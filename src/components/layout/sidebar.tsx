import { Link } from "@tanstack/react-router";
import {
	GitBranch,
	Layers,
	Settings,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import type { GitSelectedChange } from "#/lib/git";
import { cn } from "#/lib/utils";
import type { ActiveProjectContext } from "./app-shell";
import { GitSidebar } from "./git-sidebar";

interface SidebarProps {
	className?: string;
	activeProject?: ActiveProjectContext | null;
	selectedGitChange: GitSelectedChange | null;
	onSelectGitChange: (change: GitSelectedChange | null) => void;
	isGitViewActive: boolean;
	onGitViewToggle: () => void;
	onOpenProjectPicker: () => void;
}

export function Sidebar({
	className,
	activeProject = null,
	selectedGitChange,
	onSelectGitChange,
	isGitViewActive,
	onGitViewToggle,
	onOpenProjectPicker,
}: SidebarProps) {
	return (
		<aside
			className={cn(
				"flex h-screen w-80 flex-col border-r bg-sidebar",
				className,
			)}
		>
			<div className="h-20 border-b px-6 flex items-center justify-between">
				<Link
					to="/"
					className="flex items-center gap-2.5 px-1 py-1 cursor-pointer"
				>
					<div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
						<Layers className="size-4" />
					</div>
					<span className="text-base font-bold tracking-tight">Craftdesk</span>
				</Link>

				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon-xs"
						className={cn(
							"text-muted-foreground transition-colors",
							isGitViewActive ? "text-primary bg-primary/10" : "hover:text-foreground"
						)}
						onClick={onGitViewToggle}
						title={isGitViewActive ? "View Kanban Board" : "View Git Changes"}
						disabled={!activeProject}
					>
						<GitBranch className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						className="text-muted-foreground hover:text-foreground"
						onClick={onOpenProjectPicker}
						title="Manage Workspaces"
					>
						<Settings className="size-4" />
					</Button>
				</div>
			</div>

			<div className="min-h-0 flex-1">
				{activeProject && isGitViewActive ? (
					<GitSidebar
						activeProject={activeProject}
						selectedChange={selectedGitChange}
						onSelectChange={onSelectGitChange}
					/>
				) : activeProject ? (
					<div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
						<p>Project is active. Click the branch icon to manage Git changes.</p>
					</div>
				) : (
					<div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
						<p>No active project. Click the settings icon to open a project.</p>
					</div>
				)}
			</div>
		</aside>
	);
}
