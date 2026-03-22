import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TaskCard, type TaskStatus } from "./task-card";
import { Button } from "#/components/ui/button";
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
import { CreateTaskModal } from "./create-task-modal";

interface ColumnProps {
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
  }>;
}

function Column({ title, tasks }: ColumnProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleDeleteColumn = () => {
    console.log(`Deleting column: ${title}`);
    // Real delete logic would go here
  };

  return (
    <div className="flex flex-col w-72 h-full gap-4 shrink-0">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80">
            {title}
          </h2>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
            {tasks.length}
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
        {tasks.map(task => (
          <TaskCard key={task.id} {...task} />
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
        columnTitle={title}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{title}" column? All tasks within this column will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteColumn} className="bg-red-600 hover:bg-red-700 cursor-pointer">
              Delete Column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function KanbanBoard() {
  const mockTasks = {
    backlog: [
      { id: "DEV-104", title: "Implement dark mode persistence", description: "Save user theme preference to local storage and sync with account settings.", status: "idle" as const },
      { id: "DEV-108", title: "Refactor terminal state management", description: "Migrate terminal history to a more performant data structure to support longer sessions.", status: "idle" as const },
    ],
    todo: [
      { id: "DEV-105", title: "Design new command palette", description: "Create a modern command interface for quick actions and file searching.", status: "idle" as const },
    ],
    inProgress: [
      { id: "DEV-101", title: "Compile production kernel", description: "Running build scripts for the main application engine with optimized flags.", status: "running" as const },
      { id: "DEV-103", title: "Optimize asset loading pipeline", description: "Implementing lazy loading and progressive image decoding for the workspace.", status: "idle" as const },
    ],
    done: [
      { id: "DEV-98", title: "Fix layout shift on mobile", description: "Resolved jumpy transitions when switching between board and list views on small screens.", status: "idle" as const },
      { id: "DEV-95", title: "Update documentation for API", description: "Completed the reference guide for all public REST endpoints.", status: "idle" as const },
    ]
  };

  return (
    <div className="flex flex-1 gap-6 p-6 h-full overflow-x-auto scrollbar-thin scrollbar-thumb-border">
      <Column title="Backlog" tasks={mockTasks.backlog} />
      <Column title="To Do" tasks={mockTasks.todo} />
      <Column title="In Progress" tasks={mockTasks.inProgress} />
      <Column title="Done" tasks={mockTasks.done} />
    </div>
  );
}
