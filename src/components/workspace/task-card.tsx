import { useNavigate } from "@tanstack/react-router";
import { Terminal, Trash2 } from "lucide-react";
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
import { cn } from "#/lib/utils";

interface TaskCardProps {
	id: string;
	projectId: string;
	title: string;
	notes?: string;
	className?: string;
	draggable?: boolean;
	isDragging?: boolean;
	isRunning?: boolean;
	onDragStart?: (event: DragEvent<HTMLElement>) => void;
	onDragEnd?: () => void;
	onDelete: (taskId: string) => Promise<void> | void;
}

export function TaskCard({
	id,
	projectId,
	title,
	notes,
	className,
	draggable,
	isDragging,
	isRunning,
	onDragStart,
	onDragEnd,
	onDelete,
}: TaskCardProps) {
	const navigate = useNavigate();
	const cardRef = useRef<HTMLDivElement>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isClickSuppressed, setIsClickSuppressed] = useState(false);
	const taskLabel = id.startsWith("TASK-") ? `#${id.slice(5)}` : id.slice(0, 8);
	const notesPreview = summarizeNotes(notes);
	const metaBadgeClassName =
		"inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] leading-none font-mono font-bold tracking-tight";

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

	return (
		<>
			<li
				className={cn(
					"group list-none flex w-full shrink-0 overflow-hidden rounded-xl",
					isDragging && "opacity-45",
					className,
				)}
				draggable={draggable}
				onDragStart={handleTaskDragStart}
				onDragEnd={handleTaskDragEnd}
			>
				<div
					ref={cardRef}
					className={cn(
						"relative isolate flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card bg-clip-padding shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing",
						"hover:border-primary/50 hover:bg-white/[0.02]",
					)}
				>
					<div className="p-3 space-y-3">
						{/* Top Row: ID and Delete */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span
									className={cn(
										metaBadgeClassName,
										"border border-border/70 bg-muted/35 text-muted-foreground/80",
									)}
								>
									{taskLabel}
								</span>
								{isRunning && (
									<span
										className={cn(
											metaBadgeClassName,
											"gap-1.5 border border-green-500/20 bg-green-500/5 text-green-500 uppercase",
										)}
									>
										<Terminal className="size-2.5" />
										Running
									</span>
								)}
							</div>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									e.preventDefault();
									setIsDeleteDialogOpen(true);
								}}
								className="appearance-none border-0 bg-transparent flex items-center gap-1 text-[8px] font-bold text-muted-foreground/60 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:border-red-500/20 hover:bg-red-500/5 cursor-pointer uppercase tracking-tighter"
							>
								<Trash2 className="size-3" />
								<span>Delete</span>
							</button>
						</div>

						{/* Title Area */}
						<button
							type="button"
							onClick={handleOpenTask}
							onKeyDown={handleCardKeyDown}
							className="appearance-none border-0 bg-transparent block w-full p-0 space-y-1 text-left cursor-pointer"
						>
							<h3 className="text-[12px] font-medium leading-[1.4] text-foreground/90 group-hover:text-foreground transition-colors line-clamp-1">
								{title}
							</h3>
							{notesPreview ? (
								<p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
									{notesPreview}
								</p>
							) : (
								<p className="text-[10px] text-muted-foreground/60 leading-snug">
									No notes yet.
								</p>
							)}
						</button>
					</div>
				</div>
			</li>

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
