import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ArrowLeft, 
  MoreVertical, 
  RotateCcw, 
  Square, 
  Terminal as TerminalIcon
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { AppShell } from "#/components/layout/app-shell";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskDetailView,
});

function TaskDetailView() {
  const { taskId } = Route.useParams();

  // Mock task data for the view
  const task = {
    id: taskId,
    title: "Compile production kernel",
    description: "The production kernel needs to be compiled with the latest security patches and performance optimizations for the upcoming v2.0 release. This includes updating the build script and verifying the checksums of all dependencies.",
    status: "running",
  };

  const statusConfig = {
    idle: { label: "Idle", color: "text-muted-foreground bg-muted/50 border-border" },
    running: { label: "Running", color: "text-green-500 bg-green-500/10 border-green-500/20" },
    error: { label: "Error", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  };

  return (
    <AppShell>
      <div className="flex h-full flex-1 overflow-hidden">
        {/* Left Side: Details */}
        <div className="flex flex-col w-1/2 border-r bg-background overflow-y-auto">
          {/* Header */}
          <div className="h-20 flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-3 px-2">
              <Link to="/" className="p-2 hover:bg-muted rounded-md transition-colors">
                <ArrowLeft className="size-4" />
              </Link>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none">{task.id}</span>
                <h1 className="text-sm font-bold truncate max-w-[300px] mt-1 leading-none">{task.title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border leading-none",
                statusConfig[task.status as keyof typeof statusConfig].color
              )}>
                {statusConfig[task.status as keyof typeof statusConfig].label}
              </div>
              <Button variant="ghost" size="icon" className="size-8 ml-1">
                <MoreVertical className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Description Section */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</h2>
              <p className="text-sm leading-relaxed text-foreground/90 bg-muted/30 p-4 rounded-xl border">
                {task.description}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Terminal */}
        <div className="flex-1 flex flex-col bg-[#09090B]">
          <div className="h-20 flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <TerminalIcon className="size-3.5 text-primary" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Active Terminal</span>
                <span className="text-[10px] font-mono text-green-500/80 bg-green-500/5 px-1.5 rounded border border-green-500/10">sh</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-400">
                <Square className="size-3.5" />
              </Button>
            </div>
          </div>
          
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
                <span className="text-primary animate-pulse font-bold">_</span>
              </div>
            </div>
          </div>

          {/* Terminal Input Area */}
          <div className="p-4 border-t border-white/5 bg-white/[0.01]">
             <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2 group focus-within:border-primary/50 transition-all">
               <span className="text-primary font-bold text-xs">$</span>
               <input 
                 type="text" 
                 placeholder="Type a command..." 
                 className="flex-1 bg-transparent border-none text-xs font-mono focus:outline-none placeholder:text-muted-foreground/30"
               />
             </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
