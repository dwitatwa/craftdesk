import { Link } from "@tanstack/react-router";
import { Folder, Layers, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { cn } from "#/lib/utils";

interface SidebarProps {
	className?: string;
	projects: ProjectSummary[];
	onAddProject?: () => void;
	onDeleteProject?: (projectId: string) => Promise<void> | void;
}

export function Sidebar({
	className,
	projects,
	onAddProject,
	onDeleteProject,
}: SidebarProps) {
	return (
		<aside
			className={cn(
				"flex flex-col border-r bg-sidebar h-screen w-64",
				className,
			)}
		>
			{/* App Header */}
			<div className="h-20 flex items-center px-4 border-b">
				<Link to="/" className="flex items-center gap-2.5 px-3 cursor-pointer">
					<div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
						<Layers className="size-4" />
					</div>
					<span className="text-base font-bold tracking-tight">Craftdesk</span>
				</Link>
			</div>

			{/* Project List */}
			<div className="flex-1 overflow-y-auto p-2">
				<div className="px-3 mb-2 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
					<span>Projects</span>
					<button
						type="button"
						className="cursor-pointer rounded-sm p-1 hover:text-foreground"
						onClick={onAddProject}
					>
						<Plus className="size-3" />
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
			</div>
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
