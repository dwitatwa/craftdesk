#!/usr/bin/env python3

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def expand_home(value: str) -> Path:
    return Path(value).expanduser().resolve()


def resolve_db_path(db_file: str, data_dir: str) -> Path:
    if db_file and data_dir:
        fail("Use either --db-file or --data-dir, not both.")

    if db_file:
        return expand_home(db_file)

    if data_dir:
        return expand_home(data_dir) / "craftdesk.sqlite"

    env_data_dir = os.environ.get("CRAFTDESK_DATA_DIR", "").strip()
    if env_data_dir:
        return expand_home(env_data_dir) / "craftdesk.sqlite"

    return (
        Path.home()
        / ".local"
        / "share"
        / "craftdesk"
        / "data"
        / "craftdesk.sqlite"
    )


def connect_db(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        fail(
            f"Craftdesk database not found at {db_path}. Start Craftdesk first or pass --db-file or --data-dir."
        )

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_task(conn: sqlite3.Connection, task_id: str) -> dict:
    row = conn.execute(
        """
        SELECT
            t.id,
            t.title,
            t.category,
            t.notes,
            t.project_id AS projectId,
            p.name AS projectName,
            p.path AS projectPath,
            t.column_id AS columnId,
            c.title AS columnTitle,
            t.created_at AS createdAt,
            t.done_at AS doneAt
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        INNER JOIN board_columns c ON c.id = t.column_id
        WHERE t.id = ?
        """,
        (task_id,),
    ).fetchone()

    if row is None:
        fail(f'Task "{task_id}" was not found.')

    payload = dict(row)
    payload["status"] = payload["columnTitle"]
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Read Craftdesk task details from the local database."
    )
    parser.add_argument("--task-id", required=True, help="Target Craftdesk task id.")
    parser.add_argument("--db-file", default="", help="Path to craftdesk.sqlite.")
    parser.add_argument(
        "--data-dir",
        default="",
        help="Path to the directory containing craftdesk.sqlite.",
    )
    parser.add_argument("--json", action="store_true", help="Print JSON output.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    db_path = resolve_db_path(args.db_file, args.data_dir)
    conn = connect_db(db_path)

    try:
        payload = get_task(conn, args.task_id)
    finally:
        conn.close()

    payload["dbPath"] = str(db_path)

    if args.json:
        print(json.dumps(payload, indent=2))
        return

    print(f"Task: {payload['id']}")
    print(f"Title: {payload['title']}")
    print(f"Status: {payload['status']}")
    print(f"Category: {payload['category']}")
    print(f"Project: {payload['projectName']} ({payload['projectId']})")
    print(f"Column: {payload['columnTitle']}")
    print(f"Done At: {payload['doneAt'] or '-'}")
    print("")
    print(payload["notes"] if payload["notes"].strip() else "(No notes)")


if __name__ == "__main__":
    main()
