import { createServerFn } from "@tanstack/react-start";

import type {
	CreateColumnInput,
	CreateProjectFileInput,
	CreateTaskInput,
	DeleteColumnInput,
	DeleteProjectInput,
	DeleteTaskInput,
	HideCurrentDoneTaskInput,
	ListProjectsInput,
	MoveTaskInput,
	ProjectFileLookupInput,
	ProjectFileMutationInput,
	ProjectLookupInput,
	SaveProjectInput,
	TaskLookupInput,
	UpdateProjectFileInput,
	UpdateTaskInput,
	UpdateTaskNotesInput,
} from "#/lib/craftdesk";

export const listProjects = createServerFn({ method: "GET" })
	.inputValidator((input: ListProjectsInput | undefined) => input)
	.handler(async ({ data }) => {
		const { listProjects: listProjectsFromDb } = await import("#/server/db");
		return listProjectsFromDb(data);
	});

export const saveProject = createServerFn({ method: "POST" })
	.inputValidator((input: SaveProjectInput) => input)
	.handler(async ({ data }) => {
		const { saveProject: saveProjectToDb } = await import("#/server/db");
		return saveProjectToDb(data);
	});

export const pickProjectDirectory = createServerFn({ method: "POST" }).handler(
	async () => {
		const { pickDirectoryPath } = await import("#/server/folder-picker");
		return pickDirectoryPath();
	},
);

export const getProjectWorkspace = createServerFn({ method: "GET" })
	.inputValidator((input: ProjectLookupInput) => input)
	.handler(async ({ data }) => {
		const { getProjectWorkspace: getProjectWorkspaceFromDb } = await import(
			"#/server/db"
		);
		return getProjectWorkspaceFromDb(data.projectId);
	});

export const listProjectDirectory = createServerFn({ method: "GET" })
	.inputValidator((input: ProjectFileLookupInput) => input)
	.handler(async ({ data }) => {
		const { listProjectDirectoryEntries } = await import(
			"#/server/project-files"
		);
		return listProjectDirectoryEntries(data);
	});

export const readProjectFile = createServerFn({ method: "GET" })
	.inputValidator((input: ProjectFileMutationInput) => input)
	.handler(async ({ data }) => {
		const { readProjectFileContent } = await import("#/server/project-files");
		return readProjectFileContent(data);
	});

export const createProjectFile = createServerFn({ method: "POST" })
	.inputValidator((input: CreateProjectFileInput) => input)
	.handler(async ({ data }) => {
		const { createProjectFile: createProjectFileOnDisk } = await import(
			"#/server/project-files"
		);
		return createProjectFileOnDisk(data);
	});

export const deleteProjectFile = createServerFn({ method: "POST" })
	.inputValidator((input: ProjectFileMutationInput) => input)
	.handler(async ({ data }) => {
		const { deleteProjectFile: deleteProjectFileOnDisk } = await import(
			"#/server/project-files"
		);
		return deleteProjectFileOnDisk(data);
	});

export const updateProjectFile = createServerFn({ method: "POST" })
	.inputValidator((input: UpdateProjectFileInput) => input)
	.handler(async ({ data }) => {
		const { updateProjectFileContent } = await import("#/server/project-files");
		return updateProjectFileContent(data);
	});

export const createColumn = createServerFn({ method: "POST" })
	.inputValidator((input: CreateColumnInput) => input)
	.handler(async ({ data }) => {
		const { createColumn: createColumnInDb } = await import("#/server/db");
		return createColumnInDb(data);
	});

export const deleteColumn = createServerFn({ method: "POST" })
	.inputValidator((input: DeleteColumnInput) => input)
	.handler(async ({ data }) => {
		const { deleteColumn: deleteColumnInDb } = await import("#/server/db");
		return deleteColumnInDb(data);
	});

export const createTask = createServerFn({ method: "POST" })
	.inputValidator((input: CreateTaskInput) => input)
	.handler(async ({ data }) => {
		const { createTask: createTaskInDb } = await import("#/server/db");
		return createTaskInDb(data);
	});

export const updateTaskNotes = createServerFn({ method: "POST" })
	.inputValidator((input: UpdateTaskNotesInput) => input)
	.handler(async ({ data }) => {
		const { updateTaskNotes: updateTaskNotesInDb } = await import(
			"#/server/db"
		);
		return updateTaskNotesInDb(data);
	});

export const updateTask = createServerFn({ method: "POST" })
	.inputValidator((input: UpdateTaskInput) => input)
	.handler(async ({ data }) => {
		const { updateTask: updateTaskInDb } = await import("#/server/db");
		return updateTaskInDb(data);
	});

export const deleteTask = createServerFn({ method: "POST" })
	.inputValidator((input: DeleteTaskInput) => input)
	.handler(async ({ data }) => {
		const { deleteTask: deleteTaskInDb } = await import("#/server/db");
		return deleteTaskInDb(data);
	});

export const moveTask = createServerFn({ method: "POST" })
	.inputValidator((input: MoveTaskInput) => input)
	.handler(async ({ data }) => {
		const { moveTask: moveTaskInDb } = await import("#/server/db");
		return moveTaskInDb(data);
	});

export const deleteProject = createServerFn({ method: "POST" })
	.inputValidator((input: DeleteProjectInput) => input)
	.handler(async ({ data }) => {
		const { deleteProject: deleteProjectInDb } = await import("#/server/db");
		return deleteProjectInDb(data);
	});

export const hideCurrentDoneTask = createServerFn({ method: "POST" })
	.inputValidator((input: HideCurrentDoneTaskInput) => input)
	.handler(async ({ data }) => {
		const { hideCurrentDoneTask: hideCurrentDoneTaskInDb } = await import(
			"#/server/db"
		);
		return hideCurrentDoneTaskInDb(data);
	});

export const getTaskDetail = createServerFn({ method: "GET" })
	.inputValidator((input: TaskLookupInput) => input)
	.handler(async ({ data }) => {
		const { getTaskDetail: getTaskDetailFromDb } = await import("#/server/db");
		return getTaskDetailFromDb(data.taskId);
	});
