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
	GitChange,
	GitCommitPreview,
	GitDiffMode,
	GitExplorerHighlights,
	GitRemote,
} from "#/lib/git";
import {
	getGitBranchCommits,
	getGitChangeMarkers,
	mutateGitChangeMarker,
} from "#/server/git";
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
import type {
	GitBulkSelectionMode,
	GitSidebarDiscardTarget,
	GitSidebarProps,
} from "./git-sidebar-types";
import {
	createInitialSectionState,
	resolveBranchRowActionState,
} from "./git-sidebar-utils";
import { useGitSidebarState } from "./use-git-sidebar-state";

export function GitSidebar({
	activeProject,
	onExplorerHighlightsChange,
	onOpenProjectFile,
	selectedChange,
	onSelectChange,
	onDiffRefresh,
}: GitSidebarProps) {
	const activeProjectId = activeProject?.id ?? "";
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
	const [activeSelectionMode, setActiveSelectionMode] =
		useState<GitBulkSelectionMode>(null);
	const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
	const [discardTarget, setDiscardTarget] =
		useState<GitSidebarDiscardTarget | null>(null);
	const [isMarkersLoading, setIsMarkersLoading] = useState(false);
	const [markedPaths, setMarkedPaths] = useState<Set<string>>(() => new Set());
	const [pendingMarkerPaths, setPendingMarkerPaths] = useState<string[]>([]);
	const [remoteOpenState, setRemoteOpenState] = useState<
		Record<string, boolean>
	>({});
	const branchCommitsRequestIdRef = useRef(0);
	const markerRequestIdRef = useRef(0);
	const branchContextMenuRef = useRef<HTMLDivElement | null>(null);
	const {
		error,
		handleCheckoutLocalBranch,
		handleCheckoutRemoteBranch,
		handleDeleteStash,
		handleCreateLocalBranch,
		handleDeleteLocalBranch,
		handleDiscardChanges,
		handleGitAction,
		handleGitCommit,
		handleGitGroupAction,
		handleIgnoreSelectedChanges,
		handleApplyStash,
		handlePullCurrentBranch,
		handleUpdateBranchFromUpstream,
		handlePushBranchToRemote,
		handlePushCurrentBranch,
		handleRefresh,
		handleRefreshRemotes,
		handleStashChanges,
		handleStageSelectedChanges,
		handleUnstageSelectedChanges,
		isLoading,
		isRefreshingRemotes,
		overview,
		pendingMutationKey,
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
		if (!activeProjectId) {
			setIsMarkersLoading(false);
			setMarkedPaths(new Set());
			setPendingMarkerPaths([]);
			return;
		}

		let isCancelled = false;
		const requestId = markerRequestIdRef.current + 1;
		markerRequestIdRef.current = requestId;
		setIsMarkersLoading(true);

		void getGitChangeMarkers({
			data: {
				projectId: activeProjectId,
			},
		})
			.then((nextPaths) => {
				if (isCancelled || markerRequestIdRef.current !== requestId) {
					return;
				}

				setMarkedPaths(new Set(nextPaths));
			})
			.catch(() => {
				if (isCancelled || markerRequestIdRef.current !== requestId) {
					return;
				}

				setMarkedPaths(new Set());
			})
			.finally(() => {
				if (isCancelled || markerRequestIdRef.current !== requestId) {
					return;
				}

				setIsMarkersLoading(false);
				setPendingMarkerPaths([]);
			});

		return () => {
			isCancelled = true;
		};
	}, [activeProjectId]);

	useEffect(() => {
		onExplorerHighlightsChange?.(
			createGitExplorerHighlights(
				overview ? [...overview.staged, ...overview.unstaged] : [],
			),
		);
	}, [onExplorerHighlightsChange, overview]);

	useEffect(() => {
		if (!overview) {
			setActiveSelectionMode(null);
			setSelectedPaths([]);
			setDiscardTarget(null);
			return;
		}

		const activeChanges =
			activeSelectionMode === "staged" ? overview.staged : overview.unstaged;

		setSelectedPaths((currentPaths) =>
			currentPaths.filter((selectedPath) =>
				activeChanges.some((change) => change.path === selectedPath),
			),
		);
		setDiscardTarget((currentTarget) => {
			if (!currentTarget) {
				return null;
			}

			const nextChanges = currentTarget.changes.filter((targetChange) =>
				overview.unstaged.some((change) => change.path === targetChange.path),
			);

			return nextChanges.length > 0
				? { ...currentTarget, changes: nextChanges }
				: null;
		});

		if (activeSelectionMode && activeChanges.length === 0) {
			setActiveSelectionMode(null);
		}
	}, [activeSelectionMode, overview]);

	useEffect(() => {
		if (!overview) {
			setRemoteOpenState({});
			return;
		}

		setRemoteOpenState((currentState) => {
			const nextState: Record<string, boolean> = {};

			for (const remote of overview.remotes) {
				nextState[remote.name] = currentState[remote.name] ?? true;
			}

			return nextState;
		});
	}, [overview]);

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

	const setSelectionMode = (diffMode: GitDiffMode) => {
		setActiveSelectionMode(diffMode);
		setSelectedPaths([]);
		setDiscardTarget(null);
	};

	const clearSelectionMode = () => {
		setActiveSelectionMode(null);
		setSelectedPaths([]);
		setDiscardTarget(null);
	};

	const toggleSelection = (change: GitChange) => {
		setSelectedPaths((currentPaths) =>
			currentPaths.includes(change.path)
				? currentPaths.filter((path) => path !== change.path)
				: [...currentPaths, change.path],
		);
	};

	const handleSingleDiscardRequest = (change: GitChange) => {
		setDiscardTarget({
			changes: [change],
			source: "single",
		});
	};

	const handleToggleMarker = async (change: GitChange) => {
		if (
			!activeProjectId ||
			isMarkersLoading ||
			pendingMarkerPaths.includes(change.path)
		) {
			return;
		}

		const nextMarked = !markedPaths.has(change.path);
		setPendingMarkerPaths((currentPaths) => [...currentPaths, change.path]);
		setMarkedPaths((currentPaths) => {
			const nextPaths = new Set(currentPaths);

			if (nextMarked) {
				nextPaths.add(change.path);
			} else {
				nextPaths.delete(change.path);
			}

			return nextPaths;
		});

		try {
			await mutateGitChangeMarker({
				data: {
					projectId: activeProjectId,
					filePath: change.path,
					marked: nextMarked,
				},
			});
		} catch {
			setMarkedPaths((currentPaths) => {
				const nextPaths = new Set(currentPaths);

				if (nextMarked) {
					nextPaths.delete(change.path);
				} else {
					nextPaths.add(change.path);
				}

				return nextPaths;
			});
		} finally {
			setPendingMarkerPaths((currentPaths) =>
				currentPaths.filter((path) => path !== change.path),
			);
		}
	};

	const handleDiscardDialogConfirm = async () => {
		if (!discardTarget) {
			return;
		}

		const didDiscard = await handleDiscardChanges(discardTarget.changes);

		if (!didDiscard) {
			return;
		}

		const discardedPaths = discardTarget.changes.map((change) => change.path);
		setSelectedPaths((currentPaths) =>
			currentPaths.filter((path) => !discardedPaths.includes(path)),
		);
		setDiscardTarget(null);

		if (discardTarget.source === "selection") {
			clearSelectionMode();
		}
	};

	const handleSelectedAction = async (
		diffMode: GitDiffMode,
		action: "stage" | "unstage" | "discard" | "stash" | "ignore",
	) => {
		if (!overview || activeSelectionMode !== diffMode) {
			return;
		}

		const sourceChanges =
			diffMode === "staged" ? overview.staged : overview.unstaged;
		const selectedChanges = sourceChanges.filter((change) =>
			selectedPaths.includes(change.path),
		);

		if (selectedChanges.length === 0) {
			return;
		}

		if (action === "discard") {
			setDiscardTarget({
				changes: selectedChanges,
				source: "selection",
			});
			return;
		}

		const didApply =
			action === "stage"
				? await handleStageSelectedChanges(selectedChanges)
				: action === "unstage"
					? await handleUnstageSelectedChanges(selectedChanges)
					: action === "ignore"
						? await handleIgnoreSelectedChanges(selectedChanges)
						: await handleStashChanges(selectedChanges, diffMode);

		if (!didApply) {
			return;
		}

		clearSelectionMode();
	};

	const isDiscarding = discardTarget
		? discardTarget.changes.length > 1
			? pendingMutationKey === "discard:selected"
			: pendingMutationKey ===
				`discard:${discardTarget.changes[0].path}:${discardTarget.changes[0].code}`
		: false;

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
	const activeRemoteRefName = currentBranch?.upstream ?? null;
	const pendingRemoteCheckoutRefName = pendingMutationKey.startsWith(
		"branch:checkout-remote:",
	)
		? pendingMutationKey.slice("branch:checkout-remote:".length)
		: null;
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
	const handlePullFromContextMenu = (branch: GitBranchListEntry) => {
		setBranchContextMenuState(null);

		if (branch.isCurrent) {
			void handlePullCurrentBranch();
			return;
		}

		void handleUpdateBranchFromUpstream(branch.name);
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
				<div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
					{error ? (
						<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[12px] text-red-200/90">
							{error}
						</div>
					) : null}

					{!error && isLoading && !overview ? (
						<div className="flex items-center gap-1.5 px-2.5 py-3 text-[12px] text-muted-foreground/60">
							<LoaderCircle className="size-3 animate-spin" />
							Loading Git state...
						</div>
					) : null}

					{!error && overview ? (
						<div className="divide-y divide-white/4">
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
										className="size-5 text-muted-foreground/40 hover:text-foreground"
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											void handleRefresh();
										}}
										disabled={isLoading}
										aria-label="Refresh Git data"
									>
										{isLoading ? (
											<LoaderCircle className="size-2.5 animate-spin" />
										) : (
											<RefreshCcw className="size-2.5" />
										)}
									</Button>
								}
							>
								<div className="flex flex-col gap-1">
									<ChangeGroup
										title="Staged"
										changes={overview.staged}
										onOpenFile={onOpenProjectFile}
										selectedChange={selectedChange}
										onSelectChange={onSelectChange}
										diffMode="staged"
										onAction={(change, action) => {
											if (action === "stash") {
												return handleStashChanges([change], "staged", {
													singleChangeCode: change.code,
												});
											}

											return handleGitAction(change, action);
										}}
										onDiscardRequest={handleSingleDiscardRequest}
										onGroupAction={handleGitGroupAction}
										pendingMutationKey={pendingMutationKey}
										activeSelectionMode={activeSelectionMode}
										isMarkersLoading={isMarkersLoading}
										markedPaths={markedPaths}
										pendingMarkerPaths={pendingMarkerPaths}
										selectedPaths={
											activeSelectionMode === "staged" ? selectedPaths : []
										}
										onStartSelectionMode={setSelectionMode}
										onCancelSelectionMode={clearSelectionMode}
										onToggleMarker={handleToggleMarker}
										onToggleSelection={toggleSelection}
										onSelectedAction={(action) => {
											void handleSelectedAction("staged", action);
										}}
									/>
									<ChangeGroup
										title="Unstaged"
										changes={overview.unstaged}
										onOpenFile={onOpenProjectFile}
										selectedChange={selectedChange}
										onSelectChange={onSelectChange}
										diffMode="unstaged"
										onAction={(change, action) => {
											if (action === "stash") {
												return handleStashChanges([change], "unstaged", {
													singleChangeCode: change.code,
												});
											}

											return handleGitAction(change, action);
										}}
										onDiscardRequest={handleSingleDiscardRequest}
										onGroupAction={handleGitGroupAction}
										pendingMutationKey={pendingMutationKey}
										activeSelectionMode={activeSelectionMode}
										isMarkersLoading={isMarkersLoading}
										markedPaths={markedPaths}
										pendingMarkerPaths={pendingMarkerPaths}
										selectedPaths={
											activeSelectionMode === "unstaged" ? selectedPaths : []
										}
										onStartSelectionMode={setSelectionMode}
										onCancelSelectionMode={clearSelectionMode}
										onToggleMarker={handleToggleMarker}
										onToggleSelection={toggleSelection}
										onSelectedAction={(action) => {
											void handleSelectedAction("unstaged", action);
										}}
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
										className="size-5 text-muted-foreground/40 hover:text-foreground"
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
											<LoaderCircle className="size-2.5 animate-spin" />
										) : (
											<Plus className="size-2.5" />
										)}
									</Button>
								}
							>
								<div className="space-y-0.5">
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
								rightElement={
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										className="size-5 text-muted-foreground/40 hover:text-foreground"
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											void handleRefreshRemotes();
										}}
										disabled={isRefreshingRemotes}
										aria-label="Refresh remotes"
										title="Refresh remotes"
									>
										{isRefreshingRemotes ? (
											<LoaderCircle className="size-2.5 animate-spin" />
										) : (
											<RefreshCcw className="size-2.5" />
										)}
									</Button>
								}
							>
								{overview.remotes.length > 0 ? (
									<div className="space-y-0.5" role="tree">
										{overview.remotes.map((remote) => (
											<RemoteRow
												key={remote.name}
												remote={remote}
												isOpen={remoteOpenState[remote.name] ?? true}
												onOpenChange={(open) => {
													setRemoteOpenState((currentState) => ({
														...currentState,
														[remote.name]: open,
													}));
												}}
												activeRefName={activeRemoteRefName}
												onCheckoutBranch={(refName) => {
													void handleCheckoutRemoteBranch(refName);
												}}
												pendingCheckoutRefName={pendingRemoteCheckoutRefName}
											/>
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
									<div className="space-y-0.5">
										{overview.stashes.map((stash) => (
											<StashRow
												key={stash.name}
												stash={stash}
												onApply={() => {
													void handleApplyStash(stash.name);
												}}
												onDelete={() => {
													void handleDeleteStash(stash.name);
												}}
												isApplying={
													pendingMutationKey === `stash:apply:${stash.name}`
												}
												isDeleting={
													pendingMutationKey === `stash:delete:${stash.name}`
												}
											/>
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
					void handleDiscardDialogConfirm();
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
					className="fixed z-50 min-w-[170px] overflow-hidden rounded-lg border border-white/8 bg-[#0e0e10] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
					style={{
						left: branchContextMenuState.x,
						top: branchContextMenuState.y,
					}}
				>
					<button
						type="button"
						role="menuitem"
						className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
						disabled={isBranchActionDisabled}
						onClick={() => {
							handleShowBranchCommits(contextMenuBranch.name);
						}}
					>
						<GitCommitHorizontal className="size-3 text-zinc-400" />
						<span>Show Commits</span>
					</button>
					{contextMenuBranchActions.canCheckout ? (
						<button
							type="button"
							role="menuitem"
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
							disabled={isBranchActionDisabled}
							onClick={() => {
								handleCheckoutFromContextMenu(contextMenuBranch.name);
							}}
						>
							<ArrowRightLeft className="size-3 text-zinc-400" />
							<span>Checkout Branch</span>
						</button>
					) : null}
					<button
						type="button"
						role="menuitem"
						className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
						disabled={
							isBranchActionDisabled || !contextMenuBranchActions.canPush
						}
						title={
							!contextMenuBranchActions.canPush
								? (contextMenuBranchActions.pushDisabledReason ?? undefined)
								: undefined
						}
						onClick={() => {
							handlePushFromContextMenu(contextMenuBranch);
						}}
					>
						<ArrowUpToLine className="size-3 text-zinc-400" />
						<span>{contextMenuBranchActions.pushLabel}</span>
					</button>
					<button
						type="button"
						role="menuitem"
						className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
						disabled={
							isBranchActionDisabled || !contextMenuBranchActions.canPull
						}
						title={
							!contextMenuBranchActions.canPull
								? (contextMenuBranchActions.pullDisabledReason ?? undefined)
								: undefined
						}
						onClick={() => {
							handlePullFromContextMenu(contextMenuBranch);
						}}
					>
						<ArrowDownToLine className="size-3 text-zinc-400" />
						<span>{contextMenuBranchActions.pullLabel}</span>
					</button>
					{contextMenuBranchActions.canCreatePullRequest ? (
						<button
							type="button"
							role="menuitem"
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
							disabled={isBranchActionDisabled}
							onClick={handleCreatePullRequestFromContextMenu}
						>
							<GitPullRequest className="size-3 text-zinc-400" />
							<span>Create Pull Request</span>
						</button>
					) : null}
					{contextMenuBranchActions.canDelete ? (
						<>
							<div className="my-1 border-t border-white/5" />
							<button
								type="button"
								role="menuitem"
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
								disabled={isBranchActionDisabled}
								onClick={() => {
									if (isBranchActionDisabled) {
										return;
									}

									setDeleteBranchTarget(contextMenuBranch.name);
									setBranchContextMenuState(null);
								}}
							>
								<Trash2 className="size-3 text-red-400/70" />
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

function createGitExplorerHighlights(
	changes: GitChange[],
): GitExplorerHighlights {
	const filePaths = new Set<string>();
	const directoryPaths = new Set<string>();

	for (const change of changes) {
		addChangedPath(change.path, filePaths, directoryPaths);

		if (change.originalPath) {
			addChangedPath(change.originalPath, filePaths, directoryPaths);
		}
	}

	return {
		directories: [...directoryPaths],
		files: [...filePaths],
	};
}

function addChangedPath(
	value: string,
	filePaths: Set<string>,
	directoryPaths: Set<string>,
) {
	const normalizedPath = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

	if (!normalizedPath) {
		return;
	}

	filePaths.add(normalizedPath);

	let directoryPath = getParentDirectoryPath(normalizedPath);

	while (directoryPath) {
		directoryPaths.add(directoryPath);
		directoryPath = getParentDirectoryPath(directoryPath);
	}
}

function getParentDirectoryPath(relativePath: string) {
	const lastSlashIndex = relativePath.lastIndexOf("/");

	return lastSlashIndex === -1 ? "" : relativePath.slice(0, lastSlashIndex);
}
