import {
	GitBranch,
	GitCompareArrows,
	GitFork,
	LoaderCircle,
	RefreshCcw,
	ScrollText,
} from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { ChangeGroup } from "./git-sidebar-sections";
import {
	BranchRow,
	BranchSummaryCard,
	CommitRow,
	CommitSection,
	EmptyState,
	RemoteRow,
	SidebarSection,
	StashRow,
} from "./git-sidebar-sections";
import { GitSidebarDiscardDialog } from "./git-sidebar-discard-dialog";
import type { GitSidebarProps } from "./git-sidebar-types";
import { createInitialSectionState } from "./git-sidebar-utils";
import { useGitSidebarState } from "./use-git-sidebar-state";

export function GitSidebar({
	activeProject,
	selectedChange,
	onSelectChange,
	onOverviewRefresh,
}: GitSidebarProps) {
	const activeProjectPath = activeProject?.path ?? "";
	const [sectionOpenState, setSectionOpenState] = useState(
		createInitialSectionState,
	);
	const {
		discardTarget,
		error,
		handleDiscardConfirm,
		handleGitAction,
		handleGitCommit,
		handleGitGroupAction,
		handleRefresh,
		isDiscarding,
		isLoading,
		overview,
		pendingMutationKey,
		setDiscardTarget,
	} = useGitSidebarState({
		activeProjectPath,
		onOverviewRefresh,
		onSelectChange,
		selectedChange,
	});

	if (!activeProject) {
		return (
			<div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
				Open a project to inspect its Git state.
			</div>
		);
	}

	const changeCount =
		(overview?.staged.length ?? 0) + (overview?.unstaged.length ?? 0);

	return (
		<>
			<div className="flex h-full min-h-0 flex-col">
				<div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
					{error ? (
						<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
							{error}
						</div>
					) : null}

					{!error && isLoading && !overview ? (
						<div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
							<LoaderCircle className="size-3 animate-spin" />
							Loading Git state...
						</div>
					) : null}

					{!error && overview ? (
						<div className="space-y-1">
							<CommitSection
								onCommit={handleGitCommit}
								disabled={isLoading || overview.staged.length === 0}
								isCommitting={
									pendingMutationKey === "commit:all" ||
									pendingMutationKey === "commit-push:all"
								}
							/>

							<SidebarSection
								open={sectionOpenState.changes}
								onOpenChange={(open) =>
									setSectionOpenState((current) => ({
										...current,
										changes: open,
									}))
								}
								title={`Changes${changeCount > 0 ? ` (${changeCount})` : ""}`}
								icon={GitCompareArrows}
								rightElement={
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										className="shrink-0 text-muted-foreground hover:text-foreground"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											void handleRefresh();
										}}
										disabled={isLoading}
										aria-label="Refresh Git data"
									>
										{isLoading ? (
											<LoaderCircle className="size-3 animate-spin" />
										) : (
											<RefreshCcw className="size-3" />
										)}
									</Button>
								}
							>
								<div className="flex flex-col gap-4">
									<ChangeGroup
										title="Staged"
										changes={overview.staged}
										selectedChange={selectedChange}
										onSelectChange={onSelectChange}
										diffMode="staged"
										onAction={handleGitAction}
										onDiscardRequest={setDiscardTarget}
										onGroupAction={handleGitGroupAction}
										pendingMutationKey={pendingMutationKey}
									/>
									<ChangeGroup
										title="Unstaged"
										changes={overview.unstaged}
										selectedChange={selectedChange}
										onSelectChange={onSelectChange}
										diffMode="unstaged"
										onAction={handleGitAction}
										onDiscardRequest={setDiscardTarget}
										onGroupAction={handleGitGroupAction}
										pendingMutationKey={pendingMutationKey}
									/>
								</div>
							</SidebarSection>

							<SidebarSection
								open={sectionOpenState.branches}
								onOpenChange={(open) =>
									setSectionOpenState((current) => ({
										...current,
										branches: open,
									}))
								}
								title={`Branches (${overview.branches.length})`}
								icon={GitBranch}
							>
								<BranchSummaryCard branch={overview.branch} />
								<div className="mt-3 space-y-1.5">
									<div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
										Recent Commits
									</div>
									{overview.commits.length > 0 ? (
										overview.commits.map((commit) => (
											<CommitRow key={commit.sha} commit={commit} />
										))
									) : (
										<EmptyState label="No commits were found." />
									)}
								</div>
								<div className="mt-3 space-y-1.5">
									<div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
										Local Branches
									</div>
									{overview.branches.length > 0 ? (
										overview.branches.map((branch) => (
											<BranchRow key={branch.name} branch={branch} />
										))
									) : (
										<EmptyState label="No local branches were found." />
									)}
								</div>
							</SidebarSection>

							<SidebarSection
								open={sectionOpenState.remotes}
								onOpenChange={(open) =>
									setSectionOpenState((current) => ({
										...current,
										remotes: open,
									}))
								}
								title={`Remotes (${overview.remotes.length})`}
								icon={GitFork}
							>
								{overview.remotes.length > 0 ? (
									overview.remotes.map((remote) => (
										<RemoteRow key={remote.name} remote={remote} />
									))
								) : (
									<EmptyState label="No remotes could be found." />
								)}
							</SidebarSection>

							<SidebarSection
								open={sectionOpenState.stashes}
								onOpenChange={(open) =>
									setSectionOpenState((current) => ({
										...current,
										stashes: open,
									}))
								}
								title={`Stashes (${overview.stashes.length})`}
								icon={ScrollText}
							>
								{overview.stashes.length > 0 ? (
									overview.stashes.map((stash) => (
										<StashRow key={stash.name} stash={stash} />
									))
								) : (
									<EmptyState label="No stashes could be found." />
								)}
							</SidebarSection>
						</div>
					) : null}
				</div>
			</div>

			<GitSidebarDiscardDialog
				discardTarget={discardTarget}
				isDiscarding={isDiscarding}
				onConfirm={() => {
					void handleDiscardConfirm();
				}}
				onOpenChange={(open) => {
					if (!open && !isDiscarding) {
						setDiscardTarget(null);
					}
				}}
			/>
		</>
	);
}
