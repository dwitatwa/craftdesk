import {
	ChevronRight,
	FilePlus2,
	FileText,
	Folder,
	FolderOpen,
	ImageIcon,
	LoaderCircle,
	NotebookText,
	RefreshCcw,
	Search,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import type {
	ProjectFileContent,
	ProjectFileEntry,
	ProjectFileSearchResult,
	ProjectFileSelectionState,
} from "#/lib/craftdesk";
import { getProjectFileExtension, isMarkdownFilePath } from "#/lib/craftdesk";
import { cn } from "#/lib/utils";
import {
	createProjectFile,
	deleteProjectFile,
	listProjectDirectory,
	readProjectFile,
	searchProjectFiles,
} from "#/server/craftdesk";
import type { ActiveProjectContext } from "../layout/app-shell";

interface FileExplorerProps {
	activeProject: ActiveProjectContext;
	onBeforeFileOpen?: (
		currentRelativePath: string,
		nextRelativePath: string,
	) => Promise<boolean> | boolean;
	onSelectionChange: (selection: ProjectFileSelectionState) => void;
}

interface DirectoryState {
	entries: ProjectFileEntry[];
	error: string;
	isLoading: boolean;
	isLoaded: boolean;
}

interface ImportedProjectFile {
	base64Content: string;
	name: string;
	relativePath: string;
}

const ROOT_PATH = "";
const CLIPBOARD_FILE_FALLBACK_PREFIX = "pasted-file";
const IMAGE_FILE_EXTENSIONS_BY_MIME = new Map([
	["image/apng", "apng"],
	["image/avif", "avif"],
	["image/bmp", "bmp"],
	["image/gif", "gif"],
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
]);
const IMAGE_FILE_EXTENSIONS = new Set([
	...IMAGE_FILE_EXTENSIONS_BY_MIME.values(),
	"ico",
	"jpeg",
	"jpg",
	"svg",
]);

function createDirectoryState(): DirectoryState {
	return {
		entries: [],
		error: "",
		isLoading: false,
		isLoaded: false,
	};
}

function normalizeRelativePath(value: string) {
	return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function getParentDirectory(relativePath: string) {
	const normalizedPath = normalizeRelativePath(relativePath);
	const lastSlashIndex = normalizedPath.lastIndexOf("/");

	return lastSlashIndex === -1
		? ROOT_PATH
		: normalizedPath.slice(0, lastSlashIndex);
}

function getDirectoryChain(relativePath: string) {
	const normalizedPath = normalizeRelativePath(relativePath);

	if (!normalizedPath) {
		return [ROOT_PATH];
	}

	const segments = normalizedPath.split("/");
	const chain = [ROOT_PATH];

	for (let index = 0; index < segments.length - 1; index += 1) {
		chain.push(segments.slice(0, index + 1).join("/"));
	}

	return chain;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
	return error instanceof Error ? error.message : fallbackMessage;
}

async function readImportedFile(file: File) {
	const arrayBuffer = await file.arrayBuffer();
	const relativePath = getImportedFilePath(file);

	return {
		base64Content: arrayBufferToBase64(arrayBuffer),
		name: relativePath.split("/").pop() ?? relativePath,
		relativePath,
	};
}

function getImportedFilePath(file: File) {
	const preferredPath =
		"webkitRelativePath" in file && typeof file.webkitRelativePath === "string"
			? file.webkitRelativePath
			: file.name;
	const normalizedPath = normalizeRelativePath(preferredPath);

	if (normalizedPath) {
		return normalizedPath;
	}

	return createClipboardFallbackFileName(file.type);
}

function createClipboardFallbackFileName(mimeType: string) {
	const fileExtension = IMAGE_FILE_EXTENSIONS_BY_MIME.get(mimeType);
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

	return fileExtension
		? `${CLIPBOARD_FILE_FALLBACK_PREFIX}-${timestamp}.${fileExtension}`
		: `${CLIPBOARD_FILE_FALLBACK_PREFIX}-${timestamp}`;
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
	const bytes = new Uint8Array(arrayBuffer);
	const chunkSize = 0x8000;
	let binary = "";

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}

	return btoa(binary);
}

function isImageFilePath(relativePath: string) {
	return IMAGE_FILE_EXTENSIONS.has(getProjectFileExtension(relativePath));
}

export function FileExplorer({
	activeProject,
	onBeforeFileOpen,
	onSelectionChange,
}: FileExplorerProps) {
	const projectId = activeProject.id;
	const activeProjectIdRef = useRef(projectId);
	const contextMenuRef = useRef<HTMLDivElement | null>(null);
	const searchRequestIdRef = useRef(0);
	activeProjectIdRef.current = projectId;
	const [directories, setDirectories] = useState<
		Record<string, DirectoryState>
	>(() => ({
		[ROOT_PATH]: {
			...createDirectoryState(),
			isLoading: true,
		},
	}));
	const [expandedDirectories, setExpandedDirectories] = useState<
		Record<string, boolean>
	>(() => ({
		[ROOT_PATH]: true,
	}));
	const [selectedFilePath, setSelectedFilePath] = useState("");
	const [selectedFile, setSelectedFile] = useState<ProjectFileContent | null>(
		null,
	);
	const [deleteTarget, setDeleteTarget] = useState<{
		name: string;
		relativePath: string;
	} | null>(null);
	const [importedFile, setImportedFile] = useState<ImportedProjectFile | null>(
		null,
	);
	const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
	const [newFilePath, setNewFilePath] = useState("");
	const [createError, setCreateError] = useState("");
	const [isCreatingFile, setIsCreatingFile] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeletingFile, setIsDeletingFile] = useState(false);
	const [isImportingFile, setIsImportingFile] = useState(false);
	const [isDragTargetActive, setIsDragTargetActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<ProjectFileSearchResult[]>(
		[],
	);
	const [searchError, setSearchError] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [contextMenuState, setContextMenuState] = useState<
		| {
				kind: "explorer";
				x: number;
				y: number;
		  }
		| {
				kind: "file";
				x: number;
				y: number;
				file: {
					name: string;
					relativePath: string;
				};
		  }
		| null
	>(null);
	const trimmedSearchQuery = searchQuery.trim();
	const isSearchMode = trimmedSearchQuery.length > 0;
	const isSearchPending =
		isSearchMode && trimmedSearchQuery !== debouncedSearchQuery;

	useEffect(() => {
		if (!contextMenuState) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (contextMenuRef.current?.contains(event.target as Node)) {
				return;
			}

			setContextMenuState(null);
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				setContextMenuState(null);
			}
		};

		const handleViewportChange = () => {
			setContextMenuState(null);
		};

		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleEscape, true);
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, true);

		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleEscape, true);
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange, true);
		};
	}, [contextMenuState]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setDebouncedSearchQuery(searchQuery.trim());
		}, 200);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [searchQuery]);

	const runSearch = useEffectEvent(async (query: string) => {
		const trimmedQuery = query.trim();
		const requestId = searchRequestIdRef.current + 1;
		searchRequestIdRef.current = requestId;

		if (!trimmedQuery) {
			setSearchResults([]);
			setSearchError("");
			setIsSearching(false);
			return;
		}

		setIsSearching(true);
		setSearchError("");

		try {
			const results = await searchProjectFiles({
				data: {
					projectId,
					query: trimmedQuery,
				},
			});

			if (
				projectId !== activeProjectIdRef.current ||
				requestId !== searchRequestIdRef.current
			) {
				return;
			}

			setSearchResults(results);
			setSearchError("");
		} catch (error) {
			if (
				projectId !== activeProjectIdRef.current ||
				requestId !== searchRequestIdRef.current
			) {
				return;
			}

			setSearchResults([]);
			setSearchError(getErrorMessage(error, "Failed to search files."));
		} finally {
			if (
				projectId === activeProjectIdRef.current &&
				requestId === searchRequestIdRef.current
			) {
				setIsSearching(false);
			}
		}
	});

	const loadDirectory = async (relativePath: string, force = false) => {
		const normalizedPath = normalizeRelativePath(relativePath);
		const existingState = directories[normalizedPath];

		if (existingState?.isLoading || (existingState?.isLoaded && !force)) {
			return;
		}

		setDirectories((currentDirectories) => ({
			...currentDirectories,
			[normalizedPath]: {
				...(currentDirectories[normalizedPath] ?? createDirectoryState()),
				error: "",
				isLoading: true,
			},
		}));

		try {
			const entries = await listProjectDirectory({
				data: {
					projectId,
					relativePath: normalizedPath,
				},
			});

			if (projectId !== activeProjectIdRef.current) {
				return;
			}

			setDirectories((currentDirectories) => ({
				...currentDirectories,
				[normalizedPath]: {
					entries,
					error: "",
					isLoading: false,
					isLoaded: true,
				},
			}));
		} catch (error) {
			if (projectId !== activeProjectIdRef.current) {
				return;
			}

			setDirectories((currentDirectories) => ({
				...currentDirectories,
				[normalizedPath]: {
					...(currentDirectories[normalizedPath] ?? createDirectoryState()),
					error: getErrorMessage(error, "Failed to load directory."),
					isLoading: false,
					isLoaded: true,
				},
			}));
		}
	};

	const loadFile = async (relativePath: string) => {
		const normalizedPath = normalizeRelativePath(relativePath);

		if (onBeforeFileOpen) {
			const shouldContinue = await onBeforeFileOpen(
				selectedFilePath,
				normalizedPath,
			);

			if (!shouldContinue) {
				return;
			}
		}

		setSelectedFilePath(normalizedPath);
		setSelectedFile(null);
		onSelectionChange({
			file: null,
			relativePath: normalizedPath,
			isLoading: true,
			error: "",
		});

		try {
			const file = await readProjectFile({
				data: {
					projectId,
					relativePath: normalizedPath,
				},
			});

			if (projectId !== activeProjectIdRef.current) {
				return;
			}

			setSelectedFile(file);
			onSelectionChange({
				file,
				relativePath: normalizedPath,
				isLoading: false,
				error: "",
			});
		} catch (error) {
			if (projectId !== activeProjectIdRef.current) {
				return;
			}

			const nextError = getErrorMessage(error, "Failed to open file.");
			onSelectionChange({
				file: null,
				relativePath: normalizedPath,
				isLoading: false,
				error: nextError,
			});
		}
	};

	useEffect(() => {
		onSelectionChange({
			file: null,
			relativePath: "",
			isLoading: false,
			error: "",
		});

		let isCurrent = true;

		void listProjectDirectory({
			data: {
				projectId,
				relativePath: ROOT_PATH,
			},
		})
			.then((entries) => {
				if (!isCurrent) {
					return;
				}

				setDirectories({
					[ROOT_PATH]: {
						entries,
						error: "",
						isLoading: false,
						isLoaded: true,
					},
				});
			})
			.catch((error) => {
				if (!isCurrent) {
					return;
				}

				setDirectories({
					[ROOT_PATH]: {
						entries: [],
						error: getErrorMessage(error, "Failed to load directory."),
						isLoading: false,
						isLoaded: true,
					},
				});
			});

		return () => {
			isCurrent = false;
		};
	}, [onSelectionChange, projectId]);

	useEffect(() => {
		if (!debouncedSearchQuery) {
			setSearchResults([]);
			setSearchError("");
			setIsSearching(false);
			return;
		}

		void runSearch(debouncedSearchQuery);
	}, [debouncedSearchQuery]);

	const handleToggleDirectory = async (relativePath: string) => {
		const normalizedPath = normalizeRelativePath(relativePath);
		const isExpanded = expandedDirectories[normalizedPath];

		setExpandedDirectories((currentDirectories) => ({
			...currentDirectories,
			[normalizedPath]: !isExpanded,
		}));

		if (!isExpanded) {
			await loadDirectory(normalizedPath);
		}
	};

	const handleRefresh = async () => {
		const expandedPaths = Object.entries(expandedDirectories)
			.filter(([, isExpanded]) => isExpanded)
			.map(([relativePath]) => relativePath);

		await Promise.all(
			expandedPaths.map((relativePath) => loadDirectory(relativePath, true)),
		);

		if (selectedFilePath) {
			await loadFile(selectedFilePath);
		}

		if (trimmedSearchQuery) {
			await runSearch(trimmedSearchQuery);
		}
	};

	const handleImportFiles = async (files: FileList | File[]) => {
		const importedFiles = Array.from(files);

		if (importedFiles.length === 0) {
			return;
		}

		if (importedFiles.length > 1) {
			setCreateError("Import one file at a time.");
			return;
		}

		setIsImportingFile(true);
		setCreateError("");

		try {
			const importedFile = await readImportedFile(importedFiles[0]);

			setImportedFile(importedFile);
			setNewFilePath(importedFile.relativePath);
		} catch (error) {
			setCreateError(getErrorMessage(error, "Failed to import file."));
		} finally {
			setIsImportingFile(false);
		}
	};

	const handleCreateFile = async () => {
		const normalizedPath = normalizeRelativePath(newFilePath.trim());

		if (!importedFile) {
			setCreateError("Drop or paste a file first.");
			return;
		}

		if (!normalizedPath) {
			setCreateError("Imported file path is missing.");
			return;
		}

		setIsCreatingFile(true);
		setCreateError("");

		try {
			await createProjectFile({
				data: {
					projectId,
					base64Content: importedFile.base64Content,
					relativePath: normalizedPath,
				},
			});

			const directoryChain = getDirectoryChain(normalizedPath);

			setExpandedDirectories((currentDirectories) => ({
				...currentDirectories,
				...Object.fromEntries(directoryChain.map((path) => [path, true])),
			}));

			for (const directoryPath of directoryChain) {
				await loadDirectory(directoryPath, true);
			}

			setIsCreateFormOpen(false);
			setImportedFile(null);
			setNewFilePath("");
			if (trimmedSearchQuery) {
				await runSearch(trimmedSearchQuery);
			}
			await loadFile(normalizedPath);
		} catch (error) {
			setCreateError(getErrorMessage(error, "Failed to create file."));
		} finally {
			setIsCreatingFile(false);
		}
	};

	const handleDeleteFile = async () => {
		if (!deleteTarget) {
			return;
		}

		const targetPath = deleteTarget.relativePath;
		setIsDeletingFile(true);

		try {
			await deleteProjectFile({
				data: {
					projectId,
					relativePath: targetPath,
				},
			});

			await loadDirectory(getParentDirectory(targetPath), true);
			if (selectedFilePath === targetPath) {
				setSelectedFilePath("");
				setSelectedFile(null);
				onSelectionChange({
					file: null,
					relativePath: "",
					isLoading: false,
					error: "",
				});
			}
			setIsDeleteDialogOpen(false);
			setDeleteTarget(null);
			if (trimmedSearchQuery) {
				await runSearch(trimmedSearchQuery);
			}
		} catch (error) {
			const nextError = getErrorMessage(error, "Failed to delete file.");
			onSelectionChange({
				file: selectedFile,
				relativePath: selectedFilePath,
				isLoading: false,
				error: nextError,
			});
		} finally {
			setIsDeletingFile(false);
		}
	};

	const renderFileIcon = (relativePath: string) => {
		if (isImageFilePath(relativePath)) {
			return <ImageIcon className="size-3 shrink-0 text-sky-400/70" />;
		}

		if (isMarkdownFilePath(relativePath)) {
			return <NotebookText className="size-3 shrink-0 text-emerald-400/70" />;
		}

		return <FileText className="size-3 shrink-0 text-muted-foreground/60" />;
	};

	const renderFileButton = ({
		className,
		pathLabel,
		relativePath,
		style,
	}: {
		className?: string;
		pathLabel?: React.ReactNode;
		relativePath: string;
		style?: React.CSSProperties;
	}) => {
		const isSelected = selectedFilePath === relativePath;

		return (
			<button
				key={relativePath}
				type="button"
				className={cn(
					"flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
					isSelected && "bg-primary/10 text-foreground",
					className,
				)}
				style={style}
				onClick={() => {
					void loadFile(relativePath);
				}}
				onContextMenu={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setContextMenuState({
						kind: "file",
						x: event.clientX,
						y: event.clientY,
						file: {
							name: relativePath.split("/").pop() ?? relativePath,
							relativePath,
						},
					});
				}}
			>
				{renderFileIcon(relativePath)}
				<div className="min-w-0 flex-1">
					<div className="truncate">
						{relativePath.split("/").pop() ?? relativePath}
					</div>
					{pathLabel ? pathLabel : null}
				</div>
			</button>
		);
	};

	const renderDirectoryEntries = (
		entries: ProjectFileEntry[],
		depth = 0,
	): React.ReactNode =>
		entries.map((entry) => {
			const directoryState = directories[entry.relativePath];
			const isExpanded = expandedDirectories[entry.relativePath];
			const paddingLeft = 10 + depth * 12;

			if (entry.kind === "directory") {
				return (
					<div key={entry.relativePath}>
						<button
							type="button"
							className={cn(
								"flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
								isExpanded && "text-foreground",
							)}
							style={{ paddingLeft }}
							onClick={() => {
								void handleToggleDirectory(entry.relativePath);
							}}
						>
							<ChevronRight
								className={cn(
									"size-2.5 shrink-0 transition-transform opacity-70",
									isExpanded && "rotate-90",
								)}
							/>
							{isExpanded ? (
								<FolderOpen className="size-3 shrink-0 text-primary/90" />
							) : (
								<Folder className="size-3 shrink-0 text-primary/70" />
							)}
							<span className="truncate">{entry.name}</span>
							{directoryState?.isLoading ? (
								<LoaderCircle className="ml-auto size-2.5 animate-spin text-muted-foreground/40" />
							) : null}
						</button>
						{isExpanded ? (
							<div>
								{directoryState?.error ? (
									<p
										className="px-3 py-0.5 text-[10px] text-destructive/70"
										style={{ paddingLeft: paddingLeft + 18 }}
									>
										{directoryState.error}
									</p>
								) : null}
								{directoryState?.entries?.length ? (
									renderDirectoryEntries(directoryState.entries, depth + 1)
								) : directoryState?.isLoaded && !directoryState.isLoading ? (
									<p
										className="px-3 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/30"
										style={{ paddingLeft: paddingLeft + 18 }}
									>
										Empty
									</p>
								) : null}
							</div>
						) : null}
					</div>
				);
			}

			return renderFileButton({
				relativePath: entry.relativePath,
				style: { paddingLeft: paddingLeft + 18 },
			});
		});

	const rootDirectory = directories[ROOT_PATH];

	return (
		<>
			<div className="flex h-full min-h-0 flex-col bg-sidebar/80">
				<div className="border-b border-white/6 px-2 py-2">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/45" />
						<Input
							aria-label="Search files"
							placeholder="Search files..."
							className="h-8 border-white/8 bg-white/[0.03] pl-8 pr-8 text-xs placeholder:text-muted-foreground/40"
							value={searchQuery}
							onChange={(event) => {
								setSearchQuery(event.target.value);
							}}
						/>
						{searchQuery ? (
							<button
								type="button"
								aria-label="Clear file search"
								className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/55 transition-colors hover:text-foreground"
								onClick={() => {
									setSearchQuery("");
								}}
							>
								<X className="size-3.5" />
							</button>
						) : null}
					</div>
				</div>
				<div
					role="tree"
					aria-label="File explorer"
					className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 custom-scrollbar"
					onContextMenu={(event) => {
						event.preventDefault();
						setContextMenuState({
							kind: "explorer",
							x: event.clientX,
							y: event.clientY,
						});
					}}
				>
					{isSearchMode ? (
						isSearchPending || isSearching ? (
							<div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/60">
								<LoaderCircle className="mr-1.5 size-3 animate-spin" />
								Searching files
							</div>
						) : searchError ? (
							<div className="px-3 py-4 text-[12px] text-destructive/80">
								{searchError}
							</div>
						) : searchResults.length ? (
							<div className="space-y-0.5">
								<div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/45">
									{searchResults.length} matching files
								</div>
								{searchResults.map((result) =>
									renderFileButton({
										className: "px-2 py-1.5",
										pathLabel: (
											<div className="truncate text-[10px] text-muted-foreground/45">
												{result.relativePath}
											</div>
										),
										relativePath: result.relativePath,
									}),
								)}
							</div>
						) : (
							<div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-muted-foreground/40">
								No files match "{trimmedSearchQuery}".
							</div>
						)
					) : rootDirectory?.isLoading ? (
						<div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/60">
							<LoaderCircle className="mr-1.5 size-3 animate-spin" />
							Loading files
						</div>
					) : rootDirectory?.error ? (
						<div className="px-3 py-4 text-[12px] text-destructive/80">
							{rootDirectory.error}
						</div>
					) : rootDirectory?.entries.length ? (
						renderDirectoryEntries(rootDirectory.entries)
					) : (
						<div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-muted-foreground/40">
							Select this workspace to start creating files.
						</div>
					)}
				</div>
			</div>

			{contextMenuState ? (
				<div
					ref={contextMenuRef}
					className="fixed z-50 min-w-[170px] overflow-hidden rounded-lg border border-white/8 bg-[#0e0e10] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
					style={{
						left: contextMenuState.x,
						top: contextMenuState.y,
					}}
				>
					{contextMenuState.kind === "explorer" ? (
						<>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5"
								onClick={() => {
									setContextMenuState(null);
									void handleRefresh();
								}}
							>
								<RefreshCcw className="size-3 text-zinc-400" />
								<span>Refresh Files</span>
							</button>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 transition-colors hover:bg-white/5"
								onClick={() => {
									setContextMenuState(null);
									setIsCreateFormOpen(true);
									setCreateError("");
								}}
							>
								<FilePlus2 className="size-3 text-zinc-400" />
								<span>Add File</span>
							</button>
						</>
					) : (
						<button
							type="button"
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
							onClick={() => {
								setContextMenuState(null);
								setDeleteTarget(contextMenuState.file);
								setIsDeleteDialogOpen(true);
							}}
						>
							<Trash2 className="size-3 text-red-400/70" />
							<span>Delete File</span>
						</button>
					)}
				</div>
			) : null}

			<Dialog
				open={isCreateFormOpen}
				onOpenChange={(isOpen) => {
					setIsCreateFormOpen(isOpen);
					if (!isOpen) {
						setImportedFile(null);
						setIsDragTargetActive(false);
						setNewFilePath("");
						setCreateError("");
					}
				}}
			>
				<DialogContent
					className="max-w-md border-white/8 bg-[#111113]"
					onPasteCapture={(event) => {
						const clipboardFiles = event.clipboardData.files;

						if (clipboardFiles.length === 0) {
							return;
						}

						event.preventDefault();
						void handleImportFiles(clipboardFiles);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add File</DialogTitle>
						<DialogDescription>
							Drop a file or paste one from your clipboard.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<button
							type="button"
							aria-label="Import a file by dragging it here or pasting it"
							className={cn(
								"block w-full rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
								isDragTargetActive
									? "border-primary bg-primary/10"
									: "border-white/8 bg-white/[0.02]",
							)}
							onDragEnter={(event) => {
								event.preventDefault();
								setIsDragTargetActive(true);
							}}
							onDragOver={(event) => {
								event.preventDefault();
								setIsDragTargetActive(true);
							}}
							onDragLeave={(event) => {
								event.preventDefault();
								if (
									event.currentTarget.contains(
										event.relatedTarget as Node | null,
									)
								) {
									return;
								}

								setIsDragTargetActive(false);
							}}
							onDrop={(event) => {
								event.preventDefault();
								setIsDragTargetActive(false);
								void handleImportFiles(event.dataTransfer.files);
							}}
						>
							{isImportingFile ? (
								<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
									<LoaderCircle className="size-4 animate-spin" />
									<span>Importing file</span>
								</div>
							) : (
								<div className="space-y-2">
									<p className="text-sm font-medium text-foreground">
										Drag and drop a file here or paste one
									</p>
									<p className="text-xs text-muted-foreground">
										The imported file name becomes the project path.
									</p>
									{importedFile?.name ? (
										<p className="text-xs text-primary">
											Imported: {importedFile.name}
										</p>
									) : null}
								</div>
							)}
						</button>
						{createError ? (
							<p className="text-xs text-destructive">{createError}</p>
						) : null}
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => {
								setIsCreateFormOpen(false);
								setImportedFile(null);
								setIsDragTargetActive(false);
								setNewFilePath("");
								setCreateError("");
							}}
						>
							Cancel
						</Button>
						<Button
							disabled={isCreatingFile || !newFilePath}
							onClick={() => {
								void handleCreateFile();
							}}
						>
							{isCreatingFile ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								"Create"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={(isOpen) => setIsDeleteDialogOpen(isOpen)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete File</AlertDialogTitle>
						<AlertDialogDescription>
							This removes{" "}
							<span className="font-medium">{deleteTarget?.name}</span> from the
							project directory.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingFile}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeletingFile}
							onClick={(event) => {
								event.preventDefault();
								void handleDeleteFile();
							}}
						>
							{isDeletingFile ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
