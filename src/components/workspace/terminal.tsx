import {
	LoaderCircle,
	Maximize2,
	Minus,
	Play,
	RotateCcw,
	Square,
	Terminal as TerminalIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import type { TerminalScope } from "#/lib/terminal";
import { cn } from "#/lib/utils";
import {
	getPersistentTerminalController,
	type TerminalViewState,
} from "./terminal-runtime";

interface TerminalProps {
	className?: string;
	collapseTrigger?: "button" | "header";
	title?: string;
	headerHeight?: string;
	isCollapsed?: boolean;
	onToggleCollapse?: () => void;
	autoStart?: boolean;
	scope: TerminalScope;
}

const INITIAL_VIEW_STATE: TerminalViewState = {
	session: null,
	error: null,
	isConnecting: false,
};

export function Terminal({
	className,
	collapseTrigger = "button",
	title = "Active Terminal",
	headerHeight = "h-14",
	isCollapsed = false,
	onToggleCollapse,
	autoStart = true,
	scope,
}: TerminalProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const controllerRef = useRef<ReturnType<
		typeof getPersistentTerminalController
	> | null>(null);
	const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
	const { cwd, projectId, scopeId, scopeType } = scope;

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const controller = getPersistentTerminalController({
			cwd,
			projectId,
			scopeId,
			scopeType,
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
	}, [cwd, projectId, scopeId, scopeType]);

	useEffect(() => {
		if (typeof window === "undefined" || isCollapsed) {
			return;
		}

		const controller = getPersistentTerminalController({
			cwd,
			projectId,
			scopeId,
			scopeType,
		});
		const mountElement = hostRef.current;

		if (!controller || !mountElement) {
			return;
		}

		controller.attach(mountElement, { autoStart });

		return () => {
			controller.detach(mountElement);
		};
	}, [autoStart, cwd, isCollapsed, projectId, scopeId, scopeType]);

	const handleStart = async () => {
		await controllerRef.current?.start();
	};

	const handleRestart = async () => {
		await controllerRef.current?.restart();
	};

	const handleStop = async () => {
		await controllerRef.current?.stop();
	};

	const { error, isConnecting, session } = viewState;
	const showStartPrompt = !autoStart && !session?.sessionId && !isConnecting;
	const statusLabel = session?.status ?? (isConnecting ? "connecting" : "idle");
	const scopeLabel = scope.scopeType === "task" ? "task" : "project";
	const isHeaderToggleEnabled =
		Boolean(onToggleCollapse) && collapseTrigger === "header";

	const headerContent = (
		<>
			<TerminalIcon className="size-3.5 text-primary shrink-0" />
			<div className="flex items-center gap-1.5 min-w-0">
				<span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest truncate">
					{title}
				</span>
				<span className="text-[10px] font-mono text-zinc-500 uppercase">
					[{scopeLabel}]
				</span>
				<span
					className={cn(
						"text-[10px] font-mono uppercase",
						session?.status === "running"
							? "text-green-400"
							: session?.status === "exited"
								? "text-amber-300"
								: "text-zinc-400",
					)}
				>
					[{statusLabel}]
					{session?.exitCode !== null && session?.status === "exited" && (
						<span className="ml-1 opacity-70">({session.exitCode})</span>
					)}
				</span>
			</div>
		</>
	);

	return (
		<div className={cn("flex flex-col bg-[#09090B]", className)}>
			<div
				className={cn(
					"flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02]",
					headerHeight,
				)}
			>
				{isHeaderToggleEnabled ? (
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
						onClick={onToggleCollapse}
						aria-expanded={!isCollapsed}
						aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
					>
						{headerContent}
					</button>
				) : (
					<div className="flex min-w-0 items-center gap-3">{headerContent}</div>
				)}
				<div className="flex items-center gap-1 shrink-0">
					{showStartPrompt && (
						<Button
							variant="outline"
							size="sm"
							className="h-7 border-white/10 bg-white/[0.04] px-2.5 text-xs text-zinc-200 hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
							onClick={() => {
								void handleStart();
							}}
						>
							<Play className="size-3.5 fill-current" />
							Start
						</Button>
					)}
					{onToggleCollapse && collapseTrigger === "button" && (
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
						disabled={isConnecting || !session?.sessionId}
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
						disabled={!session?.sessionId || session?.status !== "running"}
					>
						<Square className="size-3.5" />
					</Button>
				</div>
			</div>

			{!isCollapsed && (
				<div className="relative flex-1 min-h-0 terminal-surface">
					<div ref={hostRef} className="h-full w-full" />

					{showStartPrompt && (
						<div className="absolute inset-0 flex items-center justify-center p-6">
							<div className="flex max-w-sm flex-col items-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 py-5 text-center backdrop-blur-sm">
								<TerminalIcon className="size-5 text-zinc-300" />
								<p className="mt-3 text-sm font-medium text-zinc-100">
									Terminal is idle
								</p>
								<p className="mt-1 text-xs text-zinc-400">
									Start it manually when you want to open a task shell.
								</p>
								<Button
									size="sm"
									className="mt-4 h-8"
									onClick={() => {
										void handleStart();
									}}
								>
									<Play className="size-3.5 fill-current" />
									Start terminal
								</Button>
							</div>
						</div>
					)}

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
			)}
		</div>
	);
}
