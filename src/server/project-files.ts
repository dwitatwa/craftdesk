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
	CreateProjectFileInput,
	ProjectFileContent,
	ProjectFileEntry,
	ProjectFileLookupInput,
	ProjectFileMutationInput,
} from "#/lib/craftdesk";
import { getProjectSummary } from "#/server/db";

const IGNORED_DIRECTORY_NAMES = new Set([".git", "node_modules"]);

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

	if (fileBuffer.includes(0)) {
		throw new Error("Binary files are not supported in preview.");
	}

	return {
		name: path.basename(absolutePath),
		relativePath,
		content: fileBuffer.toString("utf8"),
	};
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

	try {
		await writeFile(absolutePath, input.content ?? "", {
			encoding: "utf8",
			flag: "wx",
		});
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

	return {
		name: path.basename(absolutePath),
		relativePath,
		content: input.content ?? "",
	};
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
