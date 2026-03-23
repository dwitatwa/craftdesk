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
import type { GitChange } from "#/lib/git";

interface GitSidebarDiscardDialogProps {
	discardTarget: GitChange | null;
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
	const discardTargetPath = discardTarget?.path ?? "";
	const isDiscardingUntrackedFile = discardTarget?.kind === "untracked";

	return (
		<AlertDialog open={Boolean(discardTarget)} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isDiscardingUntrackedFile
							? "Delete Untracked File"
							: "Discard File Changes"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isDiscardingUntrackedFile
							? "This file is untracked, so discarding it will permanently delete it from the project directory:"
							: "This will remove the current unstaged changes from:"}{" "}
						<span className="font-medium break-all">{discardTargetPath}</span>
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
						{isDiscardingUntrackedFile ? "Delete File" : "Discard Changes"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
