import { 
  MoreVertical, 
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Square
} from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/utils";
import { Link } from "@tanstack/react-router";

export type TaskStatus = 'idle' | 'running' | 'error';

interface TaskCardProps {
  id: string;
  title: string;
  status: TaskStatus;
  className?: string;
}

export function TaskCard({
  id,
  title,
  status,
  className
}: TaskCardProps) {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const statusConfig = {
    idle: { label: "Idle", color: "text-muted-foreground bg-muted/50 border-border" },
    running: { label: "Running", color: "text-green-500 bg-green-500/10 border-green-500/20" },
    error: { label: "Error", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  };

  return (
    <Link 
      to="/tasks/$taskId" 
      params={{ taskId: id }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer",
        isTerminalOpen && "ring-1 ring-primary/30 border-primary/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">{id}</span>
          <div className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border leading-none",
            statusConfig[status].color
          )}>
            {statusConfig[status].label}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
        >
          <MoreVertical className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      <h3 className="text-xs font-medium leading-tight text-foreground line-clamp-2">
        {title}
      </h3>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <div className="flex items-center gap-3 text-muted-foreground">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsTerminalOpen(!isTerminalOpen);
            }}
            className={cn(
              "flex items-center gap-1 text-[9px] hover:text-primary transition-colors",
              isTerminalOpen ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            <TerminalIcon className={cn("size-3", (status === 'running' || isTerminalOpen) ? "text-primary" : "text-muted-foreground")} />
            <span>Terminal</span>
            {isTerminalOpen ? <ChevronUp className="size-2.5" /> : <ChevronDown className="size-2.5" />}
          </button>
        </div>
      </div>

      {/* Embedded Terminal */}
      {isTerminalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="mt-2 rounded border bg-[#09090B] overflow-hidden flex flex-col cursor-default"
        >
          <div className="flex items-center justify-between px-2 py-1 border-b border-white/5 bg-white/5">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">sh — {id}</span>
            <div className="flex items-center gap-1">
               <RotateCcw className="size-2.5 text-muted-foreground hover:text-foreground cursor-pointer" />
               <Square className="size-2.5 text-muted-foreground hover:text-red-400 cursor-pointer" />
            </div>
          </div>
          <div className="p-2 font-mono text-[10px] leading-relaxed max-h-32 overflow-y-auto selection:bg-primary/30">
            <div className="text-muted-foreground">dwitatwa@craftdesk:~/workspace $ <span className="text-foreground">npm run dev</span></div>
            <div className="text-blue-400 mt-1 font-bold tracking-tight">&gt; craftdesk@0.1.0 dev</div>
            <div className="text-blue-400 font-bold tracking-tight">&gt; vite dev --port 3000</div>
            <div className="mt-1 text-green-400/90">ready in 142 ms</div>
            <div className="text-primary animate-pulse mt-1">_</div>
          </div>
        </div>
      )}
    </Link>
  );
}
