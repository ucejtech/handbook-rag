
import os

import psycopg
from pgvector.psycopg import register_vector

from models import MarkdownUnit


DATABASE_URL = os.environ["DATABASE_URL"]
EMBEDDING_DIMENSIONS = 1536


def init_db() -> None:
    """Create the extensions, the chunks table and its BM25 index."""

    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.execute("CREATE EXTENSION IF NOT EXISTS pg_search")

        register_vector(conn)

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS document_chunks (
                id BIGSERIAL PRIMARY KEY,
                document_id TEXT NOT NULL,
                content TEXT NOT NULL,
                page_numbers INTEGER[] NOT NULL,
                section_path TEXT[] NOT NULL,
                embedding vector(1536) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )

        # ParadeDB BM25 index over the chunk text, with ParadeDB's default
        # k1 = 1.2 and b = 0.75. English stemming lets "vacations" match
        # "vacation". Rows are indexed as they are inserted.
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS document_chunks_search_idx
            ON document_chunks
            USING paradedb (
                id,
                (content::pdb.unicode_words('stemmer=english'))
            )
            WITH (key_field = 'id')
            """
        )


def insert_embeddings(
    embedded_chunks: list[
        tuple[list[MarkdownUnit], list[float]]
    ],
    document_id: str,
) -> int:
    """
    Insert embedded chunks into PostgreSQL.

    Returns the number of chunks inserted.
    """

    if not embedded_chunks:
        return 0

    rows = []

    for chunk, embedding in embedded_chunks:
        if not chunk:
            continue

        if len(embedding) != EMBEDDING_DIMENSIONS:
            raise ValueError(
                f"Expected {EMBEDDING_DIMENSIONS} dimensions, "
                f"got {len(embedding)}"
            )

        content = "\n\n".join(unit.text for unit in chunk).strip()

        if not content:
            continue

        page_numbers = sorted({unit.page for unit in chunk})
        section_path = chunk[0].section_path

        rows.append(
            (
                document_id,
                content,
                page_numbers,
                section_path,
                embedding,
            )
        )

    if not rows:
        return 0

    with psycopg.connect(DATABASE_URL) as conn:
        register_vector(conn)

        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO document_chunks (
                    document_id,
                    content,
                    page_numbers,
                    section_path,
                    embedding
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                rows,
            )

    print(f"Inserted {len(rows)} chunks into Database")
    return len(rows)
