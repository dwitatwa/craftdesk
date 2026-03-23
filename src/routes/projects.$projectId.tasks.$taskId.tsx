import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TaskNotesEditor } from "#/components/workspace/task-notes-editor";
import { Terminal } from "#/components/workspace/terminal";
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

const DEFAULT_DETAIL_PANEL_RATIO = 0.48;
const MIN_DETAIL_PANEL_WIDTH = 360;
const MIN_TERMINAL_PANEL_WIDTH = 420;

function TaskDetailView() {
	const { projectId } = Route.useParams();
	const { task } = Route.useLoaderData();
	const router = useRouter();
	const splitContainerRef = useRef<HTMLDivElement | null>(null);
	const dragStateRef = useRef<{
		containerLeft: number;
		containerWidth: number;
	} | null>(null);
	const [detailPanelWidth, setDetailPanelWidth] = useState<number | null>(null);
	const [isDraggingDivider, setIsDraggingDivider] = useState(false);

	useEffect(() => {
		const container = splitContainerRef.current;

		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		const syncWidth = (containerWidth: number) => {
			setDetailPanelWidth((currentWidth) => {
				const fallbackWidth = containerWidth * DEFAULT_DETAIL_PANEL_RATIO;
				return clampDetailPanelWidth(
					currentWidth ?? fallbackWidth,
					containerWidth,
				);
			});
		};

		syncWidth(container.getBoundingClientRect().width);

		const resizeObserver = new ResizeObserver(([entry]) => {
			syncWidth(entry.contentRect.width);
		});

		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!isDraggingDivider) {
			return;
		}

		const handlePointerMove = (event: PointerEvent) => {
			const dragState = dragStateRef.current;

			if (!dragState) {
				return;
			}

			const nextWidth = clampDetailPanelWidth(
				event.clientX - dragState.containerLeft,
				dragState.containerWidth,
			);

			setDetailPanelWidth(nextWidth);
		};

		const stopDragging = () => {
			dragStateRef.current = null;
			setIsDraggingDivider(false);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", stopDragging);
		window.addEventListener("pointercancel", stopDragging);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", stopDragging);
			window.removeEventListener("pointercancel", stopDragging);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, [isDraggingDivider]);

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

	const handleDividerPointerDown = (
		event: React.PointerEvent<HTMLButtonElement>,
	) => {
		if (event.button !== 0) {
			return;
		}

		const container = splitContainerRef.current;

		if (!container) {
			return;
		}

		const rect = container.getBoundingClientRect();

		dragStateRef.current = {
			containerLeft: rect.left,
			containerWidth: rect.width,
		};

		setDetailPanelWidth((currentWidth) =>
			clampDetailPanelWidth(
				currentWidth ?? rect.width * DEFAULT_DETAIL_PANEL_RATIO,
				rect.width,
			),
		);
		setIsDraggingDivider(true);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	};

	const handleDividerDoubleClick = () => {
		const container = splitContainerRef.current;

		if (!container) {
			return;
		}

		setDetailPanelWidth(
			clampDetailPanelWidth(
				container.getBoundingClientRect().width * DEFAULT_DETAIL_PANEL_RATIO,
				container.getBoundingClientRect().width,
			),
		);
	};

	const handleDividerKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
	) => {
		const container = splitContainerRef.current;

		if (!container) {
			return;
		}

		const containerWidth = container.getBoundingClientRect().width;
		const step = event.shiftKey ? 48 : 24;
		const currentWidth = clampDetailPanelWidth(
			detailPanelWidth ?? containerWidth * DEFAULT_DETAIL_PANEL_RATIO,
			containerWidth,
		);

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			setDetailPanelWidth(
				clampDetailPanelWidth(currentWidth - step, containerWidth),
			);
		}

		if (event.key === "ArrowRight") {
			event.preventDefault();
			setDetailPanelWidth(
				clampDetailPanelWidth(currentWidth + step, containerWidth),
			);
		}
	};

	const detailWidth = detailPanelWidth ?? getDefaultDetailPanelWidthStyle();

	return (
		<div ref={splitContainerRef} className="flex h-full flex-1 overflow-hidden">
			{task ? (
				<>
					{/* Left Side: Details */}
					<div
						id="task-detail-panel"
						className="relative flex min-w-0 flex-col overflow-y-auto bg-background custom-scrollbar"
						style={{ width: detailWidth }}
					>
						{/* Header - Consistent with Sidebar and Terminal */}
						<div className="h-20 flex items-center justify-between px-6 border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
							<div className="flex items-center gap-4 min-w-0">
								<Link
									to="/projects/$projectId"
									params={{ projectId: task.projectId }}
									className="inline-flex items-center justify-center size-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
									title="Back to kanban (Alt+W)"
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
						<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px translate-x-1/2 bg-border/80" />
						<button
							type="button"
							className="absolute inset-y-0 right-0 z-20 w-3 translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
							onPointerDown={handleDividerPointerDown}
							onDoubleClick={handleDividerDoubleClick}
							onKeyDown={handleDividerKeyDown}
							aria-controls="task-detail-panel task-terminal-panel"
							aria-label="Resize task detail panels"
							tabIndex={0}
						/>
					</div>

					<div id="task-terminal-panel" className="flex min-w-0 flex-1">
						<Terminal
							autoStart={false}
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
					</div>
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
	);
}

function clampDetailPanelWidth(width: number, containerWidth: number) {
	const maxWidth = Math.max(
		MIN_DETAIL_PANEL_WIDTH,
		containerWidth - MIN_TERMINAL_PANEL_WIDTH,
	);

	return Math.min(Math.max(width, MIN_DETAIL_PANEL_WIDTH), maxWidth);
}

function getDefaultDetailPanelWidthStyle() {
	return `clamp(${MIN_DETAIL_PANEL_WIDTH}px, ${DEFAULT_DETAIL_PANEL_RATIO * 100}%, max(${MIN_DETAIL_PANEL_WIDTH}px, calc(100% - ${MIN_TERMINAL_PANEL_WIDTH}px)))`;
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
