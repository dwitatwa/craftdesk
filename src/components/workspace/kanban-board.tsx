import { Plus, Trash2 } from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useState } from "react";
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
import { Button } from "#/components/ui/button";
import type { BoardColumn, BoardTask, TaskCategory } from "#/lib/craftdesk";
import { cn } from "#/lib/utils";
import { CreateTaskModal } from "./create-task-modal";
import { TaskCard } from "./task-card";

interface DropTarget {
	columnId: string;
	taskId: string | null;
	position: number;
	placement: "before" | "after" | "end";
}

interface ColumnProps {
	column: BoardColumn;
	onCreateTask: (input: {
		columnId: string;
		title: string;
		category: TaskCategory;
	}) => Promise<void> | void;
	onDeleteColumn: (columnId: string) => Promise<void> | void;
	onUpdateTask: (
		taskId: string,
		input: { title: string; category: TaskCategory; notes: string },
	) => Promise<void> | void;
	onDeleteTask: (taskId: string) => Promise<void> | void;
	onStopTaskTerminal: (taskId: string) => Promise<void> | void;
	onDragOverColumn: (event: DragEvent<HTMLElement>, columnId: string) => void;
	onDropOnColumn: (event: DragEvent<HTMLElement>, columnId: string) => void;
	onDragOverTask: (
		event: DragEvent<HTMLLIElement>,
		columnId: string,
		taskId: string,
		taskIndex: number,
	) => void;
	onDropOnTask: (
		event: DragEvent<HTMLLIElement>,
		columnId: string,
		taskId: string,
		taskIndex: number,
	) => void;
	onDragStartTask: (
		event: DragEvent<HTMLElement>,
		taskId: string,
		columnId: string,
	) => void;
	onDragEndTask: () => void;
	activeDropTarget: DropTarget | null;
	draggedTaskId: string | null;
}

function Column({
	column,
	onCreateTask,
	onDeleteColumn,
	onUpdateTask,
	onDeleteTask,
	onStopTaskTerminal,
	onDragOverColumn,
	onDropOnColumn,
	onDragOverTask,
	onDropOnTask,
	onDragStartTask,
	onDragEndTask,
	activeDropTarget,
	draggedTaskId,
}: ColumnProps) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDeleteColumn = async () => {
		setIsDeleting(true);

		try {
			await onDeleteColumn(column.id);
			setIsDeleteDialogOpen(false);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="grid h-full min-h-0 w-72 shrink-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
			<div className="flex items-center justify-between px-2">
				<div className="flex items-center gap-2">
					<h2 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80">
						{column.title}
					</h2>
					<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
						{column.tasks.length}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="size-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
						onClick={() => setIsDeleteDialogOpen(true)}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>

			<div
				className={cn(
					"flex min-h-0 flex-col overflow-hidden rounded-xl border border-transparent transition-colors",
					activeDropTarget?.columnId === column.id &&
						"border-primary/40 bg-primary/5",
				)}
			>
				<ul
					className="custom-scrollbar m-0 flex min-h-0 flex-1 list-none flex-col gap-3 overflow-y-auto p-0 pr-1 pb-4 [scrollbar-gutter:stable]"
					aria-label={`${column.title} tasks`}
					onDragOver={(event) => onDragOverColumn(event, column.id)}
					onDrop={(event) => onDropOnColumn(event, column.id)}
				>
					{column.tasks.map((task, taskIndex) => {
						const showDropIndicatorTop =
							draggedTaskId !== task.id &&
							activeDropTarget?.columnId === column.id &&
							activeDropTarget.taskId === task.id &&
							activeDropTarget.placement === "before";
						const showDropIndicatorBottom =
							draggedTaskId !== task.id &&
							activeDropTarget?.columnId === column.id &&
							activeDropTarget.taskId === task.id &&
							activeDropTarget.placement === "after";

						return (
							<TaskCard
								key={task.id}
								{...task}
								columnTitle={column.title}
								draggable
								isDragging={draggedTaskId === task.id}
								onDragStart={(event) =>
									onDragStartTask(event, task.id, column.id)
								}
								onDragEnd={onDragEndTask}
								onDragOver={(event) =>
									onDragOverTask(event, column.id, task.id, taskIndex)
								}
								onDrop={(event) =>
									onDropOnTask(event, column.id, task.id, taskIndex)
								}
								showDropIndicatorTop={showDropIndicatorTop}
								showDropIndicatorBottom={showDropIndicatorBottom}
								onUpdateTask={onUpdateTask}
								onDelete={onDeleteTask}
								onStopTerminal={onStopTaskTerminal}
							/>
						);
					})}
					<li>
						<Button
							variant="ghost"
							className="w-full h-8 justify-start gap-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all border border-dashed border-border/50 hover:border-primary/30 mt-1 cursor-pointer"
							onClick={() => setIsCreateModalOpen(true)}
						>
							<Plus className="size-3" />
							Add Task
						</Button>
					</li>
				</ul>
			</div>

			<CreateTaskModal
				isOpen={isCreateModalOpen}
				onOpenChange={setIsCreateModalOpen}
				columnTitle={column.title}
				onCreate={(input) =>
					onCreateTask({
						columnId: column.id,
						...input,
					})
				}
			/>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Column</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete the "{column.title}" column? All
							tasks within this column will be permanently removed. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteColumn}
							className="bg-red-600 hover:bg-red-700 cursor-pointer"
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete Column"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

interface KanbanBoardProps {
	columns: BoardColumn[];
	onCreateTask: (input: {
		columnId: string;
		title: string;
		category: TaskCategory;
	}) => Promise<void> | void;
	onDeleteColumn: (columnId: string) => Promise<void> | void;
	onUpdateTask: (
		taskId: string,
		input: { title: string; category: TaskCategory; notes: string },
	) => Promise<void> | void;
	onDeleteTask: (taskId: string) => Promise<void> | void;
	onStopTaskTerminal: (taskId: string) => Promise<void> | void;
	onMoveTask: (
		taskId: string,
		targetColumnId: string,
		targetPosition: number,
	) => Promise<void> | void;
}

function moveTaskLocally(
	columns: BoardColumn[],
	taskId: string,
	sourceColumnId: string,
	targetColumnId: string,
	targetPosition: number,
): BoardColumn[] {
	const sourceColumn = columns.find((column) => column.id === sourceColumnId);
	const targetColumn = columns.find((column) => column.id === targetColumnId);
	const originalTask = sourceColumn?.tasks.find((task) => task.id === taskId);
	const sourceTaskIndex = sourceColumn?.tasks.findIndex(
		(task) => task.id === taskId,
	);

	if (
		!sourceColumn ||
		!targetColumn ||
		!originalTask ||
		sourceTaskIndex === undefined ||
		sourceTaskIndex < 0
	) {
		return columns;
	}

	const movedTaskForTarget: BoardTask = {
		...originalTask,
		columnId: targetColumnId,
		position: 0,
	};

	if (sourceColumnId === targetColumnId) {
		const remainingTasks = sourceColumn.tasks.filter(
			(task) => task.id !== taskId,
		);
		const nextTaskIndex = Math.max(
			0,
			Math.min(
				targetPosition - (sourceTaskIndex < targetPosition ? 1 : 0),
				remainingTasks.length,
			),
		);

		if (nextTaskIndex === sourceTaskIndex) {
			return columns;
		}

		const reorderedTasks = [...remainingTasks];
		reorderedTasks.splice(nextTaskIndex, 0, movedTaskForTarget);

		return columns.map((column) =>
			column.id === sourceColumnId
				? {
						...column,
						tasks: reorderedTasks.map(
							(task, index): BoardTask => ({
								...task,
								position: index,
							}),
						),
					}
				: column,
		);
	}

	return columns.map((column) => {
		if (column.id === sourceColumnId) {
			const nextTasks = column.tasks
				.filter((task) => task.id !== taskId)
				.map(
					(task, index): BoardTask => ({
						...task,
						position: index,
					}),
				);

			return {
				...column,
				tasks: nextTasks,
			};
		}

		if (column.id !== targetColumnId) {
			return column;
		}

		const nextTasks = [...column.tasks];
		const nextTaskIndex = Math.max(
			0,
			Math.min(targetPosition, nextTasks.length),
		);
		nextTasks.splice(nextTaskIndex, 0, movedTaskForTarget);

		return {
			...column,
			tasks: nextTasks.map(
				(task, index): BoardTask => ({
					...task,
					position: index,
				}),
			),
		};
	});
}

export function KanbanBoard({
	columns,
	onCreateTask,
	onDeleteColumn,
	onUpdateTask,
	onDeleteTask,
	onStopTaskTerminal,
	onMoveTask,
}: KanbanBoardProps) {
	const [boardColumns, setBoardColumns] = useState(columns);
	const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
	const [dragSourceColumnId, setDragSourceColumnId] = useState<string | null>(
		null,
	);
	const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(
		null,
	);

	useEffect(() => {
		setBoardColumns(columns);
	}, [columns]);

	const handleDragStartTask = (
		event: DragEvent<HTMLElement>,
		taskId: string,
		columnId: string,
	) => {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", taskId);
		setDraggedTaskId(taskId);
		setDragSourceColumnId(columnId);
	};

	const resetDragState = () => {
		setDraggedTaskId(null);
		setDragSourceColumnId(null);
		setActiveDropTarget(null);
	};

	const updateDropTarget = (nextTarget: DropTarget) => {
		setActiveDropTarget((currentTarget) =>
			currentTarget &&
			currentTarget.columnId === nextTarget.columnId &&
			currentTarget.taskId === nextTarget.taskId &&
			currentTarget.position === nextTarget.position &&
			currentTarget.placement === nextTarget.placement
				? currentTarget
				: nextTarget,
		);
	};

	const handleDragOverColumn = (
		event: DragEvent<HTMLElement>,
		columnId: string,
	) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";

		const eventTarget = event.target;
		if (eventTarget instanceof HTMLElement) {
			const taskDropZone = eventTarget.closest("[data-task-drop-zone='true']");
			if (
				taskDropZone instanceof HTMLElement &&
				event.currentTarget.contains(taskDropZone)
			) {
				return;
			}
		}

		const column = boardColumns.find((candidate) => candidate.id === columnId);
		if (!column) {
			return;
		}

		updateDropTarget({
			columnId,
			taskId: null,
			position: column.tasks.length,
			placement: "end",
		});
	};

	const applyDrop = async (
		taskId: string,
		sourceColumnId: string,
		targetColumnId: string,
		targetPosition: number,
	) => {
		const previousColumns = boardColumns;
		const nextColumns = moveTaskLocally(
			previousColumns,
			taskId,
			sourceColumnId,
			targetColumnId,
			targetPosition,
		);
		resetDragState();

		if (nextColumns === previousColumns) {
			return;
		}

		setBoardColumns(nextColumns);

		try {
			await onMoveTask(taskId, targetColumnId, targetPosition);
		} catch {
			setBoardColumns(previousColumns);
		}
	};

	const handleDragOverTask = (
		event: DragEvent<HTMLLIElement>,
		columnId: string,
		taskId: string,
		taskIndex: number,
	) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";

		const { top, height } = event.currentTarget.getBoundingClientRect();
		const placement = event.clientY < top + height / 2 ? "before" : "after";
		const position = placement === "before" ? taskIndex : taskIndex + 1;

		updateDropTarget({
			columnId,
			taskId,
			position,
			placement,
		});
	};

	const handleDropOnColumn = async (
		event: DragEvent<HTMLElement>,
		targetColumnId: string,
	) => {
		event.preventDefault();

		const eventTarget = event.target;
		if (eventTarget instanceof HTMLElement) {
			const taskDropZone = eventTarget.closest("[data-task-drop-zone='true']");
			if (
				taskDropZone instanceof HTMLElement &&
				event.currentTarget.contains(taskDropZone)
			) {
				return;
			}
		}

		const taskId = draggedTaskId ?? event.dataTransfer.getData("text/plain");
		const sourceColumnId = dragSourceColumnId;
		const targetPosition =
			activeDropTarget?.columnId === targetColumnId
				? activeDropTarget.position
				: (boardColumns.find((column) => column.id === targetColumnId)?.tasks
						.length ?? 0);

		if (!taskId || !sourceColumnId) {
			resetDragState();
			return;
		}

		await applyDrop(taskId, sourceColumnId, targetColumnId, targetPosition);
	};

	const handleDropOnTask = async (
		event: DragEvent<HTMLLIElement>,
		targetColumnId: string,
		taskId: string,
		taskIndex: number,
	) => {
		event.preventDefault();
		event.stopPropagation();

		const draggedId = draggedTaskId ?? event.dataTransfer.getData("text/plain");
		const sourceColumnId = dragSourceColumnId;
		const activeTarget =
			activeDropTarget?.columnId === targetColumnId &&
			activeDropTarget.taskId === taskId
				? activeDropTarget
				: null;
		const targetPosition =
			activeTarget?.position ??
			(activeTarget?.placement === "after" ? taskIndex + 1 : taskIndex);

		if (!draggedId || !sourceColumnId) {
			resetDragState();
			return;
		}

		await applyDrop(draggedId, sourceColumnId, targetColumnId, targetPosition);
	};

	return (
		<div className="flex h-full min-h-0 flex-1 gap-6 overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-border">
			{boardColumns.length > 0 ? (
				boardColumns.map((column) => (
					<Column
						key={column.id}
						column={column}
						onCreateTask={onCreateTask}
						onDeleteColumn={onDeleteColumn}
						onUpdateTask={onUpdateTask}
						onDeleteTask={onDeleteTask}
						onStopTaskTerminal={onStopTaskTerminal}
						onDragOverColumn={handleDragOverColumn}
						onDropOnColumn={handleDropOnColumn}
						onDragOverTask={handleDragOverTask}
						onDropOnTask={handleDropOnTask}
						onDragStartTask={handleDragStartTask}
						onDragEndTask={resetDragState}
						activeDropTarget={activeDropTarget}
						draggedTaskId={draggedTaskId}
					/>
				))
			) : (
				<div className="flex h-full min-w-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
					<div className="space-y-2">
						<h2 className="text-sm font-semibold">No columns yet</h2>
						<p className="text-xs text-muted-foreground">
							Create a column to start organizing work on this board.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
