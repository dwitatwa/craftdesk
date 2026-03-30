import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	EyeOff,
	Play,
	Plus,
	Square,
	Terminal as TerminalIcon,
	X,
} from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "#/components/ui/button";
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { CreateColumnModal } from "#/components/workspace/create-column-modal";
import { KanbanBoard } from "#/components/workspace/kanban-board";
import { Terminal } from "#/components/workspace/terminal";
import { disposePersistentTerminalController } from "#/components/workspace/terminal-runtime";
import type { TaskCategory } from "#/lib/craftdesk";
import type { TerminalActionRequest, TerminalStatus } from "#/lib/terminal";
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

interface ProjectTerminalTab {
	id: string;
	label: string;
	terminalKey: string;
	autoStart: boolean;
	status: TerminalStatus | "idle";
	isConnecting: boolean;
	actionRequest: TerminalActionRequest | null;
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

let nextTerminalActionNonce = 1;

function createTerminalActionRequest(
	type: TerminalActionRequest["type"],
): TerminalActionRequest {
	const nonce = nextTerminalActionNonce;
	nextTerminalActionNonce += 1;
	return { type, nonce };
}

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
		status: "idle",
		isConnecting: false,
		actionRequest: null,
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

function isToggleProjectTerminalShortcut(event: KeyboardEvent) {
	return (
		event.ctrlKey &&
		!event.metaKey &&
		!event.altKey &&
		!event.shiftKey &&
		event.code === "Backslash"
	);
}

function ProjectDetailView() {
	const { workspace } = Route.useLoaderData();
	const router = useRouter();
	const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false);
	const [isUpdatingDoneVisibility, setIsUpdatingDoneVisibility] =
		useState(false);
	const [isProjectTerminalModalOpen, setIsProjectTerminalModalOpen] =
		useState(false);
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
		setIsProjectTerminalModalOpen(false);
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

	const handleCreateProjectTerminalTab = (options?: {
		autoStart?: boolean;
	}) => {
		if (!workspace) {
			return;
		}

		setIsProjectTerminalModalOpen(true);
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

	const handleToggleProjectTerminalModal = () => {
		if (!workspace) {
			return;
		}

		if (hasProjectTerminalTabs) {
			setIsProjectTerminalModalOpen((currentOpen) => !currentOpen);
			return;
		}

		handleCreateProjectTerminalTab({ autoStart: true });
	};

	const handleProjectTerminalShortcutToggle = useEffectEvent(() => {
		handleToggleProjectTerminalModal();
	});

	const handleSelectProjectTerminalTab = (tabId: string) => {
		updateProjectTerminalState((currentState) => ({
			...currentState,
			activeTabId: tabId,
		}));
	};

	const handleStartProjectTerminalTab = (tabId: string) => {
		setIsProjectTerminalModalOpen(true);
		updateProjectTerminalState((currentState) => ({
			...currentState,
			activeTabId: tabId,
			tabs: currentState.tabs.map((tab) =>
				tab.id === tabId
					? {
							...tab,
							autoStart: true,
							isConnecting: true,
							actionRequest: createTerminalActionRequest("start"),
						}
					: tab,
			),
		}));
	};

	const handleStopProjectTerminalTab = async (tabId: string) => {
		if (!workspace) {
			return;
		}

		const tabToStop = projectTerminalState.tabs.find((tab) => tab.id === tabId);

		if (!tabToStop) {
			return;
		}

		if (
			projectTerminalState.activeTabId === tabId &&
			isProjectTerminalModalOpen
		) {
			updateProjectTerminalState((currentState) => ({
				...currentState,
				tabs: currentState.tabs.map((tab) =>
					tab.id === tabId
						? {
								...tab,
								autoStart: false,
								isConnecting: true,
								actionRequest: createTerminalActionRequest("stop"),
							}
						: tab,
				),
			}));
			return;
		}

		await stopScopeTerminal({
			data: {
				scopeType: "project",
				scopeId: workspace.project.id,
				terminalKey: tabToStop.terminalKey,
			},
		});

		updateProjectTerminalState((currentState) => ({
			...currentState,
			tabs: currentState.tabs.map((tab) =>
				tab.id === tabId
					? {
							...tab,
							autoStart: false,
							status: "stopped",
							isConnecting: false,
							actionRequest: null,
						}
					: tab,
			),
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
			setIsProjectTerminalModalOpen(false);
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

	useEffect(() => {
		const handleProjectTerminalShortcut = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				!isToggleProjectTerminalShortcut(event)
			) {
				return;
			}

			event.preventDefault();
			handleProjectTerminalShortcutToggle();
		};

		window.addEventListener("keydown", handleProjectTerminalShortcut);

		return () => {
			window.removeEventListener("keydown", handleProjectTerminalShortcut);
		};
	}, []);

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{workspace ? (
				<>
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
								onClick={handleToggleProjectTerminalModal}
							>
								<TerminalIcon className="size-3.5" />
								{hasProjectTerminalTabs && isProjectTerminalModalOpen
									? "Close Terminal"
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

					<div className="relative flex-1 min-h-0 overflow-hidden">
						<div className="relative z-0 flex h-full min-h-0 flex-col overflow-hidden">
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

			<Dialog
				open={
					isProjectTerminalModalOpen &&
					hasProjectTerminalTabs &&
					Boolean(activeProjectTerminalTab)
				}
				onOpenChange={setIsProjectTerminalModalOpen}
			>
				<DialogContent
					hideClose
					className="flex h-[min(78vh,760px)] max-w-[min(92vw,1180px)] flex-col gap-0 overflow-hidden border border-white/10 bg-[#09090B] p-0 shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
				>
					{workspace && activeProjectTerminalTab ? (
						<>
							<div className="flex items-center justify-between border-b border-white/6 bg-[#101012] px-4 py-3">
								<div className="flex min-w-0 items-center gap-3">
									<TerminalIcon className="size-4 shrink-0 text-zinc-200" />
									<div className="min-w-0">
										<div className="truncate text-[12px] font-semibold text-zinc-100">
											Project Terminal
										</div>
										<div className="truncate text-[10px] font-mono text-zinc-500">
											Ctrl+\
										</div>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon-xs"
									className="text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
									onClick={() => setIsProjectTerminalModalOpen(false)}
									aria-label="Close terminal modal"
								>
									<X className="size-3.5" />
								</Button>
							</div>
							<div className="flex min-h-0 flex-1 flex-col">
								<div className="flex items-center gap-2 border-b border-white/5 bg-[#111111] px-2 pt-1.5">
									<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
										{projectTerminalState.tabs.map((tab) => {
											return (
												<ProjectTerminalTabButton
													key={tab.id}
													tab={tab}
													isActive={tab.id === activeProjectTerminalTab.id}
													onSelect={handleSelectProjectTerminalTab}
													onStart={handleStartProjectTerminalTab}
													onStop={handleStopProjectTerminalTab}
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
								<Terminal
									key={activeProjectTerminalTab.id}
									actionRequest={activeProjectTerminalTab.actionRequest}
									autoStart={activeProjectTerminalTab.autoStart}
									className="min-h-0 flex-1"
									onViewStateChange={(viewState) => {
										updateProjectTerminalState((currentState) => ({
											...currentState,
											tabs: currentState.tabs.map((tab) =>
												tab.id === activeProjectTerminalTab.id
													? {
															...tab,
															status:
																viewState.session?.status ??
																(tab.status === "idle" ? "idle" : tab.status),
															isConnecting: viewState.isConnecting,
															actionRequest: null,
														}
													: tab,
											),
										}));
									}}
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
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>

			<CreateColumnModal
				isOpen={isCreateColumnModalOpen}
				onOpenChange={setIsCreateColumnModalOpen}
				onCreate={handleCreateColumn}
			/>
		</div>
	);
}

function ProjectTerminalTabButton({
	tab,
	isActive,
	onSelect,
	onStart,
	onStop,
	onClose,
}: {
	tab: ProjectTerminalTab;
	isActive: boolean;
	onSelect: (tabId: string) => void;
	onStart: (tabId: string) => void;
	onStop: (tabId: string) => Promise<void>;
	onClose: (tabId: string) => Promise<void>;
}) {
	const isRunning = tab.status === "running";
	const canStart = !tab.isConnecting && tab.status !== "running";
	const canStop = !tab.isConnecting && isRunning;

	const handleStart = () => {
		onStart(tab.id);
	};

	const handleStop = () => {
		void onStop(tab.id);
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
