import { 
  Bell, 
  ChevronRight, 
  Command, 
  Plus, 
  Share2, 
  UserCircle 
} from "lucide-react";
import { Button } from "#/components/ui/button";

export function Topbar() {
  return (
    <header className="flex h-12 items-center justify-between border-b bg-background px-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Craftdesk</span>
        <ChevronRight className="size-3 text-muted-foreground/50" />
        <span className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Workspace</span>
        <ChevronRight className="size-3 text-muted-foreground/50" />
        <span className="text-foreground">Board</span>
      </div>

      {/* Center Search / Command */}
      <div className="flex-1 max-w-xl mx-8 relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground group-focus-within:text-primary transition-colors">
          <Command className="size-3" />
        </div>
        <input 
          type="text" 
          placeholder="Search or type a command..." 
          className="w-full h-8 bg-muted/30 border border-border rounded-md pl-8 pr-12 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted border border-border rounded leading-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
          <Bell className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
          <Share2 className="size-4" />
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <Button variant="ghost" size="sm" className="h-8 gap-2 font-medium px-2 hover:bg-muted/50">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-[10px] text-primary font-bold">D</span>
          </div>
          <span className="text-xs">dwitatwa</span>
        </Button>
      </div>
    </header>
  );
}
