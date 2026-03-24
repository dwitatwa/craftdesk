import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
	BinaryProjectFileContent,
	CreateProjectFileInput,
	ImageProjectFileContent,
	ProjectFileContent,
	ProjectFileEntry,
	ProjectFileLookupInput,
	ProjectFileMutationInput,
	ProjectFileSearchResult,
	SearchProjectFilesInput,
	TextProjectFileContent,
	UpdateProjectFileInput,
} from "#/lib/craftdesk";
import { notifyProjectFileChange } from "#/server/language-server-manager";
import { resolveProjectPath } from "#/server/project-paths";

const TREE_IGNORED_DIRECTORY_NAMES = new Set([".git"]);
const SEARCH_IGNORED_DIRECTORY_NAMES = new Set([".git", "node_modules"]);
const MIME_TYPES_BY_EXTENSION = new Map([
	[".apng", "image/apng"],
	[".avif", "image/avif"],
	[".bmp", "image/bmp"],
	[".gif", "image/gif"],
	[".ico", "image/x-icon"],
	[".jpeg", "image/jpeg"],
	[".jpg", "image/jpeg"],
	[".png", "image/png"],
	[".svg", "image/svg+xml"],
	[".webp", "image/webp"],
]);

export async function listProjectDirectoryEntries(
	input: ProjectFileLookupInput,
): Promise<ProjectFileEntry[]> {
	const { absolutePath, relativePath } = resolveProjectPath(
		input.projectId,
		input.relativePath,
	);
	const directoryStat = await stat(absolutePath).catch(() => null);

	if (!directoryStat) {
		throw new Error("Directory not found.");
	}

	if (!directoryStat.isDirectory()) {
		throw new Error("Requested path is not a directory.");
	}

	const entries = await readdir(absolutePath, { withFileTypes: true });

	return entries
		.filter((entry) =>
			entry.isDirectory()
				? !TREE_IGNORED_DIRECTORY_NAMES.has(entry.name)
				: true,
		)
		.map((entry) => {
			const entryRelativePath = [relativePath, entry.name]
				.filter(Boolean)
				.join("/");

			return {
				name: entry.name,
				relativePath: entryRelativePath,
				kind: entry.isDirectory() ? "directory" : "file",
				hasChildren: entry.isDirectory() ? true : undefined,
			} satisfies ProjectFileEntry;
		})
		.sort((left, right) => {
			if (left.kind !== right.kind) {
				return left.kind === "directory" ? -1 : 1;
			}

			return left.name.localeCompare(right.name, undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
}

export async function searchProjectFiles(
	input: SearchProjectFilesInput,
): Promise<ProjectFileSearchResult[]> {
	const query = input.query.trim().toLowerCase();

	if (!query) {
		return [];
	}

	const { absolutePath } = resolveProjectPath(input.projectId);
	const matches: ProjectFileSearchResult[] = [];

	await collectMatchingProjectFiles({
		absoluteDirectoryPath: absolutePath,
		matches,
		query,
		relativeDirectoryPath: "",
	});

	return matches.sort((left, right) => {
		const leftNameMatch = left.name.toLowerCase().includes(query);
		const rightNameMatch = right.name.toLowerCase().includes(query);

		if (leftNameMatch !== rightNameMatch) {
			return leftNameMatch ? -1 : 1;
		}

		const byName = left.name.localeCompare(right.name, undefined, {
			numeric: true,
			sensitivity: "base",
		});

		if (byName !== 0) {
			return byName;
		}

		return left.relativePath.localeCompare(right.relativePath, undefined, {
			numeric: true,
			sensitivity: "base",
		});
	});
}

export async function readProjectFileContent(
	input: ProjectFileMutationInput,
): Promise<ProjectFileContent> {
	const { absolutePath, relativePath } = resolveProjectPath(
		input.projectId,
		input.relativePath,
	);
	const fileStat = await stat(absolutePath).catch(() => null);

	if (!fileStat) {
		throw new Error("File not found.");
	}

	if (!fileStat.isFile()) {
		throw new Error("Requested path is not a file.");
	}

	const fileBuffer = await readFile(absolutePath);
	const baseFile = {
		name: path.basename(absolutePath),
		relativePath,
		size: fileBuffer.byteLength,
	};
	const mimeType = getMimeTypeForPath(absolutePath);

	if (isPreviewableImageMimeType(mimeType)) {
		return {
			...baseFile,
			kind: "image",
			base64Content: fileBuffer.toString("base64"),
			mimeType,
		} satisfies ImageProjectFileContent;
	}

	if (fileBuffer.includes(0)) {
		return {
			...baseFile,
			kind: "binary",
			mimeType,
		} satisfies BinaryProjectFileContent;
	}

	return {
		...baseFile,
		kind: "text",
		content: fileBuffer.toString("utf8"),
	} satisfies TextProjectFileContent;
}

export async function createProjectFile(
	input: CreateProjectFileInput,
): Promise<ProjectFileContent> {
	const { absolutePath, relativePath } = resolveProjectPath(
		input.projectId,
		input.relativePath,
	);

	if (!relativePath) {
		throw new Error("File path is required.");
	}

	await mkdir(path.dirname(absolutePath), { recursive: true });
	const fileContent = getFileContentBuffer(input);

	try {
		await writeFile(absolutePath, fileContent, { flag: "wx" });
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "EEXIST"
		) {
			throw new Error("A file already exists at that path.");
		}

		throw error;
	}

	const createdFile = await readProjectFileContent({
		projectId: input.projectId,
		relativePath,
	});

	void notifyProjectFileChange({
		projectId: input.projectId,
		relativePath,
		type: "created",
	});

	return createdFile;
}

export async function deleteProjectFile(
	input: ProjectFileMutationInput,
): Promise<void> {
	const { absolutePath } = resolveProjectPath(
		input.projectId,
		input.relativePath,
	);
	const fileStat = await stat(absolutePath).catch(() => null);

	if (!fileStat) {
		throw new Error("File not found.");
	}

	if (!fileStat.isFile()) {
		throw new Error("Only files can be deleted from the explorer.");
	}

	await rm(absolutePath);
	void notifyProjectFileChange({
		projectId: input.projectId,
		relativePath: input.relativePath,
		type: "deleted",
	});
}

export async function updateProjectFileContent(
	input: UpdateProjectFileInput,
): Promise<TextProjectFileContent> {
	const { absolutePath, relativePath } = resolveProjectPath(
		input.projectId,
		input.relativePath,
	);
	const fileStat = await stat(absolutePath).catch(() => null);

	if (!fileStat) {
		throw new Error("File not found.");
	}

	if (!fileStat.isFile()) {
		throw new Error("Requested path is not a file.");
	}

	const existingFile = await readProjectFileContent({
		projectId: input.projectId,
		relativePath,
	});

	if (existingFile.kind !== "text") {
		throw new Error("Only text files can be edited in the file pane.");
	}

	await writeFile(absolutePath, input.content, { encoding: "utf8" });

	const updatedFile = await readProjectFileContent({
		projectId: input.projectId,
		relativePath,
	});

	if (updatedFile.kind !== "text") {
		throw new Error("File contents could not be reloaded after saving.");
	}

	void notifyProjectFileChange({
		projectId: input.projectId,
		relativePath,
		type: "changed",
	});

	return updatedFile;
}

async function collectMatchingProjectFiles({
	absoluteDirectoryPath,
	matches,
	query,
	relativeDirectoryPath,
}: {
	absoluteDirectoryPath: string;
	matches: ProjectFileSearchResult[];
	query: string;
	relativeDirectoryPath: string;
}) {
	const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (SEARCH_IGNORED_DIRECTORY_NAMES.has(entry.name)) {
				continue;
			}

			const entryRelativePath = [relativeDirectoryPath, entry.name]
				.filter(Boolean)
				.join("/");

			await collectMatchingProjectFiles({
				absoluteDirectoryPath: path.join(absoluteDirectoryPath, entry.name),
				matches,
				query,
				relativeDirectoryPath: entryRelativePath,
			});
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const entryRelativePath = [relativeDirectoryPath, entry.name]
			.filter(Boolean)
			.join("/");
		const normalizedEntryPath = entryRelativePath.toLowerCase();

		if (!normalizedEntryPath.includes(query)) {
			continue;
		}

		matches.push({
			name: entry.name,
			relativePath: entryRelativePath,
		});
	}
}

function getMimeTypeForPath(filePath: string) {
	return (
		MIME_TYPES_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? null
	);
}

function isPreviewableImageMimeType(
	mimeType: string | null,
): mimeType is string {
	return (
		!!mimeType && mimeType.startsWith("image/") && mimeType !== "image/svg+xml"
	);
}

function getFileContentBuffer(input: CreateProjectFileInput) {
	if (input.base64Content) {
		return Buffer.from(input.base64Content, "base64");
	}

	if (input.content) {
		return Buffer.from(input.content, "utf8");
	}

	return Buffer.alloc(0);
}
