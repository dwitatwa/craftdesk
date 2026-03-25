import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	EyeOff,
	Play,
	Plus,
	Square,
	Terminal as TerminalIcon,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { CreateColumnModal } from "#/components/workspace/create-column-modal";
import { KanbanBoard } from "#/components/workspace/kanban-board";
import { Terminal } from "#/components/workspace/terminal";
import {
	disposePersistentTerminalController,
	usePersistentTerminalController,
} from "#/components/workspace/terminal-runtime";
import type { TaskCategory } from "#/lib/craftdesk";
import { cn } from "#/lib/utils";
import {
	createColumn,
	createTask,
	deleteColumn,
	deleteTask,
	getProjectWorkspace,
	hideCurrentDoneTask,
	moveTask,
	updateTask,
} from "#/server/craftdesk";
import { stopScopeTerminal } from "#/server/terminal";

export const Route = createFileRoute("/projects/$projectId/")({
	loader: async ({ params }) => {
		const workspace = await getProjectWorkspace({
			data: { projectId: params.projectId },
		});

		return {
			workspace,
		};
	},
	component: ProjectDetailView,
});

const COLLAPSED_TERMINAL_HEIGHT = 56;
const DEFAULT_TERMINAL_HEIGHT = 280;
const MIN_EXPANDED_TERMINAL_HEIGHT = 180;

interface ProjectTerminalTab {
	id: string;
	label: string;
	terminalKey: string;
	autoStart: boolean;
}

interface ProjectTerminalWorkspaceState {
	tabs: ProjectTerminalTab[];
	activeTabId: string | null;
	nextTabNumber: number;
}

const projectTerminalWorkspaces = new Map<
	string,
	ProjectTerminalWorkspaceState
>();

function createProjectTerminalTab(
	terminalNumber: number,
	options?: { autoStart?: boolean },
): ProjectTerminalTab {
	const terminalKey = `terminal-${terminalNumber}`;

	return {
		id: terminalKey,
		label: `Terminal ${terminalNumber}`,
		terminalKey,
		autoStart: options?.autoStart ?? false,
	};
}

function createInitialProjectTerminalWorkspaceState(): ProjectTerminalWorkspaceState {
	return {
		tabs: [],
		activeTabId: null,
		nextTabNumber: 1,
	};
}

function getStoredProjectTerminalWorkspaceState(projectId: string) {
	const existingState = projectTerminalWorkspaces.get(projectId);

	if (existingState) {
		return existingState;
	}

	const initialState = createInitialProjectTerminalWorkspaceState();
	projectTerminalWorkspaces.set(projectId, initialState);
	return initialState;
}

function ProjectDetailView() {
	const { workspace } = Route.useLoaderData();
	const router = useRouter();
	const layoutRef = useRef<HTMLDivElement | null>(null);
	const workspaceAreaRef = useRef<HTMLDivElement | null>(null);
	const resizeStateRef = useRef<{
		containerBottom: number;
		containerHeight: number;
	} | null>(null);
	const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false);
	const [isUpdatingDoneVisibility, setIsUpdatingDoneVisibility] =
		useState(false);
	const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(true);
	const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
	const [isResizingTerminal, setIsResizingTerminal] = useState(false);
	const [projectTerminalState, setProjectTerminalState] =
		useState<ProjectTerminalWorkspaceState>(() =>
			workspace
				? getStoredProjectTerminalWorkspaceState(workspace.project.id)
				: createInitialProjectTerminalWorkspaceState(),
		);

	const doneColumn = workspace?.columns.find(
		(column) => column.title === "Done",
	);
	const workspaceProjectId = workspace?.project.id ?? null;
	const hasVisibleDoneTask = Boolean(doneColumn?.tasks.length);
	const hasProjectTerminalTabs = projectTerminalState.tabs.length > 0;
	const activeProjectTerminalTab =
		projectTerminalState.tabs.find(
			(tab) => tab.id === projectTerminalState.activeTabId,
		) ??
		projectTerminalState.tabs[0] ??
		null;

	const updateProjectTerminalState = (
		updater: (
			currentState: ProjectTerminalWorkspaceState,
		) => ProjectTerminalWorkspaceState,
	) => {
		if (!workspace) {
			return;
		}

		setProjectTerminalState((currentState) => {
			const nextState = updater(currentState);
			projectTerminalWorkspaces.set(workspace.project.id, nextState);
			return nextState;
		});
	};

	const refreshData = async () => {
		await router.invalidate();
	};

	useEffect(() => {
		if (!workspaceProjectId) {
			return;
		}

		setProjectTerminalState(
			getStoredProjectTerminalWorkspaceState(workspaceProjectId),
		);
	}, [workspaceProjectId]);

	const handleHideCurrentDoneTask = async () => {
		if (!workspace || isUpdatingDoneVisibility) {
			return;
		}

		setIsUpdatingDoneVisibility(true);

		try {
			await hideCurrentDoneTask({
				data: {
					projectId: workspace.project.id,
				},
			});
			await refreshData();
		} finally {
			setIsUpdatingDoneVisibility(false);
		}
	};

	const handleCreateColumn = async (title: string) => {
		if (!workspace) {
			return;
		}

		await createColumn({
			data: {
				projectId: workspace.project.id,
				title,
			},
		});
		await refreshData();
	};

	const handleCreateTask = async (input: {
		columnId: string;
		title: string;
		category: TaskCategory;
	}) => {
		if (!workspace) {
			return;
		}

		await createTask({
			data: {
				projectId: workspace.project.id,
				columnId: input.columnId,
				title: input.title,
				category: input.category,
			},
		});
		await refreshData();
	};

	const handleDeleteColumn = async (columnId: string) => {
		if (!workspace) {
			return;
		}

		await deleteColumn({
			data: {
				projectId: workspace.project.id,
				columnId,
			},
		});
		await refreshData();
	};

	const handleDeleteTask = async (taskId: string) => {
		await deleteTask({
			data: { taskId },
		});
		await refreshData();
	};

	const handleStopTaskTerminal = async (taskId: string) => {
		await stopScopeTerminal({
			data: {
				scopeType: "task",
				scopeId: taskId,
			},
		});
		await refreshData();
	};

	const handleUpdateTask = async (
		taskId: string,
		input: { title: string; category: TaskCategory; notes: string },
	) => {
		await updateTask({
			data: {
				taskId,
				title: input.title,
				category: input.category,
				notes: input.notes,
			},
		});
		await refreshData();
	};

	const handleMoveTask = async (
		taskId: string,
		targetColumnId: string,
		targetPosition: number,
	) => {
		if (!workspace) {
			return;
		}

		await moveTask({
			data: {
				projectId: workspace.project.id,
				taskId,
				targetColumnId,
				targetPosition,
			},
		});
		await refreshData();
	};

	useEffect(() => {
		const container = workspaceAreaRef.current;

		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		const syncHeight = (containerHeight: number) => {
			setTerminalHeight((currentHeight) =>
				clampProjectTerminalHeight(currentHeight, containerHeight),
			);
		};

		syncHeight(container.getBoundingClientRect().height);

		const resizeObserver = new ResizeObserver(([entry]) => {
			syncHeight(entry.contentRect.height);
		});

		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!isResizingTerminal) {
			return;
		}

		const handlePointerMove = (event: PointerEvent) => {
			const resizeState = resizeStateRef.current;

			if (!resizeState) {
				return;
			}

			setTerminalHeight(
				clampProjectTerminalHeight(
					resizeState.containerBottom - event.clientY,
					resizeState.containerHeight,
				),
			);
		};

		const stopResizing = () => {
			resizeStateRef.current = null;
			setIsResizingTerminal(false);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", stopResizing);
		window.addEventListener("pointercancel", stopResizing);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", stopResizing);
			window.removeEventListener("pointercancel", stopResizing);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, [isResizingTerminal]);

	const handleTerminalResizeStart = (
		event: React.PointerEvent<HTMLButtonElement>,
	) => {
		if (event.button !== 0) {
			return;
		}

		const container = workspaceAreaRef.current;

		if (!container) {
			return;
		}

		const rect = container.getBoundingClientRect();

		resizeStateRef.current = {
			containerBottom: rect.bottom,
			containerHeight: rect.height,
		};

		if (isTerminalCollapsed) {
			setIsTerminalCollapsed(false);
		}

		setTerminalHeight((currentHeight) =>
			clampProjectTerminalHeight(currentHeight, rect.height),
		);
		setIsResizingTerminal(true);
		document.body.style.cursor = "row-resize";
		document.body.style.userSelect = "none";
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	};

	const handleTerminalResizeKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
	) => {
		const container = workspaceAreaRef.current;

		if (!container) {
			return;
		}

		const containerHeight = container.getBoundingClientRect().height;
		const step = event.shiftKey ? 56 : 28;

		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (isTerminalCollapsed) {
				setIsTerminalCollapsed(false);
			}
			setTerminalHeight((currentHeight) =>
				clampProjectTerminalHeight(currentHeight + step, containerHeight),
			);
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (isTerminalCollapsed) {
				setIsTerminalCollapsed(false);
			}
			setTerminalHeight((currentHeight) =>
				clampProjectTerminalHeight(currentHeight - step, containerHeight),
			);
		}
	};

	const handleTerminalResizeDoubleClick = () => {
		const container = workspaceAreaRef.current;

		if (!container) {
			return;
		}

		setIsTerminalCollapsed(false);
		setTerminalHeight(
			clampProjectTerminalHeight(
				DEFAULT_TERMINAL_HEIGHT,
				container.getBoundingClientRect().height,
			),
		);
	};

	const renderedTerminalHeight = isTerminalCollapsed
		? COLLAPSED_TERMINAL_HEIGHT
		: terminalHeight;

	const handleCreateProjectTerminalTab = (options?: {
		autoStart?: boolean;
	}) => {
		if (!workspace) {
			return;
		}

		setIsTerminalCollapsed(false);
		updateProjectTerminalState((currentState) => {
			const terminalNumber = currentState.nextTabNumber;
			const nextTab = createProjectTerminalTab(terminalNumber, options);

			return {
				tabs: [...currentState.tabs, nextTab],
				activeTabId: nextTab.id,
				nextTabNumber: terminalNumber + 1,
			};
		});
	};

	const handleOpenProjectTerminal = () => {
		if (!workspace) {
			return;
		}

		if (hasProjectTerminalTabs && isTerminalCollapsed) {
			setIsTerminalCollapsed(false);
			return;
		}

		if (hasProjectTerminalTabs) {
			setIsTerminalCollapsed(true);
			return;
		}

		handleCreateProjectTerminalTab({ autoStart: true });
	};

	const handleSelectProjectTerminalTab = (tabId: string) => {
		updateProjectTerminalState((currentState) => ({
			...currentState,
			activeTabId: tabId,
		}));
	};

	const handleCloseProjectTerminalTab = async (tabId: string) => {
		if (!workspace) {
			return;
		}

		const tabToRemove = projectTerminalState.tabs.find(
			(tab) => tab.id === tabId,
		);

		if (!tabToRemove) {
			return;
		}

		let isClosingLastTab = false;

		updateProjectTerminalState((currentState) => {
			const closingTabIndex = currentState.tabs.findIndex(
				(tab) => tab.id === tabId,
			);

			if (closingTabIndex === -1) {
				return currentState;
			}

			const nextTabs = currentState.tabs.filter((tab) => tab.id !== tabId);
			isClosingLastTab = nextTabs.length === 0;

			if (nextTabs.length === 0) {
				return {
					...currentState,
					tabs: [],
					activeTabId: null,
				};
			}

			const fallbackActiveTab =
				nextTabs[Math.min(closingTabIndex, nextTabs.length - 1)] ?? nextTabs[0];

			return {
				...currentState,
				tabs: nextTabs,
				activeTabId:
					currentState.activeTabId === tabId
						? fallbackActiveTab.id
						: currentState.activeTabId,
			};
		});

		if (isClosingLastTab) {
			setIsTerminalCollapsed(true);
		}

		await disposePersistentTerminalController(
			{
				scopeType: "project",
				scopeId: workspace.project.id,
				projectId: workspace.project.id,
				cwd: workspace.project.path,
				terminalKey: tabToRemove.terminalKey,
			},
			{ stop: true },
		);
	};

	return (
		<div ref={layoutRef} className="flex-1 flex flex-col min-h-0">
			{workspace ? (
				<>
					{/* Workspace Header Info */}
					<div className="h-20 px-6 flex items-center justify-between border-b bg-background/30 backdrop-blur-sm">
						<div className="flex flex-col justify-center">
							<h1 className="text-xl font-bold tracking-tight">
								{workspace.project.name}
							</h1>
							<p className="text-xs text-muted-foreground font-mono leading-none mt-1">
								{workspace.project.path}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-8 gap-2 text-xs font-medium",
									"text-muted-foreground hover:text-foreground",
								)}
								onClick={handleOpenProjectTerminal}
							>
								<TerminalIcon className="size-3.5" />
								{hasProjectTerminalTabs
									? isTerminalCollapsed
										? "Show Terminal"
										: "Hide Terminal"
									: "Open Terminal"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-8 gap-2 text-xs font-medium",
									"text-muted-foreground hover:text-foreground",
								)}
								onClick={handleHideCurrentDoneTask}
								disabled={isUpdatingDoneVisibility || !hasVisibleDoneTask}
							>
								<EyeOff className="size-3.5" />
								Hide Current Done Tasks
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={() => setIsCreateColumnModalOpen(true)}
							>
								<Plus className="size-3.5" />
								Add Column
							</Button>
						</div>
					</div>

					<div
						ref={workspaceAreaRef}
						className="relative flex-1 min-h-0 overflow-hidden"
					>
						{/* Board Area */}
						<div
							className={cn(
								"relative z-0 flex h-full min-h-0 flex-col overflow-hidden",
								hasProjectTerminalTabs && "pb-14",
							)}
						>
							<KanbanBoard
								columns={workspace.columns}
								onCreateTask={handleCreateTask}
								onDeleteColumn={handleDeleteColumn}
								onUpdateTask={handleUpdateTask}
								onDeleteTask={handleDeleteTask}
								onStopTaskTerminal={handleStopTaskTerminal}
								onMoveTask={handleMoveTask}
							/>
						</div>

						{/* Project Terminal */}
						{hasProjectTerminalTabs && activeProjectTerminalTab && (
							<div
								className={cn(
									"absolute inset-x-0 bottom-0 z-20 overflow-hidden border-t border-white/5 bg-[#09090B] shadow-[0_-12px_36px_rgba(0,0,0,0.42)]",
									isResizingTerminal
										? "transition-none"
										: "transition-[height] duration-300 ease-in-out",
								)}
								style={{ height: renderedTerminalHeight }}
							>
								<button
									type="button"
									className="absolute inset-x-0 top-0 z-10 h-3 cursor-row-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
									onPointerDown={handleTerminalResizeStart}
									onKeyDown={handleTerminalResizeKeyDown}
									onDoubleClick={handleTerminalResizeDoubleClick}
									aria-label="Resize terminal height"
								/>
								<div className="flex h-full min-h-0 flex-col pt-3">
									<div className="flex items-center gap-2 border-b border-white/5 bg-[#111111] px-2 pt-1.5">
										<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
											{projectTerminalState.tabs.map((tab) => {
												return (
													<ProjectTerminalTabButton
														key={tab.id}
														tab={tab}
														isActive={tab.id === activeProjectTerminalTab.id}
														projectId={workspace.project.id}
														cwd={workspace.project.path}
														onSelect={handleSelectProjectTerminalTab}
														onClose={handleCloseProjectTerminalTab}
													/>
												);
											})}
										</div>
										<div className="flex shrink-0 items-center gap-1 pb-1.5">
											<Button
												variant="ghost"
												size="icon-xs"
												className="text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
												onClick={() =>
													handleCreateProjectTerminalTab({ autoStart: false })
												}
												aria-label="Add terminal"
											>
												<Plus className="size-3.5" />
											</Button>
										</div>
									</div>
									{!isTerminalCollapsed && (
										<Terminal
											autoStart={activeProjectTerminalTab.autoStart}
											className="min-h-0 flex-1"
											showHeader={false}
											showStartAction={false}
											showRestartAction={false}
											showStopAction={false}
											scope={{
												scopeType: "project",
												scopeId: workspace.project.id,
												projectId: workspace.project.id,
												cwd: workspace.project.path,
												terminalKey: activeProjectTerminalTab.terminalKey,
											}}
										/>
									)}
								</div>
							</div>
						)}
					</div>
				</>
			) : (
				<div className="flex flex-1 items-center justify-center p-8">
					<div className="max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
						<h1 className="text-lg font-semibold">Project not found</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							This workspace is not saved in SQLite yet. Add it from the sidebar
							to create a board for it.
						</p>
					</div>
				</div>
			)}

			<CreateColumnModal
				isOpen={isCreateColumnModalOpen}
				onOpenChange={setIsCreateColumnModalOpen}
				onCreate={handleCreateColumn}
			/>
		</div>
	);
}

function clampProjectTerminalHeight(height: number, containerHeight: number) {
	const maxHeight = Math.max(MIN_EXPANDED_TERMINAL_HEIGHT, containerHeight);

	return Math.min(Math.max(height, MIN_EXPANDED_TERMINAL_HEIGHT), maxHeight);
}

function ProjectTerminalTabButton({
	tab,
	isActive,
	projectId,
	cwd,
	onSelect,
	onClose,
}: {
	tab: ProjectTerminalTab;
	isActive: boolean;
	projectId: string;
	cwd: string;
	onSelect: (tabId: string) => void;
	onClose: (tabId: string) => Promise<void>;
}) {
	const scope = {
		scopeType: "project" as const,
		scopeId: projectId,
		projectId,
		cwd,
		terminalKey: tab.terminalKey,
	};
	const { controller, viewState } = usePersistentTerminalController(scope);
	const { isConnecting, session } = viewState;
	const isRunning = session?.status === "running";
	const canStart = !isConnecting && session?.status !== "running";
	const canStop = !isConnecting && isRunning;

	const handleStart = () => {
		onSelect(tab.id);
		void controller?.start();
	};

	const handleStop = () => {
		void controller?.stop();
	};

	const handleClose = () => {
		void onClose(tab.id);
	};

	return (
		<div
			className={cn(
				"flex shrink-0 items-center rounded-t-md border border-b-0 bg-[#151515] text-[11px] text-zinc-300",
				isActive
					? "border-white/30 bg-[#09090B] text-zinc-100"
					: "border-white/10 text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200",
			)}
		>
			<button
				type="button"
				className="max-w-36 truncate px-3 py-2 text-left"
				onClick={() => onSelect(tab.id)}
				aria-pressed={isActive}
			>
				{tab.label}
			</button>
			<div className="flex items-center gap-0.5 pr-1">
				<button
					type="button"
					className="inline-flex size-5 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:opacity-35"
					onClick={(event) => {
						event.stopPropagation();
						handleStart();
					}}
					disabled={!canStart}
					aria-label={`Start ${tab.label}`}
				>
					<Play className="size-3 fill-current" />
				</button>
				<button
					type="button"
					className="inline-flex size-5 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:opacity-35"
					onClick={(event) => {
						event.stopPropagation();
						handleStop();
					}}
					disabled={!canStop}
					aria-label={`Stop ${tab.label}`}
				>
					<Square className="size-3" />
				</button>
				<button
					type="button"
					className="inline-flex size-5 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100"
					onClick={(event) => {
						event.stopPropagation();
						handleClose();
					}}
					aria-label={`Close ${tab.label}`}
				>
					<X className="size-3" />
				</button>
			</div>
		</div>
	);
}
