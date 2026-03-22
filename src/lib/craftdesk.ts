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
	notes: string;
	projectId: string;
	columnId: string;
	position: number;
	createdAt: string;
	doneAt: string | null;
	isRunning?: boolean;
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
	notes: string;
	projectId: string;
	projectName: string;
	projectPath: string;
	columnId: string;
	columnTitle: string;
	createdAt: string;
	doneAt: string | null;
	isRunning?: boolean;
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
}

export interface DeleteTaskInput {
	taskId: string;
}

export interface MoveTaskInput {
	projectId: string;
	taskId: string;
	targetColumnId: string;
}

export interface DeleteProjectInput {
	projectId: string;
}

export interface ProjectLookupInput {
	projectId: string;
}

export interface TaskLookupInput {
	taskId: string;
}

export interface UpdateTaskNotesInput {
	taskId: string;
	notes: string;
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
	const cleanedPath = path.trim().replace(/[\\/]+$/g, "");
	const normalizedSeparators = cleanedPath.replace(/\\/g, "/");
	const lastSegment =
		normalizedSeparators.split("/").filter(Boolean).pop() ?? cleanedPath;

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
