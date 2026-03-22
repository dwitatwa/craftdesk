export interface ProjectSummary {
	id: string;
	name: string;
	path: string;
	taskCount: number;
	activeSessions: number;
	lastOpenedAt: string;
}

export interface BoardTask {
	id: string;
	title: string;
	description: string;
	projectId: string;
	columnId: string;
	createdAt: string;
	doneAt: string | null;
}

export interface BoardColumn {
	id: string;
	title: string;
	position: number;
	tasks: BoardTask[];
}

export interface ProjectWorkspace {
	project: ProjectSummary;
	columns: BoardColumn[];
}

export interface TaskDetail {
	id: string;
	title: string;
	description: string;
	projectId: string;
	projectName: string;
	projectPath: string;
	columnId: string;
	columnTitle: string;
	createdAt: string;
	doneAt: string | null;
}

export interface SaveProjectInput {
	name: string;
	path: string;
}

export interface ListProjectsInput {
	sortBy?: "recent" | "name";
}

export interface CreateColumnInput {
	projectId: string;
	title: string;
}

export interface DeleteColumnInput {
	projectId: string;
	columnId: string;
}

export interface CreateTaskInput {
	projectId: string;
	columnId: string;
	title: string;
	description: string;
}

export interface DeleteTaskInput {
	taskId: string;
}

export interface ProjectLookupInput {
	projectId: string;
}

export interface TaskLookupInput {
	taskId: string;
}

const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]+/g;

export function slugifyProjectId(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(NON_ALPHANUMERIC_REGEX, "-")
		.replace(/^-+|-+$/g, "");
}

export function deriveProjectNameFromPath(path: string) {
	const cleanedPath = path.trim().replace(/\/+$/g, "");
	const lastSegment =
		cleanedPath.split("/").filter(Boolean).pop() ?? cleanedPath;

	return titleizeSegment(lastSegment || "Project");
}

function titleizeSegment(value: string) {
	return value
		.replace(/[-_]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
