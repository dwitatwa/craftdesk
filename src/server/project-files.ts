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
	TextProjectFileContent,
	UpdateProjectFileInput,
} from "#/lib/craftdesk";
import { getProjectSummary } from "#/server/db";

const IGNORED_DIRECTORY_NAMES = new Set([".git", "node_modules"]);
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

function normalizeRelativePath(relativePath?: string) {
	return (relativePath ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function getProjectRoot(projectId: string) {
	const project = getProjectSummary(projectId);

	if (!project) {
		throw new Error("Project not found.");
	}

	return path.resolve(project.path);
}

function resolveProjectPath(projectId: string, relativePath?: string) {
	const projectRoot = getProjectRoot(projectId);
	const normalizedRelativePath = normalizeRelativePath(relativePath);
	const absolutePath = path.resolve(projectRoot, normalizedRelativePath);
	const isProjectRoot = absolutePath === projectRoot;
	const isChildPath = absolutePath.startsWith(`${projectRoot}${path.sep}`);

	if (!isProjectRoot && !isChildPath) {
		throw new Error("Path must stay within the selected project.");
	}

	return {
		projectRoot,
		absolutePath,
		relativePath: normalizedRelativePath,
	};
}

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
			entry.isDirectory() ? !IGNORED_DIRECTORY_NAMES.has(entry.name) : true,
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

	return readProjectFileContent({
		projectId: input.projectId,
		relativePath,
	});
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

	return updatedFile;
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
