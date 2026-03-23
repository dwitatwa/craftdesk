import { createServerFn } from "@tanstack/react-start";

import type {
	ConnectTerminalInput,
	ReadTerminalInput,
	ResizeTerminalInput,
	RestartTerminalInput,
	StopScopeTerminalInput,
	StopTerminalInput,
	WriteTerminalInput,
} from "#/lib/terminal";

export const connectTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: ConnectTerminalInput) => input)
	.handler(async ({ data }) => {
		const { connectTerminal: connectScopedTerminal } = await import(
			"#/server/terminal-manager"
		);
		return connectScopedTerminal(data);
	});

export const readTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: ReadTerminalInput) => input)
	.handler(async ({ data }) => {
		const { readTerminal: readScopedTerminal } = await import(
			"#/server/terminal-manager"
		);
		return readScopedTerminal(data);
	});

export const writeTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: WriteTerminalInput) => input)
	.handler(async ({ data }) => {
		const { writeTerminal: writeToTerminal } = await import(
			"#/server/terminal-manager"
		);
		return writeToTerminal(data);
	});

export const resizeTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: ResizeTerminalInput) => input)
	.handler(async ({ data }) => {
		const { resizeTerminal: resizeScopedTerminal } = await import(
			"#/server/terminal-manager"
		);
		return resizeScopedTerminal(data);
	});

export const restartTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: RestartTerminalInput) => input)
	.handler(async ({ data }) => {
		const { restartTerminal: restartScopedTerminal } = await import(
			"#/server/terminal-manager"
		);
		return restartScopedTerminal(data.sessionId);
	});

export const stopTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: StopTerminalInput) => input)
	.handler(async ({ data }) => {
		const { stopTerminal: stopScopedTerminal } = await import(
			"#/server/terminal-manager"
		);
		return stopScopedTerminal(data.sessionId);
	});

export const stopScopeTerminal = createServerFn({ method: "POST" })
	.inputValidator((input: StopScopeTerminalInput) => input)
	.handler(async ({ data }) => {
		const { stopScopeTerminal: stopScopedTerminal } = await import(
			"#/server/terminal-manager"
		);
		return stopScopedTerminal(data);
	});
