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
import { Label } from "#/components/ui/label";

interface CreateColumnModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateColumnModal({
  isOpen,
  onOpenChange,
}: CreateColumnModalProps) {
  const [title, setTitle] = useState("");

  const handleCreate = () => {
    console.log("Creating column:", title);
    setTitle("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Column</DialogTitle>
          <DialogDescription>
            Create a new column to organize your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="column-title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Column Title
            </Label>
            <Input
              id="column-title"
              placeholder="e.g., In Review, Testing..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/30 focus-visible:ring-primary/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()} className="cursor-pointer">
            Create Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
