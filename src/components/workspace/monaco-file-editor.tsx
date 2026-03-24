import Editor, { loader } from "@monaco-editor/react";
import { LoaderCircle } from "lucide-react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/less/less.contribution";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import "monaco-editor/esm/vs/basic-languages/scss/scss.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
	getLanguageIdFromPath,
	getMonacoLanguageIdFromPath,
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

declare global {
	interface Window {
		MonacoEnvironment?: {
			getWorker: (_workerId: string, label: string) => Worker;
		};
	}
}

const LANGUAGE_MARKER_OWNER = "craftdesk-lsp";
const SUPPORTED_PROVIDER_LANGUAGES = ["javascript", "typescript"] as const;
const modelContextByUri = new Map<string, ModelContext>();
const VESPER_THEME = "craftdesk-vesper";

let isMonacoConfigured = false;
let areProvidersRegistered = false;

const VESPER_THEME_COLORS: monaco.editor.IColors = {
	"diffEditor.insertedLineBackground": "#99FFE415",
	"diffEditor.insertedTextBackground": "#99FFE415",
	"diffEditor.removedLineBackground": "#FF808015",
	"diffEditor.removedTextBackground": "#FF808015",
	"editor.background": "#101010",
	"editor.foreground": "#FFFFFF",
	"editor.selectionBackground": "#FFFFFF25",
	"editor.selectionHighlightBackground": "#FFFFFF25",
	"editorBracketHighlight.foreground1": "#A0A0A0",
	"editorBracketHighlight.foreground2": "#A0A0A0",
	"editorBracketHighlight.foreground3": "#A0A0A0",
	"editorBracketHighlight.foreground4": "#A0A0A0",
	"editorBracketHighlight.foreground5": "#A0A0A0",
	"editorBracketHighlight.foreground6": "#A0A0A0",
	"editorBracketHighlight.unexpectedBracket.foreground": "#FF8080",
	"editorError.foreground": "#FF8080",
	"editorGutter.addedBackground": "#99FFE4",
	"editorGutter.background": "#101010",
	"editorGutter.deletedBackground": "#FF8080",
	"editorGutter.modifiedBackground": "#FFC799",
	"editorHoverWidget.background": "#161616",
	"editorHoverWidget.border": "#282828",
	"editorInlayHint.background": "#1C1C1C",
	"editorInlayHint.foreground": "#A0A0A0",
	"editorLineNumber.activeForeground": "#A0A0A0",
	"editorLineNumber.foreground": "#505050",
	"editorOverviewRuler.border": "#101010",
	"editorWarning.foreground": "#FFC799",
	"editorWidget.background": "#101010",
	focusBorder: "#FFC799",
	"list.activeSelectionBackground": "#232323",
	"list.activeSelectionForeground": "#FFC799",
	"list.errorForeground": "#FF8080",
	"list.highlightForeground": "#FFC799",
	"list.hoverBackground": "#282828",
	"list.inactiveSelectionBackground": "#232323",
	"minimap.background": "#101010",
	"scrollbar.shadow": "#101010",
	"scrollbarSlider.background": "#34343480",
	"scrollbarSlider.hoverBackground": "#343434",
	"textLink.activeForeground": "#FFCFA8",
	"textLink.foreground": "#FFC799",
};

const VESPER_TOKEN_RULES: monaco.editor.ITokenThemeRule[] = [
	{ foreground: "8B8B8B94", token: "comment" },
	{ foreground: "A0A0A0", token: "comment.doc" },
	{ foreground: "FF8080", token: "invalid" },
	{ foreground: "A0A0A0", token: "keyword" },
	{ foreground: "A0A0A0", token: "keyword.control" },
	{ foreground: "A0A0A0", token: "storage" },
	{ foreground: "A0A0A0", token: "operator" },
	{ foreground: "A0A0A0", token: "delimiter" },
	{ foreground: "A0A0A0", token: "delimiter.bracket" },
	{ foreground: "A0A0A0", token: "delimiter.array" },
	{ foreground: "A0A0A0", token: "delimiter.parenthesis" },
	{ foreground: "A0A0A0", token: "delimiter.curly" },
	{ foreground: "FFFFFF", token: "variable" },
	{ foreground: "FFFFFF", token: "identifier" },
	{ foreground: "FFFFFF", token: "variable.parameter" },
	{ foreground: "A0A0A0", token: "variable.language" },
	{ foreground: "FFC799", token: "number" },
	{ foreground: "FFC799", token: "number.hex" },
	{ foreground: "FFC799", token: "constant" },
	{ foreground: "FFC799", token: "constant.numeric" },
	{ foreground: "FFC799", token: "constant.language" },
	{ foreground: "FFC799", token: "constant.language.boolean" },
	{ foreground: "A0A0A0", token: "regexp" },
	{ foreground: "99FFE4", token: "string" },
	{ foreground: "A0A0A0", token: "string.escape" },
	{ foreground: "FFC799", token: "type" },
	{ foreground: "FFC799", token: "type.identifier" },
	{ foreground: "FFC799", token: "typeParameter" },
	{ foreground: "FFC799", token: "tag" },
	{ foreground: "FFC799", token: "tag.id" },
	{ foreground: "FFC799", token: "tag.class" },
	{ foreground: "A0A0A0", token: "attribute.name" },
	{ foreground: "FFC799", token: "attribute.name.html" },
	{ foreground: "A0A0A0", token: "attribute.value" },
	{ foreground: "FFFFFF", token: "attribute.name.css" },
	{ foreground: "FFFFFF", token: "attribute.value.css" },
	{ foreground: "FFFFFF", token: "property.name" },
	{ foreground: "FFFFFF", token: "property.value" },
	{ foreground: "FFC799", token: "key" },
	{ foreground: "FFC799", token: "string.key.json" },
	{ foreground: "FFC799", token: "constructor" },
	{ foreground: "FFC799", token: "namespace" },
	{ foreground: "FFC799", token: "class" },
	{ foreground: "FFC799", token: "function" },
	{ foreground: "FFC799", token: "function.call" },
	{ foreground: "FFC799", token: "method" },
	{ foreground: "FFC799", token: "method.call" },
	{ foreground: "FFC799", token: "predefined" },
];

function configureMonacoEnvironment() {
	if (isMonacoConfigured || typeof window === "undefined") {
		return;
	}

	window.MonacoEnvironment = {
		getWorker: (_workerId, label) => {
			if (label === "json") {
				return new jsonWorker();
			}

			return new editorWorker();
		},
	};
	loader.config({ monaco });
	monaco.editor.defineTheme(VESPER_THEME, {
		base: "vs-dark",
		colors: VESPER_THEME_COLORS,
		inherit: true,
		rules: VESPER_TOKEN_RULES,
	});
	isMonacoConfigured = true;
}

function getEditorLanguageId(relativePath: string) {
	return getMonacoLanguageIdFromPath(relativePath);
}

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

configureMonacoEnvironment();

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
		<div
			className={cn(
				"relative h-full min-h-[260px] bg-[#101010] [&_.current-line]:!border-transparent [&_.margin]:!bg-[#101010] [&_.minimap]:!bg-[#101010] [&_.monaco-editor-background]:!bg-[#101010] [&_.monaco-editor]:!bg-[#101010] [&_.monaco-scrollable-element_.scrollbar_.shadow]:!bg-[#101010] [&_.view-overlays_.current-line]:!border-transparent",
				className,
			)}
		>
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
				theme={VESPER_THEME}
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
