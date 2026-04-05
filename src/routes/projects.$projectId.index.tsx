import { createFileRoute, useRouter } from "@tanstack/react-router";
import { EyeOff, Plus, Terminal as TerminalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { CreateColumnModal } from "#/components/workspace/create-column-modal";
import { KanbanBoard } from "#/components/workspace/kanban-board";
import {
	ProjectTerminalDialog,
	useProjectTerminalDialog,
} from "#/components/workspace/project-terminal-dialog";
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

function ProjectDetailView() {
	const { workspace } = Route.useLoaderData();
	const router = useRouter();
	const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false);
	const [isUpdatingDoneVisibility, setIsUpdatingDoneVisibility] =
		useState(false);
	const projectTerminal = useProjectTerminalDialog(
		workspace
			? {
					projectId: workspace.project.id,
					cwd: workspace.project.path,
				}
			: null,
	);

	const doneColumn = workspace?.columns.find(
		(column) => column.title === "Done",
	);
	const hasVisibleDoneTask = Boolean(doneColumn?.tasks.length);

	const refreshData = async () => {
		await router.invalidate();
	};

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
								onClick={projectTerminal.toggle}
							>
								<TerminalIcon className="size-3.5" />
								{projectTerminal.hasTabs && projectTerminal.isOpen
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

			<ProjectTerminalDialog controller={projectTerminal} />

			<CreateColumnModal
				isOpen={isCreateColumnModalOpen}
				onOpenChange={setIsCreateColumnModalOpen}
				onCreate={handleCreateColumn}
			/>
		</div>
	);
}
