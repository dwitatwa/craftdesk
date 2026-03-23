import type {
	GitChange,
	GitDiffMode,
	GitRepositoryOverview,
	GitSelectedChange,
} from "#/lib/git";

export type GitSidebarSectionId = "changes" | "branches" | "remotes" | "stashes";

export function createInitialSectionState(): Record<GitSidebarSectionId, boolean> {
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
	return (
		findMatchingChange(current, overview.unstaged, "unstaged") ??
		findMatchingChange(current, overview.staged, "staged") ??
		null
	);
}

function findMatchingChange(
	current: GitSelectedChange | null,
	changes: GitChange[],
	diffMode: GitDiffMode,
) {
	if (!current) {
		return null;
	}

	const exactMatch = changes.find(
		(change) =>
			change.path === current.path &&
			change.code === current.code &&
			change.originalPath === current.originalPath,
	);

	if (exactMatch) {
		return {
			...exactMatch,
			diffMode,
		};
	}

	const pathMatch = changes.find(
		(change) =>
			change.path === current.path &&
			change.originalPath === current.originalPath,
	);

	if (!pathMatch) {
		return null;
	}

	return {
		...pathMatch,
		diffMode,
	};
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
