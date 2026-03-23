import { Eye, LoaderCircle, Save, SquarePen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import { updateTaskNotes } from "#/server/craftdesk";

interface TaskNotesEditorProps {
	taskId: string;
	initialNotes: string;
	onSaved?: () => Promise<void> | void;
}

export function TaskNotesEditor({
	taskId,
	initialNotes,
	onSaved,
}: TaskNotesEditorProps) {
	const [draftNotes, setDraftNotes] = useState(initialNotes);
	const [savedNotes, setSavedNotes] = useState(initialNotes);
	const [mode, setMode] = useState<"write" | "preview">("write");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const hasChanges = draftNotes !== savedNotes;

	const persistNotes = useCallback(
		async (notes: string) => {
			setIsSaving(true);
			setSaveError(null);

			try {
				const normalizedNotes = notes.replace(/\r\n/g, "\n");
				await updateTaskNotes({
					data: {
						taskId,
						notes: normalizedNotes,
					},
				});
				setSavedNotes(normalizedNotes);
				await onSaved?.();
			} catch (error) {
				setSaveError(
					error instanceof Error
						? error.message
						: "Unable to save notes right now.",
				);
			} finally {
				setIsSaving(false);
			}
		},
		[onSaved, taskId],
	);

	const handleSave = async () => {
		if (isSaving || !hasChanges) {
			return;
		}

		await persistNotes(draftNotes);
	};

	useEffect(() => {
		if (!hasChanges || isSaving) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			void persistNotes(draftNotes);
		}, 700);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [draftNotes, hasChanges, isSaving, persistNotes]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2">
				<div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
					Notes
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-lg border border-white/8 bg-black/20 p-1">
						<button
							type="button"
							onClick={() => setMode("write")}
							className={cn(
								"inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] leading-none transition-colors",
								mode === "write"
									? "bg-white/8 text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<SquarePen className="size-3 shrink-0" />
							Write
						</button>
						<button
							type="button"
							onClick={() => setMode("preview")}
							className={cn(
								"inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] leading-none transition-colors",
								mode === "preview"
									? "bg-white/8 text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Eye className="size-3 shrink-0" />
							Preview
						</button>
					</div>
					<Button
						type="button"
						size="xs"
						variant="outline"
						onClick={handleSave}
						disabled={!hasChanges || isSaving}
						className="h-8 min-w-18 rounded-lg border-white/10 bg-black/20 px-3 text-[10px] font-mono uppercase tracking-[0.14em] text-foreground hover:bg-white/8"
					>
						{isSaving ? (
							<LoaderCircle className="size-3 animate-spin" />
						) : (
							<Save className="size-3" />
						)}
						Save
					</Button>
				</div>
			</div>

			<div
				className={cn(
					"flex flex-1 overflow-hidden px-4 pb-4",
					mode === "write" ? "bg-[#09090b]/20" : "bg-transparent",
				)}
			>
				{mode === "write" ? (
					<Textarea
						value={draftNotes}
						onChange={(event) => {
							setDraftNotes(event.target.value);
							if (saveError) {
								setSaveError(null);
							}
						}}
						onKeyDown={(event) => {
							if ((event.metaKey || event.ctrlKey) && event.key === "s") {
								event.preventDefault();
								void handleSave();
							}
						}}
						onBlur={() => {
							void handleSave();
						}}
						placeholder="Write task notes in markdown..."
						className="h-full min-h-[260px] resize-none border-0 bg-transparent px-2 py-4 font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0"
					/>
				) : (
					<div className="custom-scrollbar flex-1 overflow-y-auto px-2 py-4">
						{draftNotes.trim() ? (
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
									{draftNotes}
								</ReactMarkdown>
							</div>
						) : (
							<div className="flex h-full items-center justify-center px-6 text-center text-sm italic text-muted-foreground/45">
								No notes yet. Start typing markdown to preview it here.
							</div>
						)}
					</div>
				)}
			</div>
			{saveError ? (
				<div className="border-t border-white/5 px-4 py-2 text-[11px] text-red-300">
					{saveError}
				</div>
			) : null}
		</div>
	);
}
