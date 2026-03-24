export type SupportedLanguageId =
	| "javascript"
	| "javascriptreact"
	| "typescript"
	| "typescriptreact";

export interface LanguageServerPosition {
	line: number;
	character: number;
}

export interface LanguageServerRange {
	start: LanguageServerPosition;
	end: LanguageServerPosition;
}

export interface LanguageDocumentSyncInput {
	content: string;
	projectId: string;
	relativePath: string;
	version: number;
}

export interface LanguageDocumentPositionInput
	extends LanguageDocumentSyncInput {
	position: LanguageServerPosition;
}

export type LanguageServerDiagnosticSeverity =
	| "error"
	| "warning"
	| "information"
	| "hint";

export interface LanguageServerDiagnostic {
	code?: string;
	message: string;
	range: LanguageServerRange;
	severity: LanguageServerDiagnosticSeverity;
	source?: string;
}

export interface LanguageServerCompletionItem {
	detail?: string;
	documentation?: string;
	filterText?: string;
	insertText?: string;
	kind?: number;
	label: string;
	range?: LanguageServerRange | null;
	sortText?: string;
}

export interface LanguageServerLocation {
	range: LanguageServerRange;
	uri: string;
}

interface LanguageServerResponseBase {
	error?: string;
	isAvailable: boolean;
}

export interface LanguageServerDiagnosticsResponse
	extends LanguageServerResponseBase {
	diagnostics: LanguageServerDiagnostic[];
}

export interface LanguageServerHoverResponse
	extends LanguageServerResponseBase {
	contents: string[];
	range: LanguageServerRange | null;
}

export interface LanguageServerCompletionResponse
	extends LanguageServerResponseBase {
	isIncomplete: boolean;
	items: LanguageServerCompletionItem[];
}

export interface LanguageServerDefinitionResponse
	extends LanguageServerResponseBase {
	locations: LanguageServerLocation[];
}

const LANGUAGE_ID_BY_EXTENSION = new Map<string, SupportedLanguageId>([
	["cjs", "javascript"],
	["cts", "typescript"],
	["js", "javascript"],
	["jsx", "javascriptreact"],
	["mjs", "javascript"],
	["mts", "typescript"],
	["ts", "typescript"],
	["tsx", "typescriptreact"],
]);

const MONACO_LANGUAGE_ID_BY_EXTENSION = new Map<string, string>([
	["cjs", "javascript"],
	["css", "css"],
	["cts", "typescript"],
	["html", "html"],
	["htm", "html"],
	["js", "javascript"],
	["json", "json"],
	["jsx", "javascript"],
	["less", "less"],
	["md", "markdown"],
	["mdx", "markdown"],
	["mjs", "javascript"],
	["mts", "typescript"],
	["scss", "scss"],
	["ts", "typescript"],
	["tsx", "typescript"],
]);

function getPathExtension(relativePath: string) {
	const normalizedPath = relativePath
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "");
	const lastDotIndex = normalizedPath.lastIndexOf(".");

	if (lastDotIndex === -1) {
		return null;
	}

	return normalizedPath.slice(lastDotIndex + 1).toLowerCase();
}

export function getLanguageIdFromPath(
	relativePath: string,
): SupportedLanguageId | null {
	const extension = getPathExtension(relativePath);

	if (!extension) {
		return null;
	}

	return LANGUAGE_ID_BY_EXTENSION.get(extension) ?? null;
}

export function getMonacoLanguageId(languageId: SupportedLanguageId) {
	return languageId.startsWith("typescript") ? "typescript" : "javascript";
}

export function getMonacoLanguageIdFromPath(relativePath: string) {
	const extension = getPathExtension(relativePath);

	if (!extension) {
		return "plaintext";
	}

	return MONACO_LANGUAGE_ID_BY_EXTENSION.get(extension) ?? "plaintext";
}
