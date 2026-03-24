import {
	GitBranch,
	GitCompareArrows,
	GitFork,
	LoaderCircle,
	Plus,
	RefreshCcw,
	ScrollText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import type { GitBranchSummary, GitCommitPreview, GitRemote } from "#/lib/git";
import { getGitBranchCommits } from "#/server/git";
import {
	GitSidebarBranchCommitsDialog,
	GitSidebarCreateBranchDialog,
} from "./git-sidebar-branch-dialogs";
import { GitSidebarDiscardDialog } from "./git-sidebar-discard-dialog";
import {
	BranchRow,
	ChangeGroup,
	CommitSection,
	EmptyState,
	RemoteRow,
	SidebarSection,
	StashRow,
} from "./git-sidebar-sections";
import type { GitSidebarProps } from "./git-sidebar-types";
import { createInitialSectionState } from "./git-sidebar-utils";
import { useGitSidebarState } from "./use-git-sidebar-state";

export function GitSidebar({
	activeProject,
	selectedChange,
	onSelectChange,
	onDiffRefresh,
}: GitSidebarProps) {
	const activeProjectPath = activeProject?.path ?? "";
	const [sectionOpenState, setSectionOpenState] = useState(
		createInitialSectionState,
	);
	const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
		useState(false);
	const [branchCommitsTarget, setBranchCommitsTarget] = useState<{
		branchName: string;
		projectPath: string;
	} | null>(null);
	const [branchCommits, setBranchCommits] = useState<GitCommitPreview[]>([]);
	const [branchCommitsError, setBranchCommitsError] = useState("");
	const [isBranchCommitsLoading, setIsBranchCommitsLoading] = useState(false);
	const branchCommitsRequestIdRef = useRef(0);
	const {
		discardTarget,
		error,
		handleCheckoutLocalBranch,
		handleCreateLocalBranch,
		handleDiscardConfirm,
		handleGitAction,
		handleGitCommit,
		handleGitGroupAction,
		handlePullCurrentBranch,
		handlePushBranchToRemote,
		handleRefresh,
		isDiscarding,
		isLoading,
		overview,
		pendingMutationKey,
		setDiscardTarget,
	} = useGitSidebarState({
		activeProjectPath,
		onDiffRefresh,
		onSelectChange,
		selectedChange,
	});
	const branchCommitsBranchName =
		branchCommitsTarget?.projectPath === activeProjectPath
			? branchCommitsTarget.branchName
			: "";

	useEffect(() => {
		if (!branchCommitsBranchName || !activeProjectPath) {
			if (!branchCommitsBranchName) {
				setBranchCommits([]);
				setBranchCommitsError("");
				setIsBranchCommitsLoading(false);
			}

			return;
		}

		let isCancelled = false;
		const requestId = branchCommitsRequestIdRef.current + 1;
		branchCommitsRequestIdRef.current = requestId;

		setBranchCommits([]);
		setBranchCommitsError("");
		setIsBranchCommitsLoading(true);

		void getGitBranchCommits({
			data: {
				cwd: activeProjectPath,
				branchName: branchCommitsBranchName,
			},
		})
			.then((nextCommits) => {
				if (isCancelled || branchCommitsRequestIdRef.current !== requestId) {
					return;
				}

				setBranchCommits(nextCommits);
			})
			.catch((cause) => {
				if (isCancelled || branchCommitsRequestIdRef.current !== requestId) {
					return;
				}

				setBranchCommitsError(
					cause instanceof Error
						? cause.message
						: "Failed to load branch commits.",
				);
			})
			.finally(() => {
				if (isCancelled || branchCommitsRequestIdRef.current !== requestId) {
					return;
				}

				setIsBranchCommitsLoading(false);
			});

		return () => {
			isCancelled = true;
		};
	}, [activeProjectPath, branchCommitsBranchName]);

	if (!activeProject) {
		return (
			<div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
				Open a project to inspect its Git state.
			</div>
		);
	}

	const changeCount =
		(overview?.staged.length ?? 0) + (overview?.unstaged.length ?? 0);
	const isCreateBranching = pendingMutationKey === "branch:create";
	const isAnyBranchMutationPending = pendingMutationKey.startsWith("branch:");
	const isBranchCommitsDialogOpen = Boolean(branchCommitsBranchName);
	const currentBranch = overview?.branch ?? null;
	const orderedBranches = overview
		? [
				...overview.branches.filter((branch) => branch.isCurrent),
				...overview.branches.filter((branch) => !branch.isCurrent),
			]
		: [];
	const currentBranchPullRequestUrl =
		currentBranch && overview
			? buildPullRequestUrl(currentBranch, overview.remotes)
			: null;

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
								rightElement={
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										className="shrink-0 text-muted-foreground hover:text-foreground"
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											setIsCreateBranchDialogOpen(true);
										}}
										disabled={isLoading || isAnyBranchMutationPending}
										aria-label="Create local branch"
										title="Create local branch"
									>
										<Plus className="size-3" />
									</Button>
								}
								>
									<div className="space-y-1">
										{orderedBranches.length > 0 ? (
											orderedBranches.map((branch) => (
												<BranchRow
													key={branch.name}
													branch={branch}
													currentBranch={branch.isCurrent ? currentBranch : null}
													isCheckingOut={
														pendingMutationKey === `branch:checkout:${branch.name}`
													}
													isPulling={pendingMutationKey === "branch:pull"}
													isPushing={
														pendingMutationKey === `branch:push:${branch.name}`
													}
													onCheckout={
														branch.isCurrent ||
														isAnyBranchMutationPending ||
														isLoading
															? undefined
															: () => {
																	void handleCheckoutLocalBranch(branch.name);
																}
													}
													onCreatePullRequest={
														branch.isCurrent && currentBranchPullRequestUrl
															? () => {
																	if (typeof window !== "undefined") {
																		window.open(
																			currentBranchPullRequestUrl,
																			"_blank",
																			"noopener,noreferrer",
																		);
																	}
																}
															: undefined
													}
													onPull={
														branch.isCurrent &&
														currentBranch?.upstream &&
														!isAnyBranchMutationPending &&
														!isLoading
															? () => {
																	void handlePullCurrentBranch();
																}
															: undefined
													}
													onPush={
														!branch.isCurrent &&
														overview.remotes.length > 0 &&
														!isAnyBranchMutationPending &&
														!isLoading
															? () => {
																	void handlePushBranchToRemote(branch.name);
																}
															: undefined
													}
													onShowCommits={() => {
														setBranchCommitsTarget({
															branchName: branch.name,
															projectPath: activeProjectPath,
														});
													}}
												/>
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
			<GitSidebarCreateBranchDialog
				currentBranchName={currentBranch?.name ?? ""}
				isDetachedHead={currentBranch?.detached ?? false}
				isOpen={isCreateBranchDialogOpen}
				isSubmitting={isCreateBranching}
				onCreate={handleCreateLocalBranch}
				onOpenChange={setIsCreateBranchDialogOpen}
			/>
			<GitSidebarBranchCommitsDialog
				branchName={branchCommitsBranchName}
				commits={branchCommits}
				error={branchCommitsError}
				isLoading={isBranchCommitsLoading}
				isOpen={isBranchCommitsDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setBranchCommitsTarget(null);
					}
				}}
			/>
			</>
		);
}

function buildPullRequestUrl(
	branch: GitBranchSummary,
	remotes: GitRemote[],
): string | null {
	if (branch.detached) {
		return null;
	}

	const remoteName = branch.upstream?.split("/")[0] || "origin";
	const remote = remotes.find((entry) => entry.name === remoteName);
	const webRemoteUrl = normalizeRemoteWebUrl(
		remote?.pushUrl ?? remote?.fetchUrl ?? null,
	);

	if (!webRemoteUrl) {
		return null;
	}

	if (webRemoteUrl.hostname === "github.com") {
		return `${webRemoteUrl.origin}${webRemoteUrl.pathname}/compare/${encodeURIComponent(branch.name)}?expand=1`;
	}

	if (webRemoteUrl.hostname === "gitlab.com") {
		return `${webRemoteUrl.origin}${webRemoteUrl.pathname}/-/merge_requests/new?merge_request[source_branch]=${encodeURIComponent(branch.name)}`;
	}

	return null;
}

function normalizeRemoteWebUrl(remoteUrl: string | null): URL | null {
	if (!remoteUrl) {
		return null;
	}

	let normalized = remoteUrl.trim();

	if (normalized.startsWith("git@")) {
		normalized = normalized.replace(/^git@([^:]+):/, "https://$1/");
	} else if (normalized.startsWith("ssh://git@")) {
		normalized = normalized.replace(/^ssh:\/\/git@/, "https://");
	}

	normalized = normalized.replace(/\.git$/, "");

	try {
		return new URL(normalized);
	} catch {
		return null;
	}
}
