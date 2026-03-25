import { loader } from "@monaco-editor/react";
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

import { getMonacoLanguageIdFromPath } from "#/lib/language-server";

declare global {
	interface Window {
		MonacoEnvironment?: {
			getWorker: (_workerId: string, label: string) => Worker;
		};
	}
}

export const MONACO_THEME = "craftdesk-vesper";
export const MONACO_SURFACE_CLASSNAME =
	"relative h-full min-h-[260px] bg-[#101010] [&_.current-line]:!border-transparent [&_.margin]:!bg-[#101010] [&_.minimap]:!bg-[#101010] [&_.monaco-diff-editor_.diffOverview]:!bg-[#101010] [&_.monaco-editor-background]:!bg-[#101010] [&_.monaco-editor]:!bg-[#101010] [&_.monaco-scrollable-element_.scrollbar_.shadow]:!bg-[#101010] [&_.view-overlays_.current-line]:!border-transparent";

let isMonacoConfigured = false;

const VESPER_THEME_COLORS: monaco.editor.IColors = {
	"diffEditor.insertedLineBackground": "#99FFE415",
	"diffEditorOverview.insertedForeground": "#99FFE466",
	"diffEditor.insertedTextBackground": "#99FFE415",
	"diffEditor.removedLineBackground": "#FF808015",
	"diffEditorOverview.removedForeground": "#FF808066",
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

export function configureMonacoEnvironment() {
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
	monaco.editor.defineTheme(MONACO_THEME, {
		base: "vs-dark",
		colors: VESPER_THEME_COLORS,
		inherit: true,
		rules: VESPER_TOKEN_RULES,
	});
	isMonacoConfigured = true;
}

export function getEditorLanguageId(relativePath: string) {
	return getMonacoLanguageIdFromPath(relativePath);
}

configureMonacoEnvironment();

export { monaco };
