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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import {
	TASK_CATEGORIES,
	TASK_CATEGORY_LABELS,
	type TaskCategory,
} from "#/lib/craftdesk";

interface EditTaskModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	columnTitle?: string;
	initialTitle: string;
	initialCategory: TaskCategory;
	initialNotes: string;
	onSave: (input: {
		title: string;
		category: TaskCategory;
		notes: string;
	}) => Promise<void> | void;
}

export function EditTaskModal({
	isOpen,
	onOpenChange,
	columnTitle,
	initialTitle,
	initialCategory,
	initialNotes,
	onSave,
}: EditTaskModalProps) {
	const titleId = useId();
	const categoryLabelId = useId();
	const notesId = useId();
	const [title, setTitle] = useState(initialTitle);
	const [category, setCategory] = useState(initialCategory);
	const [notes, setNotes] = useState(initialNotes);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setTitle(initialTitle);
		setCategory(initialCategory);
		setNotes(initialNotes);
		setSaveError(null);
	}, [initialCategory, initialNotes, initialTitle, isOpen]);

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
				category,
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
							id={categoryLabelId}
							className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
						>
							Category
						</Label>
						<Select
							value={category}
							onValueChange={(value) => setCategory(value as TaskCategory)}
						>
							<SelectTrigger
								aria-labelledby={categoryLabelId}
								className="bg-muted/30 focus-visible:ring-primary/30"
							>
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								{TASK_CATEGORIES.map((option) => (
									<SelectItem key={option} value={option}>
										{TASK_CATEGORY_LABELS[option]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
