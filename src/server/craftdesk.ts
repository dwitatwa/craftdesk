import { createServerFn } from "@tanstack/react-start";

import type {
	CreateColumnInput,
	CreateTaskInput,
	DeleteColumnInput,
	DeleteProjectInput,
	DeleteTaskInput,
	ListProjectsInput,
	ProjectLookupInput,
	SaveProjectInput,
	TaskLookupInput,
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

export const getProjectWorkspace = createServerFn({ method: "GET" })
	.inputValidator((input: ProjectLookupInput) => input)
	.handler(async ({ data }) => {
		const { getProjectWorkspace: getProjectWorkspaceFromDb } = await import(
			"#/server/db"
		);
		return getProjectWorkspaceFromDb(data.projectId);
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

export const deleteTask = createServerFn({ method: "POST" })
	.inputValidator((input: DeleteTaskInput) => input)
	.handler(async ({ data }) => {
		const { deleteTask: deleteTaskInDb } = await import("#/server/db");
		return deleteTaskInDb(data);
	});

export const deleteProject = createServerFn({ method: "POST" })
	.inputValidator((input: DeleteProjectInput) => input)
	.handler(async ({ data }) => {
		const { deleteProject: deleteProjectInDb } = await import("#/server/db");
		return deleteProjectInDb(data);
	});

export const getTaskDetail = createServerFn({ method: "GET" })
	.inputValidator((input: TaskLookupInput) => input)
	.handler(async ({ data }) => {
		const { getTaskDetail: getTaskDetailFromDb } = await import("#/server/db");
		return getTaskDetailFromDb(data.taskId);
	});
