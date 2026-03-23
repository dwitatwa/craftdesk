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

interface CreateTaskModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	columnTitle?: string;
	onCreate: (input: { title: string }) => Promise<void> | void;
}

export function CreateTaskModal({
	isOpen,
	onOpenChange,
	columnTitle,
	onCreate,
}: CreateTaskModalProps) {
	const [title, setTitle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setTitle("");
	};

	const handleCreate = async () => {
		if (isSubmitting || !title.trim()) {
			return;
		}

		setIsSubmitting(true);

		try {
			await onCreate({
				title: title.trim(),
			});

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
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleCreate();
					}}
				>
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
							<Label
								htmlFor="title"
								className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
							>
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
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => handleOpenChange(false)}
							className="cursor-pointer"
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!title.trim() || isSubmitting}
							className="cursor-pointer"
						>
							{isSubmitting ? "Creating..." : "Create Task"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
