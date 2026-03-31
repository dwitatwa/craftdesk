import { useEffect, useRef, useState } from "react";
import type {
	TerminalScope,
	TerminalSessionSnapshot,
	TerminalSocketServerMessage,
} from "#/lib/terminal";
import { getTerminalSession, stopTerminal } from "#/server/terminal";

type XTermInstance = {
	open: (element: HTMLElement) => void;
	write: (data: string) => void;
	reset: () => void;
	focus: () => void;
	dispose: () => void;
	loadAddon: (addon: unknown) => void;
	onData: (callback: (data: string) => void) => { dispose: () => void };
	readonly cols: number;
	readonly rows: number;
};

type FitAddonInstance = {
	fit: () => void;
};

export interface TerminalViewState {
	session: TerminalSessionSnapshot | null;
	error: string | null;
	isConnecting: boolean;
}

type Listener = () => void;

const TERMINAL_SOCKET_PATH = "/_ws/terminal";
const PARKING_LOT_ID = "craftdesk-terminal-parking-lot";
const DEFAULT_TERMINAL_KEY = "default";
const INITIAL_VIEW_STATE: TerminalViewState = {
	session: null,
	error: null,
	isConnecting: false,
};

const terminalControllers = new Map<string, TerminalController>();

export function getPersistentTerminalController(scope: TerminalScope) {
	const scopeKey = getScopeKey(scope);
	const existingController = terminalControllers.get(scopeKey);

	if (existingController) {
		existingController.updateScope(scope);
		return existingController;
	}

	const controller = new TerminalController(scope);
	terminalControllers.set(scopeKey, controller);
	return controller;
}

export async function disposePersistentTerminalController(
	scope: TerminalScope,
	options?: { stop?: boolean },
) {
	const scopeKey = getScopeKey(scope);
	const controller = terminalControllers.get(scopeKey);

	if (!controller) {
		return;
	}

	terminalControllers.delete(scopeKey);
	await controller.dispose(options);
}

export function useTerminalController(scope: TerminalScope) {
	const controllerRef = useRef<TerminalController | null>(null);
	const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
	const { cwd, projectId, scopeId, scopeType, terminalKey } = scope;

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const controller = getPersistentTerminalController({
			cwd,
			projectId,
			scopeId,
			scopeType,
			terminalKey,
		});
		controllerRef.current = controller;
		setViewState(controller.getState());

		const unsubscribe = controller.subscribe(() => {
			setViewState({ ...controller.getState() });
		});

		return () => {
			unsubscribe();

			if (controllerRef.current === controller) {
				controllerRef.current = null;
			}
		};
	}, [cwd, projectId, scopeId, scopeType, terminalKey]);

	return {
		controller: controllerRef.current,
		viewState,
	};
}

class TerminalController {
	private scope: TerminalScope;
	private readonly listeners = new Set<Listener>();
	private readonly viewState: TerminalViewState = { ...INITIAL_VIEW_STATE };
	private hostElement: HTMLDivElement | null = null;
	private mountElement: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private terminal: XTermInstance | null = null;
	private fitAddon: FitAddonInstance | null = null;
	private socket: WebSocket | null = null;
	private socketReadyPromise: Promise<void> | null = null;
	private setupPromise: Promise<void> | null = null;
	private resumePromise: Promise<void> | null = null;
	private sessionId: string | null = null;
	private suppressedInputDepth = 0;
	private isDisposed = false;
	private hasCheckedExistingSession = false;

	constructor(scope: TerminalScope) {
		this.scope = scope;
	}

	updateScope(scope: TerminalScope) {
		this.scope = scope;
	}

	getState() {
		return this.viewState;
	}

	subscribe(listener: Listener) {
		if (this.isDisposed) {
			return () => {};
		}

		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	attach(mountElement: HTMLElement, options?: { autoStart?: boolean }) {
		if (this.isDisposed) {
			return;
		}

		this.mountElement = mountElement;
		this.mountHostElement();
		this.observeResize();

		if (options?.autoStart) {
			void this.start();
			return;
		}

		void this.resumeExistingSession();
	}

	detach(mountElement: HTMLElement) {
		if (this.mountElement !== mountElement) {
			return;
		}

		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.mountElement = null;

		const hostElement = this.hostElement;

		if (hostElement && hostElement.parentElement !== getParkingLot()) {
			getParkingLot().appendChild(hostElement);
		}
	}

	async start() {
		if (this.viewState.session && this.viewState.session.status !== "running") {
			await this.restart();
			return;
		}

		await this.ensureConnected();

		if (this.isDisposed) {
			return;
		}

		this.focus();
		void this.resizeToFit();
	}

	async restart() {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			await this.ensureConnected();
		}

		if (this.isDisposed) {
			return;
		}

		this.setConnecting(true);
		this.setError(null);
		this.sendMessage({ type: "restart" });
	}

	async stop() {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}

		this.setConnecting(true);
		this.setError(null);
		this.sendMessage({ type: "stop" });
	}

	focus() {
		if (this.mountElement && !this.isDisposed) {
			this.terminal?.focus();
		}
	}

	async dispose(options?: { stop?: boolean }) {
		this.isDisposed = true;
		const currentSessionId = this.sessionId;
		this.setupPromise = null;
		this.socketReadyPromise = null;
		this.sessionId = null;

		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.mountElement = null;

		const socket = this.socket;
		this.socket = null;
		socket?.close();

		const hostElement = this.hostElement;
		if (hostElement?.parentElement) {
			hostElement.parentElement.removeChild(hostElement);
		}
		this.hostElement = null;

		this.fitAddon = null;
		this.terminal?.dispose();
		this.terminal = null;

		if (options?.stop && currentSessionId) {
			try {
				await stopTerminal({
					data: { sessionId: currentSessionId },
				});
			} catch {
				// Ignore shutdown errors for tabs that are being removed.
			}
		}

		this.viewState.session = null;
		this.viewState.error = null;
		this.viewState.isConnecting = false;
		this.listeners.clear();
	}

	private notify() {
		for (const listener of this.listeners) {
			listener();
		}
	}

	private setSession(session: TerminalSessionSnapshot | null) {
		this.viewState.session = session;
		this.notify();
	}

	private setError(error: string | null) {
		this.viewState.error = error;
		this.notify();
	}

	private setConnecting(isConnecting: boolean) {
		this.viewState.isConnecting = isConnecting;
		this.notify();
	}

	private ensureHostElement() {
		if (!this.hostElement) {
			const hostElement = document.createElement("div");
			hostElement.className = "h-full w-full cursor-text";
			this.hostElement = hostElement;
		}

		return this.hostElement;
	}

	private mountHostElement() {
		if (!this.mountElement) {
			return;
		}

		const hostElement = this.ensureHostElement();

		if (hostElement.parentElement !== this.mountElement) {
			this.mountElement.replaceChildren(hostElement);
		}
	}

	private observeResize() {
		if (!this.mountElement) {
			return;
		}

		this.resizeObserver?.disconnect();
		this.resizeObserver = new ResizeObserver(() => {
			void this.resizeToFit().catch((cause) => {
				this.setError(getErrorMessage(cause));
			});
		});
		this.resizeObserver.observe(this.mountElement);
	}

	private async ensureConnected() {
		if (this.isDisposed) {
			return;
		}

		if (this.setupPromise) {
			return this.setupPromise;
		}

		this.setupPromise = this.connect();
		return this.setupPromise;
	}

	private async resumeExistingSession() {
		if (
			this.isDisposed ||
			this.hasCheckedExistingSession ||
			this.resumePromise ||
			this.viewState.session ||
			this.setupPromise
		) {
			return this.resumePromise;
		}

		this.resumePromise = this.loadExistingSession();
		return this.resumePromise;
	}

	private async loadExistingSession() {
		this.hasCheckedExistingSession = true;

		try {
			const existingSession = await getTerminalSession({
				data: {
					scopeType: this.scope.scopeType,
					scopeId: this.scope.scopeId,
					terminalKey: this.scope.terminalKey,
				},
			});

			if (!existingSession || this.isDisposed) {
				return;
			}

			await this.ensureTerminal();
			this.syncSnapshot(existingSession, { reset: true });
			await this.ensureConnected();

			if (this.isDisposed) {
				return;
			}

			void this.resizeToFit();
		} catch (cause) {
			if (!this.isDisposed) {
				this.setError(getErrorMessage(cause));
			}
		} finally {
			this.resumePromise = null;
		}
	}

	private async connect() {
		this.setConnecting(true);
		this.setError(null);

		try {
			await this.ensureTerminal();
			await this.ensureSocket();

			if (this.isDisposed) {
				return;
			}

			this.sendMessage({
				type: "connect",
				scopeType: this.scope.scopeType,
				scopeId: this.scope.scopeId,
				projectId: this.scope.projectId,
				cwd: this.scope.cwd,
				terminalKey: this.scope.terminalKey,
			});
			void this.resizeToFit();
		} catch (cause) {
			this.setupPromise = null;

			if (this.isDisposed) {
				return;
			}

			this.setConnecting(false);
			this.setError(getErrorMessage(cause));
			throw cause;
		}
	}

	private async ensureTerminal() {
		if (this.terminal) {
			return;
		}

		const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] =
			await Promise.all([
				import("@xterm/xterm"),
				import("@xterm/addon-fit"),
				import("@xterm/addon-web-links"),
			]);

		if (this.isDisposed) {
			return;
		}

		const hostElement = this.ensureHostElement();

		if (!hostElement.isConnected) {
			(this.mountElement ?? getParkingLot()).appendChild(hostElement);
		}

		const terminal = new XTerm({
			allowTransparency: true,
			cursorBlink: true,
			cursorStyle: "bar",
			fontFamily:
				'"JetBrains Mono", "SFMono-Regular", "Cascadia Code", "Menlo", monospace',
			fontSize: 13,
			lineHeight: 1.35,
			scrollback: 20000,
			theme: {
				background: "#09090b",
				foreground: "#f4f4f5",
				cursor: "#fafafa",
				selectionBackground: "rgba(96, 165, 250, 0.28)",
				black: "#09090b",
				red: "#f87171",
				green: "#4ade80",
				yellow: "#facc15",
				blue: "#60a5fa",
				magenta: "#c084fc",
				cyan: "#22d3ee",
				white: "#fafafa",
				brightBlack: "#52525b",
				brightRed: "#fca5a5",
				brightGreen: "#86efac",
				brightYellow: "#fde047",
				brightBlue: "#93c5fd",
				brightMagenta: "#d8b4fe",
				brightCyan: "#67e8f9",
				brightWhite: "#ffffff",
			},
		});
		const fitAddon = new FitAddon();

		terminal.loadAddon(fitAddon);
		terminal.loadAddon(new WebLinksAddon());
		terminal.open(hostElement);
		terminal.onData((data) => {
			if (this.suppressedInputDepth > 0) {
				return;
			}

			if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
				return;
			}

			this.sendMessage({
				type: "input",
				data,
			});
		});

		this.terminal = terminal as XTermInstance;
		this.fitAddon = fitAddon as FitAddonInstance;
		this.focus();
		this.fitTerminal();
	}

	private async ensureSocket() {
		if (this.socket?.readyState === WebSocket.OPEN) {
			return;
		}

		if (this.socketReadyPromise) {
			return this.socketReadyPromise;
		}

		this.socketReadyPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(resolveTerminalSocketUrl());
			let isSettled = false;

			const settle = (callback: () => void) => {
				if (isSettled) {
					return;
				}

				isSettled = true;
				callback();
			};

			socket.addEventListener("open", () => {
				settle(() => {
					this.socket = socket;
					this.socketReadyPromise = null;
					resolve();
				});
			});

			socket.addEventListener("message", (event) => {
				this.handleSocketMessage(event);
			});

			socket.addEventListener("close", () => {
				if (this.socket === socket) {
					this.socket = null;
				}

				this.socketReadyPromise = null;
				this.setupPromise = null;

				if (!this.isDisposed) {
					this.setConnecting(false);
				}

				settle(() => {
					reject(new Error("Terminal connection closed before it was ready."));
				});
			});

			socket.addEventListener("error", () => {
				if (!this.isDisposed) {
					this.setError("Terminal connection failed.");
				}

				settle(() => {
					reject(new Error("Terminal connection failed."));
				});
			});
		});

		return this.socketReadyPromise;
	}

	private handleSocketMessage(event: MessageEvent) {
		const message = parseServerMessage(event.data);

		if (!message) {
			this.setError("Terminal sent an invalid response.");
			this.setConnecting(false);
			return;
		}

		switch (message.type) {
			case "snapshot": {
				this.sessionId = message.session.sessionId;
				this.setupPromise = null;
				this.setConnecting(false);
				this.syncSnapshot(message.session, { reset: message.reset });
				return;
			}
			case "output": {
				if (this.sessionId && message.sessionId !== this.sessionId) {
					return;
				}

				this.terminal?.write(message.data);
				if (this.viewState.session) {
					this.viewState.session.sequence = message.sequence;
				}
				return;
			}
			case "error": {
				this.setupPromise = null;
				this.setConnecting(false);
				this.setError(message.message);
			}
		}
	}

	private syncSnapshot(
		nextSnapshot: TerminalSessionSnapshot,
		options?: { reset?: boolean },
	) {
		if (this.isDisposed) {
			return;
		}

		this.sessionId = nextSnapshot.sessionId;
		this.setSession(nextSnapshot);

		if (!this.terminal) {
			return;
		}

		if (options?.reset) {
			this.withInputSuppressed(() => {
				this.terminal?.reset();
				if (nextSnapshot.buffer) {
					this.terminal?.write(nextSnapshot.buffer);
				}
			});
		}
	}

	private withInputSuppressed(callback: () => void) {
		this.suppressedInputDepth += 1;

		try {
			callback();
		} finally {
			this.suppressedInputDepth = Math.max(0, this.suppressedInputDepth - 1);
		}
	}

	private fitTerminal() {
		if (!this.terminal || !this.fitAddon) {
			return null;
		}

		this.fitAddon.fit();
		return {
			cols: this.terminal.cols,
			rows: this.terminal.rows,
		};
	}

	private async resizeToFit() {
		const size = this.fitTerminal();

		if (!size || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}

		this.sendMessage({
			type: "resize",
			cols: size.cols,
			rows: size.rows,
		});
	}

	private sendMessage(message: object) {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}

		this.socket.send(JSON.stringify(message));
	}
}

function parseServerMessage(data: unknown): TerminalSocketServerMessage | null {
	if (typeof data !== "string") {
		return null;
	}

	try {
		return JSON.parse(data) as TerminalSocketServerMessage;
	} catch {
		return null;
	}
}

function getScopeKey(
	scope: Pick<TerminalScope, "scopeType" | "scopeId" | "terminalKey">,
) {
	return `${scope.scopeType}:${scope.scopeId}:${scope.terminalKey?.trim() || DEFAULT_TERMINAL_KEY}`;
}

function getParkingLot() {
	let parkingLot = document.getElementById(PARKING_LOT_ID);

	if (parkingLot) {
		return parkingLot;
	}

	parkingLot = document.createElement("div");
	parkingLot.id = PARKING_LOT_ID;
	parkingLot.setAttribute("aria-hidden", "true");
	parkingLot.style.position = "fixed";
	parkingLot.style.left = "-10000px";
	parkingLot.style.top = "0";
	parkingLot.style.width = "1px";
	parkingLot.style.height = "1px";
	parkingLot.style.overflow = "hidden";
	parkingLot.style.pointerEvents = "none";
	document.body.appendChild(parkingLot);
	return parkingLot;
}

function resolveTerminalSocketUrl() {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${TERMINAL_SOCKET_PATH}`;
}

function getErrorMessage(cause: unknown) {
	return cause instanceof Error ? cause.message : "Terminal request failed.";
}
