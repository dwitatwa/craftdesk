import { 
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";

export type TaskStatus = 'idle' | 'running' | 'error';

interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  className?: string;
}

export function TaskCard({
  id,
  title,
  description,
  status,
  className
}: TaskCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    console.log(`Deleting task ${id}`);
    // Real delete logic would go here
  };

  return (
    <>
      <div className={cn("group flex flex-col w-full", className)}>
        <Link 
          to="/tasks/$taskId" 
          params={{ taskId: id }}
          className={cn(
            "relative flex flex-col bg-card border border-border shadow-sm transition-all duration-150 rounded-md overflow-hidden cursor-pointer",
            "hover:border-primary/50 hover:bg-white/[0.02]"
          )}
        >
          <div className="p-3 space-y-3">
            {/* Top Row: ID and Delete */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-muted-foreground tracking-tighter bg-white/5 px-1 rounded">
                #{id.split('-')[1]}
              </span>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDeleteDialogOpen(true);
                }}
                className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground/60 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-red-500/20 hover:bg-red-500/5 cursor-pointer uppercase tracking-tighter"
              >
                <Trash2 className="size-3" />
                <span>Delete</span>
              </button>
            </div>

            {/* Title Area */}
            <div className="space-y-1">
              <h3 className="text-[12px] font-medium leading-[1.4] text-foreground/90 group-hover:text-foreground transition-colors line-clamp-1">
                {title}
              </h3>
              {description && (
                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>
        </Link>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete task {id}
              and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
