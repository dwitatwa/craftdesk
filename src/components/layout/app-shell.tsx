import type React from "react";
import type { ProjectSummary } from "#/lib/craftdesk";
import { Sidebar } from "./sidebar";

interface AppShellProps {
	children: React.ReactNode;
	showSidebar?: boolean;
	projects?: ProjectSummary[];
	onAddProject?: () => void;
	onDeleteProject?: (projectId: string) => Promise<void> | void;
}

export function AppShell({
	children,
	showSidebar = true,
	projects = [],
	onAddProject,
	onDeleteProject,
}: AppShellProps) {
	return (
		<div className="flex h-screen w-full overflow-hidden bg-background">
			{showSidebar && (
				<Sidebar
					projects={projects}
					onAddProject={onAddProject}
					onDeleteProject={onDeleteProject}
				/>
			)}
			<div className="flex flex-1 flex-col overflow-hidden">
				<main className="flex-1 overflow-auto bg-background/50 relative">
					{/* Dot Grid Overlay */}
					<div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#1A1A1A_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
					<div className="relative h-full flex flex-col">{children}</div>
				</main>
			</div>
		</div>
	);
}
