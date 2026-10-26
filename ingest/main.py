from pathlib import Path

from pydoc import text
from dotenv import load_dotenv

load_dotenv()

from chunk import make_chunks
from embed import embed_chunks
from db import init_db, insert_embeddings
from extract import extract_markdown_to_units_from_pdf

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PDF = REPO_ROOT / "data" / "handbook.pdf"

def main():
    units = extract_markdown_to_units_from_pdf(DEFAULT_PDF)
    chunks = make_chunks(
        units,
        max_tokens=500,
        overlap_tokens=75,
        section_depth=2,
    )
    embedded = embed_chunks(chunks)

    init_db()
    insert_embeddings(embedded, "Posthog-handbook")

if __name__ == "__main__":
    main()