export type GitChangeKind =
	| "modified"
	| "added"
	| "deleted"
	| "renamed"
	| "copied"
	| "untracked"
	| "unmerged"
	| "typechange"
	| "unknown";

export type GitDiffMode = "staged" | "unstaged";

export interface GitRepositoryOverviewInput {
	cwd: string;
}

export interface GitDiffInput {
	cwd: string;
	path: string;
	originalPath?: string | null;
	diffMode: GitDiffMode;
	code: string;
}

export interface GitChangeMutationInput {
	cwd: string;
	path: string;
	action: "stage" | "unstage" | "discard" | "stage-all" | "unstage-all" | "commit" | "commit-push";
	commitMessage?: string;
}

export interface GitChange {
	path: string;
	originalPath: string | null;
	code: string;
	kind: GitChangeKind;
	label: string;
}

export interface GitSelectedChange extends GitChange {
	diffMode: GitDiffMode;
}

export interface GitBranchSummary {
	name: string;
	upstream: string | null;
	ahead: number;
	behind: number;
	detached: boolean;
}

export interface GitBranchListEntry {
	name: string;
	lastCommitRelativeDate: string;
	shortSha: string;
	isCurrent: boolean;
}

export interface GitCommitPreview {
	sha: string;
	shortSha: string;
	summary: string;
	relativeDate: string;
	author: string;
}

export interface GitRemote {
	name: string;
	fetchUrl: string | null;
	pushUrl: string | null;
}

export interface GitStashEntry {
	name: string;
	message: string;
	relativeDate: string;
	commitSha: string;
}

export interface GitRepositoryOverview {
	repoRoot: string;
	repoName: string;
	branch: GitBranchSummary;
	branches: GitBranchListEntry[];
	commits: GitCommitPreview[];
	staged: GitChange[];
	unstaged: GitChange[];
	remotes: GitRemote[];
	stashes: GitStashEntry[];
}

export interface GitDiffResult {
	path: string;
	diffMode: GitDiffMode;
	content: string;
	isBinary: boolean;
	isEmpty: boolean;
}
