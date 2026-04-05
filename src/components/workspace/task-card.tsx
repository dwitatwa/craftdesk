import { useNavigate } from "@tanstack/react-router";
import { Pencil, Square, Trash2 } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { TASK_CATEGORY_LABELS, type TaskCategory } from "#/lib/craftdesk";
import { cn } from "#/lib/utils";
import { EditTaskModal } from "./edit-task-modal";

interface TaskCardProps {
	id: string;
	projectId: string;
	title: string;
	category: TaskCategory;
	notes?: string;
	columnTitle?: string;
	className?: string;
	draggable?: boolean;
	isDragging?: boolean;
	isRunning?: boolean;
	onDragStart?: (event: DragEvent<HTMLElement>) => void;
	onDragEnd?: () => void;
	onDragOver?: (event: DragEvent<HTMLLIElement>) => void;
	onDrop?: (event: DragEvent<HTMLLIElement>) => void;
	showDropIndicatorTop?: boolean;
	showDropIndicatorBottom?: boolean;
	onUpdateTask: (
		taskId: string,
		input: { title: string; category: TaskCategory; notes: string },
	) => Promise<void> | void;
	onDelete: (taskId: string) => Promise<void> | void;
	onStopTerminal: (taskId: string) => Promise<void> | void;
}

export function TaskCard({
	id,
	projectId,
	title,
	category,
	notes,
	columnTitle,
	className,
	draggable,
	isDragging,
	isRunning,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
	showDropIndicatorTop,
	showDropIndicatorBottom,
	onUpdateTask,
	onDelete,
	onStopTerminal,
}: TaskCardProps) {
	const navigate = useNavigate();
	const cardRef = useRef<HTMLDivElement>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isStoppingTerminal, setIsStoppingTerminal] = useState(false);
	const [isClickSuppressed, setIsClickSuppressed] = useState(false);
	const taskLabel = id.startsWith("TASK-") ? `#${id.slice(5)}` : id.slice(0, 8);
	const notesPreview = summarizeNotes(notes);
	const metaBadgeClassName =
		"inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] leading-none font-mono font-bold tracking-tight";
	const categoryBadgeClassName = getTaskCategoryBadgeClassName(category);

	const handleDelete = async () => {
		setIsDeleting(true);

		try {
			await onDelete(id);
			setIsDeleteDialogOpen(false);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleOpenTask = () => {
		if (isClickSuppressed || isDragging) {
			return;
		}

		void navigate({
			to: "/projects/$projectId/tasks/$taskId",
			params: { projectId, taskId: id },
		});
	};

	const handleCardKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		handleOpenTask();
	};

	const handleTaskDragStart = (event: DragEvent<HTMLElement>) => {
		setIsClickSuppressed(true);

		if (cardRef.current) {
			event.dataTransfer.setDragImage(cardRef.current, 24, 24);
		}

		onDragStart?.(event);
	};

	const handleTaskDragEnd = () => {
		onDragEnd?.();
		window.setTimeout(() => {
			setIsClickSuppressed(false);
		}, 0);
	};

	const handleStopTerminal = async () => {
		setIsStoppingTerminal(true);

		try {
			await onStopTerminal(id);
		} finally {
			setIsStoppingTerminal(false);
		}
	};

	return (
		<>
			<li
				data-task-drop-zone="true"
				data-task-id={id}
				onDragOver={onDragOver}
				onDrop={onDrop}
				className={cn(
					"group relative list-none flex w-full shrink-0 overflow-hidden rounded-lg",
					isDragging && "opacity-45",
					className,
				)}
			>
				{showDropIndicatorTop ? (
					<div className="pointer-events-none absolute inset-x-3 top-0 z-10 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background)),0_0_12px_hsl(var(--primary)/0.35)]" />
				) : null}
				{showDropIndicatorBottom ? (
					<div className="pointer-events-none absolute inset-x-3 bottom-0 z-10 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background)),0_0_12px_hsl(var(--primary)/0.35)]" />
				) : null}
				<div
					ref={cardRef}
					className={cn(
						"relative isolate flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card bg-clip-padding shadow-sm transition-all duration-150",
						"hover:border-primary/50",
					)}
				>
					<div className="p-3 space-y-3">
						{/* Top Row: ID */}
						<button
							type="button"
							aria-label={`Drag ${title}`}
							className={cn(
								"flex w-full items-center justify-between rounded-md border-0 bg-transparent p-0 text-left",
								draggable && "cursor-grab active:cursor-grabbing",
							)}
							draggable={draggable}
							onClick={(event) => {
								event.preventDefault();
							}}
							onDragStart={handleTaskDragStart}
							onDragEnd={handleTaskDragEnd}
						>
							<div className="flex items-center gap-2">
								<span
									className={cn(
										metaBadgeClassName,
										"border border-border bg-muted/50 text-muted-foreground",
									)}
								>
									{taskLabel}
								</span>
								<span
									className={cn(metaBadgeClassName, categoryBadgeClassName)}
								>
									{TASK_CATEGORY_LABELS[category]}
								</span>
							</div>
							<div />
						</button>

						{/* Title Area */}
						<button
							type="button"
							onClick={handleOpenTask}
							onKeyDown={handleCardKeyDown}
							className="appearance-none border-0 bg-transparent block w-full p-0 space-y-1 text-left cursor-pointer"
						>
							<h3 className="text-xs font-semibold leading-[1.4] text-foreground/90 group-hover:text-foreground transition-colors line-clamp-2">
								{title}
							</h3>
							{notesPreview ? (
								<p className="text-[10px] text-muted-foreground/80 leading-snug line-clamp-2">
									{notesPreview}
								</p>
							) : (
								<p className="text-[10px] text-muted-foreground/50 leading-snug italic">
									No notes yet.
								</p>
							)}
						</button>
					</div>
					<div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 bg-muted/10">
						<div className="min-w-0">
							{isRunning ? (
								<button
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										event.preventDefault();
										void handleStopTerminal();
									}}
									disabled={isStoppingTerminal}
									className="appearance-none border-0 bg-transparent flex items-center gap-1 text-[10px] font-bold text-amber-500/80 hover:text-amber-500 transition-colors px-1.5 py-0.5 rounded hover:bg-amber-500/5 cursor-pointer uppercase tracking-tight disabled:cursor-not-allowed disabled:opacity-60"
								>
									<Square className="size-3" />
									<span>
										{isStoppingTerminal ? "Stopping..." : "Stop Terminal"}
									</span>
								</button>
							) : null}
						</div>
						<div className="flex items-center justify-end gap-1">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									setIsEditModalOpen(true);
								}}
								className="appearance-none border-0 bg-transparent flex items-center gap-1 text-[10px] font-bold text-muted-foreground/80 hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent cursor-pointer uppercase tracking-tight"
							>
								<Pencil className="size-3" />
								<span>Edit</span>
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									setIsDeleteDialogOpen(true);
								}}
								className="appearance-none border-0 bg-transparent flex items-center gap-1 text-[10px] font-bold text-muted-foreground/80 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/5 cursor-pointer uppercase tracking-tight"
							>
								<Trash2 className="size-3" />
								<span>Delete</span>
							</button>
						</div>
					</div>
				</div>
			</li>

			<EditTaskModal
				isOpen={isEditModalOpen}
				onOpenChange={setIsEditModalOpen}
				columnTitle={columnTitle}
				initialTitle={title}
				initialCategory={category}
				initialNotes={notes ?? ""}
				onSave={(input) => onUpdateTask(id, input)}
			/>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete task{" "}
							{id}
							and remove its data from our servers.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete Task"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function summarizeNotes(value?: string) {
	return (value ?? "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[.*?\]\(.*?\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^\s*[-*+]\s+/gm, "")
		.replace(/^\s*\d+\.\s+/gm, "")
		.replace(/[>*_~]/g, "")
		.replace(/\n+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getTaskCategoryBadgeClassName(category: TaskCategory) {
	switch (category) {
		case "feature":
			return "border border-sky-500/30 bg-sky-500/10 text-sky-300";
		case "bug":
			return "border border-rose-500/30 bg-rose-500/10 text-rose-300";
		default:
			return "border border-amber-500/30 bg-amber-500/10 text-amber-300";
	}
}
