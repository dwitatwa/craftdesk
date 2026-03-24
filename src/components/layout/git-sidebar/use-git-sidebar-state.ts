import {
	useCallback,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

import type {
	GitBranchMutationInput,
	GitChange,
	GitRepositoryOverview,
	GitSelectedChange,
} from "#/lib/git";
import {
	getGitRepositoryOverview,
	mutateGitBranch,
	mutateGitChange,
	waitForGitRepositoryChange,
} from "#/server/git";
import { delay, resolveSelectedChange } from "./git-sidebar-utils";

const GIT_REPOSITORY_WAIT_TIMEOUT_MS = 25_000;
const GIT_REPOSITORY_FALLBACK_REFRESH_MS = 30_000;
const GIT_PENDING_MUTATION_RETRY_MS = 500;

interface UseGitSidebarStateOptions {
	activeProjectPath: string;
	selectedChange: GitSelectedChange | null;
	onSelectChange: (change: GitSelectedChange | null) => void;
	onDiffRefresh?: () => void;
}

export function useGitSidebarState({
	activeProjectPath,
	selectedChange,
	onSelectChange,
	onDiffRefresh,
}: UseGitSidebarStateOptions) {
	const [overview, setOverview] = useState<GitRepositoryOverview | null>(null);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [pendingMutationKey, setPendingMutationKey] = useState("");
	const activeProjectPathRef = useRef(activeProjectPath);
	const loadedProjectPathRef = useRef("");
	const overviewRequestRef = useRef<{
		projectPath: string;
		promise: Promise<GitRepositoryOverview>;
	} | null>(null);
	const selectedChangeRef = useRef(selectedChange);
	const onSelectChangeRef = useRef(onSelectChange);
	const onDiffRefreshRef = useRef(onDiffRefresh);
	const overviewRef = useRef(overview);
	const pendingMutationKeyRef = useRef(pendingMutationKey);
	const changeVersionRef = useRef(0);
	activeProjectPathRef.current = activeProjectPath;
	selectedChangeRef.current = selectedChange;
	onSelectChangeRef.current = onSelectChange;
	onDiffRefreshRef.current = onDiffRefresh;
	overviewRef.current = overview;
	pendingMutationKeyRef.current = pendingMutationKey;

	const syncSelectedChange = useCallback(
		(nextOverview: GitRepositoryOverview) => {
			if (!selectedChangeRef.current) {
				return;
			}

			onSelectChangeRef.current(
				resolveSelectedChange(selectedChangeRef.current, nextOverview),
			);
		},
		[],
	);

	const loadOverview = useCallback(
		async (
			projectPath: string,
			options: {
				notifyDiff?: boolean;
				force?: boolean;
				reset?: boolean;
			} = {},
		) => {
			const existingRequest = overviewRequestRef.current;

			if (!options.force && existingRequest?.projectPath === projectPath) {
				return existingRequest.promise;
			}

			if (options.reset) {
				setOverview(null);
			}

			setError("");
			setIsLoading(true);

			const promise = getGitRepositoryOverview({
				data: {
					cwd: projectPath,
				},
			});
			overviewRequestRef.current = {
				projectPath,
				promise,
			};

			try {
				const nextOverview = await promise;

				if (activeProjectPathRef.current !== projectPath) {
					return nextOverview;
				}

				loadedProjectPathRef.current = projectPath;
				setOverview(nextOverview);
				changeVersionRef.current = nextOverview.changeVersion;
				syncSelectedChange(nextOverview);

				if (options.notifyDiff) {
					onDiffRefreshRef.current?.();
				}

				return nextOverview;
			} catch (cause) {
				if (activeProjectPathRef.current === projectPath) {
					setError(
						cause instanceof Error ? cause.message : "Failed to load Git data.",
					);
				}

				throw cause;
			} finally {
				if (overviewRequestRef.current?.promise === promise) {
					overviewRequestRef.current = null;
				}

				if (activeProjectPathRef.current === projectPath) {
					setIsLoading(false);
				}
			}
		},
		[syncSelectedChange],
	);

	useEffect(() => {
		if (!activeProjectPath) {
			loadedProjectPathRef.current = "";
			overviewRequestRef.current = null;
			setOverview(null);
			setError("");
			setIsLoading(false);
			changeVersionRef.current = 0;
			return;
		}

		if (
			loadedProjectPathRef.current === activeProjectPath &&
			overviewRef.current
		) {
			syncSelectedChange(overviewRef.current);
			return;
		}

		if (overviewRequestRef.current?.projectPath === activeProjectPath) {
			setError("");
			setIsLoading(true);
			return;
		}

		void loadOverview(activeProjectPath, { reset: true }).catch(() => {
			// Error state is handled inside loadOverview.
		});
	}, [activeProjectPath, loadOverview, syncSelectedChange]);

	const refreshOverview = useEffectEvent(
		async (
			projectPath: string,
			options?: { force?: boolean; notifyDiff?: boolean },
		) => {
			try {
				await loadOverview(projectPath, options);
			} catch {
				// Error state is handled inside loadOverview.
			}
		},
	);

	useEffect(() => {
		if (!activeProjectPath) {
			return;
		}

		let isCancelled = false;
		let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

		const clearFallbackTimer = () => {
			if (!fallbackTimer) {
				return;
			}

			clearTimeout(fallbackTimer);
			fallbackTimer = null;
		};

		const scheduleFallbackRefresh = () => {
			clearFallbackTimer();
			fallbackTimer = setTimeout(() => {
				if (isCancelled) {
					return;
				}

				if (
					document.visibilityState !== "visible" ||
					pendingMutationKeyRef.current
				) {
					scheduleFallbackRefresh();
					return;
				}

				void refreshOverview(activeProjectPath, { force: true });
				scheduleFallbackRefresh();
			}, GIT_REPOSITORY_FALLBACK_REFRESH_MS);
		};

		const handleVisibilityRefresh = () => {
			if (
				document.visibilityState !== "visible" ||
				pendingMutationKeyRef.current
			) {
				return;
			}

			void refreshOverview(activeProjectPath, { force: true });
		};

		const syncLoop = async () => {
			while (!isCancelled) {
				try {
					const result = await waitForGitRepositoryChange({
						data: {
							cwd: activeProjectPath,
							afterVersion: changeVersionRef.current,
							timeoutMs: GIT_REPOSITORY_WAIT_TIMEOUT_MS,
						},
					});

					if (
						isCancelled ||
						activeProjectPathRef.current !== activeProjectPath ||
						pendingMutationKeyRef.current
					) {
						return;
					}

					if (!result.changed) {
						continue;
					}

					changeVersionRef.current = result.version;
					await refreshOverview(activeProjectPath, {
						force: true,
						notifyDiff: true,
					});
				} catch {
					if (isCancelled) {
						return;
					}

					await delay(GIT_PENDING_MUTATION_RETRY_MS);
				}
			}
		};

		scheduleFallbackRefresh();
		void syncLoop();
		window.addEventListener("focus", handleVisibilityRefresh);
		document.addEventListener("visibilitychange", handleVisibilityRefresh);

		return () => {
			isCancelled = true;
			clearFallbackTimer();
			window.removeEventListener("focus", handleVisibilityRefresh);
			document.removeEventListener("visibilitychange", handleVisibilityRefresh);
		};
	}, [activeProjectPath]);

	const handleRefresh = useCallback(async () => {
		if (!activeProjectPath) {
			return;
		}

		try {
			await loadOverview(activeProjectPath, {
				force: true,
				notifyDiff: true,
			});
		} catch {
			// Error state is handled inside loadOverview.
		}
	}, [activeProjectPath, loadOverview]);

	const handleGitAction = useCallback(
		async (change: GitChange, action: "stage" | "unstage" | "discard") => {
			if (!activeProjectPath) {
				return false;
			}

			setPendingMutationKey(`${action}:${change.path}:${change.code}`);
			setError("");

			try {
				await mutateGitChange({
					data: {
						cwd: activeProjectPath,
						path: change.path,
						action,
					},
				});
				await handleRefresh();
				return true;
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Failed to perform Git action.",
				);
				return false;
			} finally {
				setPendingMutationKey("");
			}
		},
		[activeProjectPath, handleRefresh],
	);

	const handleSelectedGitAction = useCallback(
		async (changes: GitChange[], action: "stage" | "unstage" | "discard") => {
			if (!activeProjectPath || changes.length === 0) {
				return false;
			}

			const uniquePaths = [...new Set(changes.map((change) => change.path))];
			const primaryChange = changes[0];
			const isSingleChange = uniquePaths.length === 1;
			const bulkAction =
				action === "stage"
					? "stage-selected"
					: action === "unstage"
						? "unstage-selected"
						: "discard-selected";
			const mutationKey = isSingleChange
				? `${action}:${primaryChange.path}:${primaryChange.code}`
				: `${action}:selected`;

			setPendingMutationKey(mutationKey);
			setError("");

			try {
				await mutateGitChange({
					data: {
						cwd: activeProjectPath,
						path: isSingleChange ? primaryChange.path : ".",
						paths: isSingleChange ? undefined : uniquePaths,
						action: isSingleChange ? action : bulkAction,
					},
				});
				await handleRefresh();
				return true;
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: `Failed to ${action} selected changes.`,
				);
				return false;
			} finally {
				setPendingMutationKey("");
			}
		},
		[activeProjectPath, handleRefresh],
	);

	const handleDiscardChanges = useCallback(
		async (changes: GitChange[]) => handleSelectedGitAction(changes, "discard"),
		[handleSelectedGitAction],
	);

	const handleStageSelectedChanges = useCallback(
		async (changes: GitChange[]) => handleSelectedGitAction(changes, "stage"),
		[handleSelectedGitAction],
	);

	const handleUnstageSelectedChanges = useCallback(
		async (changes: GitChange[]) => handleSelectedGitAction(changes, "unstage"),
		[handleSelectedGitAction],
	);

	const handleGitGroupAction = useCallback(
		async (action: "stage-all" | "unstage-all") => {
			if (!activeProjectPath) {
				return;
			}

			const diffMode = action === "stage-all" ? "unstaged" : "staged";
			setPendingMutationKey(`${diffMode}:all`);
			setError("");

			try {
				await mutateGitChange({
					data: {
						cwd: activeProjectPath,
						path: ".",
						action,
					},
				});
				await handleRefresh();
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Failed to perform group action.",
				);
			} finally {
				setPendingMutationKey("");
			}
		},
		[activeProjectPath, handleRefresh],
	);

	const handleGitCommit = useCallback(
		async (message: string, action: "commit" | "commit-push") => {
			if (!activeProjectPath || !message.trim()) {
				return;
			}

			setPendingMutationKey(`${action}:all`);
			setError("");

			try {
				await mutateGitChange({
					data: {
						cwd: activeProjectPath,
						path: ".",
						action,
						commitMessage: message,
					},
				});
				await handleRefresh();
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: `Failed to perform ${action}.`,
				);
			} finally {
				setPendingMutationKey("");
			}
		},
		[activeProjectPath, handleRefresh],
	);

	const runGitBranchMutation = useCallback(
		async (
			action: GitBranchMutationInput["action"],
			options: {
				branchName?: string;
				mutationKey: string;
				errorMessage: string;
			},
		) => {
			if (!activeProjectPath) {
				return false;
			}

			setPendingMutationKey(options.mutationKey);
			setError("");

			try {
				await mutateGitBranch({
					data: {
						cwd: activeProjectPath,
						action,
						branchName: options.branchName,
					},
				});
				await handleRefresh();
				return true;
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : options.errorMessage);
				return false;
			} finally {
				setPendingMutationKey("");
			}
		},
		[activeProjectPath, handleRefresh],
	);

	const handleCreateLocalBranch = useCallback(
		async (branchName: string) =>
			runGitBranchMutation("create-local", {
				branchName,
				mutationKey: "branch:create",
				errorMessage: "Failed to create branch.",
			}),
		[runGitBranchMutation],
	);

	const handleCheckoutLocalBranch = useCallback(
		async (branchName: string) =>
			runGitBranchMutation("checkout-local", {
				branchName,
				mutationKey: `branch:checkout:${branchName}`,
				errorMessage: "Failed to checkout branch.",
			}),
		[runGitBranchMutation],
	);

	const handleDeleteLocalBranch = useCallback(
		async (branchName: string) =>
			runGitBranchMutation("delete-local", {
				branchName,
				mutationKey: `branch:delete:${branchName}`,
				errorMessage: "Failed to delete branch.",
			}),
		[runGitBranchMutation],
	);

	const handleMergeBranchIntoCurrent = useCallback(
		async (branchName: string) =>
			runGitBranchMutation("merge-into-current", {
				branchName,
				mutationKey: `branch:merge:${branchName}`,
				errorMessage: "Failed to merge branch.",
			}),
		[runGitBranchMutation],
	);

	const handlePullCurrentBranch = useCallback(
		async () =>
			runGitBranchMutation("pull-current", {
				mutationKey: "branch:pull",
				errorMessage: "Failed to pull branch.",
			}),
		[runGitBranchMutation],
	);

	const handlePushCurrentBranch = useCallback(
		async () =>
			runGitBranchMutation("push-current", {
				mutationKey: "branch:push",
				errorMessage: "Failed to push branch.",
			}),
		[runGitBranchMutation],
	);

	const handlePushBranchToRemote = useCallback(
		async (branchName: string) =>
			runGitBranchMutation("push-branch", {
				branchName,
				mutationKey: `branch:push:${branchName}`,
				errorMessage: "Failed to push branch.",
			}),
		[runGitBranchMutation],
	);

	return {
		error,
		handleCheckoutLocalBranch,
		handleDiscardChanges,
		handleGitAction,
		handleCreateLocalBranch,
		handleDeleteLocalBranch,
		handleMergeBranchIntoCurrent,
		handlePullCurrentBranch,
		handlePushBranchToRemote,
		handlePushCurrentBranch,
		handleGitCommit,
		handleGitGroupAction,
		handleRefresh,
		handleStageSelectedChanges,
		handleUnstageSelectedChanges,
		isLoading,
		overview,
		pendingMutationKey,
	};
}
