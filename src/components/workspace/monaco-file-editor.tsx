import Editor from "@monaco-editor/react";
import { LoaderCircle } from "lucide-react";
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
	const [languageStatus, setLanguageStatus] = useState("");
	const modelPath = useMemo(
		() => monaco.Uri.file(`${projectPath}/${relativePath}`).toString(),
		[projectPath, relativePath],
	);
	const isLanguageServerEnabled = !!getLanguageIdFromPath(relativePath);

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

			setLanguageStatus("");
			return;
		}

		const model = editorRef.current?.getModel();

		if (!model) {
			return;
		}

		let isCancelled = false;
		let timeoutId = 0;

		const syncModel = () => {
			window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(async () => {
				const response = await syncLanguageFile({
					data: {
						content: model.getValue(),
						projectId,
						relativePath,
						version: model.getVersionId(),
					},
				});

				if (isCancelled || model.isDisposed()) {
					return;
				}

				monaco.editor.setModelMarkers(
					model,
					LANGUAGE_MARKER_OWNER,
					response.isAvailable ? response.diagnostics.map(toMonacoMarker) : [],
				);
				startTransition(() => {
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

	return (
		<div className={cn(MONACO_SURFACE_CLASSNAME, className)}>
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
							onSave();
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
	);
}
