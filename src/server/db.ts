import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import os from "node:os";
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
	type HideCurrentDoneTaskInput,
	type ListProjectsInput,
	type MoveTaskInput,
	normalizeTaskCategory,
	type ProjectSummary,
	type ProjectWorkspace,
	type SaveProjectInput,
	slugifyProjectId,
	type UpdateTaskInput,
} from "#/lib/craftdesk";
import type {
	GitChangeMarkerListInput,
	GitChangeMarkerMutationInput,
} from "#/lib/git";
import { isScopeRunning } from "#/server/terminal-manager";

const DATA_DIR = resolveDataDirectory();
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
		category: "feature",
		title: "Implement dark mode persistence",
		notes:
			"Save user theme preference to local storage and sync with account settings.",
	},
	{
		id: "TASK-0002",
		columnTitle: "Backlog",
		category: "feature",
		title: "Refactor terminal state management",
		notes:
			"Migrate terminal history to a more performant data structure to support longer sessions.",
	},
	{
		id: "TASK-0003",
		columnTitle: "To Do",
		category: "feature",
		title: "Design new command palette",
		notes:
			"Create a modern command interface for quick actions and file searching.",
	},
	{
		id: "TASK-0004",
		columnTitle: "In Progress",
		category: "other",
		title: "Compile production kernel",
		notes:
			"Running build scripts for the main application engine with optimized flags.",
	},
	{
		id: "TASK-0005",
		columnTitle: "In Progress",
		category: "feature",
		title: "Optimize asset loading pipeline",
		notes:
			"Implementing lazy loading and progressive image decoding for the workspace.",
	},
	{
		id: "TASK-0006",
		columnTitle: "Done",
		category: "bug",
		title: "Fix layout shift on mobile",
		notes:
			"Resolved jumpy transitions when switching between board and list views on small screens.",
	},
	{
		id: "TASK-0007",
		columnTitle: "Done",
		category: "other",
		title: "Update documentation for API",
		notes: "Completed the reference guide for all public REST endpoints.",
	},
] as const;

let dbInstance: DatabaseSync | null = null;

function resolveDataDirectory() {
	const configuredPath = process.env.CRAFTDESK_DATA_DIR?.trim();

	if (configuredPath) {
		if (configuredPath === "~") {
			return os.homedir();
		}

		if (configuredPath.startsWith("~/")) {
			return path.join(os.homedir(), configuredPath.slice(2));
		}

		return path.resolve(configuredPath);
	}

	return path.join(process.cwd(), "data");
}

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
      category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('feature', 'bug', 'other')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      done_at TEXT,
      hide_in_done_column INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_last_opened_at ON projects(last_opened_at DESC);
    CREATE INDEX IF NOT EXISTS idx_board_columns_project_position ON board_columns(project_id, position);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id);

    CREATE TABLE IF NOT EXISTS git_change_markers (
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, file_path),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_git_change_markers_project_updated_at
      ON git_change_markers(project_id, updated_at DESC);
  `);
}

function runMigrations(db: DatabaseSync) {
	ensureColumnExists(db, "tasks", "created_at", "TEXT");
	ensureColumnExists(db, "tasks", "done_at", "TEXT");
	ensureColumnExists(
		db,
		"tasks",
		"hide_in_done_column",
		"INTEGER NOT NULL DEFAULT 0",
	);
	removeStatusColumnIfPresent(db);
	const didAddTaskPosition = ensureTaskPositionColumnExists(db);
	ensureTaskNotesColumn(db);
	ensureTaskCategoryColumn(db);
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

    UPDATE tasks
    SET category = 'other'
    WHERE category IS NULL
      OR TRIM(category) = ''
      OR category NOT IN ('feature', 'bug', 'other');
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
	const hasPosition = columns.some((column) => column.name === "position");
	const hasNotes = columns.some((column) => column.name === "notes");
	const hasHideInDoneColumn = columns.some(
		(column) => column.name === "hide_in_done_column",
	);
	const hasCategory = columns.some((column) => column.name === "category");
	const noteSource = hasNotes ? "notes" : "description";
	const positionSource = hasPosition ? "position" : "0";
	const hideInDoneColumnSource = hasHideInDoneColumn
		? "hide_in_done_column"
		: "0";
	const categorySource = hasCategory ? "category" : "'other'";

	if (!columns.some((column) => column.name === "status")) {
		return;
	}

	db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE tasks__new (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('feature', 'bug', 'other')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      done_at TEXT,
      hide_in_done_column INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
    );

    INSERT INTO tasks__new (
      id,
      project_id,
      column_id,
      position,
      title,
      category,
      notes,
      created_at,
      done_at,
      hide_in_done_column,
      updated_at
    )
    SELECT
      id,
      project_id,
      column_id,
      ${positionSource},
      title,
      ${categorySource},
      ${noteSource},
      created_at,
      done_at,
      ${hideInDoneColumnSource},
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

function ensureTaskNotesColumn(db: DatabaseSync) {
	const columns = getTableColumns(db, "tasks");
	const hasNotes = columns.some((column) => column.name === "notes");
	const hasDescription = columns.some(
		(column) => column.name === "description",
	);
	const hasHideInDoneColumn = columns.some(
		(column) => column.name === "hide_in_done_column",
	);
	const hasCategory = columns.some((column) => column.name === "category");

	if (hasNotes && !hasDescription && hasHideInDoneColumn && hasCategory) {
		return;
	}

	const notesSource = hasNotes
		? "notes"
		: hasDescription
			? "description"
			: "''";
	const hideInDoneColumnSource = hasHideInDoneColumn
		? "hide_in_done_column"
		: "0";
	const categorySource = hasCategory ? "category" : "'other'";

	db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE tasks__new (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('feature', 'bug', 'other')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      done_at TEXT,
      hide_in_done_column INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE CASCADE
    );

    INSERT INTO tasks__new (
      id,
      project_id,
      column_id,
      position,
      title,
      category,
      notes,
      created_at,
      done_at,
      hide_in_done_column,
      updated_at
    )
    SELECT
      id,
      project_id,
      column_id,
      position,
      title,
      ${categorySource},
      ${notesSource},
      created_at,
      done_at,
      ${hideInDoneColumnSource},
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

function ensureTaskCategoryColumn(db: DatabaseSync) {
	const columns = getTableColumns(db, "tasks");

	if (columns.some((column) => column.name === "category")) {
		return;
	}

	db.exec(
		"ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'other';",
	);
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
      category,
      notes,
      created_at,
      done_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
			task.category,
			task.notes,
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

export function getDatabaseSize(): number {
	try {
		return [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`].reduce(
			(totalSize, filePath) => {
				try {
					return totalSize + statSync(filePath).size;
				} catch {
					return totalSize;
				}
			},
			0,
		);
	} catch (error) {
		console.error("Failed to get database size:", error);
		return 0;
	}
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
        category,
        notes,
        project_id,
        column_id,
        position,
        created_at,
        done_at,
        hide_in_done_column
      FROM tasks
      WHERE project_id = ?
      ORDER BY column_id ASC, position ASC, created_at ASC, id ASC
    `)
		.all(projectId) as Array<{
		id: string;
		title: string;
		category: string;
		notes: string;
		project_id: string;
		column_id: string;
		position: number;
		created_at: string;
		done_at: string | null;
		hide_in_done_column: number;
	}>;

	const tasksByColumnId = new Map<
		string,
		Array<BoardColumn["tasks"][number] & { hideInDoneColumn: boolean }>
	>();

	for (const task of tasks) {
		const existingTasks = tasksByColumnId.get(task.column_id) ?? [];
		existingTasks.push({
			id: task.id,
			title: task.title,
			category: normalizeTaskCategory(task.category),
			notes: task.notes,
			projectId: task.project_id,
			columnId: task.column_id,
			position: task.position,
			createdAt: task.created_at,
			doneAt: task.done_at,
			hideInDoneColumn: Boolean(task.hide_in_done_column),
			isRunning: isScopeRunning({ scopeType: "task", scopeId: task.id }),
		});
		tasksByColumnId.set(task.column_id, existingTasks);
	}

	return {
		project: mapProjectSummary(project),
		columns: columns.map((column) => ({
			id: column.id,
			title: column.title,
			position: column.position,
			tasks: (tasksByColumnId.get(column.id) ?? [])
				.filter((task) => !(column.title === "Done" && task.hideInDoneColumn))
				.map(({ hideInDoneColumn: _hideInDoneColumn, ...task }) => task),
		})),
	};
}

export function getProjectSummary(projectId: string): ProjectSummary | null {
	const row = toProjectSummaryRow(projectId);

	return row ? mapProjectSummary(row) : null;
}

function ensureProjectExists(db: DatabaseSync, projectId: string) {
	const project = db
		.prepare("SELECT id FROM projects WHERE id = ?")
		.get(projectId) as { id: string } | undefined;

	if (!project) {
		throw new Error("Project not found.");
	}
}

export function listGitChangeMarkers(
	input: GitChangeMarkerListInput,
): string[] {
	const db = getDb();
	ensureProjectExists(db, input.projectId);

	const rows = db
		.prepare(`
      SELECT file_path
      FROM git_change_markers
      WHERE project_id = ?
      ORDER BY updated_at DESC, file_path ASC
    `)
		.all(input.projectId) as Array<{ file_path: string }>;

	return rows.map((row) => row.file_path);
}

export function setGitChangeMarker(input: GitChangeMarkerMutationInput) {
	const db = getDb();
	const projectId = input.projectId.trim();
	const filePath = input.filePath.trim();

	if (!projectId) {
		throw new Error("Project ID is required.");
	}

	if (!filePath) {
		throw new Error("File path is required.");
	}

	ensureProjectExists(db, projectId);

	if (!input.marked) {
		db.prepare(`
      DELETE FROM git_change_markers
      WHERE project_id = ? AND file_path = ?
    `).run(projectId, filePath);
		return;
	}

	const timestamp = nowIso();
	db.prepare(`
    INSERT INTO git_change_markers (
      project_id,
      file_path,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, file_path)
    DO UPDATE SET updated_at = excluded.updated_at
  `).run(projectId, filePath, timestamp, timestamp);
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
	const category = normalizeTaskCategory(input.category);

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
      category,
      notes,
      created_at,
      done_at,
      hide_in_done_column,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		nextTaskId(db),
		input.projectId,
		input.columnId,
		positionRow.position + 1,
		title,
		category,
		"",
		timestamp,
		null,
		0,
		timestamp,
	);
}

export function updateTaskNotes(input: { taskId: string; notes: string }) {
	const db = getDb();
	const notes = input.notes.replace(/\r\n/g, "\n");
	const timestamp = nowIso();

	db.prepare(`
    UPDATE tasks
    SET notes = ?, updated_at = ?
    WHERE id = ?
  `).run(notes, timestamp, input.taskId);
}

export function updateTask(input: UpdateTaskInput) {
	const db = getDb();
	const title = input.title.trim();
	const category = normalizeTaskCategory(input.category);
	const notes = input.notes.replace(/\r\n/g, "\n");
	const timestamp = nowIso();

	if (!title) {
		throw new Error("Task title is required.");
	}

	const result = db
		.prepare(`
      UPDATE tasks
      SET title = ?, category = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `)
		.run(title, category, notes, timestamp, input.taskId);

	if (result.changes === 0) {
		throw new Error("Task not found.");
	}
}

export function moveTask(input: MoveTaskInput) {
	const db = getDb();
	const task = db
		.prepare(`
      SELECT id, column_id, position, hide_in_done_column
      FROM tasks
      WHERE id = ? AND project_id = ?
    `)
		.get(input.taskId, input.projectId) as
		| {
				id: string;
				column_id: string;
				position: number;
				hide_in_done_column: number;
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

	const timestamp = nowIso();
	const targetCountRow = db
		.prepare(`
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE column_id = ?
    `)
		.get(targetColumn.id) as { count: number };

	const rawTargetPosition = Math.max(0, input.targetPosition);
	const targetPosition =
		task.column_id === targetColumn.id
			? Math.max(
					0,
					Math.min(
						rawTargetPosition - (task.position < rawTargetPosition ? 1 : 0),
						Math.max(0, targetCountRow.count - 1),
					),
				)
			: Math.min(rawTargetPosition, targetCountRow.count);

	if (task.column_id === targetColumn.id && targetPosition === task.position) {
		return;
	}

	try {
		db.exec("BEGIN");

		if (task.column_id === targetColumn.id) {
			if (targetPosition < task.position) {
				db.prepare(`
          UPDATE tasks
          SET position = position + 1
          WHERE column_id = ?
            AND position >= ?
            AND position < ?
        `).run(task.column_id, targetPosition, task.position);
			} else {
				db.prepare(`
          UPDATE tasks
          SET position = position - 1
          WHERE column_id = ?
            AND position > ?
            AND position <= ?
        `).run(task.column_id, task.position, targetPosition);
			}

			db.prepare(`
        UPDATE tasks
        SET
          position = ?,
          hide_in_done_column = 0,
          updated_at = ?
        WHERE id = ? AND project_id = ?
      `).run(targetPosition, timestamp, input.taskId, input.projectId);
		} else {
			db.prepare(`
        UPDATE tasks
        SET position = position - 1
        WHERE column_id = ?
          AND position > ?
      `).run(task.column_id, task.position);

			db.prepare(`
        UPDATE tasks
        SET position = position + 1
        WHERE column_id = ?
          AND position >= ?
      `).run(targetColumn.id, targetPosition);

			db.prepare(`
        UPDATE tasks
        SET
          column_id = ?,
          position = ?,
          done_at = ?,
          hide_in_done_column = 0,
          updated_at = ?
        WHERE id = ? AND project_id = ?
      `).run(
				targetColumn.id,
				targetPosition,
				targetColumn.title === "Done" ? timestamp : null,
				timestamp,
				input.taskId,
				input.projectId,
			);
		}

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

export function hideCurrentDoneTask(input: HideCurrentDoneTaskInput) {
	const db = getDb();
	const timestamp = nowIso();

	db.prepare(`
      UPDATE tasks
      SET hide_in_done_column = 1, updated_at = ?
      WHERE id IN (
        SELECT t.id
        FROM tasks t
        INNER JOIN board_columns c ON c.id = t.column_id
        WHERE t.project_id = ?
          AND c.project_id = ?
          AND c.title = 'Done'
          AND t.hide_in_done_column = 0
      )
    `).run(timestamp, input.projectId, input.projectId);
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

export function getGlobalStats() {
	const db = getDb();
	const stats = db
		.prepare(`
      SELECT 
        COUNT(id) as total_projects,
        SUM(active_sessions) as total_sessions
      FROM projects
    `)
		.get() as { total_projects: number; total_sessions: number };

	const taskStats = db
		.prepare(`
      SELECT 
        category,
        COUNT(id) as count
      FROM tasks
      GROUP BY category
    `)
		.all() as Array<{ category: string; count: number }>;

	return {
		totalProjects: stats.total_projects || 0,
		totalSessions: stats.total_sessions || 0,
		tasksByCategory: taskStats.reduce(
			(acc, curr) => {
				acc[curr.category] = curr.count;
				return acc;
			},
			{} as Record<string, number>,
		),
	};
}
