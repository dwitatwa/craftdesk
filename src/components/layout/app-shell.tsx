import type React from "react";
import { useEffect, useState } from "react";
import { GitDiffView } from "#/components/workspace/git-diff-view";
import type { ProjectSummary } from "#/lib/craftdesk";
import type { GitSelectedChange } from "#/lib/git";
import { Sidebar } from "./sidebar";
import {
	Dialog,
	DialogContent,
} from "#/components/ui/dialog";
import {
	Folder,
	LoaderCircle,
	Plus,
	Trash2,
	Search,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { Link } from "@tanstack/react-router";
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
	onAddProject?: () => Promise<unknown> | void;
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
	const [selectedGitChange, setSelectedGitChange] =
		useState<GitSelectedChange | null>(null);
	const [isGitViewActive, setIsGitViewActive] = useState(false);
	const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		setSelectedGitChange(null);
		setIsGitViewActive(false);
	}, [activeProject]);

	const isGitWorkspaceVisible =
		showSidebar && activeProject && !isProjectPickerOpen && isGitViewActive && selectedGitChange;

	const filteredProjects = projects.filter((project) =>
		project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		project.path.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="flex h-screen w-full overflow-hidden bg-background">
			{showSidebar && (
				<Sidebar
					activeProject={activeProject}
					selectedGitChange={selectedGitChange}
					onSelectGitChange={setSelectedGitChange}
					isGitViewActive={isGitViewActive}
					onGitViewToggle={() => setIsGitViewActive(!isGitViewActive)}
					onOpenProjectPicker={() => setIsProjectPickerOpen(true)}
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

			<Dialog open={isProjectPickerOpen} onOpenChange={setIsProjectPickerOpen}>
				<DialogContent hideClose className="max-w-xl p-0 gap-0 overflow-hidden border border-white/5 bg-[#09090B] shadow-2xl">
					{/* Search Header */}
					<div className="relative flex items-center border-b border-white/5 px-4 h-12">
						<Search className="size-4 text-muted-foreground/50 mr-3" />
						<Input
							placeholder="Search workspaces..."
							className="flex-1 h-full bg-transparent border-none focus-visible:ring-0 text-sm p-0 placeholder:text-muted-foreground/30"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							autoFocus
						/>
						<Button
							onClick={() => onAddProject?.()}
							disabled={isAddingProject}
							variant="ghost"
							size="xs"
							className="h-7 gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
						>
							{isAddingProject ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								<Plus className="size-3" />
							)}
							Add New
						</Button>
					</div>

					{/* List Area */}
					<div className="max-h-[380px] overflow-y-auto custom-scrollbar p-1.5">
						<div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/30">
							Recent Workspaces
						</div>
						
						{filteredProjects.length > 0 ? (
							<div className="space-y-[1px]">
								{filteredProjects.map((project) => (
									<ProjectItem
										key={project.id}
										project={project}
										isActive={activeProject?.id === project.id}
										onSelect={() => setIsProjectPickerOpen(false)}
										onDelete={onDeleteProject}
									/>
								))}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<p className="text-xs text-muted-foreground/40 italic">
									{searchQuery ? "No matching workspaces found." : "No workspaces added yet."}
								</p>
							</div>
						)}
					</div>

					{/* Footer / Error */}
					{addProjectError && (
						<div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-[10px] text-destructive font-mono">
							ERROR: {addProjectError}
						</div>
					)}
					<div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
						<div className="text-[9px] text-muted-foreground/40 font-mono uppercase tracking-widest">
							{filteredProjects.length} total projects
						</div>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
								<kbd className="px-1 rounded bg-white/5 border border-white/5">↑↓</kbd>
								<span>Navigate</span>
							</div>
							<div className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
								<kbd className="px-1 rounded bg-white/5 border border-white/5">Enter</kbd>
								<span>Select</span>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ProjectItem({
	project,
	isActive,
	onSelect,
	onDelete,
}: {
	project: ProjectSummary;
	isActive: boolean;
	onSelect: () => void;
	onDelete?: (id: string) => void;
}) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	return (
		<>
			<div
				className={cn(
					"group relative flex items-center h-10 rounded px-2 transition-colors cursor-pointer",
					isActive 
						? "bg-primary/10" 
						: "hover:bg-white/[0.03]"
				)}
			>
				{isActive && (
					<div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r" />
				)}

				<Link
					to="/projects/$projectId"
					params={{ projectId: project.id }}
					onClick={onSelect}
					className="flex-1 flex items-center gap-3 min-w-0 h-full"
				>
					<div className={cn(
						"size-6 rounded flex items-center justify-center shrink-0",
						isActive ? "text-primary" : "text-muted-foreground/40 group-hover:text-foreground/60"
					)}>
						<Folder className="size-3.5" />
					</div>
					
					<div className="flex items-baseline gap-2 min-w-0">
						<span className={cn(
							"text-xs font-semibold truncate",
							isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
						)}>
							{project.name}
						</span>
						<span className="text-[10px] text-muted-foreground/20 font-mono truncate hidden sm:block">
							{project.path}
						</span>
					</div>
				</Link>

				<Button
					variant="ghost"
					size="icon-xs"
					className="opacity-0 group-hover:opacity-100 h-6 w-6 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
					onClick={(e) => {
						e.preventDefault();
						setIsDeleteDialogOpen(true);
					}}
				>
					<Trash2 className="size-3" />
				</Button>
			</div>

			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove "{project.name}" from your workspaces? 
							This will not delete the files on your disk, only the Craftdesk board data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => onDelete?.(project.id)}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete Project
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
