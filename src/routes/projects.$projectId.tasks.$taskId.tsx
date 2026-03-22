import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AppShell } from "#/components/layout/app-shell";
import { SaveProjectModal } from "#/components/workspace/save-project-modal";
import { Terminal } from "#/components/workspace/terminal";
import {
	deleteProject,
	getTaskDetail,
	listProjects,
	saveProject,
} from "#/server/craftdesk";

export const Route = createFileRoute("/projects/$projectId/tasks/$taskId")({
	loader: async ({ params }) => {
		const task = await getTaskDetail({
			data: { taskId: params.taskId },
		});
		const projects = await listProjects({
			data: { sortBy: "name" },
		});

		return {
			task: task?.projectId === params.projectId ? task : null,
			projects,
		};
	},
	component: TaskDetailView,
});

function TaskDetailView() {
	const { task, projects } = Route.useLoaderData();
	const router = useRouter();
	const [isSaveProjectModalOpen, setIsSaveProjectModalOpen] = useState(false);

	const handleSaveProject = async (input: { name: string; path: string }) => {
		const project = await saveProject({ data: input });
		await router.invalidate();
		await router.navigate({
			to: "/projects/$projectId",
			params: { projectId: project.id },
		});
	};

	const handleDeleteProject = async (projectId: string) => {
		await deleteProject({ data: { projectId } });
		await router.invalidate();

		if (task?.projectId === projectId) {
			await router.navigate({ to: "/" });
		}
	};

	return (
		<AppShell
			projects={projects}
			onAddProject={() => setIsSaveProjectModalOpen(true)}
			onDeleteProject={handleDeleteProject}
		>
			<div className="flex h-full flex-1 overflow-hidden">
				{task ? (
					<>
						{/* Left Side: Details */}
						<div className="flex flex-col w-1/2 border-r bg-background overflow-y-auto">
							{/* Header */}
							<div className="h-20 flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
								<div className="flex items-center gap-3 px-2">
									<Link
										to="/projects/$projectId"
										params={{ projectId: task.projectId }}
										className="p-2 hover:bg-muted rounded-md transition-colors"
									>
										<ArrowLeft className="size-4" />
									</Link>
									<div className="flex flex-col">
										<span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
											{task.id}
										</span>
										<h1 className="text-sm font-bold truncate max-w-[300px] mt-1 leading-none">
											{task.title}
										</h1>
									</div>
								</div>
								<div className="px-2 text-right">
									<div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
										{task.columnTitle}
									</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{task.projectName}
									</div>
								</div>
							</div>

							{/* Content */}
							<div className="p-6 space-y-8">
								<div className="space-y-3">
									<h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
										Timeline
									</h2>
									<div className="grid gap-3 sm:grid-cols-2">
										<div className="rounded-xl border bg-muted/20 p-4">
											<div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
												Created
											</div>
											<div className="mt-2 text-sm font-medium">
												{formatTimestamp(task.createdAt)}
											</div>
										</div>
										<div className="rounded-xl border bg-muted/20 p-4">
											<div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
												Done
											</div>
											<div className="mt-2 text-sm font-medium">
												{task.doneAt
													? formatTimestamp(task.doneAt)
													: "Not completed yet"}
											</div>
										</div>
									</div>
								</div>

								<div className="space-y-3">
									<h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
										Workspace
									</h2>
									<div className="rounded-xl border bg-muted/20 p-4">
										<div className="font-medium">{task.projectName}</div>
										<div className="mt-1 text-xs font-mono text-muted-foreground">
											{task.projectPath}
										</div>
									</div>
								</div>

								<div className="space-y-3">
									<h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
										Description
									</h2>
									<p className="text-sm leading-relaxed text-foreground/90 bg-muted/30 p-4 rounded-xl border">
										{task.description || "No description yet."}
									</p>
								</div>
							</div>
						</div>
						<Terminal className="flex-1" headerHeight="h-20" />
					</>
				) : (
					<div className="flex flex-1 items-center justify-center p-8">
						<div className="max-w-md rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
							<h1 className="text-lg font-semibold">Task not found</h1>
							<p className="mt-2 text-sm text-muted-foreground">
								This task may have been deleted, may not belong to this project,
								or the database has not been seeded with it.
							</p>
						</div>
					</div>
				)}
			</div>

			<SaveProjectModal
				isOpen={isSaveProjectModalOpen}
				onOpenChange={setIsSaveProjectModalOpen}
				onSubmit={handleSaveProject}
			/>
		</AppShell>
	);
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
