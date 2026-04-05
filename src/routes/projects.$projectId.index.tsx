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
					<div className="h-16 px-6 flex items-center justify-between border-b bg-card">
						<div className="flex flex-col justify-center">
							<h1 className="text-lg font-bold tracking-tight">
								{workspace.project.name}
							</h1>
							<p className="text-[10px] text-muted-foreground font-mono leading-none mt-1">
								{workspace.project.path}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-8 gap-2 text-xs font-semibold",
									"text-muted-foreground hover:text-foreground hover:bg-accent",
								)}
								onClick={projectTerminal.toggle}
							>
								<TerminalIcon className="size-3.5" />
								{projectTerminal.hasTabs && projectTerminal.isOpen
									? "Close Terminal"
									: "Terminal"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"h-8 gap-2 text-xs font-semibold",
									"text-muted-foreground hover:text-foreground hover:bg-accent",
								)}
								onClick={handleHideCurrentDoneTask}
								disabled={isUpdatingDoneVisibility || !hasVisibleDoneTask}
							>
								<EyeOff className="size-3.5" />
								Clear Done
							</Button>
							<Button
								variant="secondary"
								size="sm"
								className="h-8 gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm"
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
					<div className="max-w-md rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-sm">
						<h1 className="text-lg font-bold">Project not found</h1>
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
