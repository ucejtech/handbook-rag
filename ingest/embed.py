import os

from openai import OpenAI
from models import MarkdownUnit
import tiktoken

encoding = tiktoken.get_encoding("cl100k_base")

client = OpenAI()
embedding_model = os.environ["EMBEDDING_MODEL"]

MAX_INPUT_TOKENS = 8192
MAX_BATCH_TOKENS = 200_000
MAX_BATCH_SIZE = 2048

def embed_chunks(
    chunks: list[list[MarkdownUnit]],
) -> list[tuple[list[MarkdownUnit], list[float]]]:
    results: list[tuple[list[MarkdownUnit], list[float]]] = []

    batch_chunks: list[list[MarkdownUnit]] = []
    batch_texts: list[str] = []
    batch_tokens = 0

    def submit_batch() -> None:
        response = client.embeddings.create(
            model=embedding_model,
            input=batch_texts,
        )

        for item in response.data:
            results.append(
                (batch_chunks[item.index], item.embedding)
            )

    for chunk in chunks:
        text = "\n\n".join(unit.text for unit in chunk).strip()

        if not text:
            continue

        token_count = len(encoding.encode(text))

        if token_count > MAX_INPUT_TOKENS:
            raise ValueError(
                f"Chunk has {token_count} tokens; "
                f"maximum allowed is {MAX_INPUT_TOKENS}. "
                "Split it before embedding."
            )

        if batch_texts and (
            batch_tokens + token_count > MAX_BATCH_TOKENS
            or len(batch_texts) >= MAX_BATCH_SIZE
        ):
            submit_batch()
            batch_chunks = []
            batch_texts = []
            batch_tokens = 0

        batch_chunks.append(chunk)
        batch_texts.append(text)
        batch_tokens += token_count

    if batch_texts:
        submit_batch()

    print(f"Embedded {len(results)} chunks")
    return results

