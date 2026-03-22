import { createFileRoute } from "@tanstack/react-router";
import { 
  ArrowRight, 
  FolderPlus, 
  History, 
  LayoutGrid, 
  Plus, 
  Star,
  Terminal as TerminalIcon
} from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { AppShell } from "#/components/layout/app-shell";
import { KanbanBoard } from "#/components/workspace/kanban-board";

export const Route = createFileRoute("/")({ component: CraftdeskApp });

function CraftdeskApp() {
  const [activeView, setActiveView] = useState<'home' | 'board'>('board');

  if (activeView === 'home') {
    return (
      <AppShell>
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-mono text-primary">
              <TerminalIcon className="size-3" />
              v1.0.0-alpha
            </div>
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
              Craft Your Workspace
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A high-density workspace for technical teams. Manage tasks with integrated terminal environments and visual pipelines.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 w-full">
            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <History className="size-3" />
                Recent Workspaces
              </h2>
              <div className="grid gap-3">
                <RecentWorkspaceCard 
                  name="Craftdesk Platform" 
                  path="~/projects/craftdesk" 
                  tasks={12} 
                  activeSessions={2} 
                  onClick={() => setActiveView('board')}
                />
                <RecentWorkspaceCard 
                  name="Craftdesk Core" 
                  path="~/oss/craftdesk" 
                  tasks={45} 
                  activeSessions={0} 
                  onClick={() => setActiveView('board')}
                />
                <RecentWorkspaceCard 
                  name="Documentation" 
                  path="~/docs/main" 
                  tasks={3} 
                  activeSessions={0} 
                  onClick={() => setActiveView('board')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <Plus className="size-3" />
                Get Started
              </h2>
              <div className="grid gap-4">
                <button className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group text-center">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <FolderPlus className="size-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <div className="font-medium group-hover:text-primary transition-colors">Open Local Folder</div>
                    <p className="text-xs text-muted-foreground">Select a directory to start craftdesking</p>
                  </div>
                </button>
                <div className="grid grid-cols-2 gap-4">
                   <Button variant="outline" className="h-12 gap-2 text-xs">
                     <Star className="size-3.5" />
                     Pinned
                   </Button>
                   <Button variant="outline" className="h-12 gap-2 text-xs">
                     <LayoutGrid className="size-3.5" />
                     Templates
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Workspace Header Info */}
        <div className="h-20 px-6 flex items-center justify-between border-b bg-background/30 backdrop-blur-sm">
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold tracking-tight">Project Alpha</h1>
            <p className="text-xs text-muted-foreground font-mono leading-none mt-1">~/projects/side/alpha</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="size-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
              <div className="size-6 rounded-full border-2 border-background bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                +4
              </div>
            </div>
            <Button size="sm" className="h-8 gap-2 text-xs font-medium">
              <Plus className="size-3.5" />
              New Task
            </Button>
          </div>
        </div>

        {/* Board Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard />
        </div>
      </div>
    </AppShell>
  );
}

function RecentWorkspaceCard({ 
  name, 
  path, 
  tasks, 
  activeSessions,
  onClick
}: { 
  name: string; 
  path: string; 
  tasks: number; 
  activeSessions: number;
  onClick: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left group"
    >
      <div className="space-y-1">
        <div className="font-medium group-hover:text-primary transition-colors">{name}</div>
        <div className="text-[10px] font-mono text-muted-foreground">{path}</div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 justify-end">
            {tasks} tasks
          </div>
          {activeSessions > 0 && (
            <div className="text-[10px] font-mono text-green-500 flex items-center gap-1 justify-end">
              <div className="size-1 rounded-full bg-green-500 animate-pulse" />
              {activeSessions} live
            </div>
          )}
        </div>
        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}
