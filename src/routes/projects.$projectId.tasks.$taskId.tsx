import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { TaskNotesEditor } from "#/components/workspace/task-notes-editor";
import { TASK_CATEGORY_LABELS, type TaskCategory } from "#/lib/craftdesk";
import { shouldHandleMiddleClickClose } from "#/lib/utils";
import { getTaskDetail } from "#/server/craftdesk";

export const Route = createFileRoute("/projects/$projectId/tasks/$taskId")({
	loader: async ({ params }) => {
		const task = await getTaskDetail({
			data: { taskId: params.taskId },
		});

		return {
			task: task?.projectId === params.projectId ? task : null,
		};
	},
	component: TaskDetailView,
});

function TaskDetailView() {
	const { projectId } = Route.useParams();
	const { task } = Route.useLoaderData();
	const router = useRouter();
	const headerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handleCloseTaskDetailShortcut = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				event.metaKey ||
				event.ctrlKey ||
				!event.altKey ||
				event.shiftKey ||
				event.key.toLowerCase() !== "w"
			) {
				return;
			}

			event.preventDefault();
			void router.navigate({
				to: "/projects/$projectId",
				params: { projectId },
			});
		};

		window.addEventListener("keydown", handleCloseTaskDetailShortcut);

		return () => {
			window.removeEventListener("keydown", handleCloseTaskDetailShortcut);
		};
	}, [projectId, router]);

	const handleCloseTaskDetail = useCallback(() => {
		void router.navigate({
			to: "/projects/$projectId",
			params: { projectId },
		});
	}, [projectId, router]);

	useEffect(() => {
		const header = headerRef.current;

		if (!header) {
			return;
		}

		const handleMouseDown = (event: MouseEvent) => {
			if (!shouldHandleMiddleClickClose(event)) {
				return;
			}

			event.preventDefault();
			handleCloseTaskDetail();
		};

		header.addEventListener("mousedown", handleMouseDown);

		return () => {
			header.removeEventListener("mousedown", handleMouseDown);
		};
	}, [handleCloseTaskDetail]);

	return (
		<div className="flex h-full flex-1 overflow-hidden">
			{task ? (
				<div
					id="task-detail-panel"
					className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-background custom-scrollbar"
					style={{ maxWidth: "900px", margin: "0 auto", width: "100%" }}
				>
						{/* Header - Consistent with Sidebar and Terminal */}
						<div
							ref={headerRef}
							className="h-20 flex items-center justify-between px-6 border-b sticky top-0 bg-background/80 backdrop-blur-md z-10"
						>
							<div className="flex items-center gap-4 min-w-0">
								<Link
									to="/projects/$projectId"
									params={{ projectId: task.projectId }}
									className="inline-flex items-center justify-center size-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
									data-middle-click-close-ignore
									title="Back to kanban (Alt+W)"
								>
									<ArrowLeft className="size-4" />
								</Link>
								<div className="flex flex-col min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
											{task.id}
										</span>
										<span
											className={getTaskCategoryBadgeClassName(task.category)}
										>
											{TASK_CATEGORY_LABELS[task.category]}
										</span>
										{task.isRunning && (
											<div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 leading-none">
												<span className="relative flex size-1.5">
													<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
													<span className="relative inline-flex rounded-full size-1.5 bg-green-500" />
												</span>
												<span className="text-[8px] font-mono font-bold text-green-500 uppercase tracking-widest">
													Running
												</span>
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
										{task.doneAt
											? formatTimestamp(task.doneAt)
											: "In Progress Session"}
									</div>
									<div className="absolute -right-2 -bottom-2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
										<CheckCircle2 className="size-16" />
									</div>
								</div>
							</div>

							{/* Notes Panel - Flexible height */}
							<div className="flex-1 flex flex-col min-h-[280px] rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden">
								<TaskNotesEditor
									key={task.id}
									taskId={task.id}
									initialNotes={task.notes}
									onSaved={async () => {
										await router.invalidate();
									}}
								/>
							</div>
					</div>
				</div>
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
	);
}

function getTaskCategoryBadgeClassName(category: TaskCategory) {
	const baseClassName =
		"inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest leading-none";

	switch (category) {
		case "feature":
			return `${baseClassName} border-sky-500/30 bg-sky-500/10 text-sky-300`;
		case "bug":
			return `${baseClassName} border-rose-500/30 bg-rose-500/10 text-rose-300`;
		default:
			return `${baseClassName} border-amber-500/30 bg-amber-500/10 text-amber-300`;
	}
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
