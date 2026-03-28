import type {
	GitBranchListEntry,
	GitBranchSummary,
	GitChange,
	GitDiffMode,
	GitRemote,
	GitRepositoryOverview,
	GitSelectedChange,
} from "#/lib/git";

export type GitSidebarSectionId =
	| "changes"
	| "branches"
	| "remotes"
	| "stashes";

export function createInitialSectionState(): Record<
	GitSidebarSectionId,
	boolean
> {
	return {
		changes: true,
		branches: false,
		remotes: false,
		stashes: false,
	};
}

export function resolveSelectedChange(
	current: GitSelectedChange | null,
	overview: GitRepositoryOverview,
) {
	if (!current) {
		return null;
	}

	const preferredChanges =
		current.diffMode === "staged" ? overview.staged : overview.unstaged;
	const fallbackChanges =
		current.diffMode === "staged" ? overview.unstaged : overview.staged;
	const preferredMode = current.diffMode;
	const fallbackMode = current.diffMode === "staged" ? "unstaged" : "staged";

	return (
		findMatchingChange(current, preferredChanges, preferredMode, true) ??
		findMatchingChange(current, fallbackChanges, fallbackMode, true) ??
		findMatchingChange(current, preferredChanges, preferredMode, false) ??
		findMatchingChange(current, fallbackChanges, fallbackMode, false) ??
		null
	);
}

function findMatchingChange(
	current: GitSelectedChange | null,
	changes: GitChange[],
	diffMode: GitDiffMode,
	requireCodeMatch: boolean,
) {
	if (!current) {
		return null;
	}

	const match = changes.find(
		(change) =>
			change.path === current.path &&
			change.originalPath === current.originalPath &&
			(!requireCodeMatch || change.code === current.code),
	);

	if (match) {
		return {
			...match,
			diffMode,
		};
	}

	return null;
}

export function delay(timeoutMs: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, timeoutMs);
	});
}

export function getChangeToneClassName(code: string) {
	switch (code) {
		case "A":
		case "?":
			return "bg-emerald-500/15 text-emerald-300";
		case "M":
			return "bg-amber-500/15 text-amber-300";
		case "D":
			return "bg-red-500/15 text-red-300";
		case "R":
		case "C":
			return "bg-sky-500/15 text-sky-300";
		case "U":
			return "bg-fuchsia-500/15 text-fuchsia-300";
		default:
			return "bg-white/10 text-zinc-200";
	}
}

export function getBranchNameToneClassName(
	branch: Pick<GitBranchListEntry, "ahead" | "behind" | "isCurrent">,
) {
	if (branch.ahead > 0 && branch.behind > 0) {
		return "text-sky-300";
	}

	if (branch.behind > 0) {
		return "text-amber-300";
	}

	if (branch.ahead > 0) {
		return "text-emerald-300";
	}

	return branch.isCurrent ? "text-foreground" : undefined;
}

export function resolveBranchRowActionState({
	branch,
	currentBranch,
	branchPullRequestUrl,
	remotes,
	pendingMutationKey,
}: {
	branch: GitBranchListEntry;
	currentBranch: GitBranchSummary | null;
	branchPullRequestUrl: string | null;
	remotes: GitRemote[];
	pendingMutationKey: string;
}) {
	const isCheckingOut = pendingMutationKey === `branch:checkout:${branch.name}`;
	const isPulling = branch.isCurrent
		? pendingMutationKey === "branch:pull"
		: pendingMutationKey === `branch:update:${branch.name}`;
	const isPushing = branch.isCurrent
		? pendingMutationKey === "branch:push"
		: pendingMutationKey === `branch:push:${branch.name}`;
	const hasUpstream = branch.isCurrent
		? Boolean(currentBranch?.upstream)
		: Boolean(branch.upstream);
	const canPush = branch.isCurrent
		? Boolean(
				currentBranch &&
					!currentBranch.detached &&
					(!currentBranch.upstream || currentBranch.ahead > 0),
			)
		: !branch.upstream
			? remotes.length > 0
			: branch.ahead > 0;
	const pushLabel =
		branch.isCurrent && !currentBranch?.detached && !hasUpstream
			? "Publish Branch"
			: "Push Branch";
	const pushDisabledReason = canPush
		? null
		: branch.isCurrent
			? !currentBranch
				? "Push status is unavailable."
				: currentBranch.detached
					? "Checkout a branch before pushing."
					: currentBranch.upstream
						? currentBranch.behind > 0
							? "This branch is behind its upstream and has nothing to push."
							: "This branch is already in sync with its upstream."
						: "Publish is unavailable for this branch."
			: !branch.upstream
				? "Add a remote before pushing this branch."
				: branch.behind > 0
					? "This branch is behind its upstream. Update it before pushing."
					: "This branch is already in sync with its upstream.";
	const canPull = branch.isCurrent
		? Boolean(
				currentBranch &&
					!currentBranch.detached &&
					currentBranch.upstream &&
					currentBranch.behind > 0,
			)
		: Boolean(branch.upstream && branch.behind > 0 && branch.ahead === 0);
	const pullLabel = branch.isCurrent ? "Pull Branch" : "Update Branch";
	const pullDisabledReason = canPull
		? null
		: branch.isCurrent
			? !currentBranch
				? "Pull status is unavailable."
				: currentBranch.detached
					? "Checkout a branch before pulling."
					: !currentBranch.upstream
						? "Set an upstream branch before pulling."
						: "This branch is already in sync with its upstream."
			: !branch.upstream
				? "Set an upstream branch before updating."
				: branch.behind === 0
					? "This branch is already in sync with its upstream."
					: "This branch has local commits. Update it after checking it out.";

	return {
		canCheckout: !branch.isCurrent,
		canDelete: !branch.isCurrent,
		canPull,
		canPush,
		canCreatePullRequest: Boolean(branchPullRequestUrl),
		hasUpstream,
		isCheckingOut,
		isPulling,
		isPushing,
		pullLabel,
		pullDisabledReason,
		pushDisabledReason,
		pushLabel,
	};
}
