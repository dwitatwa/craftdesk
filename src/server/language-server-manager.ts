import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import {
	createMessageConnection,
	type MessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
} from "vscode-jsonrpc/node.js";
import {
	type CompletionItem,
	CompletionRequest,
	type Definition,
	DefinitionRequest,
	type Diagnostic,
	DidChangeTextDocumentNotification,
	DidChangeWatchedFilesNotification,
	DidCloseTextDocumentNotification,
	DidOpenTextDocumentNotification,
	FileChangeType,
	type Hover,
	HoverRequest,
	InitializedNotification,
	InitializeRequest,
	type LocationLink,
	type MarkedString,
	type MarkupContent,
	type Position,
	PublishDiagnosticsNotification,
	type Range,
} from "vscode-languageserver-protocol";

import {
	getLanguageIdFromPath,
	type LanguageDocumentPositionInput,
	type LanguageDocumentSyncInput,
	type LanguageServerCompletionItem,
	type LanguageServerCompletionResponse,
	type LanguageServerDefinitionResponse,
	type LanguageServerDiagnostic,
	type LanguageServerDiagnosticsResponse,
	type LanguageServerHoverResponse,
	type LanguageServerRange,
	type SupportedLanguageId,
} from "#/lib/language-server";
import { resolveProjectPath } from "#/server/project-paths";

type ProjectFileChangeType = "changed" | "created" | "deleted";

interface LanguageDocumentRecord {
	content: string;
	diagnostics: LanguageServerDiagnostic[];
	diagnosticsVersion: number;
	isOpen: boolean;
	languageId: SupportedLanguageId;
	version: number;
}

interface DiagnosticWaiter {
	minVersion: number;
	resolve: (diagnostics: LanguageServerDiagnostic[]) => void;
	timer: ReturnType<typeof setTimeout>;
}

interface LanguageServerSession {
	connection: MessageConnection;
	diagnosticWaitersByUri: Map<string, Set<DiagnosticWaiter>>;
	documentsByUri: Map<string, LanguageDocumentRecord>;
	errorMessage: string;
	isDisposed: boolean;
	process: ChildProcessWithoutNullStreams;
	projectId: string;
	projectRoot: string;
	stderrTail: string[];
}

const runtimeRequire = createRequire(import.meta.url);
const sessionPromisesByProjectId = new Map<
	string,
	Promise<LanguageServerSession>
>();
const sessionsByProjectId = new Map<string, LanguageServerSession>();
const MAX_STDERR_LINES = 20;
const DIAGNOSTIC_TIMEOUT_MS = 450;

function getTypescriptLanguageServerEntryPath() {
	return runtimeRequire.resolve("typescript-language-server/lib/cli.mjs");
}

function createUnavailableDiagnosticsResponse(
	error: unknown,
): LanguageServerDiagnosticsResponse {
	return {
		diagnostics: [],
		error: getErrorMessage(error),
		isAvailable: false,
	};
}

function createUnavailableHoverResponse(
	error: unknown,
): LanguageServerHoverResponse {
	return {
		contents: [],
		error: getErrorMessage(error),
		isAvailable: false,
		range: null,
	};
}

function createUnavailableCompletionResponse(
	error: unknown,
): LanguageServerCompletionResponse {
	return {
		error: getErrorMessage(error),
		isAvailable: false,
		isIncomplete: false,
		items: [],
	};
}

function createUnavailableDefinitionResponse(
	error: unknown,
): LanguageServerDefinitionResponse {
	return {
		error: getErrorMessage(error),
		isAvailable: false,
		locations: [],
	};
}

function getErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Language server unavailable.";
}

function appendStderr(session: LanguageServerSession, chunk: string) {
	const nextLines = `${session.stderrTail.join("\n")}${chunk}`
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	session.stderrTail = nextLines.slice(-MAX_STDERR_LINES);
}

function createSession(projectId: string) {
	const { projectRoot } = resolveProjectPath(projectId);
	const child = spawn(
		process.execPath,
		[getTypescriptLanguageServerEntryPath(), "--stdio"],
		{
			cwd: projectRoot,
			env: {
				...process.env,
				TYPESCRIPT_LANGUAGE_SERVER_LOG_LEVEL:
					process.env.TYPESCRIPT_LANGUAGE_SERVER_LOG_LEVEL ?? "error",
			},
			stdio: ["pipe", "pipe", "pipe"],
		},
	);
	const connection = createMessageConnection(
		new StreamMessageReader(child.stdout),
		new StreamMessageWriter(child.stdin),
	);
	const session: LanguageServerSession = {
		connection,
		diagnosticWaitersByUri: new Map(),
		documentsByUri: new Map(),
		errorMessage: "",
		isDisposed: false,
		process: child,
		projectId,
		projectRoot,
		stderrTail: [],
	};

	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => {
		appendStderr(session, chunk);
	});

	child.on("error", (error) => {
		disposeSession(session, getErrorMessage(error));
	});

	child.on("exit", (code, signal) => {
		const exitDetail =
			code === 0 && !signal
				? ""
				: ` (exit code: ${code ?? "null"}, signal: ${signal ?? "none"})`;
		const stderrTail =
			session.stderrTail.length > 0 ? ` ${session.stderrTail.join(" | ")}` : "";

		disposeSession(
			session,
			`TypeScript language server exited unexpectedly${exitDetail}.${stderrTail}`.trim(),
		);
	});

	connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
		const document = session.documentsByUri.get(params.uri);

		if (!document) {
			return;
		}

		document.diagnostics = params.diagnostics.map(convertDiagnostic);
		document.diagnosticsVersion = params.version ?? document.version;
		flushDiagnosticWaiters(
			session,
			params.uri,
			document.diagnostics,
			document.diagnosticsVersion,
		);
	});

	connection.listen();

	return session;
}

async function initializeSession(session: LanguageServerSession) {
	const rootUri = pathToFileURL(session.projectRoot).toString();

	await session.connection.sendRequest(InitializeRequest.type, {
		capabilities: {
			textDocument: {
				completion: {
					completionItem: {
						documentationFormat: ["markdown", "plaintext"],
						insertReplaceSupport: true,
						snippetSupport: false,
					},
				},
				definition: {
					linkSupport: true,
				},
				hover: {
					contentFormat: ["markdown", "plaintext"],
				},
				publishDiagnostics: {
					relatedInformation: true,
					versionSupport: true,
				},
				synchronization: {
					didSave: true,
					dynamicRegistration: false,
					willSave: false,
					willSaveWaitUntil: false,
				},
			},
			workspace: {
				didChangeWatchedFiles: {
					dynamicRegistration: false,
				},
				workspaceFolders: true,
			},
		},
		clientInfo: {
			name: "craftdesk",
			version: "0.3.0",
		},
		processId: process.pid,
		rootUri,
		workspaceFolders: [
			{
				name:
					session.projectRoot.split("/").filter(Boolean).pop() ??
					session.projectRoot,
				uri: rootUri,
			},
		],
	});

	session.connection.sendNotification(InitializedNotification.type, {});
}

async function getLanguageSession(projectId: string) {
	const existingSession = sessionsByProjectId.get(projectId);

	if (existingSession && !existingSession.isDisposed) {
		return existingSession;
	}

	const existingPromise = sessionPromisesByProjectId.get(projectId);

	if (existingPromise) {
		return existingPromise;
	}

	const sessionPromise = (async () => {
		const session = createSession(projectId);

		try {
			await initializeSession(session);
			sessionsByProjectId.set(projectId, session);
			return session;
		} catch (error) {
			disposeSession(session, getErrorMessage(error));
			throw error;
		} finally {
			if (sessionPromisesByProjectId.get(projectId) === sessionPromise) {
				sessionPromisesByProjectId.delete(projectId);
			}
		}
	})();

	sessionPromisesByProjectId.set(projectId, sessionPromise);

	return sessionPromise;
}

function disposeSession(session: LanguageServerSession, errorMessage: string) {
	if (session.isDisposed) {
		return;
	}

	session.isDisposed = true;
	session.errorMessage = errorMessage;
	sessionsByProjectId.delete(session.projectId);

	for (const [uri, waiters] of session.diagnosticWaitersByUri) {
		const diagnostics = session.documentsByUri.get(uri)?.diagnostics ?? [];

		for (const waiter of waiters) {
			clearTimeout(waiter.timer);
			waiter.resolve(diagnostics);
		}
	}

	session.diagnosticWaitersByUri.clear();

	try {
		session.connection.dispose();
	} catch {}

	if (!session.process.killed) {
		session.process.kill();
	}
}

function getDocumentUri(projectId: string, relativePath: string) {
	const { absolutePath, relativePath: normalizedRelativePath } =
		resolveProjectPath(projectId, relativePath);
	const languageId = getLanguageIdFromPath(normalizedRelativePath);

	if (!languageId) {
		throw new Error(
			"Language server is only enabled for JavaScript and TypeScript files.",
		);
	}

	return {
		languageId,
		relativePath: normalizedRelativePath,
		uri: pathToFileURL(absolutePath).toString(),
	};
}

async function ensureDocumentSynced(
	session: LanguageServerSession,
	input: LanguageDocumentSyncInput,
) {
	if (session.isDisposed) {
		throw new Error(session.errorMessage || "Language server unavailable.");
	}

	const { languageId, uri } = getDocumentUri(
		input.projectId,
		input.relativePath,
	);
	const existingDocument = session.documentsByUri.get(uri);

	if (!existingDocument || !existingDocument.isOpen) {
		session.documentsByUri.set(uri, {
			content: input.content,
			diagnostics: existingDocument?.diagnostics ?? [],
			diagnosticsVersion: existingDocument?.diagnosticsVersion ?? -1,
			isOpen: true,
			languageId,
			version: input.version,
		});
		session.connection.sendNotification(DidOpenTextDocumentNotification.type, {
			textDocument: {
				languageId,
				text: input.content,
				uri,
				version: input.version,
			},
		});

		return {
			diagnosticsVersion: -1,
			uri,
		};
	}

	if (
		existingDocument.version !== input.version ||
		existingDocument.content !== input.content
	) {
		existingDocument.content = input.content;
		existingDocument.version = input.version;
		session.connection.sendNotification(
			DidChangeTextDocumentNotification.type,
			{
				contentChanges: [{ text: input.content }],
				textDocument: {
					uri,
					version: input.version,
				},
			},
		);
	}

	return {
		diagnosticsVersion: existingDocument.diagnosticsVersion,
		uri,
	};
}

function flushDiagnosticWaiters(
	session: LanguageServerSession,
	uri: string,
	diagnostics: LanguageServerDiagnostic[],
	version: number,
) {
	const waiters = session.diagnosticWaitersByUri.get(uri);

	if (!waiters || waiters.size === 0) {
		return;
	}

	for (const waiter of [...waiters]) {
		if (version < waiter.minVersion) {
			continue;
		}

		clearTimeout(waiter.timer);
		waiter.resolve(diagnostics);
		waiters.delete(waiter);
	}

	if (waiters.size === 0) {
		session.diagnosticWaitersByUri.delete(uri);
	}
}

function waitForDiagnostics(
	session: LanguageServerSession,
	uri: string,
	minVersion: number,
) {
	const document = session.documentsByUri.get(uri);

	if (document && document.diagnosticsVersion >= minVersion) {
		return Promise.resolve(document.diagnostics);
	}

	return new Promise<LanguageServerDiagnostic[]>((resolve) => {
		const waiter: DiagnosticWaiter = {
			minVersion,
			resolve: (diagnostics) => {
				resolve(diagnostics);
			},
			timer: setTimeout(() => {
				const diagnostics = session.documentsByUri.get(uri)?.diagnostics ?? [];
				session.diagnosticWaitersByUri.get(uri)?.delete(waiter);
				resolve(diagnostics);
			}, DIAGNOSTIC_TIMEOUT_MS),
		};
		const waiters = session.diagnosticWaitersByUri.get(uri) ?? new Set();
		waiters.add(waiter);
		session.diagnosticWaitersByUri.set(uri, waiters);
	});
}

function convertRange(range: Range): LanguageServerRange {
	return {
		end: {
			character: range.end.character,
			line: range.end.line,
		},
		start: {
			character: range.start.character,
			line: range.start.line,
		},
	};
}

function convertDiagnosticSeverity(
	severity?: number,
): LanguageServerDiagnostic["severity"] {
	switch (severity) {
		case 1:
			return "error";
		case 2:
			return "warning";
		case 3:
			return "information";
		case 4:
			return "hint";
		default:
			return "warning";
	}
}

function convertDiagnostic(diagnostic: Diagnostic): LanguageServerDiagnostic {
	return {
		code:
			typeof diagnostic.code === "string" || typeof diagnostic.code === "number"
				? String(diagnostic.code)
				: undefined,
		message: diagnostic.message,
		range: convertRange(diagnostic.range),
		severity: convertDiagnosticSeverity(diagnostic.severity),
		source: diagnostic.source,
	};
}

function normalizeHoverContent(content: MarkedString | MarkupContent): string {
	if (typeof content === "string") {
		return content;
	}

	if ("language" in content) {
		return `\`\`\`${content.language}\n${content.value}\n\`\`\``;
	}

	return content.value;
}

function normalizeHoverContents(hover: Hover | null): string[] {
	if (!hover) {
		return [];
	}

	if (Array.isArray(hover.contents)) {
		return hover.contents.map(normalizeHoverContent);
	}

	return [normalizeHoverContent(hover.contents)];
}

function convertCompletionItem(
	item: CompletionItem,
): LanguageServerCompletionItem {
	return {
		detail: item.detail,
		documentation:
			typeof item.documentation === "string"
				? item.documentation
				: item.documentation?.value,
		filterText: item.filterText,
		insertText:
			item.textEdit && "newText" in item.textEdit
				? item.textEdit.newText
				: item.insertText,
		kind: item.kind,
		label: item.label,
		range:
			item.textEdit && "range" in item.textEdit
				? convertRange(item.textEdit.range)
				: null,
		sortText: item.sortText,
	};
}

function normalizeDefinitionLocations(
	result: Definition | LocationLink[] | null,
) {
	if (!result) {
		return [];
	}

	const entries = Array.isArray(result) ? result : [result];

	return entries.map((entry) => {
		if ("targetUri" in entry) {
			return {
				range: convertRange(entry.targetSelectionRange),
				uri: entry.targetUri,
			};
		}

		return {
			range: convertRange(entry.range),
			uri: entry.uri,
		};
	});
}

function toProtocolPosition(
	input: LanguageDocumentPositionInput["position"],
): Position {
	return {
		character: input.character,
		line: input.line,
	};
}

export async function syncLanguageDocument(
	input: LanguageDocumentSyncInput,
): Promise<LanguageServerDiagnosticsResponse> {
	try {
		const session = await getLanguageSession(input.projectId);
		const { diagnosticsVersion, uri } = await ensureDocumentSynced(
			session,
			input,
		);
		const diagnostics = await waitForDiagnostics(
			session,
			uri,
			Math.max(input.version, diagnosticsVersion),
		);

		return {
			diagnostics,
			isAvailable: true,
		};
	} catch (error) {
		return createUnavailableDiagnosticsResponse(error);
	}
}

export async function closeLanguageDocument(input: {
	projectId: string;
	relativePath: string;
}) {
	const session = sessionsByProjectId.get(input.projectId);

	if (!session || session.isDisposed) {
		return;
	}

	try {
		const { uri } = getDocumentUri(input.projectId, input.relativePath);
		const document = session.documentsByUri.get(uri);

		if (!document?.isOpen) {
			return;
		}

		document.isOpen = false;
		session.connection.sendNotification(DidCloseTextDocumentNotification.type, {
			textDocument: { uri },
		});
	} catch {}
}

export async function getLanguageHover(
	input: LanguageDocumentPositionInput,
): Promise<LanguageServerHoverResponse> {
	try {
		const session = await getLanguageSession(input.projectId);
		const { uri } = await ensureDocumentSynced(session, input);
		const hover = await session.connection.sendRequest(HoverRequest.type, {
			position: toProtocolPosition(input.position),
			textDocument: { uri },
		});

		return {
			contents: normalizeHoverContents(hover),
			isAvailable: true,
			range: hover?.range ? convertRange(hover.range) : null,
		};
	} catch (error) {
		return createUnavailableHoverResponse(error);
	}
}

export async function getLanguageCompletions(
	input: LanguageDocumentPositionInput,
): Promise<LanguageServerCompletionResponse> {
	try {
		const session = await getLanguageSession(input.projectId);
		const { uri } = await ensureDocumentSynced(session, input);
		const completionResult = await session.connection.sendRequest(
			CompletionRequest.type,
			{
				position: toProtocolPosition(input.position),
				textDocument: { uri },
			},
		);
		const items = Array.isArray(completionResult)
			? completionResult
			: (completionResult?.items ?? []);

		return {
			isAvailable: true,
			isIncomplete: Array.isArray(completionResult)
				? false
				: (completionResult?.isIncomplete ?? false),
			items: items.map(convertCompletionItem),
		};
	} catch (error) {
		return createUnavailableCompletionResponse(error);
	}
}

export async function getLanguageDefinition(
	input: LanguageDocumentPositionInput,
): Promise<LanguageServerDefinitionResponse> {
	try {
		const session = await getLanguageSession(input.projectId);
		const { uri } = await ensureDocumentSynced(session, input);
		const definition = await session.connection.sendRequest(
			DefinitionRequest.type,
			{
				position: toProtocolPosition(input.position),
				textDocument: { uri },
			},
		);

		return {
			isAvailable: true,
			locations: normalizeDefinitionLocations(definition),
		};
	} catch (error) {
		return createUnavailableDefinitionResponse(error);
	}
}

export async function notifyProjectFileChange(input: {
	projectId: string;
	relativePath: string;
	type: ProjectFileChangeType;
}) {
	const session = sessionsByProjectId.get(input.projectId);

	if (!session || session.isDisposed) {
		return;
	}

	try {
		const { uri } = getDocumentUri(input.projectId, input.relativePath);
		const document = session.documentsByUri.get(uri);

		if (input.type === "deleted" && document?.isOpen) {
			document.isOpen = false;
			session.connection.sendNotification(
				DidCloseTextDocumentNotification.type,
				{
					textDocument: { uri },
				},
			);
		}

		if (input.type === "deleted") {
			session.documentsByUri.delete(uri);
		}

		session.connection.sendNotification(
			DidChangeWatchedFilesNotification.type,
			{
				changes: [
					{
						type:
							input.type === "created"
								? FileChangeType.Created
								: input.type === "deleted"
									? FileChangeType.Deleted
									: FileChangeType.Changed,
						uri,
					},
				],
			},
		);
	} catch {}
}
