import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
	type BoardColumn,
	type CreateColumnInput,
	type CreateTaskInput,
	type DeleteColumnInput,
	type DeleteProjectInput,
	type DeleteTaskInput,
	deriveProjectNameFromPath,
	type ListProjectsInput,
	type MoveTaskInput,
	type ProjectSummary,
	type ProjectWorkspace,
	type SaveProjectInput,
	slugifyProjectId,
	type TaskDetail,
} from "#/lib/craftdesk";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "craftdesk.sqlite");

const DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "Done"] as const;

const DEFAULT_PROJECTS = [
	{
		id: "alpha",
		name: "Project Alpha",
		path: "~/projects/side/alpha",
	},
	{
		id: "core",
		name: "Craftdesk Core",
		path: "~/oss/craftdesk",
	},
	{
		id: "design-system",
		name: "Design System",
		path: "~/projects/design",
	},
] as const;

const DEFAULT_ALPHA_TASKS = [
	{
		id: "TASK-0001",
		columnTitle: "Backlog",
		title: "Implement dark mode persistence",
		description:
			"Save user theme preference to local storage and sync with account settings.",
	},
	{
		id: "TASK-0002",
		columnTitle: "Backlog",
		title: "Refactor terminal state management",
		description:
			"Migrate terminal history to a more performant data structure to support longer sessions.",
	},
	{
		id: "TASK-0003",
		columnTitle: "To Do",
		title: "Design new command palette",
		description:
			"Create a modern command interface for quick actions and file searching.",
	},
	{
		id: "TASK-0004",
		columnTitle: "In Progress",
		title: "Compile production kernel",
		description:
			"Running build scripts for the main application engine with optimized flags.",
	},
	{
		id: "TASK-0005",
		columnTitle: "In Progress",
		title: "Optimize asset loading pipeline",
		description:
			"Implementing lazy loading and progressive image decoding for the workspace.",
	},
	{
		id: "TASK-0006",
		columnTitle: "Done",
		title: "Fix layout shift on mobile",
		description:
			"Resolved jumpy transitions when switching between board and list views on small screens.",
	},
	{
		id: "TASK-0007",
		columnTitle: "Done",
		title: "Update documentation for API",
		description: "Completed the reference guide for all public REST endpoints.",
	},
] as const;

let dbInstance: DatabaseSync | null = null;

function nowIso() {
	return new Date().toISOString();
}

function getDb() {
	if (dbInstance) {
		runMigrations(dbInstance);
		return dbInstance;
	}

	mkdirSync(DATA_DIR, { recursive: true });
	const isNewDatabase = !existsSync(DB_PATH);

	const db = new DatabaseSync(DB_PATH);
	db.exec("PRAGMA foreign_keys = ON;");
	db.exec("PRAGMA journal_mode = WAL;");

	initializeSchema(db);
	runMigrations(db);
	db.exec("UPDATE projects SET active_sessions = 0;");

	if (isNewDatabase) {
		seedDefaults(db);
	}

	dbInstance = db;
	return db;
}

function initializeSchema(db: DatabaseSync) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      active_sessions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_columns (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      done_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_last_opened_at ON projects(last_opened_at DESC);
    CREATE INDEX IF NOT EXISTS idx_board_columns_project_position ON board_columns(project_id, position);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);
  `);
}

function runMigrations(db: DatabaseSync) {
	ensureColumnExists(db, "tasks", "created_at", "TEXT");
	ensureColumnExists(db, "tasks", "done_at", "TEXT");
	removeStatusColumnIfPresent(db);
	const didAddTaskPosition = ensureTaskPositionColumnExists(db);
	db.exec(`
    UPDATE tasks
    SET created_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE created_at IS NULL OR created_at = '';

    UPDATE tasks
    SET done_at = COALESCE(done_at, updated_at, created_at)
    WHERE done_at IS NULL
      AND column_id IN (
        SELECT id
        FROM board_columns
        WHERE title = 'Done'
      );
  `);

	if (didAddTaskPosition) {
		db.exec(`
      WITH ranked_tasks AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY column_id
            ORDER BY datetime(created_at) ASC, id ASC
          ) - 1 AS next_position
        FROM tasks
      )
      UPDATE tasks
      SET position = (
        SELECT next_position
        FROM ranked_tasks
        WHERE ranked_tasks.id = tasks.id
      )
      WHERE id IN (SELECT id FROM ranked_tasks);
    `);
	}
}

function ensureColumnExists(
	db: DatabaseSync,
	tableName: string,
	columnName: string,
	columnDefinition: string,
) {
	const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
		name: string;
	}>;

	if (columns.some((column) => column.name === columnName)) {
		return;
	}

	db.exec(
		`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`,
	);
}

function removeStatusColumnIfPresent(db: DatabaseSync) {
	const columns = getTableColumns(db, "tasks");

	if (!columns.some((column) => column.name === "status")) {
		return;
	}

	db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE tasks__new (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      done_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
    );

    INSERT INTO tasks__new (
      id,
      project_id,
      column_id,
      title,
      description,
      created_at,
      done_at,
      updated_at
    )
    SELECT
      id,
      project_id,
      column_id,
      title,
      description,
      created_at,
      done_at,
      updated_at
    FROM tasks;

    DROP TABLE tasks;

    ALTER TABLE tasks__new RENAME TO tasks;

    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position);

    COMMIT;
  `);
}

function ensureTaskPositionColumnExists(db: DatabaseSync) {
	const columns = getTableColumns(db, "tasks");

	if (columns.some((column) => column.name === "position")) {
		db.exec(
			"CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position);",
		);
		return false;
	}

	db.exec("ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;");
	db.exec(
		"CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position);",
	);
	return true;
}

function getTableColumns(db: DatabaseSync, tableName: string) {
	return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
		name: string;
	}>;
}

function seedDefaults(db: DatabaseSync) {
	const timestamp = nowIso();
	const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (
      id,
      name,
      path,
      active_sessions,
      created_at,
      updated_at,
      last_opened_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

	for (const project of DEFAULT_PROJECTS) {
		insertProject.run(
			project.id,
			project.name,
			project.path,
			0,
			timestamp,
			timestamp,
			timestamp,
		);
		ensureDefaultColumns(db, project.id);
	}

	const alphaTaskCount = db
		.prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?")
		.get("alpha") as { count: number };

	if (alphaTaskCount.count > 0) {
		return;
	}

	const alphaColumns = db
		.prepare(
			"SELECT id, title FROM board_columns WHERE project_id = ? ORDER BY position ASC",
		)
		.all("alpha") as Array<{ id: string; title: string }>;

	const columnByTitle = new Map(
		alphaColumns.map((column) => [column.title, column.id]),
	);
	const nextTaskPositionByColumn = new Map<string, number>();

	const insertTask = db.prepare(`
    INSERT OR IGNORE INTO tasks (
      id,
      project_id,
      column_id,
      position,
      title,
      description,
      created_at,
      done_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	for (const task of DEFAULT_ALPHA_TASKS) {
		const columnId = columnByTitle.get(task.columnTitle);

		if (!columnId) {
			continue;
		}

		const doneAt = task.columnTitle === "Done" ? timestamp : null;
		const nextPosition = nextTaskPositionByColumn.get(columnId) ?? 0;

		insertTask.run(
			task.id,
			"alpha",
			columnId,
			nextPosition,
			task.title,
			task.description,
			timestamp,
			doneAt,
			timestamp,
		);
		nextTaskPositionByColumn.set(columnId, nextPosition + 1);
	}
}

function ensureDefaultColumns(db: DatabaseSync, projectId: string) {
	const count = db
		.prepare("SELECT COUNT(*) AS count FROM board_columns WHERE project_id = ?")
		.get(projectId) as { count: number };

	if (count.count > 0) {
		return;
	}

	const insertColumn = db.prepare(`
    INSERT INTO board_columns (
      id,
      project_id,
      title,
      position,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

	const timestamp = nowIso();

	DEFAULT_COLUMNS.forEach((title, index) => {
		insertColumn.run(
			randomUUID(),
			projectId,
			title,
			index,
			timestamp,
			timestamp,
		);
	});
}

function generateProjectId(db: DatabaseSync, rawValue: string) {
	const baseId = slugifyProjectId(rawValue) || "project";
	let candidate = baseId;
	let suffix = 2;

	const existingProject = db.prepare("SELECT id FROM projects WHERE id = ?");

	while (existingProject.get(candidate)) {
		candidate = `${baseId}-${suffix}`;
		suffix += 1;
	}

	return candidate;
}

function nextTaskId(db: DatabaseSync) {
	const row = db
		.prepare(`
      SELECT id
      FROM tasks
      WHERE id LIKE 'TASK-%'
      ORDER BY CAST(SUBSTR(id, 6) AS INTEGER) DESC
      LIMIT 1
    `)
		.get() as { id?: string } | undefined;

	const current = row?.id ? Number.parseInt(row.id.slice(5), 10) : 0;
	return `TASK-${String(current + 1).padStart(4, "0")}`;
}

function toProjectSummaryRow(projectId: string) {
	const db = getDb();

	return db
		.prepare(`
      SELECT
        p.id,
        p.name,
        p.path,
        p.active_sessions,
        p.last_opened_at,
        COUNT(t.id) AS task_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `)
		.get(projectId) as
		| {
				id: string;
				name: string;
				path: string;
				active_sessions: number;
				last_opened_at: string;
				task_count: number;
		  }
		| undefined;
}

function mapProjectSummary(row: {
	id: string;
	name: string;
	path: string;
	active_sessions: number;
	last_opened_at: string;
	task_count: number;
}): ProjectSummary {
	return {
		id: row.id,
		name: row.name,
		path: row.path,
		activeSessions: row.active_sessions,
		lastOpenedAt: row.last_opened_at,
		taskCount: row.task_count,
	};
}

export function listProjects(input: ListProjectsInput = {}): ProjectSummary[] {
	const db = getDb();
	const orderBy =
		input.sortBy === "name"
			? "p.name COLLATE NOCASE ASC, p.created_at ASC"
			: "p.last_opened_at DESC, p.created_at DESC";
	const rows = db
		.prepare(`
      SELECT
        p.id,
        p.name,
        p.path,
        p.active_sessions,
        p.last_opened_at,
        COUNT(t.id) AS task_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
      ORDER BY ${orderBy}
    `)
		.all() as Array<{
		id: string;
		name: string;
		path: string;
		active_sessions: number;
		last_opened_at: string;
		task_count: number;
	}>;

	return rows.map(mapProjectSummary);
}

export function saveProject(input: SaveProjectInput): ProjectSummary {
	const db = getDb();
	const trimmedPath = input.path.trim();
	const trimmedName =
		input.name.trim() || deriveProjectNameFromPath(trimmedPath);

	if (!trimmedPath) {
		throw new Error("Project path is required.");
	}

	const timestamp = nowIso();

	const existingProject = db
		.prepare("SELECT id FROM projects WHERE path = ?")
		.get(trimmedPath) as { id: string } | undefined;

	if (existingProject) {
		db.prepare(`
      UPDATE projects
      SET name = ?, updated_at = ?, last_opened_at = ?
      WHERE id = ?
    `).run(trimmedName, timestamp, timestamp, existingProject.id);

		const row = toProjectSummaryRow(existingProject.id);

		if (!row) {
			throw new Error("Failed to load saved project.");
		}

		return mapProjectSummary(row);
	}

	const projectId = generateProjectId(db, trimmedName || trimmedPath);

	db.prepare(`
    INSERT INTO projects (
      id,
      name,
      path,
      active_sessions,
      created_at,
      updated_at,
      last_opened_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
		projectId,
		trimmedName,
		trimmedPath,
		0,
		timestamp,
		timestamp,
		timestamp,
	);

	ensureDefaultColumns(db, projectId);

	const row = toProjectSummaryRow(projectId);

	if (!row) {
		throw new Error("Failed to load saved project.");
	}

	return mapProjectSummary(row);
}

export function getProjectWorkspace(
	projectId: string,
): ProjectWorkspace | null {
	const db = getDb();
	const existingProject = toProjectSummaryRow(projectId);

	if (!existingProject) {
		return null;
	}

	const touchedAt = nowIso();
	db.prepare(`
    UPDATE projects
    SET last_opened_at = ?, updated_at = ?
    WHERE id = ?
  `).run(touchedAt, touchedAt, projectId);

	const project = toProjectSummaryRow(projectId);

	if (!project) {
		return null;
	}

	const columns = db
		.prepare(`
      SELECT id, title, position
      FROM board_columns
      WHERE project_id = ?
      ORDER BY position ASC, created_at ASC
    `)
		.all(projectId) as Array<{
		id: string;
		title: string;
		position: number;
	}>;

	const tasks = db
		.prepare(`
      SELECT
        id,
        title,
        description,
        project_id,
        column_id,
        position,
        created_at,
        done_at
      FROM tasks
      WHERE project_id = ?
      ORDER BY column_id ASC, position ASC, created_at ASC, id ASC
    `)
		.all(projectId) as Array<{
		id: string;
		title: string;
		description: string;
		project_id: string;
		column_id: string;
		position: number;
		created_at: string;
		done_at: string | null;
	}>;

	const tasksByColumnId = new Map<string, BoardColumn["tasks"]>();

	for (const task of tasks) {
		const existingTasks = tasksByColumnId.get(task.column_id) ?? [];
		existingTasks.push({
			id: task.id,
			title: task.title,
			description: task.description,
			projectId: task.project_id,
			columnId: task.column_id,
			position: task.position,
			createdAt: task.created_at,
			doneAt: task.done_at,
		});
		tasksByColumnId.set(task.column_id, existingTasks);
	}

	return {
		project: mapProjectSummary(project),
		columns: columns.map((column) => ({
			id: column.id,
			title: column.title,
			position: column.position,
			tasks: tasksByColumnId.get(column.id) ?? [],
		})),
	};
}

export function createColumn(input: CreateColumnInput) {
	const db = getDb();
	const title = input.title.trim();

	if (!title) {
		throw new Error("Column title is required.");
	}

	const project = db
		.prepare("SELECT id FROM projects WHERE id = ?")
		.get(input.projectId) as { id: string } | undefined;

	if (!project) {
		throw new Error("Project not found.");
	}

	const positionRow = db
		.prepare(`
      SELECT COALESCE(MAX(position), -1) AS position
      FROM board_columns
      WHERE project_id = ?
    `)
		.get(input.projectId) as { position: number };

	const timestamp = nowIso();
	db.prepare(`
    INSERT INTO board_columns (
      id,
      project_id,
      title,
      position,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
		randomUUID(),
		input.projectId,
		title,
		positionRow.position + 1,
		timestamp,
		timestamp,
	);
}

export function deleteColumn(input: DeleteColumnInput) {
	const db = getDb();

	db.prepare(`
    DELETE FROM board_columns
    WHERE id = ? AND project_id = ?
  `).run(input.columnId, input.projectId);
}

export function createTask(input: CreateTaskInput) {
	const db = getDb();
	const title = input.title.trim();
	const description = input.description.trim();

	if (!title) {
		throw new Error("Task title is required.");
	}

	const column = db
		.prepare(`
      SELECT id
      FROM board_columns
      WHERE id = ? AND project_id = ?
    `)
		.get(input.columnId, input.projectId) as { id: string } | undefined;

	if (!column) {
		throw new Error("Column not found.");
	}

	const positionRow = db
		.prepare(`
      SELECT COALESCE(MAX(position), -1) AS position
      FROM tasks
      WHERE column_id = ?
    `)
		.get(input.columnId) as { position: number };

	const timestamp = nowIso();
	db.prepare(`
    INSERT INTO tasks (
      id,
      project_id,
      column_id,
      position,
      title,
      description,
      created_at,
      done_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		nextTaskId(db),
		input.projectId,
		input.columnId,
		positionRow.position + 1,
		title,
		description,
		timestamp,
		null,
		timestamp,
	);
}

export function moveTask(input: MoveTaskInput) {
	const db = getDb();
	const task = db
		.prepare(`
      SELECT id, column_id, position
      FROM tasks
      WHERE id = ? AND project_id = ?
    `)
		.get(input.taskId, input.projectId) as
		| {
				id: string;
				column_id: string;
				position: number;
		  }
		| undefined;

	if (!task) {
		throw new Error("Task not found.");
	}

	const targetColumn = db
		.prepare(`
      SELECT id, title
      FROM board_columns
      WHERE id = ? AND project_id = ?
    `)
		.get(input.targetColumnId, input.projectId) as
		| {
				id: string;
				title: string;
		  }
		| undefined;

	if (!targetColumn) {
		throw new Error("Target column not found.");
	}

	if (task.column_id === targetColumn.id) {
		return;
	}

	const timestamp = nowIso();
	const nextPositionRow = db
		.prepare(`
      SELECT COALESCE(MAX(position), -1) AS position
      FROM tasks
      WHERE column_id = ?
    `)
		.get(targetColumn.id) as { position: number };

	try {
		db.exec("BEGIN");

		db.prepare(`
      UPDATE tasks
      SET position = position - 1
      WHERE column_id = ?
        AND position > ?
    `).run(task.column_id, task.position);

		db.prepare(`
      UPDATE tasks
      SET
        column_id = ?,
        position = ?,
        done_at = ?,
        updated_at = ?
      WHERE id = ? AND project_id = ?
    `).run(
			targetColumn.id,
			nextPositionRow.position + 1,
			targetColumn.title === "Done" ? timestamp : null,
			timestamp,
			input.taskId,
			input.projectId,
		);

		db.exec("COMMIT");
	} catch (error) {
		try {
			db.exec("ROLLBACK");
		} catch {}

		throw error;
	}
}

export function deleteTask(input: DeleteTaskInput) {
	const db = getDb();

	db.prepare("DELETE FROM tasks WHERE id = ?").run(input.taskId);
}

export function deleteProject(input: DeleteProjectInput) {
	const db = getDb();

	db.prepare("DELETE FROM projects WHERE id = ?").run(input.projectId);
}

export function setProjectActiveSessions(projectId: string, count: number) {
	const db = getDb();
	const timestamp = nowIso();

	db.prepare(`
    UPDATE projects
    SET active_sessions = ?, updated_at = ?
    WHERE id = ?
  `).run(Math.max(0, count), timestamp, projectId);
}

export function getTaskDetail(taskId: string): TaskDetail | null {
	const db = getDb();
	const row = db
		.prepare(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.project_id,
        t.created_at,
        t.done_at,
        p.name AS project_name,
        p.path AS project_path,
        c.id AS column_id,
        c.title AS column_title
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      INNER JOIN board_columns c ON c.id = t.column_id
      WHERE t.id = ?
    `)
		.get(taskId) as
		| {
				id: string;
				title: string;
				description: string;
				project_id: string;
				created_at: string;
				done_at: string | null;
				project_name: string;
				project_path: string;
				column_id: string;
				column_title: string;
		  }
		| undefined;

	if (!row) {
		return null;
	}

	return {
		id: row.id,
		title: row.title,
		description: row.description,
		projectId: row.project_id,
		projectName: row.project_name,
		projectPath: row.project_path,
		columnId: row.column_id,
		columnTitle: row.column_title,
		createdAt: row.created_at,
		doneAt: row.done_at,
	};
}
