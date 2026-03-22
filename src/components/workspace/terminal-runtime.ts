import type { TerminalScope, TerminalSessionSnapshot } from "#/lib/terminal";
import {
	connectTerminal,
	readTerminal,
	resizeTerminal,
	restartTerminal,
	stopTerminal,
	writeTerminal,
} from "#/server/terminal";

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

const STOPPED_POLL_DELAY_MS = 800;
const PARKING_LOT_ID = "craftdesk-terminal-parking-lot";

const terminalControllers = new Map<string, PersistentTerminalController>();

export function getPersistentTerminalController(scope: TerminalScope) {
	const scopeKey = getScopeKey(scope);
	const existingController = terminalControllers.get(scopeKey);

	if (existingController) {
		existingController.updateScope(scope);
		return existingController;
	}

	const controller = new PersistentTerminalController(scope);
	terminalControllers.set(scopeKey, controller);
	return controller;
}

class PersistentTerminalController {
	private scope: TerminalScope;
	private readonly listeners = new Set<Listener>();
	private readonly viewState: TerminalViewState = {
		session: null,
		error: null,
		isConnecting: false,
	};
	private hostElement: HTMLDivElement | null = null;
	private mountElement: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private terminal: XTermInstance | null = null;
	private fitAddon: FitAddonInstance | null = null;
	private startupPromise: Promise<void> | null = null;
	private sessionId: string | null = null;
	private sequence = 0;

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
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	attach(mountElement: HTMLElement) {
		this.mountElement = mountElement;
		this.mountHostElement();
		this.observeResize();
		void this.ensureStarted()
			.then(() => {
				this.focus();
				return this.resizeToFit();
			})
			.catch(() => {
				// Error state is already managed inside the controller startup flow.
			});
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

	async restart() {
		if (!this.sessionId) {
			return;
		}

		this.setError(null);

		try {
			const snapshot = await restartTerminal({
				data: { sessionId: this.sessionId },
			});
			this.syncSnapshot(snapshot, { resetViewport: true });
			await this.resizeToFit();
		} catch (cause) {
			this.setError(getErrorMessage(cause));
		}
	}

	async stop() {
		if (!this.sessionId) {
			return;
		}

		this.setError(null);

		try {
			const snapshot = await stopTerminal({
				data: { sessionId: this.sessionId },
			});
			this.syncSnapshot(snapshot, { resetViewport: true });
		} catch (cause) {
			this.setError(getErrorMessage(cause));
		}
	}

	focus() {
		if (this.mountElement) {
			this.terminal?.focus();
		}
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

	private async ensureStarted() {
		if (this.terminal) {
			return;
		}

		if (this.startupPromise) {
			return this.startupPromise;
		}

		this.startupPromise = this.start();
		return this.startupPromise;
	}

	private async start() {
		this.setConnecting(true);
		this.setError(null);

		try {
			const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] =
				await Promise.all([
					import("@xterm/xterm"),
					import("@xterm/addon-fit"),
					import("@xterm/addon-web-links"),
				]);

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

			this.terminal = terminal as XTermInstance;
			this.fitAddon = fitAddon as FitAddonInstance;
			this.focus();
			this.fitTerminal();

			const snapshot = await connectTerminal({
				data: {
					scopeType: this.scope.scopeType,
					scopeId: this.scope.scopeId,
					projectId: this.scope.projectId,
					cwd: this.scope.cwd,
				},
			});

			const resizedSnapshot = await this.pushResize(snapshot.sessionId);
			this.syncSnapshot(resizedSnapshot ?? snapshot, { resetViewport: true });
			this.setConnecting(false);

			terminal.onData((data) => {
				const currentSessionId = this.sessionId;

				if (!currentSessionId) {
					return;
				}

				void writeTerminal({
					data: {
						sessionId: currentSessionId,
						data,
					},
				}).catch((cause) => {
					this.setError(getErrorMessage(cause));
				});
			});

			void this.readLoop();
		} catch (cause) {
			this.startupPromise = null;
			this.setConnecting(false);
			this.setError(getErrorMessage(cause));
			throw cause;
		}
	}

	private async readLoop() {
		while (this.sessionId) {
			try {
				const result = await readTerminal({
					data: {
						sessionId: this.sessionId,
						afterSequence: this.sequence,
						timeoutMs: 25_000,
					},
				});

				const activeTerminal = this.terminal;

				if (result.reset) {
					activeTerminal?.reset();
					if (result.buffer) {
						activeTerminal?.write(result.buffer);
					}
				} else {
					for (const chunk of result.chunks) {
						activeTerminal?.write(chunk.data);
					}
				}

				this.sequence = result.sequence;
				if (this.viewState.session) {
					this.setSession({
						...this.viewState.session,
						status: result.status,
						exitCode: result.exitCode,
						sequence: result.sequence,
						buffer: result.reset
							? result.buffer
							: this.viewState.session.buffer,
					});
				}

				if (result.status !== "running") {
					await sleep(STOPPED_POLL_DELAY_MS);
				}
			} catch (cause) {
				this.setError(getErrorMessage(cause));
				await sleep(STOPPED_POLL_DELAY_MS);
			}
		}
	}

	private syncSnapshot(
		nextSnapshot: TerminalSessionSnapshot,
		options?: { resetViewport?: boolean },
	) {
		this.sessionId = nextSnapshot.sessionId;
		this.sequence = nextSnapshot.sequence;
		this.setSession(nextSnapshot);

		if (!this.terminal) {
			return;
		}

		if (options?.resetViewport) {
			this.terminal.reset();
		}

		if (nextSnapshot.buffer) {
			this.terminal.write(nextSnapshot.buffer);
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
		const snapshot = await this.pushResize();

		if (snapshot && this.viewState.session) {
			this.setSession({
				...this.viewState.session,
				resolvedCwd: snapshot.resolvedCwd,
				requestedCwd: snapshot.requestedCwd,
				shell: snapshot.shell,
				status: snapshot.status,
				exitCode: snapshot.exitCode,
				sequence: snapshot.sequence,
				warnings: snapshot.warnings,
			});
		}
	}

	private async pushResize(sessionIdOverride?: string) {
		const size = this.fitTerminal();
		const currentSessionId = sessionIdOverride ?? this.sessionId;

		if (!size || !currentSessionId) {
			return null;
		}

		return resizeTerminal({
			data: {
				sessionId: currentSessionId,
				cols: size.cols,
				rows: size.rows,
			},
		});
	}
}

function getScopeKey(scope: Pick<TerminalScope, "scopeType" | "scopeId">) {
	return `${scope.scopeType}:${scope.scopeId}`;
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

function getErrorMessage(cause: unknown) {
	return cause instanceof Error ? cause.message : "Terminal request failed.";
}

function sleep(durationMs: number) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, durationMs);
	});
}
