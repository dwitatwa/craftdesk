import path from "node:path";

import { getProjectSummary } from "#/server/db";

export function normalizeRelativePath(relativePath?: string) {
	return (relativePath ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function getProjectRoot(projectId: string) {
	const project = getProjectSummary(projectId);

	if (!project) {
		throw new Error("Project not found.");
	}

	return path.resolve(project.path);
}

export function resolveProjectPath(projectId: string, relativePath?: string) {
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
