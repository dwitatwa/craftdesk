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

export interface GitBranchCommitPreviewInput {
	cwd: string;
	branchName: string;
	maxCount?: number;
}

export interface GitRepositoryChangeWaitInput {
	cwd: string;
	afterVersion: number;
	timeoutMs?: number;
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
	paths?: string[];
	action:
		| "stage"
		| "stage-selected"
		| "unstage"
		| "unstage-selected"
		| "discard"
		| "discard-selected"
		| "stage-all"
		| "unstage-all"
		| "commit"
		| "commit-push";
	commitMessage?: string;
}

export interface GitBranchMutationInput {
	cwd: string;
	action:
		| "create-local"
		| "checkout-local"
		| "checkout-remote"
		| "delete-local"
		| "merge-into-current"
		| "pull-current"
		| "push-branch"
		| "push-current";
	branchName?: string;
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
	upstream: string | null;
	ahead: number;
	behind: number;
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
	branches: GitRemoteBranch[];
}

export interface GitRemoteBranch {
	name: string;
	refName: string;
	lastCommitRelativeDate: string;
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
	changeVersion: number;
	branch: GitBranchSummary;
	branches: GitBranchListEntry[];
	staged: GitChange[];
	unstaged: GitChange[];
	remotes: GitRemote[];
	stashes: GitStashEntry[];
}

export interface GitRepositoryChangeWaitResult {
	repoRoot: string;
	version: number;
	changed: boolean;
}

export interface GitDiffResult {
	path: string;
	diffMode: GitDiffMode;
	content: string;
	originalContent: string;
	modifiedContent: string;
	hasTextChanges: boolean;
	isBinary: boolean;
	isEmpty: boolean;
}
