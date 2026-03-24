import { LoaderCircle } from "lucide-react";

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
import type { GitSidebarDiscardTarget } from "./git-sidebar-types";

interface GitSidebarDiscardDialogProps {
	discardTarget: GitSidebarDiscardTarget | null;
	isDiscarding: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

export function GitSidebarDiscardDialog({
	discardTarget,
	isDiscarding,
	onConfirm,
	onOpenChange,
}: GitSidebarDiscardDialogProps) {
	const discardChanges = discardTarget?.changes ?? [];
	const discardCount = discardChanges.length;
	const firstDiscardPath = discardChanges[0]?.path ?? "";
	const hasUntrackedChanges = discardChanges.some(
		(change) => change.kind === "untracked",
	);
	const isSingleChange = discardCount === 1;
	const title = isSingleChange
		? hasUntrackedChanges
			? "Delete Untracked File"
			: "Discard File Changes"
		: hasUntrackedChanges
			? "Delete Selected Files"
			: "Discard Selected Changes";
	const confirmLabel = isSingleChange
		? hasUntrackedChanges
			? "Delete File"
			: "Discard Changes"
		: hasUntrackedChanges
			? "Delete Selected"
			: "Discard Selected";

	return (
		<AlertDialog open={Boolean(discardTarget)} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>
						{isSingleChange ? (
							<>
								{hasUntrackedChanges
									? "This file is untracked, so discarding it will permanently delete it from the project directory:"
									: "This will remove the current unstaged changes from:"}{" "}
								<span className="font-medium break-all">
									{firstDiscardPath}
								</span>
							</>
						) : (
							<>
								{hasUntrackedChanges
									? "Some selected files are untracked, so discarding them will permanently delete them from the project directory."
									: "This will remove the current unstaged changes from the selected files."}{" "}
								<span className="font-medium">
									{discardCount} files selected.
								</span>
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDiscarding}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={isDiscarding}
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
						className="bg-red-600 hover:bg-red-700"
					>
						{isDiscarding ? (
							<LoaderCircle className="mr-1.5 size-3 animate-spin" />
						) : null}
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
