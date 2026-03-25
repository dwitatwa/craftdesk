export type TerminalScopeType = "project" | "task";

export type TerminalStatus = "running" | "exited" | "stopped";

export interface TerminalScope {
	scopeType: TerminalScopeType;
	scopeId: string;
	projectId: string;
	cwd: string;
	terminalKey?: string;
}

export interface ConnectTerminalInput extends TerminalScope {}

export interface TerminalChunk {
	sequence: number;
	data: string;
}

export interface TerminalSessionSnapshot {
	sessionId: string;
	scopeType: TerminalScopeType;
	scopeId: string;
	projectId: string;
	terminalKey: string;
	requestedCwd: string;
	resolvedCwd: string;
	shell: string;
	status: TerminalStatus;
	exitCode: number | null;
	sequence: number;
	buffer: string;
	warnings: string[];
}

export interface ReadTerminalInput {
	sessionId: string;
	afterSequence: number;
	timeoutMs?: number;
}

export interface ReadTerminalResult {
	sessionId: string;
	status: TerminalStatus;
	exitCode: number | null;
	sequence: number;
	reset: boolean;
	buffer: string;
	chunks: TerminalChunk[];
}

export interface WriteTerminalInput {
	sessionId: string;
	data: string;
}

export interface ResizeTerminalInput {
	sessionId: string;
	cols: number;
	rows: number;
}

export interface RestartTerminalInput {
	sessionId: string;
}

export interface StopTerminalInput {
	sessionId: string;
}

export interface StopScopeTerminalInput {
	scopeType: TerminalScopeType;
	scopeId: string;
}
