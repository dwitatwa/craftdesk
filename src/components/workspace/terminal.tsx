import { 
  RotateCcw, 
  Square, 
  Terminal as TerminalIcon,
  Minus,
  Maximize2
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

interface TerminalProps {
  className?: string;
  title?: string;
  headerHeight?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Terminal({ 
  className, 
  title = "Active Terminal", 
  headerHeight = "h-14",
  isCollapsed,
  onToggleCollapse
}: TerminalProps) {
  return (
    <div className={cn("flex flex-col bg-[#09090B]", className)}>
      <div className={cn("flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02]", headerHeight)}>
        <div className="flex items-center gap-3">
          <TerminalIcon className="size-3.5 text-primary" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{title}</span>
            <span className="text-[10px] font-mono text-green-500/80 bg-green-500/5 px-1.5 rounded border border-green-500/10">sh</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onToggleCollapse}
            >
              {isCollapsed ? <Maximize2 className="size-3.5" /> : <Minus className="size-3.5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
            <RotateCcw className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-400">
            <Square className="size-3.5" />
          </Button>
        </div>
      </div>
      
      {!isCollapsed && (
        <>
          <div className="flex-1 p-6 font-mono text-sm leading-relaxed overflow-y-auto selection:bg-primary/30 custom-scrollbar">
            <div className="space-y-2">
              <div className="text-muted-foreground">dwitatwa@craftdesk:~/workspace $ <span className="text-foreground">npm run dev</span></div>
              <div className="text-blue-400 mt-4 font-bold tracking-tight">&gt; craftdesk@0.1.0 dev</div>
              <div className="text-blue-400 font-bold tracking-tight">&gt; vite dev --port 3000</div>
              
              <div className="mt-6 p-4 rounded-lg bg-white/[0.03] border border-white/[0.05] space-y-2">
                <div className="text-green-400 flex items-center gap-2">
                  <div className="size-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                  <span className="font-bold">VITE v5.2.0</span>
                  <span className="text-muted-foreground font-normal">ready in 142 ms</span>
                </div>
                <div className="grid gap-1 mt-2 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="w-16">Local:</span>
                    <span className="text-primary hover:underline cursor-pointer">http://localhost:3000/</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-muted-foreground italic">Compiling modules...</div>
              <div className="mt-6 flex items-center gap-2">
                <span className="text-primary font-bold">➜</span>
                <span className="text-muted-foreground">Watching for changes...</span>
              </div>

              {/* Real-time Input Prompt */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-muted-foreground">dwitatwa@craftdesk:~/workspace $</span>
                <input 
                  type="text" 
                  autoFocus
                  className="flex-1 bg-transparent border-none text-sm font-mono focus:outline-none text-foreground"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
