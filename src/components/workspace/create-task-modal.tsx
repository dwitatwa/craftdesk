import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Label } from "#/components/ui/label";

interface CreateTaskModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  columnTitle?: string;
}

export function CreateTaskModal({
  isOpen,
  onOpenChange,
  columnTitle
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    console.log("Creating task:", { title, description, column: columnTitle });
    setTitle("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            {columnTitle 
              ? `Add a new task to the "${columnTitle}" column.` 
              : "Add a new task to your workspace."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Title
            </Label>
            <Input
              id="title"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/30 focus-visible:ring-primary/30"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Detailed description of the task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] bg-muted/30 focus-visible:ring-primary/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()} className="cursor-pointer">
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
