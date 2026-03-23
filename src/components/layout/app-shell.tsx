import { Link } from "@tanstack/react-router";
import { Folder, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Dialog, DialogContent } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { FilePreviewView } from "#/components/workspace/file-preview-view";
import { GitDiffView } from "#/components/workspace/git-diff-view";
import type {
	ProjectFileSelectionState,
	ProjectSummary,
	TextProjectFileContent,
} from "#/lib/craftdesk";
import type { GitSelectedChange } from "#/lib/git";
import { cn } from "#/lib/utils";
import { Sidebar } from "./sidebar";

export interface ActiveProjectContext {
	id: string;
	name: string;
	path: string;
}

type WorkspacePane = "project" | "file" | "git";
type SidebarView = "explorer" | "git";

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 260;
const MIN_WORKSPACE_CONTENT_WIDTH = 560;

function createEmptyProjectFileSelection(): ProjectFileSelectionState {
	return {
		file: null,
		relativePath: "",
		isLoading: false,
		error: "",
	};
}

function hasProjectFileSelection(selection: ProjectFileSelectionState) {
	return !!selection.relativePath || selection.isLoading || !!selection.error;
}

function isCloseWorkspacePaneShortcut(event: KeyboardEvent) {
	return (
		(!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.shiftKey &&
			event.key === "Escape") ||
		(!event.metaKey &&
			!event.ctrlKey &&
			event.altKey &&
			!event.shiftKey &&
			event.key.toLowerCase() === "w")
	);
}

interface AppShellProps {
	children: React.ReactNode;
	showSidebar?: boolean;
	projects?: ProjectSummary[];
	activeProject?: ActiveProjectContext | null;
	onAddProject?: () => unknown;
	isAddingProject?: boolean;
	addProjectError?: string;
	onDeleteProject?: (projectId: string) => unknown;
}

export function AppShell({
	activeProject = null,
	addProjectError = "",
	children,
	isAddingProject = false,
	onAddProject,
	onDeleteProject,
	projects = [],
	showSidebar = true,
}: AppShellProps) {
	const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	const filteredProjects = projects.filter(
		(project) =>
			project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			project.path.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="flex h-screen w-full overflow-hidden bg-background">
			<ProjectWorkspaceShell
				key={activeProject?.id ?? "no-project"}
				activeProject={activeProject}
				isProjectPickerOpen={isProjectPickerOpen}
				onOpenProjectPicker={() => setIsProjectPickerOpen(true)}
				showSidebar={showSidebar}
			>
				{children}
			</ProjectWorkspaceShell>

			<Dialog open={isProjectPickerOpen} onOpenChange={setIsProjectPickerOpen}>
				<DialogContent
					hideClose
					className="max-w-xl gap-0 overflow-hidden border border-white/10 bg-card/95 p-0 shadow-[0_28px_90px_rgba(0,0,0,0.58)] ring-1 ring-white/8 backdrop-blur-sm"
				>
					{/* Search Header */}
					<div className="relative flex h-12 items-center border-b border-white/8 bg-white/[0.03] px-4">
						<Search className="size-4 text-muted-foreground/50 mr-3" />
						<Input
							placeholder="Search workspaces..."
							className="h-full flex-1 border-none bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground/45"
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
						<div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/45">
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
								<p className="text-xs italic text-muted-foreground/55">
									{searchQuery
										? "No matching workspaces found."
										: "No workspaces added yet."}
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
					<div className="flex items-center justify-between border-t border-white/8 bg-white/[0.04] px-4 py-2">
						<div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">
							{filteredProjects.length} total projects
						</div>
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
								<kbd className="rounded border border-white/10 bg-white/[0.07] px-1">
									↑↓
								</kbd>
								<span>Navigate</span>
							</div>
							<div className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
								<kbd className="rounded border border-white/10 bg-white/[0.07] px-1">
									Enter
								</kbd>
								<span>Select</span>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ProjectWorkspaceShell({
	activeProject,
	children,
	isProjectPickerOpen,
	onOpenProjectPicker,
	showSidebar,
}: {
	activeProject: ActiveProjectContext | null;
	children: React.ReactNode;
	isProjectPickerOpen: boolean;
	onOpenProjectPicker: () => void;
	showSidebar: boolean;
}) {
	const [selectedGitChange, setSelectedGitChange] =
		useState<GitSelectedChange | null>(null);
	const [gitRefreshVersion, setGitRefreshVersion] = useState(0);
	const [activeSidebarView, setActiveSidebarView] =
		useState<SidebarView>("explorer");
	const [selectedProjectFile, setSelectedProjectFile] =
		useState<ProjectFileSelectionState>(createEmptyProjectFileSelection);
	const [isProjectFileDirty, setIsProjectFileDirty] = useState(false);
	const [activeWorkspacePane, setActiveWorkspacePane] =
		useState<WorkspacePane>("project");
	const splitContainerRef = useRef<HTMLDivElement | null>(null);
	const sidebarResizeStateRef = useRef<{
		containerLeft: number;
		containerWidth: number;
	} | null>(null);
	const selectedGitChangeRef = useRef(selectedGitChange);
	const selectedProjectFileRef = useRef(selectedProjectFile);
	const isProjectFileDirtyRef = useRef(isProjectFileDirty);
	const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
	const [isResizingSidebar, setIsResizingSidebar] = useState(false);
	selectedGitChangeRef.current = selectedGitChange;
	selectedProjectFileRef.current = selectedProjectFile;
	isProjectFileDirtyRef.current = isProjectFileDirty;

	useEffect(() => {
		if (!showSidebar) {
			setSidebarWidth(null);
			return;
		}

		const container = splitContainerRef.current;

		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		const syncWidth = (containerWidth: number) => {
			setSidebarWidth((currentWidth) =>
				clampSidebarWidth(
					currentWidth ?? DEFAULT_SIDEBAR_WIDTH,
					containerWidth,
				),
			);
		};

		syncWidth(container.getBoundingClientRect().width);

		const resizeObserver = new ResizeObserver(([entry]) => {
			syncWidth(entry.contentRect.width);
		});

		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, [showSidebar]);

	useEffect(() => {
		if (!isResizingSidebar) {
			return;
		}

		const handlePointerMove = (event: PointerEvent) => {
			const resizeState = sidebarResizeStateRef.current;

			if (!resizeState) {
				return;
			}

			setSidebarWidth(
				clampSidebarWidth(
					event.clientX - resizeState.containerLeft,
					resizeState.containerWidth,
				),
			);
		};

		const stopResizing = () => {
			sidebarResizeStateRef.current = null;
			setIsResizingSidebar(false);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", stopResizing);
		window.addEventListener("pointercancel", stopResizing);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", stopResizing);
			window.removeEventListener("pointercancel", stopResizing);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, [isResizingSidebar]);

	const confirmDiscardProjectFileChanges = useCallback(() => {
		if (!isProjectFileDirtyRef.current) {
			return true;
		}

		const currentRelativePath =
			selectedProjectFileRef.current.relativePath || "this file";
		const shouldDiscard = window.confirm(
			`Discard unsaved changes to ${currentRelativePath}?`,
		);

		if (shouldDiscard) {
			setIsProjectFileDirty(false);
		}

		return shouldDiscard;
	}, []);

	const handleGitChangeSelection = useCallback(
		(change: GitSelectedChange | null) => {
			if (change && !confirmDiscardProjectFileChanges()) {
				return;
			}

			setSelectedGitChange(change);
			setActiveWorkspacePane((currentPane) => {
				if (change) {
					return "git";
				}

				if (currentPane !== "git") {
					return currentPane;
				}

				return hasProjectFileSelection(selectedProjectFileRef.current)
					? "file"
					: "project";
			});
		},
		[confirmDiscardProjectFileChanges],
	);

	const handleProjectFileSelectionChange = useCallback(
		(selection: ProjectFileSelectionState) => {
			setSelectedProjectFile(selection);
			setActiveWorkspacePane((currentPane) => {
				if (hasProjectFileSelection(selection)) {
					return "file";
				}

				if (currentPane !== "file") {
					return currentPane;
				}

				return selectedGitChangeRef.current ? "git" : "project";
			});
		},
		[],
	);

	const handleCloseGitDiff = useCallback(() => {
		setSelectedGitChange(null);
		setActiveWorkspacePane(
			hasProjectFileSelection(selectedProjectFileRef.current)
				? "file"
				: "project",
		);
	}, []);

	const handleCloseProjectFile = useCallback(() => {
		if (!confirmDiscardProjectFileChanges()) {
			return;
		}

		setSelectedProjectFile(createEmptyProjectFileSelection());
		setActiveWorkspacePane(selectedGitChangeRef.current ? "git" : "project");
		setIsProjectFileDirty(false);
	}, [confirmDiscardProjectFileChanges]);

	const handleBeforeProjectFileOpen = useCallback(
		(currentRelativePath: string, _nextRelativePath: string) => {
			if (!isProjectFileDirtyRef.current || !currentRelativePath) {
				return true;
			}

			return confirmDiscardProjectFileChanges();
		},
		[confirmDiscardProjectFileChanges],
	);

	const handleProjectFileDirtyChange = useCallback((isDirty: boolean) => {
		setIsProjectFileDirty(isDirty);
	}, []);

	const handleProjectFileSaved = useCallback((file: TextProjectFileContent) => {
		setSelectedProjectFile((currentSelection) => ({
			...currentSelection,
			error: "",
			file,
			isLoading: false,
			relativePath: file.relativePath,
		}));
		setIsProjectFileDirty(false);
	}, []);

	useEffect(() => {
		const handlePaneCloseShortcut = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				!showSidebar ||
				isProjectPickerOpen ||
				!isCloseWorkspacePaneShortcut(event)
			) {
				return;
			}

			if (activeWorkspacePane === "git" && selectedGitChangeRef.current) {
				event.preventDefault();
				handleCloseGitDiff();
				return;
			}

			if (
				activeWorkspacePane === "file" &&
				hasProjectFileSelection(selectedProjectFileRef.current)
			) {
				event.preventDefault();
				handleCloseProjectFile();
			}
		};

		window.addEventListener("keydown", handlePaneCloseShortcut);

		return () => {
			window.removeEventListener("keydown", handlePaneCloseShortcut);
		};
	}, [
		activeWorkspacePane,
		handleCloseGitDiff,
		handleCloseProjectFile,
		isProjectPickerOpen,
		showSidebar,
	]);

	const handleSidebarResizeStart = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (event.button !== 0 || !showSidebar) {
				return;
			}

			const container = splitContainerRef.current;

			if (!container) {
				return;
			}

			const rect = container.getBoundingClientRect();

			sidebarResizeStateRef.current = {
				containerLeft: rect.left,
				containerWidth: rect.width,
			};

			setSidebarWidth((currentWidth) =>
				clampSidebarWidth(currentWidth ?? DEFAULT_SIDEBAR_WIDTH, rect.width),
			);
			setIsResizingSidebar(true);
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			event.currentTarget.setPointerCapture(event.pointerId);
			event.preventDefault();
		},
		[showSidebar],
	);

	const handleSidebarResizeDoubleClick = useCallback(() => {
		const container = splitContainerRef.current;

		if (!container || !showSidebar) {
			return;
		}

		setSidebarWidth(
			clampSidebarWidth(
				DEFAULT_SIDEBAR_WIDTH,
				container.getBoundingClientRect().width,
			),
		);
	}, [showSidebar]);

	const handleSidebarResizeKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>) => {
			const container = splitContainerRef.current;

			if (!container || !showSidebar) {
				return;
			}

			const containerWidth = container.getBoundingClientRect().width;
			const step = event.shiftKey ? 48 : 24;
			const currentWidth = clampSidebarWidth(
				sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
				containerWidth,
			);

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				setSidebarWidth(clampSidebarWidth(currentWidth - step, containerWidth));
			}

			if (event.key === "ArrowRight") {
				event.preventDefault();
				setSidebarWidth(clampSidebarWidth(currentWidth + step, containerWidth));
			}
		},
		[showSidebar, sidebarWidth],
	);

	const isGitWorkspaceVisible =
		showSidebar &&
		activeProject &&
		!isProjectPickerOpen &&
		activeWorkspacePane === "git" &&
		!!selectedGitChange;
	const isProjectFileVisible =
		showSidebar &&
		activeProject &&
		!isProjectPickerOpen &&
		activeWorkspacePane === "file" &&
		hasProjectFileSelection(selectedProjectFile);
	const resolvedSidebarWidth = sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;

	return (
		<div
			ref={splitContainerRef}
			className="flex min-w-0 flex-1 overflow-hidden"
		>
			{showSidebar && (
				<div
					className="relative shrink-0"
					style={{ width: resolvedSidebarWidth }}
				>
					<Sidebar
						activeProject={activeProject}
						className="h-full"
						style={{ width: "100%" }}
						onBeforeProjectFileOpen={handleBeforeProjectFileOpen}
						selectedGitChange={selectedGitChange}
						onSelectGitChange={handleGitChangeSelection}
						onGitOverviewRefresh={() =>
							setGitRefreshVersion((currentVersion) => currentVersion + 1)
						}
						activeSidebarView={activeSidebarView}
						onSidebarViewChange={setActiveSidebarView}
						onProjectFileSelectionChange={handleProjectFileSelectionChange}
						onOpenProjectPicker={onOpenProjectPicker}
					/>
					<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px translate-x-1/2 bg-border/80" />
					<button
						type="button"
						className="absolute inset-y-0 right-0 z-20 w-3 translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						onPointerDown={handleSidebarResizeStart}
						onDoubleClick={handleSidebarResizeDoubleClick}
						onKeyDown={handleSidebarResizeKeyDown}
						aria-controls="project-sidebar project-workspace"
						aria-label="Resize workspace sidebar"
						tabIndex={0}
					/>
				</div>
			)}
			<div
				id="project-workspace"
				className="flex min-w-0 flex-1 flex-col overflow-hidden"
			>
				<main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background/50">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1A1A1A_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
					<div className="relative flex h-full min-h-0 flex-col">
						{isGitWorkspaceVisible ? (
							<GitDiffView
								activeProject={activeProject}
								onClose={handleCloseGitDiff}
								refreshVersion={gitRefreshVersion}
								selectedChange={selectedGitChange}
							/>
						) : isProjectFileVisible ? (
							<FilePreviewView
								activeProject={activeProject}
								onClose={handleCloseProjectFile}
								onDirtyChange={handleProjectFileDirtyChange}
								selection={selectedProjectFile}
								onTextFileSaved={handleProjectFileSaved}
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

function clampSidebarWidth(width: number, containerWidth: number) {
	const maxWidth = Math.max(
		MIN_SIDEBAR_WIDTH,
		containerWidth - MIN_WORKSPACE_CONTENT_WIDTH,
	);

	return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), maxWidth);
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
					isActive ? "bg-primary/10" : "hover:bg-white/[0.03]",
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
					<div
						className={cn(
							"size-6 rounded flex items-center justify-center shrink-0",
							isActive
								? "text-primary"
								: "text-muted-foreground/40 group-hover:text-foreground/60",
						)}
					>
						<Folder className="size-3.5" />
					</div>

					<div className="flex items-baseline gap-2 min-w-0">
						<span
							className={cn(
								"text-xs font-semibold truncate",
								isActive
									? "text-foreground"
									: "text-muted-foreground group-hover:text-foreground",
							)}
						>
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

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove "{project.name}" from your
							workspaces? This will not delete the files on your disk, only the
							Craftdesk board data.
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
