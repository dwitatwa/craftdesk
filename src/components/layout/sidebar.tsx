import { 
  Folder, 
  Plus
} from "lucide-react";
import { cn } from "#/lib/utils";
import { Link } from "@tanstack/react-router";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside className={cn("flex flex-col border-r bg-sidebar h-screen w-64", className)}>
      {/* App Header */}
      <div className="h-20 flex items-center px-4 border-b">
        <Link to="/" className="flex items-center gap-2 px-3 cursor-pointer">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground font-bold text-[10px]">
            C
          </div>
          <span className="text-sm font-bold tracking-tight">Craftdesk</span>
        </Link>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-3 mb-2 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
          <span>Projects</span>
          <Plus className="size-3 cursor-pointer hover:text-foreground" />
        </div>
        <nav className="space-y-1">
          <SidebarItem icon={Folder} label="Project Alpha" projectId="alpha" />
          <SidebarItem icon={Folder} label="Craftdesk Core" projectId="core" />
          <SidebarItem icon={Folder} label="Design System" projectId="design-system" />
        </nav>
      </div>
    </aside>
  );
}

function SidebarItem({ 
  icon: Icon, 
  label, 
  projectId
}: { 
  icon: any; 
  label: string; 
  projectId: string;
}) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId }}
      activeProps={{
        className: "bg-sidebar-accent text-sidebar-accent-foreground"
      }}
      inactiveProps={{
        className: "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      }}
      className={cn(
        "flex items-center justify-between w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors group cursor-pointer",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn("size-4", "group-hover:text-foreground")} />
        <span>{label}</span>
      </div>
    </Link>
  );
}
