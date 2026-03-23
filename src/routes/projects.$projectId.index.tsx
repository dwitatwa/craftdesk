import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { CreateColumnModal } from "#/components/workspace/create-column-modal";
import { CreateTaskModal } from "#/components/workspace/create-task-modal";
import { KanbanBoard } from "#/components/workspace/kanban-board";
import { Terminal } from "#/components/workspace/terminal";
import { cn } from "#/lib/utils";
import {
	createColumn,
	createTask,
	deleteColumn,
	deleteTask,
	getProjectWorkspace,
	moveTask,
	updateTask,
} from "#/server/craftdesk";

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

function ProjectDetailView() {
	const { workspace } = Route.useLoaderData();
	const router = useRouter();
	const layoutRef = useRef<HTMLDivElement | null>(null);
	const workspaceAreaRef = useRef<HTMLDivElement | null>(null);
	const resizeStateRef = useRef<{
		containerBottom: number;
		containerHeight: number;
	} | null>(null);
	const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
	const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false);
	const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(true);
	const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
	const [isResizingTerminal, setIsResizingTerminal] = useState(false);

	const primaryColumn = workspace?.columns[0];

	const refreshData = async () => {
		await router.invalidate();
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
	}) => {
		if (!workspace) {
			return;
		}

		await createTask({
			data: {
				projectId: workspace.project.id,
				columnId: input.columnId,
				title: input.title,
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

	const handleUpdateTask = async (
		taskId: string,
		input: { title: string; notes: string },
	) => {
		await updateTask({
			data: {
				taskId,
				title: input.title,
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
								className="h-8 gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={() => setIsCreateColumnModalOpen(true)}
							>
								<Plus className="size-3.5" />
								Add Column
							</Button>
							<Button
								size="sm"
								className="h-8 gap-2 text-xs font-medium cursor-pointer"
								onClick={() => setIsCreateTaskModalOpen(true)}
								disabled={!primaryColumn}
							>
								<Plus className="size-3.5" />
								New Task
							</Button>
						</div>
					</div>

					<div
						ref={workspaceAreaRef}
						className="relative flex-1 min-h-0 overflow-hidden"
					>
						{/* Board Area */}
						<div className="relative z-0 flex h-full min-h-0 flex-col overflow-hidden pb-14">
							<KanbanBoard
								columns={workspace.columns}
								onCreateTask={handleCreateTask}
								onDeleteColumn={handleDeleteColumn}
								onUpdateTask={handleUpdateTask}
								onDeleteTask={handleDeleteTask}
								onMoveTask={handleMoveTask}
							/>
						</div>

						{/* Project Terminal */}
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
							<Terminal
								title="Terminal"
								className="h-full"
								collapseTrigger="header"
								isCollapsed={isTerminalCollapsed}
								onToggleCollapse={() =>
									setIsTerminalCollapsed(!isTerminalCollapsed)
								}
								scope={{
									scopeType: "project",
									scopeId: workspace.project.id,
									projectId: workspace.project.id,
									cwd: workspace.project.path,
								}}
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

			<CreateTaskModal
				isOpen={isCreateTaskModalOpen}
				onOpenChange={setIsCreateTaskModalOpen}
				columnTitle={primaryColumn?.title}
				onCreate={(input) =>
					primaryColumn
						? handleCreateTask({
								columnId: primaryColumn.id,
								title: input.title,
							})
						: Promise.resolve()
				}
			/>

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
