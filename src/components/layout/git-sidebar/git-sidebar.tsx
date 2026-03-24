import {
	ArrowDownToLine,
	ArrowRightLeft,
	ArrowUpToLine,
	GitBranch,
	GitCommitHorizontal,
	GitCompareArrows,
	GitFork,
	GitPullRequest,
	LoaderCircle,
	Plus,
	RefreshCcw,
	ScrollText,
	Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import type {
	GitBranchListEntry,
	GitBranchSummary,
	GitCommitPreview,
	GitRemote,
} from "#/lib/git";
import { getGitBranchCommits } from "#/server/git";
import {
	GitSidebarBranchActionDialog,
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
import {
	createInitialSectionState,
	resolveBranchRowActionState,
} from "./git-sidebar-utils";
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
	const [branchContextMenuState, setBranchContextMenuState] = useState<{
		branchName: string;
		x: number;
		y: number;
	} | null>(null);
	const [deleteBranchTarget, setDeleteBranchTarget] = useState<string | null>(
		null,
	);
	const [branchCommitsTarget, setBranchCommitsTarget] = useState<{
		branchName: string;
		projectPath: string;
	} | null>(null);
	const [branchCommits, setBranchCommits] = useState<GitCommitPreview[]>([]);
	const [branchCommitsError, setBranchCommitsError] = useState("");
	const [isBranchCommitsLoading, setIsBranchCommitsLoading] = useState(false);
	const branchCommitsRequestIdRef = useRef(0);
	const branchContextMenuRef = useRef<HTMLDivElement | null>(null);
	const {
		discardTarget,
		error,
		handleCheckoutLocalBranch,
		handleCreateLocalBranch,
		handleDeleteLocalBranch,
		handleDiscardConfirm,
		handleGitAction,
		handleGitCommit,
		handleGitGroupAction,
		handlePullCurrentBranch,
		handlePushBranchToRemote,
		handlePushCurrentBranch,
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

	useEffect(() => {
		if (!branchContextMenuState) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (branchContextMenuRef.current?.contains(event.target as Node)) {
				return;
			}

			setBranchContextMenuState(null);
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			setBranchContextMenuState(null);
		};

		const handleViewportChange = () => {
			setBranchContextMenuState(null);
		};

		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleEscape, true);
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, true);

		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleEscape, true);
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange, true);
		};
	}, [branchContextMenuState]);

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
	const isDeleteBranching = deleteBranchTarget
		? pendingMutationKey === `branch:delete:${deleteBranchTarget}`
		: false;
	const isBranchCommitsDialogOpen = Boolean(branchCommitsBranchName);
	const currentBranch = overview?.branch ?? null;
	const orderedBranches = overview
		? [
				...overview.branches.filter((branch) => branch.isCurrent),
				...overview.branches.filter((branch) => !branch.isCurrent),
			]
		: [];
	const isBranchActionDisabled = isLoading || isAnyBranchMutationPending;
	const contextMenuBranch = branchContextMenuState
		? (orderedBranches.find(
				(branch) => branch.name === branchContextMenuState.branchName,
			) ?? null)
		: null;
	const contextMenuBranchActions =
		contextMenuBranch && overview
			? resolveBranchRowActionState({
					branch: contextMenuBranch,
					currentBranch,
					branchPullRequestUrl: buildPullRequestUrl(
						contextMenuBranch,
						overview.remotes,
					),
					remotes: overview.remotes,
					pendingMutationKey,
				})
			: null;

	const handleDeleteBranchConfirm = async () => {
		if (!deleteBranchTarget) {
			return;
		}

		const didDelete = await handleDeleteLocalBranch(deleteBranchTarget);

		if (!didDelete) {
			return;
		}

		setDeleteBranchTarget(null);
	};
	const openBranchContextMenu = (position: {
		branchName: string;
		x: number;
		y: number;
	}) => {
		if (typeof window === "undefined") {
			setBranchContextMenuState(position);
			return;
		}

		const menuWidth = 196;
		const menuHeight = 240;
		const viewportPadding = 8;

		setBranchContextMenuState({
			branchName: position.branchName,
			x: Math.min(
				Math.max(position.x, viewportPadding),
				window.innerWidth - menuWidth - viewportPadding,
			),
			y: Math.min(
				Math.max(position.y, viewportPadding),
				window.innerHeight - menuHeight - viewportPadding,
			),
		});
	};
	const handleShowBranchCommits = (branchName: string) => {
		setBranchCommitsTarget({
			branchName,
			projectPath: activeProjectPath,
		});
		setBranchContextMenuState(null);
	};
	const handleCheckoutFromContextMenu = (branchName: string) => {
		setBranchContextMenuState(null);
		void handleCheckoutLocalBranch(branchName);
	};
	const handlePushFromContextMenu = (branch: GitBranchListEntry) => {
		setBranchContextMenuState(null);

		if (branch.isCurrent) {
			void handlePushCurrentBranch();
			return;
		}

		void handlePushBranchToRemote(branch.name);
	};
	const handlePullFromContextMenu = () => {
		setBranchContextMenuState(null);
		void handlePullCurrentBranch();
	};
	const handleCreatePullRequestFromContextMenu = () => {
		const contextMenuPullRequestUrl =
			contextMenuBranch && overview
				? buildPullRequestUrl(contextMenuBranch, overview.remotes)
				: null;

		if (typeof window !== "undefined" && contextMenuPullRequestUrl) {
			window.open(contextMenuPullRequestUrl, "_blank", "noopener,noreferrer");
		}

		setBranchContextMenuState(null);
	};

	return (
		<>
			<div className="flex h-full min-h-0 flex-col">
				<div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
					{error ? (
						<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
							{error}
						</div>
					) : null}

					{!error && isLoading && !overview ? (
						<div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
							<LoaderCircle className="size-3 animate-spin" />
							Loading Git state...
						</div>
					) : null}

					{!error && overview ? (
						<div className="divide-y divide-white/6">
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
								<div className="flex flex-col gap-3">
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
										aria-label={
											isCreateBranching
												? "Creating local branch"
												: "Create local branch"
										}
										title={
											isCreateBranching
												? "Creating local branch"
												: "Create local branch"
										}
									>
										{isCreateBranching ? (
											<LoaderCircle className="size-3 animate-spin" />
										) : (
											<Plus className="size-3" />
										)}
									</Button>
								}
							>
								<div className="space-y-1">
									{orderedBranches.length > 0 ? (
										orderedBranches.map((branch) => {
											const branchPullRequestUrl = buildPullRequestUrl(
												branch,
												overview.remotes,
											);
											const branchActions = resolveBranchRowActionState({
												branch,
												currentBranch,
												branchPullRequestUrl,
												remotes: overview.remotes,
												pendingMutationKey,
											});

											return (
												<BranchRow
													key={branch.name}
													branch={branch}
													currentBranch={
														branch.isCurrent ? currentBranch : null
													}
													isCheckingOut={branchActions.isCheckingOut}
													isPulling={branchActions.isPulling}
													isPushing={branchActions.isPushing}
													onOpenContextMenu={(position) => {
														openBranchContextMenu({
															branchName: branch.name,
															x: position.x,
															y: position.y,
														});
													}}
													onShowCommits={() => {
														handleShowBranchCommits(branch.name);
													}}
												/>
											);
										})
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
									<div className="space-y-1">
										{overview.remotes.map((remote) => (
											<RemoteRow key={remote.name} remote={remote} />
										))}
									</div>
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
									<div className="space-y-1">
										{overview.stashes.map((stash) => (
											<StashRow key={stash.name} stash={stash} />
										))}
									</div>
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
			{branchContextMenuState &&
			contextMenuBranch &&
			contextMenuBranchActions ? (
				<div
					ref={branchContextMenuRef}
					role="menu"
					aria-label={`Branch actions for ${contextMenuBranch.name}`}
					className="fixed z-50 min-w-48 overflow-hidden rounded-xl border border-white/8 bg-[#111113] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
					style={{
						left: branchContextMenuState.x,
						top: branchContextMenuState.y,
					}}
				>
					<button
						type="button"
						role="menuitem"
						className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-100 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
						disabled={isBranchActionDisabled}
						onClick={() => {
							handleShowBranchCommits(contextMenuBranch.name);
						}}
					>
						<GitCommitHorizontal className="size-3.5 text-zinc-300" />
						<span>Show Commits</span>
					</button>
					{contextMenuBranchActions.canCheckout ? (
						<button
							type="button"
							role="menuitem"
							className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-100 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
							disabled={isBranchActionDisabled}
							onClick={() => {
								handleCheckoutFromContextMenu(contextMenuBranch.name);
							}}
						>
							<ArrowRightLeft className="size-3.5 text-zinc-300" />
							<span>Checkout Branch</span>
						</button>
					) : null}
					{contextMenuBranchActions.canPush ? (
						<button
							type="button"
							role="menuitem"
							className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-100 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
							disabled={isBranchActionDisabled}
							onClick={() => {
								handlePushFromContextMenu(contextMenuBranch);
							}}
						>
							<ArrowUpToLine className="size-3.5 text-zinc-300" />
							<span>
								{contextMenuBranch.isCurrent &&
								!contextMenuBranchActions.hasUpstream
									? "Publish Branch"
									: "Push Branch"}
							</span>
						</button>
					) : null}
					{contextMenuBranchActions.canPull ? (
						<button
							type="button"
							role="menuitem"
							className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-100 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
							disabled={isBranchActionDisabled}
							onClick={handlePullFromContextMenu}
						>
							<ArrowDownToLine className="size-3.5 text-zinc-300" />
							<span>Pull Branch</span>
						</button>
					) : null}
					{contextMenuBranchActions.canCreatePullRequest ? (
						<button
							type="button"
							role="menuitem"
							className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-100 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
							disabled={isBranchActionDisabled}
							onClick={handleCreatePullRequestFromContextMenu}
						>
							<GitPullRequest className="size-3.5 text-zinc-300" />
							<span>Create Pull Request</span>
						</button>
					) : null}
					{contextMenuBranchActions.canDelete ? (
						<>
							<div className="my-1 border-t border-white/6" />
							<button
								type="button"
								role="menuitem"
								className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-300/90 transition-colors hover:bg-red-500/14 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
								disabled={isBranchActionDisabled}
								onClick={() => {
									if (isBranchActionDisabled) {
										return;
									}

									setDeleteBranchTarget(contextMenuBranch.name);
									setBranchContextMenuState(null);
								}}
							>
								<Trash2 className="size-3.5 text-red-400/85" />
								<span>Delete Branch</span>
							</button>
						</>
					) : null}
				</div>
			) : null}
			<GitSidebarBranchActionDialog
				action="delete"
				branchName={deleteBranchTarget ?? ""}
				isOpen={Boolean(deleteBranchTarget)}
				isSubmitting={isDeleteBranching}
				onConfirm={handleDeleteBranchConfirm}
				onOpenChange={(open) => {
					if (!open && !isDeleteBranching) {
						setDeleteBranchTarget(null);
					}
				}}
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
