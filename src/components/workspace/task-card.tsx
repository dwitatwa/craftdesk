import { 
  Calendar, 
  CheckSquare, 
  MessageSquare, 
  MoreVertical, 
  Terminal as TerminalIcon 
} from "lucide-react";
import { cn } from "#/lib/utils";

export type TaskStatus = 'idle' | 'running' | 'error';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface TaskCardProps {
  id: string;
  title: string;
  tags: string[];
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  activityCount?: number;
  className?: string;
}

export function TaskCard({
  id,
  title,
  tags,
  status,
  priority,
  dueDate,
  activityCount,
  className
}: TaskCardProps) {
  const priorityColors = {
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    urgent: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const statusColors = {
    idle: "bg-muted-foreground/20 ring-muted-foreground/30",
    running: "bg-green-500 ring-green-500/40 animate-pulse",
    error: "bg-red-500 ring-red-500/40",
  };

  return (
    <div className={cn(
      "group relative flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md cursor-grab active:cursor-grabbing",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className={cn("size-2 rounded-full ring-2 ring-offset-2 ring-offset-background", statusColors[status])} />
          <span className="text-[10px] font-mono text-muted-foreground">{id}</span>
        </div>
        <button className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground">
          <MoreVertical className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      <h3 className="text-xs font-medium leading-tight text-foreground line-clamp-2">
        {title}
      </h3>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <span key={tag} className="px-1 py-0.5 text-[9px] font-medium rounded bg-muted/50 text-muted-foreground border border-border/50">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <div className="flex items-center gap-3 text-muted-foreground">
          {dueDate && (
            <div className="flex items-center gap-1 text-[9px]">
              <Calendar className="size-3" />
              <span>{dueDate}</span>
            </div>
          )}
          {activityCount && (
            <div className="flex items-center gap-1 text-[9px]">
              <MessageSquare className="size-3" />
              <span>{activityCount}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[9px]">
            <TerminalIcon className={cn("size-3", status === 'running' ? "text-primary" : "text-muted-foreground")} />
            <span className={status === 'running' ? "text-primary font-medium" : ""}>Live</span>
          </div>
        </div>

        <div className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border", priorityColors[priority])}>
          {priority}
        </div>
      </div>
    </div>
  );
}
