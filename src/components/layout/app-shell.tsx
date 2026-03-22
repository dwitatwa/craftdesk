import type React from "react";
import { useEffect, useState } from "react";
import { GitDiffView } from "#/components/workspace/git-diff-view";
import type { ProjectSummary } from "#/lib/craftdesk";
import type { GitSelectedChange } from "#/lib/git";
import { Sidebar } from "./sidebar";

export interface ActiveProjectContext {
	id: string;
	name: string;
	path: string;
}

interface AppShellProps {
	children: React.ReactNode;
	showSidebar?: boolean;
	projects?: ProjectSummary[];
	activeProject?: ActiveProjectContext | null;
	onAddProject?: () => Promise<void> | void;
	isAddingProject?: boolean;
	addProjectError?: string;
	onDeleteProject?: (projectId: string) => Promise<void> | void;
}

export function AppShell({
	children,
	showSidebar = true,
	projects = [],
	activeProject = null,
	onAddProject,
	isAddingProject = false,
	addProjectError = "",
	onDeleteProject,
}: AppShellProps) {
	const [activeSidebarTab, setActiveSidebarTab] = useState<"projects" | "git">(
		"projects",
	);
	const [selectedGitChange, setSelectedGitChange] =
		useState<GitSelectedChange | null>(null);

	useEffect(() => {
		setSelectedGitChange(null);
		if (!activeProject && activeSidebarTab === "git") {
			setActiveSidebarTab("projects");
		}
	}, [activeProject, activeSidebarTab]);

	const isGitWorkspaceVisible =
		showSidebar && activeProject && activeSidebarTab === "git";

	return (
		<div className="flex h-screen w-full overflow-hidden bg-background">
			{showSidebar && (
				<Sidebar
					projects={projects}
					activeProject={activeProject}
					activeTab={activeSidebarTab}
					onActiveTabChange={setActiveSidebarTab}
					selectedGitChange={selectedGitChange}
					onSelectGitChange={setSelectedGitChange}
					onAddProject={onAddProject}
					isAddingProject={isAddingProject}
					addProjectError={addProjectError}
					onDeleteProject={onDeleteProject}
				/>
			)}
			<div className="flex flex-1 flex-col overflow-hidden">
				<main className="flex-1 overflow-auto bg-background/50 relative">
					{/* Dot Grid Overlay */}
					<div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#1A1A1A_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
					<div className="relative h-full flex flex-col">
						{isGitWorkspaceVisible ? (
							<GitDiffView
								activeProject={activeProject}
								selectedChange={selectedGitChange}
							/>
						) : (
							children
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
