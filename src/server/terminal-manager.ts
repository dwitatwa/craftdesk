import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type IPty, spawn } from "node-pty";

import type {
	ConnectTerminalInput,
	ReadTerminalInput,
	ReadTerminalResult,
	ResizeTerminalInput,
	TerminalChunk,
	TerminalSessionSnapshot,
	TerminalStatus,
	WriteTerminalInput,
} from "#/lib/terminal";
import { setProjectActiveSessions } from "#/server/db";

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const MAX_BUFFER_LENGTH = 2_000_000;
const MAX_CHUNKS = 20_000;
const DEFAULT_POLL_TIMEOUT_MS = 25_000;
const MAX_POLL_TIMEOUT_MS = 30_000;

interface Waiter {
	resolve: () => void;
	timer: ReturnType<typeof setTimeout>;
}

interface TerminalSessionRecord {
	id: string;
	scopeType: ConnectTerminalInput["scopeType"];
	scopeId: string;
	projectId: string;
	requestedCwd: string;
	resolvedCwd: string;
	shell: string;
	status: TerminalStatus;
	exitCode: number | null;
	sequence: number;
	buffer: string;
	chunks: TerminalChunk[];
	warnings: string[];
	pty: IPty | null;
	cols: number;
	rows: number;
	waiters: Waiter[];
}

const sessionsById = new Map<string, TerminalSessionRecord>();
const sessionIdByScopeKey = new Map<string, string>();

function getScopeKey(
	input: Pick<ConnectTerminalInput, "scopeType" | "scopeId">,
) {
	return `${input.scopeType}:${input.scopeId}`;
}

function resolveShell() {
	return (
		process.env.SHELL ||
		(process.platform === "win32" ? "powershell.exe" : "/bin/bash")
	);
}

function resolveShellArgs(shell: string) {
	const name = path.basename(shell).toLowerCase();

	if (name.includes("bash")) {
		return ["-il"];
	}

	if (name.includes("zsh")) {
		return ["-il"];
	}

	if (name.includes("fish")) {
		return ["-i", "-l"];
	}

	return [];
}

function resolveWorkingDirectory(requestedCwd: string) {
	const trimmed = requestedCwd.trim();
	const expandedHome =
		trimmed === "~"
			? os.homedir()
			: trimmed.startsWith("~/")
				? path.join(os.homedir(), trimmed.slice(2))
				: trimmed;

	if (expandedHome && existsSync(expandedHome)) {
		return {
			resolvedCwd: path.resolve(expandedHome),
			warnings: [] as string[],
		};
	}

	const fallback = process.cwd();
	const warnings = trimmed
		? [
				`[craftdesk] Workspace path "${trimmed}" was not found. Terminal started in ${fallback}.`,
			]
		: [
				`[craftdesk] No workspace path was configured. Terminal started in ${fallback}.`,
			];

	return {
		resolvedCwd: fallback,
		warnings,
	};
}

function appendOutput(session: TerminalSessionRecord, data: string) {
	if (!data) {
		return;
	}

	session.sequence += 1;
	session.chunks.push({
		sequence: session.sequence,
		data,
	});

	if (session.chunks.length > MAX_CHUNKS) {
		session.chunks.splice(0, session.chunks.length - MAX_CHUNKS);
	}

	session.buffer = `${session.buffer}${data}`;

	if (session.buffer.length > MAX_BUFFER_LENGTH) {
		session.buffer = session.buffer.slice(-MAX_BUFFER_LENGTH);
	}

	flushWaiters(session);
}

function flushWaiters(session: TerminalSessionRecord) {
	for (const waiter of session.waiters) {
		clearTimeout(waiter.timer);
		waiter.resolve();
	}

	session.waiters = [];
}

function serializeSession(
	session: TerminalSessionRecord,
): TerminalSessionSnapshot {
	return {
		sessionId: session.id,
		scopeType: session.scopeType,
		scopeId: session.scopeId,
		projectId: session.projectId,
		requestedCwd: session.requestedCwd,
		resolvedCwd: session.resolvedCwd,
		shell: session.shell,
		status: session.status,
		exitCode: session.exitCode,
		sequence: session.sequence,
		buffer: session.buffer,
		warnings: [...session.warnings],
	};
}

function getSessionOrThrow(sessionId: string) {
	const session = sessionsById.get(sessionId);

	if (!session) {
		throw new Error("Terminal session not found.");
	}

	return session;
}

function refreshProjectSessionCount(projectId: string) {
	let activeCount = 0;

	for (const session of sessionsById.values()) {
		if (session.projectId === projectId && session.status === "running") {
			activeCount += 1;
		}
	}

	setProjectActiveSessions(projectId, activeCount);
}

function attachPty(session: TerminalSessionRecord) {
	const shell = resolveShell();
	const { resolvedCwd, warnings } = resolveWorkingDirectory(
		session.requestedCwd,
	);
	const shellArgs = resolveShellArgs(shell);
	const pty = spawn(shell, shellArgs, {
		name: "xterm-256color",
		cwd: resolvedCwd,
		cols: session.cols,
		rows: session.rows,
		env: {
			...process.env,
			TERM: "xterm-256color",
			COLORTERM: "truecolor",
			CRAFTDESK_SCOPE: session.scopeType,
			CRAFTDESK_SCOPE_ID: session.scopeId,
			CRAFTDESK_PROJECT_ID: session.projectId,
		},
	});

	session.pty = pty;
	session.shell = shell;
	session.resolvedCwd = resolvedCwd;
	session.status = "running";
	session.exitCode = null;
	session.warnings = warnings;
	session.buffer = "";
	session.chunks = [];
	session.sequence = 0;

	for (const warning of warnings) {
		appendOutput(session, `${warning}\r\n`);
	}

	pty.onData((data) => {
		appendOutput(session, data);
	});

	pty.onExit(({ exitCode }) => {
		if (session.pty !== pty) {
			return;
		}

		session.pty = null;
		session.status = "exited";
		session.exitCode = exitCode;
		appendOutput(
			session,
			`\r\n[craftdesk] Terminal exited${typeof exitCode === "number" ? ` with code ${exitCode}` : ""}.\r\n`,
		);
		refreshProjectSessionCount(session.projectId);
	});

	refreshProjectSessionCount(session.projectId);
}

function createSession(input: ConnectTerminalInput) {
	const session: TerminalSessionRecord = {
		id: randomUUID(),
		scopeType: input.scopeType,
		scopeId: input.scopeId,
		projectId: input.projectId,
		requestedCwd: input.cwd,
		resolvedCwd: process.cwd(),
		shell: resolveShell(),
		status: "stopped",
		exitCode: null,
		sequence: 0,
		buffer: "",
		chunks: [],
		warnings: [],
		pty: null,
		cols: DEFAULT_COLS,
		rows: DEFAULT_ROWS,
		waiters: [],
	};

	attachPty(session);
	sessionsById.set(session.id, session);
	sessionIdByScopeKey.set(getScopeKey(input), session.id);
	return session;
}

export function connectTerminal(input: ConnectTerminalInput) {
	const scopeKey = getScopeKey(input);
	const existingSessionId = sessionIdByScopeKey.get(scopeKey);

	if (existingSessionId) {
		const existingSession = sessionsById.get(existingSessionId);

		if (existingSession) {
			existingSession.requestedCwd = input.cwd;
			return serializeSession(existingSession);
		}

		sessionIdByScopeKey.delete(scopeKey);
	}

	return serializeSession(createSession(input));
}

export async function readTerminal(
	input: ReadTerminalInput,
): Promise<ReadTerminalResult> {
	const session = getSessionOrThrow(input.sessionId);
	const timeoutMs = Math.min(
		Math.max(input.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS, 100),
		MAX_POLL_TIMEOUT_MS,
	);

	if (session.sequence <= input.afterSequence && session.status === "running") {
		await new Promise<void>((resolve) => {
			const waiter: Waiter = {
				resolve: () => {
					session.waiters = session.waiters.filter((item) => item !== waiter);
					resolve();
				},
				timer: setTimeout(() => {
					session.waiters = session.waiters.filter((item) => item !== waiter);
					resolve();
				}, timeoutMs),
			};
			session.waiters.push(waiter);
		});
	}

	const oldestSequence = session.chunks[0]?.sequence ?? session.sequence;
	const isLaggingBehind =
		session.chunks.length > 0 && input.afterSequence < oldestSequence - 1;

	if (isLaggingBehind) {
		return {
			sessionId: session.id,
			status: session.status,
			exitCode: session.exitCode,
			sequence: session.sequence,
			reset: true,
			buffer: session.buffer,
			chunks: [],
		};
	}

	return {
		sessionId: session.id,
		status: session.status,
		exitCode: session.exitCode,
		sequence: session.sequence,
		reset: false,
		buffer: "",
		chunks: session.chunks.filter(
			(chunk) => chunk.sequence > input.afterSequence,
		),
	};
}

export function writeTerminal(input: WriteTerminalInput) {
	const session = getSessionOrThrow(input.sessionId);

	if (session.status !== "running" || !session.pty) {
		throw new Error("Terminal is not running.");
	}

	session.pty.write(input.data);
}

export function resizeTerminal(input: ResizeTerminalInput) {
	const session = getSessionOrThrow(input.sessionId);
	session.cols = Math.max(20, input.cols);
	session.rows = Math.max(8, input.rows);

	if (session.status !== "running" || !session.pty) {
		return serializeSession(session);
	}

	session.pty.resize(session.cols, session.rows);
	return serializeSession(session);
}

export function restartTerminal(sessionId: string) {
	const session = getSessionOrThrow(sessionId);

	if (session.pty) {
		session.pty.kill();
		session.pty = null;
	}

	session.status = "stopped";
	session.exitCode = null;
	flushWaiters(session);
	attachPty(session);
	return serializeSession(session);
}

export function stopTerminal(sessionId: string) {
	const session = getSessionOrThrow(sessionId);

	if (session.pty) {
		session.pty.kill();
		session.pty = null;
	}

	session.status = "stopped";
	session.exitCode = null;
	appendOutput(session, "\r\n[craftdesk] Terminal stopped.\r\n");
	refreshProjectSessionCount(session.projectId);
	return serializeSession(session);
}
