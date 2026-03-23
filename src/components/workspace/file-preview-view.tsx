import { FileText, LoaderCircle, X } from "lucide-react";

import { Button } from "#/components/ui/button";
import type { ProjectFileSelectionState } from "#/lib/craftdesk";
import type { ActiveProjectContext } from "../layout/app-shell";

interface FilePreviewViewProps {
	activeProject: ActiveProjectContext | null;
	onClose: () => void;
	selection: ProjectFileSelectionState;
}

function getPreviewLines(content: string) {
	const normalizedContent = content.length > 0 ? content : "";
	const lines = normalizedContent.split("\n").map((lineContent, lineIndex) => ({
		id: `line-${lineIndex + 1}-${lineContent}`,
		lineNumber: lineIndex + 1,
		content: lineContent,
	}));

	return lines.length > 0
		? lines
		: [{ id: "line-1-empty", lineNumber: 1, content: "" }];
}

export function FilePreviewView({
	activeProject,
	onClose,
	selection,
}: FilePreviewViewProps) {
	const previewLines = selection.file
		? getPreviewLines(selection.file.content)
		: [{ id: "line-1-empty", lineNumber: 1, content: "" }];

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<div className="sticky top-0 z-10 flex h-20 items-center justify-between border-b bg-background/85 px-6 backdrop-blur-md">
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
				<div className="hidden items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55 md:inline-flex">
					<FileText className="size-3" />
					Read Only
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					className="ml-3 shrink-0 text-muted-foreground hover:text-foreground"
					onClick={onClose}
					title="Close file preview"
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
				) : selection.file ? (
					<div className="min-w-full">
						<div className="grid min-w-full grid-cols-[72px_minmax(0,1fr)] font-mono text-[12px] leading-6">
							{previewLines.map((line) => (
								<div className="contents" key={line.id}>
									<div className="select-none border-r border-white/5 bg-[#09090B]/55 px-4 py-0.5 text-right text-muted-foreground/35">
										{line.lineNumber}
									</div>
									<pre className="overflow-x-auto border-b border-white/[0.02] px-5 py-0.5 text-foreground/90">
										{line.content || " "}
									</pre>
								</div>
							))}
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
