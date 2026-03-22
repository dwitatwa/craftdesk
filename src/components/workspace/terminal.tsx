import {
	LoaderCircle,
	Maximize2,
	Minus,
	RotateCcw,
	Square,
	Terminal as TerminalIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import type { TerminalScope, TerminalSessionSnapshot } from "#/lib/terminal";
import { cn } from "#/lib/utils";
import {
	connectTerminal,
	readTerminal,
	resizeTerminal,
	restartTerminal,
	stopTerminal,
	writeTerminal,
} from "#/server/terminal";

interface TerminalProps {
	className?: string;
	title?: string;
	headerHeight?: string;
	isCollapsed?: boolean;
	onToggleCollapse?: () => void;
	scope: TerminalScope;
}

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

const STOPPED_POLL_DELAY_MS = 800;

export function Terminal({
	className,
	title = "Active Terminal",
	headerHeight = "h-14",
	isCollapsed = false,
	onToggleCollapse,
	scope,
}: TerminalProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const terminalRef = useRef<XTermInstance | null>(null);
	const fitAddonRef = useRef<FitAddonInstance | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const sequenceRef = useRef(0);
	const [session, setSession] = useState<TerminalSessionSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || isCollapsed) {
			return;
		}

		let cancelled = false;
		let resizeObserver: ResizeObserver | null = null;
		let inputSubscription: { dispose: () => void } | null = null;

		const teardown = () => {
			resizeObserver?.disconnect();
			inputSubscription?.dispose();
			terminalRef.current?.dispose();
			terminalRef.current = null;
			fitAddonRef.current = null;
		};

		const syncSnapshot = (
			nextSnapshot: TerminalSessionSnapshot,
			options?: { resetViewport?: boolean },
		) => {
			sessionIdRef.current = nextSnapshot.sessionId;
			sequenceRef.current = nextSnapshot.sequence;
			setSession(nextSnapshot);

			const terminal = terminalRef.current;

			if (!terminal) {
				return;
			}

			if (options?.resetViewport) {
				terminal.reset();
			}

			if (nextSnapshot.buffer) {
				terminal.write(nextSnapshot.buffer);
			}
		};

		const pushResize = async () => {
			const terminal = terminalRef.current;
			const fitAddon = fitAddonRef.current;
			const currentSessionId = sessionIdRef.current;

			if (!terminal || !fitAddon || !currentSessionId) {
				return;
			}

			fitAddon.fit();
			await resizeTerminal({
				data: {
					sessionId: currentSessionId,
					cols: terminal.cols,
					rows: terminal.rows,
				},
			});
		};

		const start = async () => {
			setIsConnecting(true);
			setError(null);

			const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] =
				await Promise.all([
					import("@xterm/xterm"),
					import("@xterm/addon-fit"),
					import("@xterm/addon-web-links"),
				]);

			if (cancelled || !hostRef.current) {
				return;
			}

			const terminal = new XTerm({
				allowTransparency: true,
				cursorBlink: true,
				cursorStyle: "bar",
				fontFamily:
					'"JetBrains Mono", "SFMono-Regular", "Cascadia Code", "Menlo", monospace',
				fontSize: 13,
				lineHeight: 1.35,
				scrollback: 5_000,
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
			terminal.open(hostRef.current);
			terminal.focus();

			terminalRef.current = terminal as XTermInstance;
			fitAddonRef.current = fitAddon as FitAddonInstance;

			const snapshot = await connectTerminal({
				data: {
					scopeType: scope.scopeType,
					scopeId: scope.scopeId,
					projectId: scope.projectId,
					cwd: scope.cwd,
				},
			});

			if (cancelled) {
				return;
			}

			syncSnapshot(snapshot, { resetViewport: true });
			await pushResize();
			setIsConnecting(false);

			inputSubscription = terminal.onData((data) => {
				const currentSessionId = sessionIdRef.current;

				if (!currentSessionId) {
					return;
				}

				void writeTerminal({
					data: {
						sessionId: currentSessionId,
						data,
					},
				}).catch((cause) => {
					setError(getErrorMessage(cause));
				});
			});

			resizeObserver = new ResizeObserver(() => {
				void pushResize().catch((cause) => {
					setError(getErrorMessage(cause));
				});
			});
			resizeObserver.observe(hostRef.current);

			while (!cancelled && sessionIdRef.current) {
				try {
					const result = await readTerminal({
						data: {
							sessionId: sessionIdRef.current,
							afterSequence: sequenceRef.current,
							timeoutMs: 25_000,
						},
					});

					if (cancelled) {
						return;
					}

					const activeTerminal = terminalRef.current;

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

					sequenceRef.current = result.sequence;
					setSession((currentSession) =>
						currentSession
							? {
									...currentSession,
									status: result.status,
									exitCode: result.exitCode,
									sequence: result.sequence,
									buffer: result.reset ? result.buffer : currentSession.buffer,
								}
							: currentSession,
					);

					if (result.status !== "running") {
						await sleep(STOPPED_POLL_DELAY_MS);
					}
				} catch (cause) {
					setError(getErrorMessage(cause));
					await sleep(STOPPED_POLL_DELAY_MS);
				}
			}
		};

		void start().catch((cause) => {
			setIsConnecting(false);
			setError(getErrorMessage(cause));
		});

		return () => {
			cancelled = true;
			teardown();
		};
	}, [isCollapsed, scope.cwd, scope.projectId, scope.scopeId, scope.scopeType]);

	const handleRestart = async () => {
		if (!sessionIdRef.current) {
			return;
		}

		setError(null);

		try {
			const snapshot = await restartTerminal({
				data: {
					sessionId: sessionIdRef.current,
				},
			});
			syncFromAction(snapshot);
		} catch (cause) {
			setError(getErrorMessage(cause));
		}
	};

	const handleStop = async () => {
		if (!sessionIdRef.current) {
			return;
		}

		setError(null);

		try {
			const snapshot = await stopTerminal({
				data: {
					sessionId: sessionIdRef.current,
				},
			});
			syncFromAction(snapshot);
		} catch (cause) {
			setError(getErrorMessage(cause));
		}
	};

	const syncFromAction = (snapshot: TerminalSessionSnapshot) => {
		sessionIdRef.current = snapshot.sessionId;
		sequenceRef.current = snapshot.sequence;
		setSession(snapshot);
		terminalRef.current?.reset();

		if (snapshot.buffer) {
			terminalRef.current?.write(snapshot.buffer);
		}
	};

	const statusLabel = session?.status ?? (isConnecting ? "connecting" : "idle");
	const scopeLabel = scope.scopeType === "task" ? "task" : "project";

	return (
		<div className={cn("flex flex-col bg-[#09090B]", className)}>
			<div
				className={cn(
					"flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02]",
					headerHeight,
				)}
			>
				<div className="flex items-center gap-3 min-w-0">
					<TerminalIcon className="size-3.5 text-primary shrink-0" />
					<div className="flex items-center gap-2 min-w-0">
						<span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest truncate">
							{title}
						</span>
						<span className="text-[10px] font-mono text-green-500/80 bg-green-500/5 px-1.5 rounded border border-green-500/10 uppercase">
							{scopeLabel}
						</span>
						<span
							className={cn(
								"text-[10px] font-mono px-1.5 rounded border uppercase",
								session?.status === "running"
									? "text-green-400 bg-green-500/5 border-green-500/10"
									: session?.status === "exited"
										? "text-amber-300 bg-amber-500/5 border-amber-500/10"
										: "text-zinc-400 bg-white/5 border-white/10",
							)}
						>
							{statusLabel}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{onToggleCollapse && (
						<Button
							variant="ghost"
							size="icon"
							className="size-7 text-muted-foreground hover:text-foreground"
							onClick={onToggleCollapse}
						>
							{isCollapsed ? (
								<Maximize2 className="size-3.5" />
							) : (
								<Minus className="size-3.5" />
							)}
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-foreground"
						onClick={() => {
							void handleRestart();
						}}
						disabled={isConnecting}
					>
						<RotateCcw className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-red-400"
						onClick={() => {
							void handleStop();
						}}
						disabled={!sessionIdRef.current || session?.status !== "running"}
					>
						<Square className="size-3.5" />
					</Button>
				</div>
			</div>

			{!isCollapsed && (
				<>
					<div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-black/20 text-[10px] font-mono text-zinc-400 uppercase tracking-[0.18em]">
						<span className="truncate">
							{session?.resolvedCwd ?? scope.cwd ?? "Resolving workspace"}
						</span>
						{session?.shell && (
							<span className="text-zinc-500 truncate">{session.shell}</span>
						)}
						{session?.exitCode !== null && session?.status === "exited" && (
							<span className="text-amber-300">exit {session.exitCode}</span>
						)}
					</div>

					<div className="relative flex-1 min-h-0 terminal-surface">
						<div ref={hostRef} className="h-full w-full cursor-text" />

						{(isConnecting || error || session?.warnings.length) && (
							<div className="absolute right-4 top-4 z-10 flex max-w-[min(32rem,calc(100%-2rem))] flex-col gap-2">
								{isConnecting && (
									<div className="rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs font-mono text-zinc-300 shadow-lg backdrop-blur-sm">
										<span className="inline-flex items-center gap-2">
											<LoaderCircle className="size-3 animate-spin" />
											Connecting terminal...
										</span>
									</div>
								)}
								{session?.warnings.map((warning) => (
									<div
										key={warning}
										className="rounded-lg border border-amber-400/15 bg-amber-400/10 px-3 py-2 text-xs font-mono text-amber-100 shadow-lg backdrop-blur-sm"
									>
										{warning}
									</div>
								))}
								{error && (
									<div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-mono text-red-100 shadow-lg backdrop-blur-sm">
										{error}
									</div>
								)}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}

function getErrorMessage(cause: unknown) {
	return cause instanceof Error ? cause.message : "Terminal request failed.";
}

function sleep(durationMs: number) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, durationMs);
	});
}
