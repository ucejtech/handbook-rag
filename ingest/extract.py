import sys
import time
import re

import pymupdf
from pathlib import Path
from urllib.parse import quote
from models import Section, MarkdownUnit

import pymupdf
import pymupdf4llm


heading_regex = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
paragraph_regex = re.compile(r"\n\s*\n")


def identify_sections(markdown: str, page: int, section_path: list[Section]) -> list[MarkdownUnit]:
    """
    Split Markdown into paragraph-like units while tracking headings.
    """
    units = []

    for block in paragraph_regex.split(markdown):
        block = block.strip()

        if not block:
            continue

        lines = block.splitlines()
        first_line = lines[0].strip()
        match = heading_regex.match(first_line)

        if match:
            heading_level = len(match.group(1))
            heading_text = match.group(2).strip()
            
            while (
                section_path
                and section_path[-1].level >= heading_level
            ):
                section_path.pop()

            section_path.append(
                Section(
                    level=heading_level,
                    title=heading_text,
                )
            )

            units.append(MarkdownUnit(
                text=block,
                page=page,
                section_path=list(section.title.replace("**", "") for section in section_path),
                is_heading=True
            ))
        else:
            units.append(MarkdownUnit(
                text=block,
                page=page,
                section_path=list(section.title.replace("**", "") for section in section_path),
                is_heading=False
            ))

    return units

def process_markdown(text: str) -> list[MarkdownUnit]:
    page_regex = re.compile(r"<!-- page (\d+) -->")
    parts = page_regex.split(text)

    section_path: list[Section] = []
    all_units: list[MarkdownUnit] = []

    for page, body in zip(parts[1::2], parts[2::2], strict=True):
        page_record = {
            "page": int(page),
            "markdown": body.strip()
        }
        
        all_units.extend(
            identify_sections(
                page_record["markdown"],
                page_record["page"],
                section_path,
            )
        )

    return all_units

def convert_to_markdown(path):
    """
    Convert a PDF to Markdown while restoring hyperlinks.

    Processes one page at a time to avoid holding the entire
    Markdown output in memory.
    """
    path = Path(path)
    output_path = path.with_suffix(".md")

    with pymupdf.open(path) as doc, output_path.open(
        "w", encoding="utf-8"
    ) as output:

        for page_num, page in enumerate(doc):

            markdown = pymupdf4llm.to_markdown(
                doc,
                pages=[page_num],
                header=False,
                footer=False,
                use_ocr=False,
            )

            # Get the PDF's actual hyperlink annotations.
            links = [
                link for link in page.get_links()
                if link.get("uri")
            ]

            if links:
                words = page.get_text("words")
                replacements = []

                for link in links:
                    rect = pymupdf.Rect(link["from"])
                    uri = link["uri"]

                    linked_words = [
                        word for word in words
                        if pymupdf.Rect(word[:4]).intersects(rect)
                    ]

                    if not linked_words:
                        continue

                    linked_words.sort(
                        key=lambda word: (word[5], word[6], word[7])
                    )

                    text = " ".join(
                        word[4] for word in linked_words
                    ).strip()

                    if text:
                        url = quote(
                            uri,
                            safe=":/?#[]@!$&'*+,;=%"
                        )
                        replacements.append(
                            (text, f"[{text}]({url})")
                        )

                # Best-effort replacement of link text in Markdown.
                for text, replacement in sorted(
                    replacements,
                    key=lambda item: len(item[0]),
                    reverse=True,
                ):
                    markdown = markdown.replace(text, replacement, 1)
                


            output.write(f"<!-- page {page_num + 1} -->\n")
            output.write(markdown)
            output.write("\n\n")

            if (page_num + 1) % 50 == 0:
                print(
                    f"Processed {page_num + 1}/{len(doc)} pages"
                )

    print(f"Markdown saved to: {output_path}")
    return str(output_path)

def extract_markdown_to_units_from_pdf(path: Path) -> list[MarkdownUnit]:
    if not path.exists():
        sys.exit(f"Handbook not found at {path}. Put the PDF at data/handbook.pdf.")

    print(f"Extracting {path.name} (about 2 minutes)…")
    start = time.time()
    markdown_path = convert_to_markdown(path)
    text = open(markdown_path).read()
    units = process_markdown(text)

    return units
