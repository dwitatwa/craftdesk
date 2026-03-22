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
import {
	deriveProjectNameFromPath,
	type SaveProjectInput,
} from "#/lib/craftdesk";
import { pickProjectDirectory } from "#/server/craftdesk";

interface SaveProjectModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (input: SaveProjectInput) => Promise<void> | void;
}

export function SaveProjectModal({
	isOpen,
	onOpenChange,
	onSubmit,
}: SaveProjectModalProps) {
	const [name, setName] = useState("");
	const [projectPath, setProjectPath] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPickingDirectory, setIsPickingDirectory] = useState(false);
	const [pickerError, setPickerError] = useState("");

	const resetForm = () => {
		setName("");
		setProjectPath("");
		setPickerError("");
	};

	const handleOpenChange = (open: boolean) => {
		if (!open && !isSubmitting) {
			resetForm();
		}

		onOpenChange(open);
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);

		try {
			await onSubmit({
				name: name.trim(),
				path: projectPath.trim(),
			});

			resetForm();
			onOpenChange(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handlePickDirectory = async () => {
		setIsPickingDirectory(true);
		setPickerError("");

		try {
			const selectedPath = await pickProjectDirectory();

			if (!selectedPath) {
				return;
			}

			setProjectPath(selectedPath);
			setName((currentName) =>
				currentName.trim()
					? currentName
					: deriveProjectNameFromPath(selectedPath),
			);
		} catch (error) {
			setPickerError(
				error instanceof Error
					? error.message
					: "Failed to open the native folder picker.",
			);
		} finally {
			setIsPickingDirectory(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Save Project</DialogTitle>
					<DialogDescription>
						Add a local folder to Craftdesk so it appears in your recent and
						sidebar project lists.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label
							htmlFor="project-name"
							className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
						>
							Project Name
						</Label>
						<Input
							id="project-name"
							placeholder="Optional display name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="bg-muted/30 focus-visible:ring-primary/30"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="project-path"
							className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
						>
							Local Path
						</Label>
						<div className="flex gap-2">
							<Input
								id="project-path"
								placeholder="~/projects/side/example"
								value={projectPath}
								onChange={(event) => setProjectPath(event.target.value)}
								className="bg-muted/30 focus-visible:ring-primary/30"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={handlePickDirectory}
								disabled={isSubmitting || isPickingDirectory}
							>
								{isPickingDirectory ? "Opening..." : "Choose Folder"}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Use the native folder picker when available, or paste a path
							manually.
						</p>
						{pickerError ? (
							<p className="text-xs text-red-500">{pickerError}</p>
						) : null}
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
						type="button"
						onClick={handleSubmit}
						disabled={!projectPath.trim() || isSubmitting}
						className="cursor-pointer"
					>
						{isSubmitting ? "Saving..." : "Save Project"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
