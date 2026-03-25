import Editor from "@monaco-editor/react";
import {
	ChevronDown,
	CircleAlert,
	Info,
	Lightbulb,
	LoaderCircle,
	TriangleAlert,
} from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
	getLanguageIdFromPath,
	type LanguageServerCompletionItem,
	type LanguageServerDiagnostic,
	type LanguageServerRange,
} from "#/lib/language-server";
import { cn } from "#/lib/utils";
import { readProjectFile } from "#/server/craftdesk";
import {
	closeLanguageFile,
	getLanguageFileCompletions,
	getLanguageFileDefinition,
	getLanguageFileHover,
	syncLanguageFile,
} from "#/server/language-server";
import {
	getEditorLanguageId,
	MONACO_SURFACE_CLASSNAME,
	MONACO_THEME,
	monaco,
} from "./monaco-shared";

interface MonacoFileEditorProps {
	className?: string;
	onChange: (value: string) => void;
	onSave: () => void;
	projectId: string;
	projectPath: string;
	relativePath: string;
	value: string;
}

interface ModelContext {
	projectId: string;
	projectPath: string;
	relativePath: string;
}

interface ProblemSeveritySummary {
	errorCount: number;
	hintCount: number;
	infoCount: number;
	warningCount: number;
}

const LANGUAGE_MARKER_OWNER = "craftdesk-lsp";
const SUPPORTED_PROVIDER_LANGUAGES = ["javascript", "typescript"] as const;
const modelContextByUri = new Map<string, ModelContext>();
let areProvidersRegistered = false;

function toMonacoRange(range: LanguageServerRange): monaco.IRange {
	return {
		endColumn: range.end.character + 1,
		endLineNumber: range.end.line + 1,
		startColumn: range.start.character + 1,
		startLineNumber: range.start.line + 1,
	};
}

function toMonacoSeverity(
	diagnostic: LanguageServerDiagnostic,
): monaco.MarkerSeverity {
	switch (diagnostic.severity) {
		case "error":
			return monaco.MarkerSeverity.Error;
		case "warning":
			return monaco.MarkerSeverity.Warning;
		case "information":
			return monaco.MarkerSeverity.Info;
		case "hint":
			return monaco.MarkerSeverity.Hint;
		default:
			return monaco.MarkerSeverity.Warning;
	}
}

function toMonacoMarker(
	diagnostic: LanguageServerDiagnostic,
): monaco.editor.IMarkerData {
	return {
		code: diagnostic.code,
		endColumn: diagnostic.range.end.character + 1,
		endLineNumber: diagnostic.range.end.line + 1,
		message: diagnostic.message,
		severity: toMonacoSeverity(diagnostic),
		source: diagnostic.source,
		startColumn: diagnostic.range.start.character + 1,
		startLineNumber: diagnostic.range.start.line + 1,
	};
}

function getDiagnosticLocationLabel(diagnostic: LanguageServerDiagnostic) {
	return `Ln ${diagnostic.range.start.line + 1}, Col ${diagnostic.range.start.character + 1}`;
}

function getDiagnosticKey(diagnostic: LanguageServerDiagnostic, index: number) {
	return [
		index,
		diagnostic.severity,
		diagnostic.source ?? "",
		diagnostic.code ?? "",
		diagnostic.range.start.line,
		diagnostic.range.start.character,
		diagnostic.message,
	].join(":");
}

function summarizeDiagnostics(
	diagnostics: LanguageServerDiagnostic[],
): ProblemSeveritySummary {
	return diagnostics.reduce<ProblemSeveritySummary>(
		(summary, diagnostic) => {
			switch (diagnostic.severity) {
				case "error":
					summary.errorCount += 1;
					break;
				case "warning":
					summary.warningCount += 1;
					break;
				case "information":
					summary.infoCount += 1;
					break;
				case "hint":
					summary.hintCount += 1;
					break;
			}

			return summary;
		},
		{
			errorCount: 0,
			hintCount: 0,
			infoCount: 0,
			warningCount: 0,
		},
	);
}

function ProblemSeverityIcon({
	className,
	severity,
}: {
	className?: string;
	severity: LanguageServerDiagnostic["severity"];
}) {
	switch (severity) {
		case "error":
			return <CircleAlert className={cn("size-3.5 text-red-300", className)} />;
		case "warning":
			return (
				<TriangleAlert className={cn("size-3.5 text-amber-300", className)} />
			);
		case "information":
			return <Info className={cn("size-3.5 text-sky-300", className)} />;
		case "hint":
			return (
				<Lightbulb className={cn("size-3.5 text-emerald-300", className)} />
			);
		default:
			return (
				<TriangleAlert
					className={cn("size-3.5 text-muted-foreground", className)}
				/>
			);
	}
}

function ProblemsBadge({
	count,
	tone,
}: {
	count: number;
	tone: "error" | "warning" | "information" | "hint";
}) {
	if (count === 0) {
		return null;
	}

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]",
				tone === "error" && "border-red-400/20 bg-red-400/10 text-red-200",
				tone === "warning" &&
					"border-amber-300/20 bg-amber-300/10 text-amber-100",
				tone === "information" &&
					"border-sky-300/20 bg-sky-300/10 text-sky-100",
				tone === "hint" &&
					"border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
			)}
		>
			<span>{count}</span>
		</div>
	);
}

function ProblemsDock({
	activeProblemIndex,
	diagnostics,
	isLanguageServerEnabled,
	isOpen,
	languageStatus,
	onSelectProblem,
	onToggle,
	relativePath,
}: {
	activeProblemIndex: number | null;
	diagnostics: LanguageServerDiagnostic[];
	isLanguageServerEnabled: boolean;
	isOpen: boolean;
	languageStatus: string;
	onSelectProblem: (
		diagnostic: LanguageServerDiagnostic,
		index: number,
	) => void;
	onToggle: () => void;
	relativePath: string;
}) {
	const summary = summarizeDiagnostics(diagnostics);

	return (
		<div className="border-t border-white/6 bg-[#09090B]">
			<div className="flex items-center justify-between border-b border-white/5 bg-[#111111] px-2 py-1.5">
				<div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
					<button
						type="button"
						className={cn(
							"inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] transition-colors",
							isOpen
								? "bg-white/8 text-foreground"
								: "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
						)}
						onClick={onToggle}
						aria-expanded={isOpen}
						aria-label={
							isOpen ? "Collapse Problems panel" : "Expand Problems panel"
						}
					>
						<TriangleAlert className="size-3.5 text-amber-300" />
						<span>Problems</span>
						<span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] leading-none text-zinc-200">
							{diagnostics.length}
						</span>
						<ChevronDown
							className={cn(
								"size-3 text-muted-foreground transition-transform",
								isOpen && "rotate-180",
							)}
						/>
					</button>
					<ProblemsBadge count={summary.errorCount} tone="error" />
					<ProblemsBadge count={summary.warningCount} tone="warning" />
					<ProblemsBadge count={summary.infoCount} tone="information" />
					<ProblemsBadge count={summary.hintCount} tone="hint" />
				</div>
				<div className="truncate pl-3 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground/45">
					{relativePath}
				</div>
			</div>
			{isOpen ? (
				<div className="flex h-60 min-h-0 flex-col">
					<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-white/5 bg-[#0D0D0F] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/45 md:grid-cols-[minmax(0,1fr)_140px_120px]">
						<span>Problem</span>
						<span className="hidden md:block">Source</span>
						<span>Location</span>
					</div>
					<div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
						{!isLanguageServerEnabled ? (
							<div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
								Problems are available for JavaScript and TypeScript files in
								the current editor.
							</div>
						) : languageStatus ? (
							<div className="flex h-full items-center justify-center px-6 text-center text-sm text-amber-100">
								<div className="max-w-lg rounded-2xl border border-amber-300/20 bg-amber-300/10 px-5 py-4">
									<div className="font-semibold text-amber-50">
										Diagnostics unavailable
									</div>
									<div className="mt-2 text-amber-100/85">{languageStatus}</div>
								</div>
							</div>
						) : diagnostics.length === 0 ? (
							<div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
								No problems in the current file.
							</div>
						) : (
							<div className="divide-y divide-white/5">
								{diagnostics.map((diagnostic, index) => {
									const isActive = activeProblemIndex === index;
									const sourceLabel = [diagnostic.source, diagnostic.code]
										.filter(Boolean)
										.join(" ");

									return (
										<button
											key={getDiagnosticKey(diagnostic, index)}
											type="button"
											className={cn(
												"grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_140px_120px]",
												isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
											)}
											onClick={() => onSelectProblem(diagnostic, index)}
										>
											<div className="flex min-w-0 gap-2">
												<ProblemSeverityIcon
													severity={diagnostic.severity}
													className="mt-0.5 shrink-0"
												/>
												<div className="min-w-0">
													<div className="truncate text-sm text-zinc-100">
														{diagnostic.message}
													</div>
													<div className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground/45 md:hidden">
														{sourceLabel || "Language server"}
													</div>
												</div>
											</div>
											<div className="hidden truncate text-[11px] text-muted-foreground md:block">
												{sourceLabel || "Language server"}
											</div>
											<div className="text-right text-[11px] font-mono text-muted-foreground">
												{getDiagnosticLocationLabel(diagnostic)}
											</div>
										</button>
									);
								})}
							</div>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}

function toMonacoCompletionKind(kind?: number) {
	switch (kind) {
		case 2:
			return monaco.languages.CompletionItemKind.Method;
		case 3:
			return monaco.languages.CompletionItemKind.Function;
		case 4:
			return monaco.languages.CompletionItemKind.Constructor;
		case 5:
			return monaco.languages.CompletionItemKind.Field;
		case 6:
			return monaco.languages.CompletionItemKind.Variable;
		case 7:
			return monaco.languages.CompletionItemKind.Class;
		case 8:
			return monaco.languages.CompletionItemKind.Interface;
		case 9:
			return monaco.languages.CompletionItemKind.Module;
		case 10:
			return monaco.languages.CompletionItemKind.Property;
		case 11:
			return monaco.languages.CompletionItemKind.Unit;
		case 12:
			return monaco.languages.CompletionItemKind.Value;
		case 13:
			return monaco.languages.CompletionItemKind.Enum;
		case 14:
			return monaco.languages.CompletionItemKind.Keyword;
		case 15:
			return monaco.languages.CompletionItemKind.Snippet;
		case 16:
			return monaco.languages.CompletionItemKind.Color;
		case 17:
			return monaco.languages.CompletionItemKind.File;
		case 18:
			return monaco.languages.CompletionItemKind.Reference;
		case 19:
			return monaco.languages.CompletionItemKind.Folder;
		case 20:
			return monaco.languages.CompletionItemKind.EnumMember;
		case 21:
			return monaco.languages.CompletionItemKind.Constant;
		case 22:
			return monaco.languages.CompletionItemKind.Struct;
		case 23:
			return monaco.languages.CompletionItemKind.Event;
		case 24:
			return monaco.languages.CompletionItemKind.Operator;
		case 25:
			return monaco.languages.CompletionItemKind.TypeParameter;
		default:
			return monaco.languages.CompletionItemKind.Text;
	}
}

function toSuggestionRange(
	item: LanguageServerCompletionItem,
	model: monaco.editor.ITextModel,
	position: monaco.Position,
): monaco.IRange {
	if (item.range) {
		return toMonacoRange(item.range);
	}

	const word = model.getWordUntilPosition(position);

	return {
		endColumn: word.endColumn,
		endLineNumber: position.lineNumber,
		startColumn: word.startColumn,
		startLineNumber: position.lineNumber,
	};
}

async function ensureDefinitionTargetModel(
	targetUri: monaco.Uri,
	context: ModelContext,
) {
	const existingModel = monaco.editor.getModel(targetUri);

	if (existingModel) {
		return existingModel;
	}

	if (!targetUri.path.startsWith(context.projectPath)) {
		return null;
	}

	const relativePath = targetUri.path
		.slice(context.projectPath.length)
		.replace(/^\/+/, "");
	const file = await readProjectFile({
		data: {
			projectId: context.projectId,
			relativePath,
		},
	});

	if (file.kind !== "text") {
		return null;
	}

	const model = monaco.editor.createModel(
		file.content,
		getEditorLanguageId(relativePath),
		targetUri,
	);

	modelContextByUri.set(targetUri.toString(), {
		projectId: context.projectId,
		projectPath: context.projectPath,
		relativePath,
	});

	model.onWillDispose(() => {
		modelContextByUri.delete(targetUri.toString());
	});

	return model;
}

function getProtocolSnapshot(
	model: monaco.editor.ITextModel,
	context: ModelContext,
) {
	return {
		content: model.getValue(),
		projectId: context.projectId,
		relativePath: context.relativePath,
		version: model.getVersionId(),
	};
}

function registerLanguageProviders() {
	if (areProvidersRegistered) {
		return;
	}

	for (const language of SUPPORTED_PROVIDER_LANGUAGES) {
		monaco.languages.registerCompletionItemProvider(language, {
			provideCompletionItems: async (model, position) => {
				const context = modelContextByUri.get(model.uri.toString());

				if (!context || !getLanguageIdFromPath(context.relativePath)) {
					return { suggestions: [] };
				}

				const response = await getLanguageFileCompletions({
					data: {
						...getProtocolSnapshot(model, context),
						position: {
							character: position.column - 1,
							line: position.lineNumber - 1,
						},
					},
				});

				if (!response.isAvailable) {
					return { suggestions: [] };
				}

				return {
					suggestions: response.items.map((item) => ({
						detail: item.detail,
						documentation: item.documentation
							? { value: item.documentation }
							: undefined,
						filterText: item.filterText,
						insertText: item.insertText ?? item.label,
						kind: toMonacoCompletionKind(item.kind),
						label: item.label,
						range: toSuggestionRange(item, model, position),
						sortText: item.sortText,
					})),
				};
			},
		});

		monaco.languages.registerHoverProvider(language, {
			provideHover: async (model, position) => {
				const context = modelContextByUri.get(model.uri.toString());

				if (!context || !getLanguageIdFromPath(context.relativePath)) {
					return null;
				}

				const response = await getLanguageFileHover({
					data: {
						...getProtocolSnapshot(model, context),
						position: {
							character: position.column - 1,
							line: position.lineNumber - 1,
						},
					},
				});

				if (!response.isAvailable || response.contents.length === 0) {
					return null;
				}

				return {
					contents: response.contents.map((value) => ({ value })),
					range: response.range ? toMonacoRange(response.range) : undefined,
				};
			},
		});

		monaco.languages.registerDefinitionProvider(language, {
			provideDefinition: async (model, position) => {
				const context = modelContextByUri.get(model.uri.toString());

				if (!context || !getLanguageIdFromPath(context.relativePath)) {
					return [];
				}

				const response = await getLanguageFileDefinition({
					data: {
						...getProtocolSnapshot(model, context),
						position: {
							character: position.column - 1,
							line: position.lineNumber - 1,
						},
					},
				});

				if (!response.isAvailable || response.locations.length === 0) {
					return [];
				}

				return Promise.all(
					response.locations.map(async (location) => {
						const targetUri = monaco.Uri.parse(location.uri);

						await ensureDefinitionTargetModel(targetUri, context);

						return {
							range: toMonacoRange(location.range),
							uri: targetUri,
						};
					}),
				);
			},
		});
	}

	areProvidersRegistered = true;
}

export function MonacoFileEditor({
	className,
	onChange,
	onSave,
	projectId,
	projectPath,
	relativePath,
	value,
}: MonacoFileEditorProps) {
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
	const onSaveRef = useRef(onSave);
	const [diagnostics, setDiagnostics] = useState<LanguageServerDiagnostic[]>(
		[],
	);
	const [activeProblemIndex, setActiveProblemIndex] = useState<number | null>(
		null,
	);
	const [isProblemsOpen, setIsProblemsOpen] = useState(false);
	const [languageStatus, setLanguageStatus] = useState("");
	const modelPath = useMemo(
		() => monaco.Uri.file(`${projectPath}/${relativePath}`).toString(),
		[projectPath, relativePath],
	);
	const isLanguageServerEnabled = !!getLanguageIdFromPath(relativePath);

	useEffect(() => {
		if (!relativePath) {
			setDiagnostics([]);
			setActiveProblemIndex(null);
			return;
		}

		setDiagnostics([]);
		setActiveProblemIndex(null);
	}, [relativePath]);

	useEffect(() => {
		setActiveProblemIndex((currentIndex) => {
			if (currentIndex === null) {
				return null;
			}

			if (diagnostics.length === 0) {
				return null;
			}

			return Math.min(currentIndex, diagnostics.length - 1);
		});
	}, [diagnostics]);

	useEffect(() => {
		onSaveRef.current = onSave;
	}, [onSave]);

	useEffect(() => {
		const model = editorRef.current?.getModel();

		if (!model) {
			return;
		}

		modelContextByUri.set(model.uri.toString(), {
			projectId,
			projectPath,
			relativePath,
		});

		return () => {
			modelContextByUri.delete(model.uri.toString());
		};
	}, [projectId, projectPath, relativePath]);

	useEffect(() => {
		if (!isLanguageServerEnabled) {
			const model = editorRef.current?.getModel();

			if (model) {
				monaco.editor.setModelMarkers(model, LANGUAGE_MARKER_OWNER, []);
			}

			setDiagnostics([]);
			setLanguageStatus("");
			return;
		}

		const model = editorRef.current?.getModel();

		if (!model) {
			return;
		}

		let isCancelled = false;
		let timeoutId = 0;
		let latestRequestId = 0;

		const syncModel = () => {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(async () => {
				const requestId = ++latestRequestId;
				const response = await syncLanguageFile({
					data: {
						content: model.getValue(),
						projectId,
						relativePath,
						version: model.getVersionId(),
					},
				});

				if (
					isCancelled ||
					model.isDisposed() ||
					requestId !== latestRequestId
				) {
					return;
				}

				const nextDiagnostics = response.isAvailable
					? response.diagnostics
					: [];

				monaco.editor.setModelMarkers(
					model,
					LANGUAGE_MARKER_OWNER,
					nextDiagnostics.map(toMonacoMarker),
				);
				startTransition(() => {
					setDiagnostics(nextDiagnostics);
					setLanguageStatus(response.isAvailable ? "" : (response.error ?? ""));
				});
			}, 220);
		};

		const contentChangeDisposable = model.onDidChangeContent(() => {
			syncModel();
		});
		syncModel();

		return () => {
			isCancelled = true;
			latestRequestId += 1;
			window.clearTimeout(timeoutId);
			contentChangeDisposable.dispose();
		};
	}, [isLanguageServerEnabled, projectId, relativePath]);

	useEffect(() => {
		if (!isLanguageServerEnabled) {
			return;
		}

		return () => {
			void closeLanguageFile({
				data: {
					projectId,
					relativePath,
				},
			});
		};
	}, [isLanguageServerEnabled, projectId, relativePath]);

	const handleSelectProblem = (
		diagnostic: LanguageServerDiagnostic,
		index: number,
	) => {
		const editor = editorRef.current;

		if (!editor) {
			return;
		}

		const range = toMonacoRange(diagnostic.range);

		setActiveProblemIndex(index);
		editor.setSelection(range);
		editor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
		editor.focus();
	};

	return (
		<div className={cn("flex h-full min-h-0 flex-col bg-[#050507]", className)}>
			<div className={cn(MONACO_SURFACE_CLASSNAME, "min-h-0 flex-1")}>
				<Editor
					beforeMount={() => {
						registerLanguageProviders();
					}}
					loading={
						<div className="flex h-full items-center justify-center bg-[#101010] text-sm text-muted-foreground">
							<LoaderCircle className="mr-3 size-4 animate-spin" />
							Loading editor
						</div>
					}
					onChange={(nextValue) => {
						onChange(nextValue ?? "");
					}}
					onMount={(editorInstance) => {
						editorRef.current = editorInstance;
						editorInstance.addCommand(
							monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
							() => {
								onSaveRef.current();
							},
						);

						const model = editorInstance.getModel();

						if (!model) {
							return;
						}

						modelContextByUri.set(model.uri.toString(), {
							projectId,
							projectPath,
							relativePath,
						});
					}}
					options={{
						automaticLayout: true,
						border: "none",
						fontFamily: "JetBrains Mono, monospace",
						fontLigatures: true,
						fontSize: 13,
						lineHeight: 24,
						minimap: { enabled: false },
						padding: {
							bottom: 16,
							top: 16,
						},
						renderLineHighlight: "none",
						scrollBeyondLastLine: false,
						smoothScrolling: true,
						tabSize: 2,
						wordWrap: "off",
					}}
					path={modelPath}
					language={getEditorLanguageId(relativePath)}
					theme={MONACO_THEME}
					value={value}
				/>
				{languageStatus ? (
					<div className="pointer-events-none absolute right-4 bottom-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100 shadow-lg backdrop-blur-sm">
						{languageStatus}
					</div>
				) : null}
			</div>
			<ProblemsDock
				activeProblemIndex={activeProblemIndex}
				diagnostics={diagnostics}
				isLanguageServerEnabled={isLanguageServerEnabled}
				isOpen={isProblemsOpen}
				languageStatus={languageStatus}
				onSelectProblem={handleSelectProblem}
				onToggle={() => setIsProblemsOpen((isOpen) => !isOpen)}
				relativePath={relativePath}
			/>
		</div>
	);
}
