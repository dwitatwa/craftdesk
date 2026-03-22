import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import type { BoardColumn } from "#/lib/craftdesk";
import { CreateTaskModal } from "./create-task-modal";
import { TaskCard } from "./task-card";

interface ColumnProps {
	column: BoardColumn;
	onCreateTask: (input: {
		columnId: string;
		title: string;
		description: string;
	}) => Promise<void> | void;
	onDeleteColumn: (columnId: string) => Promise<void> | void;
	onDeleteTask: (taskId: string) => Promise<void> | void;
}

function Column({
	column,
	onCreateTask,
	onDeleteColumn,
	onDeleteTask,
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
		<div className="flex flex-col w-72 h-full gap-4 shrink-0">
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

			<div className="flex flex-col gap-3 h-full overflow-y-auto pr-1 pb-4 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 transition-colors">
				{column.tasks.map((task) => (
					<TaskCard key={task.id} {...task} onDelete={onDeleteTask} />
				))}
				<Button
					variant="ghost"
					className="w-full h-8 justify-start gap-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all border border-dashed border-border/50 hover:border-primary/30 mt-1 cursor-pointer"
					onClick={() => setIsCreateModalOpen(true)}
				>
					<Plus className="size-3" />
					Add Task
				</Button>
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
		description: string;
	}) => Promise<void> | void;
	onDeleteColumn: (columnId: string) => Promise<void> | void;
	onDeleteTask: (taskId: string) => Promise<void> | void;
}

export function KanbanBoard({
	columns,
	onCreateTask,
	onDeleteColumn,
	onDeleteTask,
}: KanbanBoardProps) {
	return (
		<div className="flex flex-1 gap-6 p-6 h-full overflow-x-auto scrollbar-thin scrollbar-thumb-border">
			{columns.length > 0 ? (
				columns.map((column) => (
					<Column
						key={column.id}
						column={column}
						onCreateTask={onCreateTask}
						onDeleteColumn={onDeleteColumn}
						onDeleteTask={onDeleteTask}
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
