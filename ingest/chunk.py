from models import MarkdownUnit
import tiktoken

encoding = tiktoken.get_encoding("cl100k_base")

def make_chunks(
    units: list[MarkdownUnit],
    max_tokens: int = 500,
    overlap_tokens: int = 75,
    section_depth: int = 2,
) -> list[list[MarkdownUnit]]:
    if max_tokens <= 0:
        raise ValueError("max_tokens must be greater than 0")
    if not 0 <= overlap_tokens < max_tokens:
        raise ValueError("Invalid overlap_tokens")
    if section_depth < 1:
        raise ValueError("section_depth must be at least 1")

    def text_of(items: list[MarkdownUnit]) -> str:
        return "\n\n".join(unit.text for unit in items)

    def count(text: str) -> int:
        return len(encoding.encode(text))

    chunks: list[list[MarkdownUnit]] = []
    current: list[MarkdownUnit] = []
    current_group = None

    for unit in units:
        group = tuple(unit.section_path[:section_depth])

        # Start a new group when the section prefix changes.
        if current and group != current_group:
            chunks.append(current)
            current = []

        current_group = group

        # Split a unit that exceeds the budget.
        if count(unit.text) > max_tokens:
            if current:
                chunks.append(current)
                current = []

            tokens = encoding.encode(unit.text)
            start = 0

            while start < len(tokens):
                end = min(start + max_tokens, len(tokens))
                piece = encoding.decode(tokens[start:end])

                chunks.append([
                    MarkdownUnit(
                        text=piece,
                        page=unit.page,
                        section_path=unit.section_path.copy(),
                        is_heading=unit.is_heading,
                    )
                ])

                if end == len(tokens):
                    break

                start = end - overlap_tokens

            continue

        candidate = current + [unit]

        if current and count(text_of(candidate)) > max_tokens:
            previous = current
            chunks.append(previous)
            current = []

            # Carry recent units forward while they fit the overlap.
            for old_unit in reversed(previous):
                overlap = [old_unit] + current

                if count(text_of(overlap)) > overlap_tokens:
                    break

                current = overlap

            # Drop overlap if the new unit would exceed the budget.
            if count(text_of(current + [unit])) > max_tokens:
                current = []

        current.append(unit)

    if current:
        chunks.append(current)

    print(f"Created {len(chunks)} chunks")
    return chunks
