import { createFileRoute } from "@tanstack/react-router";
import { 
  Plus, 
} from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { AppShell } from "#/components/layout/app-shell";
import { KanbanBoard } from "#/components/workspace/kanban-board";
import { CreateTaskModal } from "#/components/workspace/create-task-modal";
import { CreateColumnModal } from "#/components/workspace/create-column-modal";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetailView,
});

const PROJECT_MAP: Record<string, { title: string; path: string }> = {
  "alpha": { title: "Project Alpha", path: "~/projects/side/alpha" },
  "core": { title: "Craftdesk Core", path: "~/oss/craftdesk" },
  "design-system": { title: "Design System", path: "~/projects/design" },
};

function ProjectDetailView() {
  const { projectId } = Route.useParams();
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateColumnModalOpen, setIsCreateColumnModalOpen] = useState(false);

  const project = PROJECT_MAP[projectId as keyof typeof PROJECT_MAP] || { 
    title: projectId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '), 
    path: `~/projects/${projectId}` 
  };

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Workspace Header Info */}
        <div className="h-20 px-6 flex items-center justify-between border-b bg-background/30 backdrop-blur-sm">
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold tracking-tight">{project.title}</h1>
            <p className="text-xs text-muted-foreground font-mono leading-none mt-1">{project.path}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setIsCreateColumnModalOpen(true)}
            >
              <Plus className="size-3.5" />
              Add Column
            </Button>
            <Button 
              size="sm" 
              className="h-8 gap-2 text-xs font-medium cursor-pointer"
              onClick={() => setIsCreateTaskModalOpen(true)}
            >
              <Plus className="size-3.5" />
              New Task
            </Button>
          </div>
        </div>

        {/* Board Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard />
        </div>

        <CreateTaskModal 
          isOpen={isCreateTaskModalOpen} 
          onOpenChange={setIsCreateTaskModalOpen} 
        />

        <CreateColumnModal 
          isOpen={isCreateColumnModalOpen} 
          onOpenChange={setIsCreateColumnModalOpen} 
        />
      </div>
    </AppShell>
  );
}
