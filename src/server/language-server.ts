import { createServerFn } from "@tanstack/react-start";

import type {
	LanguageDocumentPositionInput,
	LanguageDocumentSyncInput,
} from "#/lib/language-server";

export const syncLanguageFile = createServerFn({ method: "POST" })
	.inputValidator((input: LanguageDocumentSyncInput) => input)
	.handler(async ({ data }) => {
		const { syncLanguageDocument } = await import(
			"#/server/language-server-manager"
		);
		return syncLanguageDocument(data);
	});

export const closeLanguageFile = createServerFn({ method: "POST" })
	.inputValidator(
		(input: Pick<LanguageDocumentSyncInput, "projectId" | "relativePath">) =>
			input,
	)
	.handler(async ({ data }) => {
		const { closeLanguageDocument } = await import(
			"#/server/language-server-manager"
		);
		return closeLanguageDocument(data);
	});

export const getLanguageFileHover = createServerFn({ method: "POST" })
	.inputValidator((input: LanguageDocumentPositionInput) => input)
	.handler(async ({ data }) => {
		const { getLanguageHover } = await import(
			"#/server/language-server-manager"
		);
		return getLanguageHover(data);
	});

export const getLanguageFileCompletions = createServerFn({ method: "POST" })
	.inputValidator((input: LanguageDocumentPositionInput) => input)
	.handler(async ({ data }) => {
		const { getLanguageCompletions } = await import(
			"#/server/language-server-manager"
		);
		return getLanguageCompletions(data);
	});

export const getLanguageFileDefinition = createServerFn({ method: "POST" })
	.inputValidator((input: LanguageDocumentPositionInput) => input)
	.handler(async ({ data }) => {
		const { getLanguageDefinition } = await import(
			"#/server/language-server-manager"
		);
		return getLanguageDefinition(data);
	});
