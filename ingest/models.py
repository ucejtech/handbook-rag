from dataclasses import dataclass

@dataclass
class MarkdownUnit:
    text: str
    page: int
    section_path: list[str]
    is_heading: bool

@dataclass
class Section:
    level: int
    title: str