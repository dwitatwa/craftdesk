import { Eye, FileText, LoaderCircle, Save, SquarePen, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "#/components/ui/button";
import type {
	ProjectFileSelectionState,
	TextProjectFileContent,
} from "#/lib/craftdesk";
import { isMarkdownFilePath } from "#/lib/craftdesk";
import { cn, shouldHandleMiddleClickClose } from "#/lib/utils";
import { updateProjectFile } from "#/server/craftdesk";
import type { ActiveProjectContext } from "../layout/app-shell";

interface FilePreviewViewProps {
	activeProject: ActiveProjectContext | null;
	onClose: () => void;
	onDirtyChange: (isDirty: boolean) => void;
	onTextFileSaved: (file: TextProjectFileContent) => void;
	selection: ProjectFileSelectionState;
}

function normalizeLineEndings(value: string) {
	return value.replace(/\r\n/g, "\n");
}

function applyPreferredLineEndings(value: string, reference: string) {
	const normalizedValue = normalizeLineEndings(value);

	return reference.includes("\r\n")
		? normalizedValue.replace(/\n/g, "\r\n")
		: normalizedValue;
}

function formatFileSize(size: number) {
	if (size < 1024) {
		return `${size} B`;
	}

	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}

	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const MonacoFileEditor = lazy(() =>
	import("#/components/workspace/monaco-file-editor").then((module) => ({
		default: module.MonacoFileEditor,
	})),
);

export function FilePreviewView({
	activeProject,
	onClose,
	onDirtyChange,
	onTextFileSaved,
	selection,
}: FilePreviewViewProps) {
	const activeTextFile =
		selection.file?.kind === "text" ? selection.file : null;
	const [draftContent, setDraftContent] = useState(
		activeTextFile?.content ?? "",
	);
	const [savedContent, setSavedContent] = useState(
		activeTextFile?.content ?? "",
	);
	const [mode, setMode] = useState<"write" | "preview">("write");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState("");
	const headerRef = useRef<HTMLDivElement | null>(null);
	const hasChanges =
		!!activeTextFile &&
		normalizeLineEndings(draftContent) !== normalizeLineEndings(savedContent);
	const isMarkdownFile = activeTextFile
		? isMarkdownFilePath(activeTextFile.relativePath)
		: false;
	const isMarkdownPreview = isMarkdownFile && mode === "preview";
	const saveStateLabel = activeTextFile
		? saveError
			? "Save failed"
			: isSaving
				? "Saving..."
				: hasChanges
					? "Unsaved"
					: "Saved"
		: "";

	useEffect(() => {
		setDraftContent(activeTextFile?.content ?? "");
		setSavedContent(activeTextFile?.content ?? "");
		setMode("write");
		setIsSaving(false);
		setSaveError("");
	}, [activeTextFile?.content]);

	useEffect(() => {
		onDirtyChange(hasChanges);

		return () => {
			onDirtyChange(false);
		};
	}, [hasChanges, onDirtyChange]);

	useEffect(() => {
		if (!hasChanges) {
			return;
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [hasChanges]);

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

	const handleSave = async () => {
		if (!activeProject || !activeTextFile || isSaving || !hasChanges) {
			return;
		}

		setIsSaving(true);
		setSaveError("");

		try {
			const updatedFile = await updateProjectFile({
				data: {
					content: applyPreferredLineEndings(draftContent, savedContent),
					projectId: activeProject.id,
					relativePath: activeTextFile.relativePath,
				},
			});

			if (updatedFile.kind !== "text") {
				throw new Error("Only text files can be edited in the file pane.");
			}

			setDraftContent(updatedFile.content);
			setSavedContent(updatedFile.content);
			onTextFileSaved(updatedFile);
		} catch (error) {
			setSaveError(
				error instanceof Error
					? error.message
					: "Unable to save the file right now.",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-background"
			onKeyDownCapture={(event) => {
				if (
					event.defaultPrevented ||
					event.isComposing ||
					(!event.metaKey && !event.ctrlKey) ||
					event.key.toLowerCase() !== "s"
				) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				void handleSave();
			}}
		>
			<div
				ref={headerRef}
				className="sticky top-0 z-10 flex h-20 items-center justify-between border-b bg-background/85 px-6 backdrop-blur-md"
			>
				<div className="min-w-0">
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/45">
						File Preview
					</p>
					<h1 className="mt-2 truncate text-sm font-semibold text-foreground">
						{selection.relativePath || "No file selected"}
					</h1>
					{activeProject ? (
						<p className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground/35">
							{activeProject.name}
						</p>
					) : null}
				</div>
				{activeTextFile ? (
					<div className="flex items-center gap-2">
						<div
							className={cn(
								"hidden rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] md:inline-flex",
								saveError
									? "border-red-400/30 bg-red-400/10 text-red-200"
									: hasChanges
										? "border-amber-300/25 bg-amber-300/10 text-amber-100"
										: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
							)}
						>
							{saveStateLabel}
						</div>
						<Button
							variant="outline"
							size="sm"
							className="h-8 border-white/10 bg-white/[0.04] px-3 text-[10px] font-mono uppercase tracking-[0.14em] text-foreground hover:bg-white/8"
							onClick={() => {
								void handleSave();
							}}
							disabled={!hasChanges || isSaving}
							title="Save file (Ctrl+S)"
						>
							{isSaving ? (
								<LoaderCircle className="size-3 animate-spin" />
							) : (
								<Save className="size-3" />
							)}
							Save
						</Button>
						{isMarkdownFile ? (
							<div className="inline-flex rounded-lg border border-white/8 bg-white/[0.03] p-1">
								<button
									type="button"
									className={cn(
										"inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] leading-none transition-colors",
										mode === "write"
											? "bg-white/8 text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
									onClick={() => setMode("write")}
								>
									<SquarePen className="size-3 shrink-0" />
									Write
								</button>
								<button
									type="button"
									className={cn(
										"inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] leading-none transition-colors",
										mode === "preview"
											? "bg-white/8 text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
									onClick={() => setMode("preview")}
								>
									<Eye className="size-3 shrink-0" />
									Preview
								</button>
							</div>
						) : null}
					</div>
				) : (
					<div className="hidden items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55 md:inline-flex">
						<FileText className="size-3" />
						Read Only
					</div>
				)}
				<Button
					variant="ghost"
					size="icon-sm"
					className="ml-3 shrink-0 text-muted-foreground hover:text-foreground"
					onClick={onClose}
					data-middle-click-close-ignore
					title="Close file preview (Alt+W or Escape)"
				>
					<X className="size-4" />
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
				{selection.isLoading ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						<LoaderCircle className="mr-3 size-4 animate-spin" />
						Loading file preview
					</div>
				) : selection.error ? (
					<div className="flex h-full items-center justify-center p-8">
						<div className="max-w-md rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
							<p className="text-sm font-semibold text-destructive">
								Unable to preview file
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{selection.error}
							</p>
						</div>
					</div>
				) : activeTextFile ? (
					<div className="flex h-full min-h-0 flex-col">
						{!isMarkdownPreview ? (
							<div className="flex min-h-0 flex-1 bg-[#050507]">
								<div className="flex min-h-0 flex-1 overflow-hidden bg-[#050507]">
									<Suspense
										fallback={
											<div className="flex h-full w-full items-center justify-center bg-[#050507] text-sm text-muted-foreground">
												<LoaderCircle className="mr-3 size-4 animate-spin" />
												Loading editor
											</div>
										}
									>
										<MonacoFileEditor
											className="w-full"
											onChange={(nextValue) => {
												setDraftContent(nextValue);
												if (saveError) {
													setSaveError("");
												}
											}}
											onSave={() => {
												void handleSave();
											}}
											projectId={activeProject?.id ?? ""}
											projectPath={activeProject?.path ?? ""}
											relativePath={activeTextFile.relativePath}
											value={draftContent}
										/>
									</Suspense>
								</div>
							</div>
						) : (
							<div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
								{draftContent.trim() ? (
									<div
										className={cn(
											"prose prose-invert prose-sm max-w-none",
											"prose-headings:text-foreground prose-p:text-foreground/85",
											"prose-strong:text-foreground prose-a:text-primary",
											"prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none",
											"prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30",
											"prose-blockquote:border-l-white/20 prose-blockquote:text-muted-foreground",
											"prose-hr:border-white/10 prose-th:text-foreground prose-td:text-foreground/80",
											"prose-li:text-foreground/85",
										)}
									>
										<ReactMarkdown remarkPlugins={[remarkGfm]}>
											{draftContent}
										</ReactMarkdown>
									</div>
								) : (
									<div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center text-sm italic text-muted-foreground/45">
										No markdown content yet. Start typing to preview it here.
									</div>
								)}
							</div>
						)}
						{saveError ? (
							<div className="border-t border-white/5 px-4 py-2 text-[11px] text-red-300">
								{saveError}
							</div>
						) : null}
					</div>
				) : selection.file?.kind === "image" ? (
					<div className="flex h-full items-center justify-center p-6">
						<div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/8 bg-[#0B0B0D]">
							<div className="flex items-center justify-between border-b border-white/6 px-5 py-3 text-xs text-muted-foreground">
								<span>{selection.file.mimeType}</span>
								<span>{formatFileSize(selection.file.size)}</span>
							</div>
							<div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6">
								<img
									alt={`Preview of ${selection.file.name}`}
									className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_20px_70px_rgba(0,0,0,0.45)]"
									src={`data:${selection.file.mimeType};base64,${selection.file.base64Content}`}
								/>
							</div>
						</div>
					</div>
				) : selection.file?.kind === "binary" ? (
					<div className="flex h-full items-center justify-center p-8">
						<div className="max-w-md rounded-2xl border border-white/6 bg-white/[0.02] p-6 text-center">
							<p className="text-sm font-semibold text-foreground">
								Preview unavailable
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								This file was imported correctly, but Craftdesk cannot preview
								this binary format yet.
							</p>
							<p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground/55">
								{selection.file.mimeType ?? "Unknown binary"} •{" "}
								{formatFileSize(selection.file.size)}
							</p>
						</div>
					</div>
				) : (
					<div className="flex h-full items-center justify-center p-8">
						<div className="max-w-md rounded-2xl border border-white/6 bg-white/[0.02] p-6 text-center">
							<p className="text-sm font-semibold text-foreground">
								Choose a file from the explorer
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								The selected file will open here, to the right of the sidebar.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
