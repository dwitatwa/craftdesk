import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ArrowLeft, 
} from "lucide-react";
import { AppShell } from "#/components/layout/app-shell";
import { Terminal } from "#/components/workspace/terminal";

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
        <Terminal className="flex-1" headerHeight="h-20" />
      </div>
    </AppShell>
  );
}
