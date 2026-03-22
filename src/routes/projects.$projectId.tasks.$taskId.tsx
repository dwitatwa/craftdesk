import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AlignLeft, ArrowLeft, Calendar, CheckCircle2, Folder, Info } from "lucide-react";
import { AppShell } from "#/components/layout/app-shell";
import { Terminal } from "#/components/workspace/terminal";
import { useAddProject } from "#/components/workspace/use-add-project";
import { deleteProject, getTaskDetail, listProjects } from "#/server/craftdesk";

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
	const { addProject, addProjectError, isAddingProject } = useAddProject({
		onProjectSaved: async () => {
			await router.invalidate();
		},
	});

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
			onAddProject={addProject}
			isAddingProject={isAddingProject}
			addProjectError={addProjectError}
			onDeleteProject={handleDeleteProject}
		>
			<div className="flex h-full flex-1 overflow-hidden">
				{task ? (
					<>
						{/* Left Side: Details */}
						<div className="flex flex-col w-1/2 border-r bg-background overflow-y-auto custom-scrollbar">
							{/* Header - Consistent with Sidebar and Terminal */}
							<div className="h-20 flex items-center justify-between px-6 border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
								<div className="flex items-center gap-4 min-w-0">
									<Link
										to="/projects/$projectId"
										params={{ projectId: task.projectId }}
										className="inline-flex items-center justify-center size-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
									>
										<ArrowLeft className="size-4" />
									</Link>
									<div className="flex flex-col min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
												{task.id}
											</span>
											{task.isRunning && (
												<div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 leading-none">
													<span className="relative flex size-1.5">
														<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
														<span className="relative inline-flex rounded-full size-1.5 bg-green-500" />
													</span>
													<span className="text-[8px] font-mono font-bold text-green-500 uppercase tracking-widest">Running</span>
												</div>
											)}
										</div>
										<h1 className="text-sm font-bold truncate mt-1 leading-none text-foreground">
											{task.title}
										</h1>
									</div>
								</div>
								<div className="px-2 text-right shrink-0">
									<div className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
										{task.columnTitle}
									</div>
									<div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
										{task.projectName}
									</div>
								</div>
							</div>

							{/* Main Content Area - Modular Dashboard Layout */}
							<div className="flex-1 p-6 space-y-6 flex flex-col min-h-0">
								{/* Stats/Meta Cards */}
								<div className="grid grid-cols-2 gap-4 shrink-0">
									<div className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-4 transition-all hover:border-white/10 hover:bg-white/[0.02]">
										<div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
											<Calendar className="size-3" />
											Created Date
										</div>
										<div className="text-sm font-medium text-foreground/90">
											{formatTimestamp(task.createdAt)}
										</div>
										<div className="absolute -right-2 -bottom-2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
											<Calendar className="size-16" />
										</div>
									</div>

									<div className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-4 transition-all hover:border-white/10 hover:bg-white/[0.02]">
										<div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
											<CheckCircle2 className="size-3" />
											Done Date
										</div>
										<div className="text-sm font-medium text-foreground/90">
											{task.doneAt ? formatTimestamp(task.doneAt) : "In Progress Session"}
										</div>
										<div className="absolute -right-2 -bottom-2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
											<CheckCircle2 className="size-16" />
										</div>
									</div>
								</div>

								{/* Description Panel - Flexible height */}
								<div className="flex-1 flex flex-col min-h-[280px] rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden">
									<div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
										<div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
											<AlignLeft className="size-3.5" />
											Notes
										</div>
									</div>
									<div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
										<div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
											{task.description || (
												<span className="italic text-muted-foreground/40">
													No description provided for this task. Use the dashboard to add technical requirements.
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
						<Terminal
							className="flex-1"
							headerHeight="h-20"
							title="Terminal"
							scope={{
								scopeType: "task",
								scopeId: task.id,
								projectId: task.projectId,
								cwd: task.projectPath,
							}}
						/>
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
		</AppShell>
	);
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
