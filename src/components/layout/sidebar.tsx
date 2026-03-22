import { Link } from "@tanstack/react-router";
import { Folder, Layers, Plus } from "lucide-react";
import type { ProjectSummary } from "#/lib/craftdesk";
import { cn } from "#/lib/utils";

interface SidebarProps {
	className?: string;
	projects: ProjectSummary[];
	onAddProject?: () => void;
}

export function Sidebar({ className, projects, onAddProject }: SidebarProps) {
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
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	projectId: string;
}) {
	return (
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
			<div className="flex items-center gap-2.5">
				<Icon className={cn("size-4", "group-hover:text-foreground")} />
				<span>{label}</span>
			</div>
		</Link>
	);
}
