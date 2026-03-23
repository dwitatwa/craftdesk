import {
	FileCode2,
	GitCompareArrows,
	LoaderCircle,
	MoveRight,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ActiveProjectContext } from "#/components/layout/app-shell";
import { Button } from "#/components/ui/button";
import type { GitDiffResult, GitSelectedChange } from "#/lib/git";
import { cn } from "#/lib/utils";
import { getGitDiff } from "#/server/git";

interface GitDiffViewProps {
	activeProject: ActiveProjectContext | null;
	onClose: () => void;
	selectedChange: GitSelectedChange | null;
}

interface ParsedDiffRow {
	id: string;
	type: "hunk" | "line";
	header?: string;
	leftLineNumber: number | null;
	rightLineNumber: number | null;
	leftText: string;
	rightText: string;
	leftKind: "context" | "removed" | "empty";
	rightKind: "context" | "added" | "empty";
}

export function GitDiffView({
	activeProject,
	onClose,
	selectedChange,
}: GitDiffViewProps) {
	const [diff, setDiff] = useState<GitDiffResult | null>(null);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		setDiff(null);
		setError("");

		if (!activeProject || !selectedChange) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);

		void getGitDiff({
			data: {
				cwd: activeProject.path,
				path: selectedChange.path,
				originalPath: selectedChange.originalPath,
				diffMode: selectedChange.diffMode,
				code: selectedChange.code,
			},
		})
			.then((nextDiff) => {
				if (!cancelled) {
					setDiff(nextDiff);
				}
			})
			.catch((cause) => {
				if (!cancelled) {
					setError(
						cause instanceof Error
							? cause.message
							: "Failed to load file diff.",
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [activeProject, selectedChange]);

	const rows = useMemo(
		() => parseUnifiedDiff(diff?.content ?? ""),
		[diff?.content],
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
			<div className="h-20 border-b bg-background/80 px-6 flex items-center backdrop-blur-sm">
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
							title="Close diff view"
						>
							<X className="size-4" />
						</Button>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden">
				{isLoading ? (
					<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Loading diff...
					</div>
				) : null}

				{!isLoading && error ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="Diff unavailable"
							description={error}
							tone="error"
						/>
					</div>
				) : null}

				{!isLoading && !error && diff?.isEmpty ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							title="No diff output"
							description="This selection does not currently produce a textual diff."
						/>
					</div>
				) : null}

				{!isLoading && !error && diff && !diff.isEmpty ? (
					<div className="grid h-full min-h-0 grid-cols-2 divide-x divide-white/5 bg-[#09090B]">
						<DiffPaneHeader label="Previous" />
						<DiffPaneHeader label="Current" />
						<div className="custom-scrollbar col-span-2 min-h-0 overflow-auto">
							<div className="grid min-w-[960px] grid-cols-2 divide-x divide-white/5">
								<div>
									{rows.map((row) =>
										row.type === "hunk" ? (
											<HunkHeader key={row.id} header={row.header ?? ""} />
										) : (
											<DiffLine
												key={row.id}
												lineNumber={row.leftLineNumber}
												text={row.leftText}
												kind={row.leftKind}
											/>
										),
									)}
								</div>
								<div>
									{rows.map((row) =>
										row.type === "hunk" ? (
											<HunkHeader key={row.id} header={row.header ?? ""} />
										) : (
											<DiffLine
												key={row.id}
												lineNumber={row.rightLineNumber}
												text={row.rightText}
												kind={row.rightKind}
											/>
										),
									)}
								</div>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function DiffPaneHeader({ label }: { label: string }) {
	return (
		<div className="border-b border-white/5 bg-white/[0.02] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
			{label}
		</div>
	);
}

function HunkHeader({ header }: { header: string }) {
	return (
		<div className="border-b border-sky-500/10 bg-sky-500/8 px-4 py-1.5 text-[10px] font-mono text-sky-200">
			{header}
		</div>
	);
}

function DiffLine({
	lineNumber,
	text,
	kind,
}: {
	lineNumber: number | null;
	text: string;
	kind: "context" | "removed" | "added" | "empty";
}) {
	return (
		<div
			className={cn(
				"grid min-h-7 grid-cols-[64px_minmax(0,1fr)] border-b border-white/5 font-mono text-[11px] leading-6",
				kind === "removed" && "bg-red-500/10 text-red-100",
				kind === "added" && "bg-emerald-500/10 text-emerald-100",
				kind === "context" && "text-zinc-200",
				kind === "empty" && "text-zinc-500",
			)}
		>
			<div className="border-r border-white/5 px-3 text-right text-[10px] text-zinc-500">
				{lineNumber ?? ""}
			</div>
			<div className="overflow-hidden px-3 whitespace-pre">{text || " "}</div>
		</div>
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

function parseUnifiedDiff(content: string): ParsedDiffRow[] {
	const rows: ParsedDiffRow[] = [];
	let oldLine = 0;
	let newLine = 0;
	let blockIndex = 0;
	let pendingRemoved: string[] = [];
	let pendingAdded: string[] = [];

	const flushPending = () => {
		if (!pendingRemoved.length && !pendingAdded.length) {
			return;
		}

		const count = Math.max(pendingRemoved.length, pendingAdded.length);

		for (let index = 0; index < count; index += 1) {
			const removedLine = pendingRemoved[index];
			const addedLine = pendingAdded[index];
			const currentOldLine = removedLine !== undefined ? oldLine : null;
			const currentNewLine = addedLine !== undefined ? newLine : null;

			if (removedLine !== undefined) {
				oldLine += 1;
			}

			if (addedLine !== undefined) {
				newLine += 1;
			}

			rows.push({
				id: `change:${blockIndex}:${index}`,
				type: "line",
				leftLineNumber: currentOldLine,
				rightLineNumber: currentNewLine,
				leftText: removedLine ?? "",
				rightText: addedLine ?? "",
				leftKind: removedLine !== undefined ? "removed" : "empty",
				rightKind: addedLine !== undefined ? "added" : "empty",
			});
		}

		blockIndex += 1;
		pendingRemoved = [];
		pendingAdded = [];
	};

	for (const line of content.split(/\r?\n/)) {
		if (line.startsWith("@@")) {
			flushPending();
			const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

			if (match) {
				oldLine = Number.parseInt(match[1], 10);
				newLine = Number.parseInt(match[2], 10);
			}

			rows.push({
				id: `hunk:${rows.length}`,
				type: "hunk",
				header: line,
				leftLineNumber: null,
				rightLineNumber: null,
				leftText: "",
				rightText: "",
				leftKind: "context",
				rightKind: "context",
			});
			continue;
		}

		if (
			line.startsWith("--- ") ||
			line.startsWith("+++ ") ||
			line.startsWith("diff --git") ||
			line.startsWith("index ")
		) {
			continue;
		}

		if (line.startsWith("-")) {
			pendingRemoved.push(line.slice(1));
			continue;
		}

		if (line.startsWith("+")) {
			pendingAdded.push(line.slice(1));
			continue;
		}

		flushPending();

		if (line.startsWith(" ")) {
			rows.push({
				id: `context:${rows.length}:${oldLine}:${newLine}`,
				type: "line",
				leftLineNumber: oldLine,
				rightLineNumber: newLine,
				leftText: line.slice(1),
				rightText: line.slice(1),
				leftKind: "context",
				rightKind: "context",
			});
			oldLine += 1;
			newLine += 1;
		}
	}

	flushPending();

	if (rows.length === 0 && content.trim()) {
		return content.split("\n").map((line, index) => ({
			id: `raw:${index}`,
			type: "line",
			leftLineNumber: null,
			rightLineNumber: null,
			leftText: line,
			rightText: line,
			leftKind: "context",
			rightKind: "context",
		}));
	}

	return rows;
}
