import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

interface CreateColumnModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (title: string) => Promise<void> | void;
}

export function CreateColumnModal({
	isOpen,
	onOpenChange,
	onCreate,
}: CreateColumnModalProps) {
	const [title, setTitle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setTitle("");
	};

	const handleCreate = async () => {
		setIsSubmitting(true);

		try {
			await onCreate(title.trim());
			resetForm();
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open && !isSubmitting) {
			resetForm();
		}

		onOpenChange(open);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add New Column</DialogTitle>
					<DialogDescription>
						Create a new column to organize your workspace.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label
							htmlFor="column-title"
							className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
						>
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
					<Button
						variant="ghost"
						onClick={() => handleOpenChange(false)}
						className="cursor-pointer"
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!title.trim() || isSubmitting}
						className="cursor-pointer"
					>
						{isSubmitting ? "Creating..." : "Create Column"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
