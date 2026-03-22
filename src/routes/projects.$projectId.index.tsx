import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "#/components/layout/app-shell";
import { Button } from "#/components/ui/button";
import { CreateColumnModal } from "#/components/workspace/create-column-modal";
import { CreateTaskModal } from "#/components/workspace/create-task-modal";
import { KanbanBoard } from "#/components/workspace/kanban-board";
import { Terminal } from "#/components/workspace/terminal";
import { useAddProject } from "#/components/workspace/use-add-project";
import { cn } from "#/lib/utils";
import {
	createColumn,
	createTask,
	deleteColumn,
	deleteProject,
	deleteTask,
	getProjectWorkspace,
	listProjects,
} from "#/server/craftdesk";

export const Route = createFileRoute("/projects/$projectId/")({
	loader: async ({ params }) => {
		const workspace = await getProjectWorkspace({
			data: { projectId: params.projectId },
		});
		const projects = await listProjects({
			data: { sortBy: "name" },
		});

		return {
			projects,
			workspace,
		};
	},
	component: ProjectDetailView,
});

function ProjectDetailView() {
	const { projects, workspace } = Route.useLoaderData();
	const router = useRouter();
	const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
	const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false);
	const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(true);

	const primaryColumn = workspace?.columns[0];

	const refreshData = async () => {
		await router.invalidate();
	};

	const { addProject, addProjectError, isAddingProject } = useAddProject({
		onProjectSaved: refreshData,
	});

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
		description: string;
	}) => {
		if (!workspace) {
			return;
		}

		await createTask({
			data: {
				projectId: workspace.project.id,
				columnId: input.columnId,
				title: input.title,
				description: input.description,
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

	const handleDeleteProject = async (projectId: string) => {
		await deleteProject({ data: { projectId } });
		await router.invalidate();

		if (workspace?.project.id === projectId) {
			await router.navigate({ to: "/" });
		}
	};

	return (
		<AppShell
			projects={projects}
			onAddProject={addProject}
			isAddingProject={isAddingProject}
			addProjectError={addProjectError}
			onDeleteProject={handleDeleteProject}
		>
			<div className="flex-1 flex flex-col min-h-0">
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

						{/* Board Area */}
						<div className="flex-1 min-h-0 overflow-hidden">
							<KanbanBoard
								columns={workspace.columns}
								onCreateTask={handleCreateTask}
								onDeleteColumn={handleDeleteColumn}
								onDeleteTask={handleDeleteTask}
							/>
						</div>

						{/* Project Terminal */}
						<div
							className={cn(
								"border-t border-white/5 transition-all duration-300 ease-in-out overflow-hidden relative",
								isTerminalCollapsed ? "h-14" : "h-[280px]",
							)}
						>
							<Terminal
								title="Project Terminal"
								className="h-full"
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
					</>
				) : (
					<div className="flex flex-1 items-center justify-center p-8">
						<div className="max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
							<h1 className="text-lg font-semibold">Project not found</h1>
							<p className="mt-2 text-sm text-muted-foreground">
								This workspace is not saved in SQLite yet. Add it from the
								sidebar to create a board for it.
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
									description: input.description,
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
		</AppShell>
	);
}
