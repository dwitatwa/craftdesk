import type { GitSelectedChange } from "#/lib/git";

export interface ActiveProjectContext {
	id: string;
	name: string;
	path: string;
}

export interface GitSidebarProps {
	activeProject: ActiveProjectContext | null;
	selectedChange: GitSelectedChange | null;
	onSelectChange: (change: GitSelectedChange | null) => void;
	onOverviewRefresh?: () => void;
}
