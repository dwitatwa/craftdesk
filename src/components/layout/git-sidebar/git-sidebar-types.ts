import type { GitChange, GitDiffMode, GitSelectedChange } from "#/lib/git";

export interface ActiveProjectContext {
	id: string;
	name: string;
	path: string;
}

export interface GitSidebarProps {
	activeProject: ActiveProjectContext | null;
	onOpenProjectFile: (relativePath: string) => Promise<void> | void;
	selectedChange: GitSelectedChange | null;
	onSelectChange: (change: GitSelectedChange | null) => void;
	onDiffRefresh?: () => void;
}

export interface GitSidebarDiscardTarget {
	changes: GitChange[];
	source: "single" | "selection";
}

export type GitBulkSelectionMode = GitDiffMode | null;
