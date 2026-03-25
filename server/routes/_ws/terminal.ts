import { defineWebSocketHandler } from "nitro";
import type {
	TerminalSocketClientMessage,
	TerminalSocketServerMessage,
} from "#/lib/terminal";
import {
	connectTerminal,
	restartTerminal,
	resizeTerminal,
	stopTerminal,
	subscribeToTerminalSession,
	writeTerminal,
} from "#/server/terminal-manager";

interface TerminalPeerContext {
	sessionId?: string;
	unsubscribe?: (() => void) | undefined;
}

export default defineWebSocketHandler({
	message(peer, message) {
		const payload = parseMessage(message.text());

		if (!payload) {
			sendToPeer(peer, {
				type: "error",
				message: "Invalid terminal message.",
			});
			return;
		}

		const context = peer.context as TerminalPeerContext;

		try {
			switch (payload.type) {
				case "connect": {
					context.unsubscribe?.();
					const session = connectTerminal(payload);

					context.sessionId = session.sessionId;
					context.unsubscribe = subscribeToTerminalSession(
						session.sessionId,
						(event) => {
							if (event.type === "output") {
								sendToPeer(peer, {
									type: "output",
									sessionId: event.sessionId,
									sequence: event.sequence,
									data: event.data,
								});
								return;
							}

							sendToPeer(peer, {
								type: "snapshot",
								session: event.session,
								reset: event.reset,
							});
						},
					);

					sendToPeer(peer, {
						type: "snapshot",
						session,
						reset: true,
					});
					return;
				}
				case "input": {
					if (!context.sessionId) {
						throw new Error("Terminal session is not connected.");
					}

					writeTerminal({
						sessionId: context.sessionId,
						data: payload.data,
					});
					return;
				}
				case "resize": {
					if (!context.sessionId) {
						throw new Error("Terminal session is not connected.");
					}

					resizeTerminal({
						sessionId: context.sessionId,
						cols: payload.cols,
						rows: payload.rows,
					});
					return;
				}
				case "restart": {
					if (!context.sessionId) {
						throw new Error("Terminal session is not connected.");
					}

					restartTerminal(context.sessionId);
					return;
				}
				case "stop": {
					if (!context.sessionId) {
						throw new Error("Terminal session is not connected.");
					}

					stopTerminal(context.sessionId);
					return;
				}
			}
		} catch (cause) {
			sendToPeer(peer, {
				type: "error",
				message:
					cause instanceof Error
						? cause.message
						: "Terminal socket request failed.",
			});
		}
	},
	close(peer) {
		const context = peer.context as TerminalPeerContext;
		context.unsubscribe?.();
		context.unsubscribe = undefined;
		context.sessionId = undefined;
	},
});

function parseMessage(rawMessage: string): TerminalSocketClientMessage | null {
	try {
		return JSON.parse(rawMessage) as TerminalSocketClientMessage;
	} catch {
		return null;
	}
}

function sendToPeer(peer: { send: (data: string) => void }, message: TerminalSocketServerMessage) {
	peer.send(JSON.stringify(message));
}
