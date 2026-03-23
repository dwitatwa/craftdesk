import { useEffect, useId, useState } from "react";
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
import { Textarea } from "#/components/ui/textarea";

interface EditTaskModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	columnTitle?: string;
	initialTitle: string;
	initialNotes: string;
	onSave: (input: { title: string; notes: string }) => Promise<void> | void;
}

export function EditTaskModal({
	isOpen,
	onOpenChange,
	columnTitle,
	initialTitle,
	initialNotes,
	onSave,
}: EditTaskModalProps) {
	const titleId = useId();
	const notesId = useId();
	const [title, setTitle] = useState(initialTitle);
	const [notes, setNotes] = useState(initialNotes);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setTitle(initialTitle);
		setNotes(initialNotes);
		setSaveError(null);
	}, [initialNotes, initialTitle, isOpen]);

	const handleOpenChange = (open: boolean) => {
		if (isSubmitting) {
			return;
		}

		onOpenChange(open);
	};

	const handleSave = async () => {
		if (isSubmitting) {
			return;
		}

		setIsSubmitting(true);
		setSaveError(null);

		try {
			await onSave({
				title: title.trim(),
				notes,
			});
			onOpenChange(false);
		} catch (error) {
			setSaveError(
				error instanceof Error ? error.message : "Unable to save task changes.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[540px]">
				<DialogHeader>
					<DialogTitle>Edit Task</DialogTitle>
					<DialogDescription>
						{columnTitle
							? `Update the task in the "${columnTitle}" column.`
							: "Update this task."}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label
							htmlFor={titleId}
							className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
						>
							Title
						</Label>
						<Input
							id={titleId}
							placeholder="Task title..."
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							className="bg-muted/30 focus-visible:ring-primary/30"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor={notesId}
							className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
						>
							Notes
						</Label>
						<Textarea
							id={notesId}
							placeholder="Add task notes..."
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							className="min-h-32 resize-y bg-muted/30 focus-visible:ring-primary/30"
						/>
					</div>
				</div>
				{saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
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
						onClick={handleSave}
						disabled={!title.trim() || isSubmitting}
						className="cursor-pointer"
					>
						{isSubmitting ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
