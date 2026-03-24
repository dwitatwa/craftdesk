import { useId, useState } from "react";
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
import {
	TASK_CATEGORIES,
	TASK_CATEGORY_LABELS,
	type TaskCategory,
} from "#/lib/craftdesk";

interface CreateTaskModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	columnTitle?: string;
	onCreate: (input: {
		title: string;
		category: TaskCategory;
	}) => Promise<void> | void;
}

export function CreateTaskModal({
	isOpen,
	onOpenChange,
	columnTitle,
	onCreate,
}: CreateTaskModalProps) {
	const titleId = useId();
	const categoryLabelId = useId();
	const [title, setTitle] = useState("");
	const [category, setCategory] = useState<TaskCategory>("other");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setTitle("");
		setCategory("other");
	};

	const handleCreate = async () => {
		if (isSubmitting || !title.trim()) {
			return;
		}

		setIsSubmitting(true);

		try {
			await onCreate({
				title: title.trim(),
				category,
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
								htmlFor={titleId}
								className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
							>
								Title
							</Label>
							<Input
								id={titleId}
								placeholder="Task title..."
								value={title}
								onChange={(e) => setTitle(e.target.value)}
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
