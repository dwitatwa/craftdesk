import { Link } from "@tanstack/react-router";
import {
	Folder,
	GitBranch,
	Layers,
	LoaderCircle,
	Plus,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import type { ProjectSummary } from "#/lib/craftdesk";
import type { GitSelectedChange } from "#/lib/git";
import { cn } from "#/lib/utils";
import type { ActiveProjectContext } from "./app-shell";
import { GitSidebar } from "./git-sidebar";

interface SidebarProps {
	className?: string;
	projects: ProjectSummary[];
	activeProject?: ActiveProjectContext | null;
	activeTab: "projects" | "git";
	onActiveTabChange: (tab: "projects" | "git") => void;
	selectedGitChange: GitSelectedChange | null;
	onSelectGitChange: (change: GitSelectedChange | null) => void;
	onAddProject?: () => Promise<void> | void;
	isAddingProject?: boolean;
	addProjectError?: string;
	onDeleteProject?: (projectId: string) => Promise<void> | void;
}

export function Sidebar({
	className,
	projects,
	activeProject = null,
	activeTab,
	onActiveTabChange,
	selectedGitChange,
	onSelectGitChange,
	onAddProject,
	isAddingProject = false,
	addProjectError = "",
	onDeleteProject,
}: SidebarProps) {
	useEffect(() => {
		if (!activeProject && activeTab === "git") {
			onActiveTabChange("projects");
		}
	}, [activeProject, activeTab, onActiveTabChange]);

	return (
		<aside
			className={cn(
				"flex h-screen w-80 flex-col border-r bg-sidebar",
				className,
			)}
		>
			<div className="h-20 border-b px-6 flex items-center">
				<Link
					to="/"
					className="flex items-center gap-2.5 px-1 py-1 cursor-pointer"
				>
					<div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
						<Layers className="size-4" />
					</div>
					<span className="text-base font-bold tracking-tight">Craftdesk</span>
				</Link>
			</div>

			<div className="px-3.5 py-2.5 border-b border-white/5">
				<div className="grid grid-cols-2 gap-1 rounded-lg border border-white/5 bg-black/10 p-1">
					<button
						type="button"
						className={cn(
							"inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
							activeTab === "projects"
								? "bg-sidebar-accent text-sidebar-accent-foreground"
								: "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
						)}
						onClick={() => onActiveTabChange("projects")}
					>
						<Folder className="size-3.5" />
						Projects
					</button>
					<button
						type="button"
						className={cn(
							"inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
							activeTab === "git"
								? "bg-sidebar-accent text-sidebar-accent-foreground"
								: "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
						)}
						onClick={() => onActiveTabChange("git")}
						disabled={!activeProject}
					>
						<GitBranch className="size-3.5" />
						Git
					</button>
				</div>
			</div>

			{activeTab === "projects" ? (
				<div className="flex-1 overflow-y-auto custom-scrollbar p-2">
					<div className="px-3 mb-2 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
						<span>Projects</span>
						<button
							type="button"
							className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:border-border cursor-pointer"
							onClick={onAddProject}
							disabled={isAddingProject}
							aria-label={isAddingProject ? "Adding project" : "Add project"}
							title={isAddingProject ? "Adding project" : "Add project"}
						>
							{isAddingProject ? (
								<>
									<LoaderCircle className="size-3 animate-spin" />
									<span>Adding...</span>
								</>
							) : (
								<>
									<Plus className="size-3" />
									<span>Add</span>
								</>
							)}
						</button>
					</div>
					{projects.length > 0 ? (
						<nav className="space-y-1">
							{projects.map((project) => (
								<SidebarItem
									key={project.id}
									icon={Folder}
									label={project.name}
									projectId={project.id}
									onDeleteProject={onDeleteProject}
								/>
							))}
						</nav>
					) : (
						<div className="px-3 py-4 text-xs text-muted-foreground">
							No saved projects yet.
						</div>
					)}
					{addProjectError ? (
						<div className="px-3 pb-3 text-xs text-red-500">
							{addProjectError}
						</div>
					) : null}
				</div>
			) : (
				<div className="min-h-0 flex-1">
					<GitSidebar
						activeProject={activeProject}
						selectedChange={selectedGitChange}
						onSelectChange={onSelectGitChange}
					/>
				</div>
			)}
		</aside>
	);
}

function SidebarItem({
	icon: Icon,
	label,
	projectId,
	onDeleteProject,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	projectId: string;
	onDeleteProject?: (projectId: string) => Promise<void> | void;
}) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		if (!onDeleteProject) {
			return;
		}

		setIsDeleting(true);

		try {
			await onDeleteProject(projectId);
			setIsDeleteDialogOpen(false);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<Link
				to="/projects/$projectId"
				params={{ projectId }}
				activeProps={{
					className: "bg-sidebar-accent text-sidebar-accent-foreground",
				}}
				inactiveProps={{
					className:
						"text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
				}}
				className={cn(
					"flex items-center justify-between w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors group cursor-pointer",
				)}
			>
				<div className="flex items-center gap-2.5 min-w-0">
					<Icon
						className={cn("size-4 shrink-0", "group-hover:text-foreground")}
					/>
					<span className="truncate">{label}</span>
				</div>
				<button
					type="button"
					className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setIsDeleteDialogOpen(true);
					}}
				>
					<Trash2 className="size-3" />
				</button>
			</Link>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Saved Project</AlertDialogTitle>
						<AlertDialogDescription>
							This removes "{label}" from Craftdesk and deletes its board data.
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete Project"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
