import { DiffEditor } from "@monaco-editor/react";
import {
	FileCode2,
	GitCompareArrows,
	LoaderCircle,
	MoveRight,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ActiveProjectContext } from "#/components/layout/app-shell";
import { Button } from "#/components/ui/button";
import type { GitDiffResult, GitSelectedChange } from "#/lib/git";
import { getMonacoLanguageIdFromPath } from "#/lib/language-server";
import { cn, shouldHandleMiddleClickClose } from "#/lib/utils";
import { getGitDiff } from "#/server/git";
import { MONACO_SURFACE_CLASSNAME, MONACO_THEME } from "./monaco-shared";

interface GitDiffViewProps {
	activeProject: ActiveProjectContext | null;
	onClose: () => void;
	refreshVersion: number;
	selectedChange: GitSelectedChange | null;
}

export function GitDiffView({
	activeProject,
	onClose,
	refreshVersion,
	selectedChange,
}: GitDiffViewProps) {
	const activeProjectPath = activeProject?.path ?? "";
	const [diff, setDiff] = useState<GitDiffResult | null>(null);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const headerRef = useRef<HTMLDivElement | null>(null);
	const activeDiffKey = getGitDiffRequestKey(activeProjectPath, selectedChange);
	const activeDiffKeyRef = useRef(activeDiffKey);
	const diffRef = useRef(diff);
	const refreshVersionRef = useRef(refreshVersion);
	const loadedDiffKeyRef = useRef("");
	const loadedRefreshVersionRef = useRef(-1);
	const diffRequestRef = useRef<{
		diffKey: string;
		promise: Promise<GitDiffResult>;
	} | null>(null);
	activeDiffKeyRef.current = activeDiffKey;
	diffRef.current = diff;
	refreshVersionRef.current = refreshVersion;

	const loadDiff = useCallback(
		async (
			diffKey: string,
			change: GitSelectedChange,
			options: {
				force?: boolean;
				reset?: boolean;
			} = {},
		) => {
			const existingRequest = diffRequestRef.current;

			if (!options.force && existingRequest?.diffKey === diffKey) {
				return existingRequest.promise;
			}

			if (options.reset) {
				setDiff(null);
			}

			setError("");
			setIsLoading(true);

			const promise = getGitDiff({
				data: {
					cwd: activeProjectPath,
					path: change.path,
					originalPath: change.originalPath,
					diffMode: change.diffMode,
					code: change.code,
				},
			});
			diffRequestRef.current = {
				diffKey,
				promise,
			};

			try {
				const nextDiff = await promise;

				if (activeDiffKeyRef.current !== diffKey) {
					return nextDiff;
				}

				loadedDiffKeyRef.current = diffKey;
				loadedRefreshVersionRef.current = refreshVersionRef.current;
				setDiff((currentDiff) =>
					isSameDiffResult(currentDiff, nextDiff) ? currentDiff : nextDiff,
				);

				return nextDiff;
			} catch (cause) {
				if (activeDiffKeyRef.current === diffKey) {
					setError(
						cause instanceof Error
							? cause.message
							: "Failed to load file diff.",
					);
				}

				throw cause;
			} finally {
				if (diffRequestRef.current?.promise === promise) {
					diffRequestRef.current = null;
				}

				if (activeDiffKeyRef.current === diffKey) {
					setIsLoading(false);
				}
			}
		},
		[activeProjectPath],
	);

	useEffect(() => {
		if (!activeDiffKey || !selectedChange) {
			loadedDiffKeyRef.current = "";
			loadedRefreshVersionRef.current = -1;
			diffRequestRef.current = null;
			setDiff(null);
			setError("");
			setIsLoading(false);
			return;
		}

		if (
			loadedDiffKeyRef.current === activeDiffKey &&
			loadedRefreshVersionRef.current === refreshVersion &&
			diffRef.current
		) {
			return;
		}

		if (diffRequestRef.current?.diffKey === activeDiffKey) {
			setError("");
			setIsLoading(true);
			return;
		}

		void loadDiff(activeDiffKey, selectedChange, {
			reset: shouldResetDiffView(
				loadedDiffKeyRef.current,
				activeDiffKey,
				!!diffRef.current,
			),
		}).catch(() => {
			// Error state is handled inside loadDiff.
		});
	}, [activeDiffKey, loadDiff, refreshVersion, selectedChange]);

	useEffect(() => {
		const header = headerRef.current;

		if (!header) {
			return;
		}

		const handleMouseDown = (event: MouseEvent) => {
			if (!shouldHandleMiddleClickClose(event)) {
				return;
			}

			event.preventDefault();
			onClose();
		};

		header.addEventListener("mousedown", handleMouseDown);

		return () => {
			header.removeEventListener("mousedown", handleMouseDown);
		};
	}, [onClose]);

	const diffMetadata = useMemo(
		() => createDiffMetadata(activeProject, selectedChange),
		[activeProject, selectedChange],
	);

	if (!activeProject) {
		return (
			<div className="flex h-full items-center justify-center p-8">
				<EmptyState
					title="No project selected"
					description="Choose a project to inspect Git changes."
				/>
			</div>
		);
	}

	if (!selectedChange) {
		return (
			<div className="flex h-full items-center justify-center p-8">
				<EmptyState
					title="Select a changed file"
					description="Pick a staged or unstaged file from the Git sidebar to open its diff view."
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div
				ref={headerRef}
				className="h-20 border-b bg-background/80 px-6 flex items-center backdrop-blur-sm"
			>
				<div className="flex items-center justify-between gap-4 w-full">
					<div className="min-w-0">
						<div className="flex items-center gap-2 text-base font-semibold tracking-tight">
							<FileCode2 className="size-3.5 shrink-0 text-primary" />
							<span className="truncate">{selectedChange.path}</span>
						</div>
						<div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
							<span>{activeProject.name}</span>
							{selectedChange.originalPath ? (
								<>
									<span className="text-white/20">•</span>
									<span className="truncate">
										{selectedChange.originalPath}
									</span>
									<MoveRight className="size-3 shrink-0" />
									<span className="truncate">{selectedChange.path}</span>
								</>
							) : null}
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
							<GitCompareArrows className="size-3" />
							{selectedChange.diffMode}
						</div>
						<div className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
							{selectedChange.label}
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							className="text-muted-foreground hover:text-foreground"
							onClick={onClose}
							data-middle-click-close-ignore
							title="Close diff view (Alt+W or Escape)"
						>
							<X className="size-4" />
						</Button>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden">
				{isLoading && !diff ? (
					<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Loading diff...
					</div>
				) : null}

				{!diff && !isLoading && error ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="Diff unavailable"
							description={error}
							tone="error"
						/>
					</div>
				) : null}

				{!diff && !isLoading && !error ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="No diff output"
							description="This selection does not currently produce a textual diff."
						/>
					</div>
				) : null}

				{diff?.isEmpty ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="No diff output"
							description="This selection does not currently produce a textual diff."
						/>
					</div>
				) : null}

				{diff && !diff.isEmpty && diff.isBinary ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="Binary diff unavailable"
							description="This change contains binary content, so it cannot be rendered in Monaco diff view."
						/>
					</div>
				) : null}

				{diff && !diff.isEmpty && !diff.isBinary && !diff.hasTextChanges ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="No textual changes"
							description="This change only updates file metadata or path information, so there is no text diff to render."
						/>
					</div>
				) : null}

				{diff && !diff.isEmpty && !diff.isBinary && diff.hasTextChanges ? (
					<div className="relative h-full min-h-0 bg-[#101010]">
						{isLoading ? (
							<div className="pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
								<LoaderCircle className="size-3 animate-spin" />
								Refreshing diff...
							</div>
						) : null}
						<DiffEditor
							className={MONACO_SURFACE_CLASSNAME}
							language={diffMetadata.modifiedLanguage}
							loading={
								<div className="flex h-full items-center justify-center bg-[#101010] text-sm text-muted-foreground">
									<LoaderCircle className="mr-3 size-4 animate-spin" />
									Loading diff...
								</div>
							}
							modified={diff.modifiedContent}
							modifiedLanguage={diffMetadata.modifiedLanguage}
							modifiedModelPath={diffMetadata.modifiedModelPath}
							options={{
								automaticLayout: true,
								diffWordWrap: "off",
								enableSplitViewResizing: true,
								fontFamily: "JetBrains Mono, monospace",
								fontLigatures: true,
								fontSize: 13,
								glyphMargin: false,
								hideCursorInOverviewRuler: true,
								lineHeight: 24,
								lineNumbersMinChars: 4,
								minimap: { enabled: false },
								originalEditable: false,
								overviewRulerBorder: false,
								overviewRulerLanes: 3,
								padding: {
									bottom: 16,
									top: 16,
								},
								readOnly: true,
								renderIndicators: true,
								renderLineHighlight: "none",
								renderOverviewRuler: true,
								renderSideBySide: true,
								scrollBeyondLastLine: false,
								smoothScrolling: true,
								stickyScroll: { enabled: false },
								wordWrap: "off",
							}}
							original={diff.originalContent}
							originalLanguage={diffMetadata.originalLanguage}
							originalModelPath={diffMetadata.originalModelPath}
							theme={MONACO_THEME}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}

export function shouldResetDiffView(
	loadedDiffKey: string,
	activeDiffKey: string,
	hasDiff: boolean,
) {
	return loadedDiffKey !== activeDiffKey || !hasDiff;
}

export function isSameDiffResult(
	currentDiff: GitDiffResult | null,
	nextDiff: GitDiffResult,
) {
	if (!currentDiff) {
		return false;
	}

	return (
		currentDiff.path === nextDiff.path &&
		currentDiff.diffMode === nextDiff.diffMode &&
		currentDiff.originalContent === nextDiff.originalContent &&
		currentDiff.modifiedContent === nextDiff.modifiedContent &&
		currentDiff.hasTextChanges === nextDiff.hasTextChanges &&
		currentDiff.isBinary === nextDiff.isBinary &&
		currentDiff.isEmpty === nextDiff.isEmpty &&
		currentDiff.content === nextDiff.content
	);
}

function EmptyState({
	title,
	description,
	tone = "default",
}: {
	title: string;
	description: string;
	tone?: "default" | "error";
}) {
	return (
		<div
			className={cn(
				"max-w-xl rounded-2xl border px-6 py-5 text-center",
				tone === "error"
					? "border-red-500/20 bg-red-500/10 text-red-100"
					: "border-white/10 bg-black/10 text-zinc-200",
			)}
		>
			<div className="text-base font-semibold">{title}</div>
			<div
				className={cn(
					"mt-2 text-sm",
					tone === "error" ? "text-red-200/90" : "text-muted-foreground",
				)}
			>
				{description}
			</div>
		</div>
	);
}

function createDiffMetadata(
	activeProject: ActiveProjectContext | null,
	selectedChange: GitSelectedChange | null,
) {
	const originalPath =
		selectedChange?.originalPath ?? selectedChange?.path ?? "";
	const modifiedPath = selectedChange?.path ?? "";
	const projectKey = activeProject?.id ?? "workspace";

	return {
		modifiedLanguage: getMonacoLanguageIdFromPath(modifiedPath),
		modifiedModelPath: createDiffModelPath(
			projectKey,
			selectedChange?.diffMode ?? "unstaged",
			"modified",
			modifiedPath,
		),
		originalLanguage: getMonacoLanguageIdFromPath(originalPath),
		originalModelPath: createDiffModelPath(
			projectKey,
			selectedChange?.diffMode ?? "unstaged",
			"original",
			originalPath,
		),
	};
}

function createDiffModelPath(
	projectKey: string,
	diffMode: GitSelectedChange["diffMode"],
	side: "modified" | "original",
	relativePath: string,
) {
	return `git-diff:///${side}/${encodeURIComponent(projectKey)}/${diffMode}/${encodeURIComponent(relativePath)}`;
}

function getGitDiffRequestKey(
	activeProjectPath: string,
	selectedChange: GitSelectedChange | null,
) {
	if (!activeProjectPath || !selectedChange) {
		return "";
	}

	return [
		activeProjectPath,
		selectedChange.path,
		selectedChange.originalPath ?? "",
		selectedChange.diffMode,
		selectedChange.code,
	].join("::");
}
