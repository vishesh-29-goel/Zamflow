"""
ZampFlow Supabase schema bootstrap.

Reads scripts/zampflow_schema.sql and applies it to your Supabase project.

Usage (one of):
  1) Via direct Postgres (preferred):
       export SUPABASE_DB_URL=\'postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres\'
       python scripts/setup_supabase.py

  2) Manual: open the SQL file and paste it into the Supabase SQL editor:
       https://supabase.com/dashboard/project/<ref>/sql

After applying the schema the script does a sanity check:
  - inserts a row with user_email=\'__setup_test__\'
  - selects it back
  - deletes it
"""
from __future__ import annotations

import os
import sys
import pathlib

SQL_PATH = pathlib.Path(__file__).parent / "zampflow_schema.sql"


def main() -> int:
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("ERROR: SUPABASE_DB_URL is not set.", file=sys.stderr)
        print(
            "Set it to your Supabase project\'s direct Postgres connection string,",
            file=sys.stderr,
        )
        print(
            "or paste scripts/zampflow_schema.sql into the Supabase SQL editor.",
            file=sys.stderr,
        )
        return 2

    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        print(
            "psycopg2 not installed. Run: pip install \'psycopg2-binary\'",
            file=sys.stderr,
        )
        return 2

    sql = SQL_PATH.read_text()
    with psycopg2.connect(db_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            print(f"Applying schema from {SQL_PATH} ...")
            cur.execute(sql)
            print("Schema applied.")

            test_email = "__setup_test__"
            cur.execute(
                "INSERT INTO zampflow_flows (user_email, name, data) VALUES (%s, %s, %s) RETURNING id",
                (test_email, "setup self-test", Json({"nodes": [], "edges": []})),
            )
            test_id = cur.fetchone()[0]
            cur.execute("SELECT id, name FROM zampflow_flows WHERE id = %s", (test_id,))
            row = cur.fetchone()
            print(f"Inserted test row: {row}")
            cur.execute("DELETE FROM zampflow_flows WHERE id = %s", (test_id,))
            print("Test row deleted. Schema is ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
