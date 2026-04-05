import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	Activity,
	Bug,
	CheckCircle2,
	ChevronRight,
	Database,
	Folder,
	FolderPlus,
	History,
	LoaderCircle,
	Search,
	Target,
	Trash2,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "#/components/layout/app-shell";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { useAddProject } from "#/components/workspace/use-add-project";
import type { ProjectSummary } from "#/lib/craftdesk";
import { cn } from "#/lib/utils";
import {
	deleteProject,
	getDatabaseSize,
	getGlobalStats,
	listProjects,
} from "#/server/craftdesk";

export const Route = createFileRoute("/")({
	loader: async () => {
		const [projects, dbSize, stats] = await Promise.all([
			listProjects({
				data: { sortBy: "recent" },
			}),
			getDatabaseSize(),
			getGlobalStats(),
		]);

		return {
			projects,
			dbSize,
			stats,
		};
	},
	component: CraftdeskApp,
});

function CraftdeskApp() {
	const { dbSize, projects, stats } = Route.useLoaderData();
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	};

	const { addProject, addProjectError, isAddingProject } = useAddProject({
		onProjectSaved: async () => {
			await router.invalidate();
		},
	});

	const handleDeleteProject = async (projectId: string) => {
		await deleteProject({ data: { projectId } });
		await router.invalidate();
	};

	const filteredProjects = projects.filter(
		(p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.path.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const appVersionLabel = `v${__APP_VERSION__}`;

	return (
		<AppShell
			showSidebar={false}
			projects={projects}
			onAddProject={addProject}
			isAddingProject={isAddingProject}
			addProjectError={addProjectError}
			onDeleteProject={handleDeleteProject}
		>
			<div className="flex-1 overflow-y-auto custom-scrollbar">
				<div className="max-w-7xl mx-auto px-6 py-10 md:px-12 md:py-16 flex flex-col min-h-full space-y-16">
					{/* Header Section */}
					<header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
						<div className="space-y-2">
							<div className="flex items-center gap-3">
								<h1 className="text-3xl font-bold tracking-tight">Craftdesk</h1>
								<span className="text-[10px] font-mono bg-secondary border border-border px-2 py-0.5 rounded text-muted-foreground font-semibold uppercase tracking-wider">
									{appVersionLabel}
								</span>
							</div>
							<p className="text-sm text-muted-foreground max-w-lg">
								A local-first engineering workspace for technical boards,
								integrated terminals, and rapid development runtimes.
							</p>
						</div>
					</header>

					{/* Section 1: Management & System Overview */}
					<section className="space-y-4">
						<h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">
							Management
						</h2>
						<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
							{/* Primary Action: Open Workspace */}
							<button
								type="button"
								className="lg:col-span-7 flex flex-col p-6 h-[200px] rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-accent transition-all group cursor-pointer relative shadow-sm text-left overflow-hidden"
								onClick={addProject}
							>
								<div className="relative z-10 flex flex-col h-full justify-between">
									<div className="size-12 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
										{isAddingProject ? (
											<LoaderCircle className="size-6 animate-spin" />
										) : (
											<FolderPlus className="size-6" />
										)}
									</div>
									<div className="space-y-1">
										<h3 className="text-lg font-bold">Open Workspace</h3>
										<p className="text-sm text-muted-foreground max-w-sm">
											Connect a local directory to your workspace to start
											tracking features, bugs, and development progress.
										</p>
									</div>
								</div>
								<div className="absolute top-0 right-0 p-8 text-muted-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
									<FolderPlus className="size-32 -mr-8 -mt-8 rotate-6" />
								</div>
								{addProjectError && (
									<div className="absolute inset-x-0 bottom-0 p-2 bg-destructive/10 border-t border-destructive/20">
										<p className="text-[10px] font-mono text-destructive truncate">
											ERR: {addProjectError}
										</p>
									</div>
								)}
							</button>

							{/* System Overview Card */}
							<div className="lg:col-span-5 flex flex-col h-[200px] p-6 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
								<div className="flex items-center justify-between mb-6">
									<h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
										System Status
									</h3>
									<div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-secondary border border-border/50 shadow-sm">
										<Database className="size-3 text-muted-foreground/40" />
										<span className="font-mono text-[10px] font-bold text-muted-foreground/70 tracking-tight">
											{formatBytes(dbSize)}
										</span>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-x-12 gap-y-6">
									<div className="flex items-center gap-3">
										<div className="size-9 rounded bg-secondary flex items-center justify-center text-muted-foreground/70 shrink-0">
											<Folder className="size-4.5" />
										</div>
										<div className="flex flex-col">
											<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
												Workspaces
											</span>
											<span className="text-xl font-mono font-bold tabular-nums leading-none">
												{stats.totalProjects || 0}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-3">
										<div className="size-9 rounded bg-secondary flex items-center justify-center text-muted-foreground/70 shrink-0">
											<Target className="size-4.5" />
										</div>
										<div className="flex flex-col">
											<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
												Features
											</span>
											<span className="text-xl font-mono font-bold tabular-nums leading-none">
												{stats.tasksByCategory.feature || 0}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-3">
										<div className="size-9 rounded bg-secondary flex items-center justify-center text-muted-foreground/70 shrink-0">
											<Bug className="size-4.5" />
										</div>
										<div className="flex flex-col">
											<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
												Bugs
											</span>
											<span className="text-xl font-mono font-bold tabular-nums leading-none">
												{stats.tasksByCategory.bug || 0}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-3">
										<div className="size-9 rounded bg-secondary flex items-center justify-center text-muted-foreground/70 shrink-0">
											<Activity className="size-4.5" />
										</div>
										<div className="flex flex-col">
											<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
												Other
											</span>
											<span className="text-xl font-mono font-bold tabular-nums leading-none">
												{stats.tasksByCategory.other || 0}
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>

					{/* Section 2: Recent Workspaces */}
					<section className="space-y-6">
						<div className="flex items-center justify-between border-b border-border pb-4">
							<h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">
								Recent Workspaces
							</h2>
							<div className="relative group w-full md:w-64">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
								<input
									placeholder="Search recent workspaces..."
									className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all placeholder:text-muted-foreground/40"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>
						</div>

						{filteredProjects.length > 0 ? (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
								{filteredProjects.map((project) => (
									<WorkspaceTile
										key={project.id}
										project={project}
										onDelete={handleDeleteProject}
									/>
								))}
							</div>
						) : projects.length > 0 ? (
							<div className="flex flex-col items-center justify-center py-24 text-center px-6 border border-dashed rounded-xl bg-muted/5 border-white/5">
								<Search className="size-8 text-muted-foreground/10 mb-4" />
								<p className="text-xs font-medium text-muted-foreground/40">
									No projects match "{searchQuery}"
								</p>
								<Button
									variant="link"
									onClick={() => setSearchQuery("")}
									className="mt-2 h-auto p-0 text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100"
								>
									Reset Search
								</Button>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-24 text-center px-6 border border-dashed rounded-xl bg-muted/5 border-white/5">
								<History className="size-8 text-muted-foreground/10 mb-4" />
								<p className="text-xs font-medium text-muted-foreground/40">
									Your opened projects will appear here
								</p>
								<p className="text-[10px] text-muted-foreground/20 mt-2 max-w-[200px] leading-relaxed italic">
									Add a workspace using the "Open Workspace" tile above to get
									started.
								</p>
							</div>
						)}
					</section>
				</div>
			</div>
		</AppShell>
	);
}

function WorkspaceTile({
	project,
	onDelete,
}: {
	project: ProjectSummary;
	onDelete: (projectId: string) => Promise<void> | void;
}) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await onDelete(project.id);
			setIsDeleteDialogOpen(false);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<div className="group relative flex flex-col rounded-md border border-border bg-card hover:border-primary/40 transition-colors shadow-sm">
				<Link
					to="/projects/$projectId"
					params={{ projectId: project.id }}
					className="flex flex-col p-4 h-full"
				>
					<div className="flex items-center gap-3 mb-4">
						<div
							className={cn(
								"size-9 rounded flex items-center justify-center shrink-0 border border-border/50 transition-colors",
								project.activeSessions > 0
									? "bg-green-500/10 text-green-500 border-green-500/20"
									: "bg-secondary/50 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
							)}
						>
							<Folder className="size-4.5" />
						</div>
						<div className="min-w-0 flex-1">
							<h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors tracking-tight">
								{project.name}
							</h3>
							<p className="text-[10px] font-mono text-muted-foreground/50 truncate">
								{project.path}
							</p>
						</div>
					</div>

					<div className="mt-auto flex items-center justify-between text-[11px]">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-1.5 text-muted-foreground/70 font-medium">
								<CheckCircle2 className="size-3.5" />
								<span>{project.taskCount} tasks</span>
							</div>
							{project.activeSessions > 0 && (
								<div className="flex items-center gap-1.5 text-green-500 font-bold tracking-tight">
									<div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
									<span className="uppercase text-[9px]">Active</span>
								</div>
							)}
						</div>
						<ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
					</div>
				</Link>

				<button
					type="button"
					className="absolute top-2 right-2 p-1 text-muted-foreground/0 hover:text-destructive hover:bg-destructive/10 rounded transition-all group-hover:text-muted-foreground/20"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setIsDeleteDialogOpen(true);
					}}
					title="Remove Workspace"
				>
					<Trash2 className="size-3.5" />
				</button>
			</div>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove Workspace</AlertDialogTitle>
						<AlertDialogDescription>
							This removes "{project.name}" from your recent list. The files on
							your disk will not be affected.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
							disabled={isDeleting}
						>
							{isDeleting ? "Removing..." : "Remove"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
