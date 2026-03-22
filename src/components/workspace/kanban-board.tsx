import { Plus, MoreHorizontal } from "lucide-react";
import { TaskCard, type TaskStatus } from "./task-card";
import { Button } from "#/components/ui/button";

interface ColumnProps {
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
  }>;
}

function Column({ title, tasks }: ColumnProps) {
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
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1 pb-4 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 transition-colors">
        {tasks.map(task => (
          <TaskCard key={task.id} {...task} />
        ))}
        <Button variant="ghost" className="w-full h-8 justify-start gap-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all border border-dashed border-border/50 hover:border-primary/30 mt-1">
          <Plus className="size-3" />
          Add Task
        </Button>
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const mockTasks = {
    backlog: [
      { id: "DEV-104", title: "Implement dark mode persistence", status: "idle" as const },
      { id: "DEV-108", title: "Refactor terminal state management", status: "idle" as const },
    ],
    todo: [
      { id: "DEV-105", title: "Design new command palette", status: "idle" as const },
    ],
    inProgress: [
      { id: "DEV-101", title: "Compile production kernel", status: "running" as const },
      { id: "DEV-103", title: "Optimize asset loading pipeline", status: "idle" as const },
    ],
    done: [
      { id: "DEV-98", title: "Fix layout shift on mobile", status: "idle" as const },
      { id: "DEV-95", title: "Update documentation for API", status: "idle" as const },
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
