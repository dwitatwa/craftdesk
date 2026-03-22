import { 
  Box, 
  ChevronDown, 
  Folder, 
  Hash, 
  LayoutGrid, 
  Plus, 
  Search, 
  Settings, 
  Terminal as TerminalIcon 
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside className={cn("flex flex-col border-r bg-sidebar h-screen w-64", className)}>
      {/* Workspace Switcher */}
      <div className="p-4 border-b">
        <button className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium transition-colors rounded-md hover:bg-sidebar-accent group">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground font-bold text-[10px]">
              C
            </div>
            <span className="truncate">Craft Workspace</span>
          </div>
          <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Main
          </div>
          <nav className="space-y-1">
            <SidebarItem icon={LayoutGrid} label="Dashboard" active />
            <SidebarItem icon={Hash} label="Kanban Board" />
            <SidebarItem icon={TerminalIcon} label="Active Sessions" badge="2" />
          </nav>
        </div>

        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
            <span>Pinned Workspaces</span>
            <Plus className="size-3 cursor-pointer hover:text-foreground" />
          </div>
          <nav className="space-y-1">
            <SidebarItem icon={Folder} label="Project Alpha" />
            <SidebarItem icon={Folder} label="Web IDE Core" />
            <SidebarItem icon={Folder} label="Design System" />
          </nav>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t space-y-1">
        <SidebarItem icon={Search} label="Search" shortcut="⌘K" />
        <SidebarItem icon={Settings} label="Settings" />
      </div>
    </aside>
  );
}

function SidebarItem({ 
  icon: Icon, 
  label, 
  active, 
  badge, 
  shortcut 
}: { 
  icon: any; 
  label: string; 
  active?: boolean; 
  badge?: string;
  shortcut?: string;
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
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary/10 text-primary border border-primary/20 leading-none">
          {badge}
        </span>
      )}
      {shortcut && (
        <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground/70">
          {shortcut}
        </span>
      )}
    </button>
  );
}
