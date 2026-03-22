import { 
  Folder, 
  Plus
} from "lucide-react";
import { cn } from "#/lib/utils";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside className={cn("flex flex-col border-r bg-sidebar h-screen w-64", className)}>
      {/* App Header */}
      <div className="h-20 flex items-center px-4 border-b">
        <div className="flex items-center gap-2 px-3">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground font-bold text-[10px]">
            C
          </div>
          <span className="text-sm font-bold tracking-tight">Craftdesk</span>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-3 mb-2 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
          <span>Projects</span>
          <Plus className="size-3 cursor-pointer hover:text-foreground" />
        </div>
        <nav className="space-y-1">
          <SidebarItem icon={Folder} label="Project Alpha" active />
          <SidebarItem icon={Folder} label="Craftdesk Core" />
          <SidebarItem icon={Folder} label="Design System" />
        </nav>
      </div>
    </aside>
  );
}

function SidebarItem({ 
  icon: Icon, 
  label, 
  active, 
}: { 
  icon: any; 
  label: string; 
  active?: boolean; 
}) {
  return (
    <button
      className={cn(
        "flex items-center justify-between w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors group",
        active 
          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        <span>{label}</span>
      </div>
    </button>
  );
}
