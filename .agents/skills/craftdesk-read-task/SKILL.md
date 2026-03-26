---
name: craftdesk-read-task
description: Read an existing Craftdesk task when the user wants task context such as title, notes, status, category, project, or column. Use for requests like "show this Craftdesk task", "read task TASK-0001", "load task notes", "get task title and status", or "inspect the task before implementing".
---

# Craftdesk Read Task

Load read-only Craftdesk task context from the local Craftdesk SQLite database.

## Workflow

1. Require an explicit `taskId`.
- Do not guess the current task.
- If the user has not provided a task id, ask for it.

2. Read the task with the bundled script.
- Prefer JSON output so the fields are unambiguous.
- Use `--db-file` when the user gives the exact SQLite path.
- Otherwise use `--data-dir` when they provide the Craftdesk data directory.

```bash
python3 .agents/skills/craftdesk-read-task/scripts/read_craftdesk_task.py \
  --task-id TASK-0001 \
  --json
```

3. Interpret status conservatively.
- Treat `status` as the board column title.
- Also preserve raw fields like `columnTitle` and `doneAt`.
- Do not invent extra workflow states.

4. Report the task context back to the user.
- Include the task id, title, status, category, and the important notes content.
- Keep the response compact unless the user asks for the full notes.

## Script Interface

Use this script:

```bash
python3 .agents/skills/craftdesk-read-task/scripts/read_craftdesk_task.py --help
```

Supported flags:
- `--task-id <TASK-xxxx>`: required.
- `--db-file <path>`: optional explicit path to `craftdesk.sqlite`.
- `--data-dir <path>`: optional path to the directory containing `craftdesk.sqlite`.
- `--json`: print machine-readable JSON.

## Returned Fields

The script returns:
- `id`
- `title`
- `status`
- `category`
- `notes`
- `projectId`
- `projectName`
- `projectPath`
- `columnId`
- `columnTitle`
- `createdAt`
- `doneAt`
- `dbPath`

`status` is intentionally the same value as `columnTitle`.

## Failure Handling

- If the task id is missing, stop and ask for it.
- If the task does not exist, say so instead of guessing.
- If the database path cannot be resolved, tell the user that Craftdesk must be installed or started first, or that they should pass `--db-file` or `--data-dir`.
