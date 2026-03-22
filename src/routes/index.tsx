import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	ArrowRight,
	FolderPlus,
	History,
	Plus,
	Terminal as TerminalIcon,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "#/components/layout/app-shell";
import { SaveProjectModal } from "#/components/workspace/save-project-modal";
import { listProjects, saveProject } from "#/server/craftdesk";

export const Route = createFileRoute("/")({
	loader: async () => ({
		projects: await listProjects({
			data: { sortBy: "recent" },
		}),
	}),
	component: CraftdeskApp,
});

function CraftdeskApp() {
	const { projects } = Route.useLoaderData();
	const router = useRouter();
	const [isSaveProjectModalOpen, setIsSaveProjectModalOpen] = useState(false);

	const handleSaveProject = async (input: { name: string; path: string }) => {
		const project = await saveProject({ data: input });
		await router.invalidate();
		await router.navigate({
			to: "/projects/$projectId",
			params: { projectId: project.id },
		});
	};

	return (
		<AppShell showSidebar={false}>
			<div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
				<div className="text-center space-y-4 mb-12">
					<div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-mono text-primary">
						<TerminalIcon className="size-3" />
						v1.0.0-alpha
					</div>
					<h1 className="text-5xl font-bold tracking-tight bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
						Craft Your Workspace
					</h1>
					<p className="text-muted-foreground max-w-lg mx-auto">
						A high-density workspace for technical teams. Manage tasks with
						integrated terminal environments and visual pipelines.
					</p>
				</div>

				<div className="grid md:grid-cols-2 gap-6 w-full items-stretch">
					<div className="space-y-4 flex flex-col">
						<h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
							<History className="size-3" />
							Recent Workspaces
						</h2>
						<div className="grid gap-3 flex-1">
							{projects.length > 0 ? (
								projects.map((project) => (
									<RecentWorkspaceCard
										key={project.id}
										name={project.name}
										path={project.path}
										projectId={project.id}
										tasks={project.taskCount}
										activeSessions={project.activeSessions}
									/>
								))
							) : (
								<div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
									Save a local folder to start building your workspace list.
								</div>
							)}
						</div>
					</div>

					<div className="space-y-4 flex flex-col">
						<h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
							<Plus className="size-3" />
							Get Started
						</h2>
						<div className="flex-1">
							<button
								type="button"
								className="flex flex-col items-center justify-center gap-3 w-full h-full rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group text-center cursor-pointer"
								onClick={() => setIsSaveProjectModalOpen(true)}
							>
								<div className="size-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
									<FolderPlus className="size-6 text-muted-foreground group-hover:text-primary" />
								</div>
								<div>
									<div className="font-medium group-hover:text-primary transition-colors">
										Save Local Folder
									</div>
									<p className="text-xs text-muted-foreground">
										Store a local project path in SQLite and jump into its board
									</p>
								</div>
							</button>
						</div>
					</div>
				</div>
			</div>

			<SaveProjectModal
				isOpen={isSaveProjectModalOpen}
				onOpenChange={setIsSaveProjectModalOpen}
				onSubmit={handleSaveProject}
			/>
		</AppShell>
	);
}

function RecentWorkspaceCard({
	name,
	path,
	projectId,
	tasks,
	activeSessions,
}: {
	name: string;
	path: string;
	projectId: string;
	tasks: number;
	activeSessions: number;
}) {
	return (
		<Link
			to="/projects/$projectId"
			params={{ projectId }}
			className="flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left group cursor-pointer"
		>
			<div className="space-y-1">
				<div className="font-medium group-hover:text-primary transition-colors">
					{name}
				</div>
				<div className="text-[10px] font-mono text-muted-foreground">
					{path}
				</div>
			</div>
			<div className="flex items-center gap-4 text-right">
				<div className="space-y-1">
					<div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 justify-end">
						{tasks} tasks
					</div>
					{activeSessions > 0 && (
						<div className="text-[10px] font-mono text-green-500 flex items-center gap-1 justify-end">
							<div className="size-1 rounded-full bg-green-500 animate-pulse" />
							{activeSessions} live
						</div>
					)}
				</div>
				<ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
			</div>
		</Link>
	);
}
