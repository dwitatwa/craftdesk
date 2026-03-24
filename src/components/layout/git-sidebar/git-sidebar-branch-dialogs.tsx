import { LoaderCircle } from "lucide-react";
import { useState } from "react";

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
import type { GitCommitPreview } from "#/lib/git";
import { CommitRow, EmptyState } from "./git-sidebar-sections";

interface GitSidebarCreateBranchDialogProps {
	currentBranchName: string;
	isDetachedHead?: boolean;
	isOpen: boolean;
	isSubmitting: boolean;
	onCreate: (branchName: string) => Promise<boolean>;
	onOpenChange: (open: boolean) => void;
}

export function GitSidebarCreateBranchDialog({
	currentBranchName,
	isDetachedHead = false,
	isOpen,
	isSubmitting,
	onCreate,
	onOpenChange,
}: GitSidebarCreateBranchDialogProps) {
	const [branchName, setBranchName] = useState("");

	const resetForm = () => {
		setBranchName("");
	};

	const handleCreate = async () => {
		const trimmedBranchName = branchName.trim();

		if (!trimmedBranchName || isSubmitting) {
			return;
		}

		const didCreate = await onCreate(trimmedBranchName);

		if (!didCreate) {
			return;
		}

		resetForm();
		onOpenChange(false);
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
						<DialogTitle>Create Local Branch</DialogTitle>
						<DialogDescription>
							{isDetachedHead ? (
								"Create a new local branch from the current HEAD."
							) : (
								<>
									Create a new local branch from{" "}
									<span className="font-medium text-foreground">
										{currentBranchName}
									</span>
									.
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label
								htmlFor="git-branch-name"
								className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70"
							>
								Branch Name
							</Label>
							<Input
								id="git-branch-name"
								placeholder="feature/new-branch"
								value={branchName}
								onChange={(event) => setBranchName(event.target.value)}
								className="bg-muted/30 focus-visible:ring-primary/30"
								autoFocus
								disabled={isSubmitting}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => handleOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !branchName.trim()}>
							{isSubmitting ? (
								<>
									<LoaderCircle className="size-3 animate-spin" />
									Creating...
								</>
							) : (
								"Create Branch"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

interface GitSidebarBranchActionDialogProps {
	action: "delete" | "merge";
	branchName: string;
	isOpen: boolean;
	isSubmitting: boolean;
	onConfirm: () => Promise<void> | void;
	onOpenChange: (open: boolean) => void;
}

export function GitSidebarBranchActionDialog({
	action,
	branchName,
	isOpen,
	isSubmitting,
	onConfirm,
	onOpenChange,
}: GitSidebarBranchActionDialogProps) {
	const isDeleteAction = action === "delete";

	return (
		<AlertDialog open={isOpen} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isDeleteAction ? "Delete Local Branch" : "Merge Branch"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isDeleteAction
							? "This will delete the local branch with a safe delete. Git will stop the action if the branch still has unmerged commits:"
							: "This will merge the selected branch into the current checked out branch:"}{" "}
						<span className="break-all font-medium">{branchName}</span>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={isSubmitting}
						onClick={(event) => {
							event.preventDefault();
							void onConfirm();
						}}
						className={isDeleteAction ? "bg-red-600 hover:bg-red-700" : ""}
					>
						{isSubmitting ? (
							<LoaderCircle className="mr-1.5 size-3 animate-spin" />
						) : null}
						{isDeleteAction ? "Delete Branch" : "Merge Branch"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

interface GitSidebarBranchCommitsDialogProps {
	branchName: string;
	commits: GitCommitPreview[];
	error: string;
	isLoading: boolean;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function GitSidebarBranchCommitsDialog({
	branchName,
	commits,
	error,
	isLoading,
	isOpen,
	onOpenChange,
}: GitSidebarBranchCommitsDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[640px]">
				<DialogHeader>
					<DialogTitle>Recent Commits</DialogTitle>
					<DialogDescription>
						Showing the latest commits for{" "}
						<span className="break-all font-medium text-foreground">
							{branchName}
						</span>
						.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[52vh] overflow-y-auto custom-scrollbar">
					{isLoading ? (
						<div className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground">
							<LoaderCircle className="size-3 animate-spin" />
							Loading branch commits...
						</div>
					) : error ? (
						<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
							{error}
						</div>
					) : commits.length > 0 ? (
						<div className="space-y-1">
							{commits.map((commit) => (
								<CommitRow key={commit.sha} commit={commit} />
							))}
						</div>
					) : (
						<EmptyState label="No commits were found for this branch." />
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
