import { Link } from "@tanstack/react-router";
import { Files, GitBranch, Layers, Settings } from "lucide-react";
import type React from "react";
import { Button } from "#/components/ui/button";
import { FileExplorer } from "#/components/workspace/file-explorer";
import type { ProjectFileSelectionState } from "#/lib/craftdesk";
import type { GitSelectedChange } from "#/lib/git";
import { cn } from "#/lib/utils";
import type { ActiveProjectContext } from "./app-shell";
import { GitSidebar } from "./git-sidebar";

type SidebarView = "explorer" | "git";

interface SidebarProps {
	className?: string;
	activeProject?: ActiveProjectContext | null;
	style?: React.CSSProperties;
	selectedGitChange: GitSelectedChange | null;
	onSelectGitChange: (change: GitSelectedChange | null) => void;
	onGitDiffRefresh?: () => void;
	onBeforeProjectFileOpen: (
		currentRelativePath: string,
		nextRelativePath: string,
	) => Promise<boolean> | boolean;
	activeSidebarView: SidebarView;
	onSidebarViewChange: (view: SidebarView) => void;
	onProjectFileSelectionChange: (selection: ProjectFileSelectionState) => void;
	onOpenProjectPicker: () => void;
}

export function Sidebar({
	className,
	activeProject = null,
	style,
	selectedGitChange,
	onSelectGitChange,
	onGitDiffRefresh,
	onBeforeProjectFileOpen,
	activeSidebarView,
	onSidebarViewChange,
	onProjectFileSelectionChange,
	onOpenProjectPicker,
}: SidebarProps) {
	return (
		<aside
			id="project-sidebar"
			className={cn("flex h-full min-w-0 flex-col bg-sidebar", className)}
			style={style}
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
							activeSidebarView === "explorer"
								? "text-primary bg-primary/10"
								: "hover:text-foreground",
						)}
						onClick={() => onSidebarViewChange("explorer")}
						title="View File Explorer"
						disabled={!activeProject}
					>
						<Files className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						className={cn(
							"text-muted-foreground transition-colors",
							activeSidebarView === "git"
								? "text-primary bg-primary/10"
								: "hover:text-foreground",
						)}
						onClick={() => onSidebarViewChange("git")}
						title="View Git Changes"
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
				{activeProject ? (
					<>
						<div
							className={cn("h-full", activeSidebarView === "git" && "hidden")}
						>
							<FileExplorer
								key={activeProject.id}
								activeProject={activeProject}
								onBeforeFileOpen={onBeforeProjectFileOpen}
								onSelectionChange={onProjectFileSelectionChange}
							/>
						</div>
						<div
							className={cn(
								"h-full",
								activeSidebarView === "explorer" && "hidden",
							)}
						>
							<GitSidebar
								key={activeProject.id}
								activeProject={activeProject}
								selectedChange={selectedGitChange}
								onSelectChange={onSelectGitChange}
								onDiffRefresh={onGitDiffRefresh}
							/>
						</div>
					</>
				) : (
					<div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
						<p>No active project. Click the settings icon to open a project.</p>
					</div>
				)}
			</div>
		</aside>
	);
}
