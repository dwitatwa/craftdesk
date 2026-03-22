import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Maximize2, 
  Play, 
  RotateCcw, 
  Square, 
  Terminal as TerminalIcon, 
  X 
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

interface TerminalPanelProps {
  taskId?: string;
  taskTitle?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function TerminalPanel({ taskId, taskTitle, isOpen, onToggle }: TerminalPanelProps) {
  return (
    <div className={cn(
      "border-t bg-card transition-all duration-300 ease-in-out flex flex-col",
      isOpen ? "h-[300px]" : "h-10"
    )}>
      {/* Header */}
      <div 
        className="flex h-10 items-center justify-between px-4 border-b cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <TerminalIcon className="size-3.5 text-primary" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Terminal</span>
            {taskId && (
              <span className="text-xs font-medium text-foreground">
                {taskId}: {taskTitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className="size-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] font-mono text-green-500/80">Running (sh)</span>
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 mr-4 border-r pr-2 h-5">
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-red-400">
              <Square className="size-3" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
            <Maximize2 className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={onToggle}>
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div className="flex-1 bg-[#09090B] p-4 font-mono text-[11px] leading-relaxed overflow-y-auto selection:bg-primary/30">
          <div className="space-y-1">
            <div className="text-muted-foreground">dwitatwa@craftdesk:~/workspace $ <span className="text-foreground">npm run dev</span></div>
            <div className="text-blue-400 mt-2 font-bold tracking-tight">&gt; craftdesk@0.1.0 dev</div>
            <div className="text-blue-400 font-bold tracking-tight">&gt; vite dev --port 3000</div>
            <div className="mt-2 text-green-400/90 flex items-center gap-2">
              <span className="px-1 bg-green-500/10 rounded border border-green-500/20">VITE v5.2.0</span>
              ready in 142 ms
            </div>
            <div className="mt-2 text-muted-foreground/80">  ➜  <span className="font-bold text-foreground">Local:</span>   http://localhost:3000/</div>
            <div className="text-muted-foreground/80">  ➜  <span className="font-bold text-foreground">Network:</span> use --host to expose</div>
            <div className="text-muted-foreground/80">  ➜  press h + enter to show help</div>
            <div className="mt-4 text-primary animate-pulse">_</div>
          </div>
        </div>
      )}
    </div>
  );
}
