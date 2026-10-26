// Chunk text is Markdown extracted from the PDF, with links inline as [text](url).

export interface Link {
  type: "external" | "email";
  /** The URL, or the email address without "mailto:". */
  target: string;
  text: string;
}

// The anchor can't contain brackets, so in nested links like
// [[a@b.com](mailto:a@b.com)](mailto:a@b.com), the inner one matches first.
const MARKDOWN_LINK = /\[([^[\]]*)\]\(([^)\s]+)\)/g;
const BARE_URL = /https?:\/\/[^\s<>()[\]"'`]+/g;
const BARE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// Repeats until no links are left, which unwraps nested links.
function unwrapLinks(markdown: string, onLink?: (anchor: string, href: string) => void): string {
  let text = markdown;
  let previous: string;
  do {
    previous = text;
    text = text.replace(MARKDOWN_LINK, (_match, anchor: string, href: string) => {
      onLink?.(anchor, href);
      return anchor;
    });
  } while (text !== previous);
  return text;
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/, "");
}

export function extractLinks(markdown: string): Link[] {
  const links = new Map<string, Link>();
  const add = (link: Link) => {
    if (!links.has(link.target)) links.set(link.target, link);
  };

  const prose = unwrapLinks(markdown, (anchor, href) => {
    const text = toPlainText(anchor) || href;
    if (href.startsWith("mailto:")) {
      add({ type: "email", target: href.slice("mailto:".length), text });
    } else if (/^https?:\/\//.test(href)) {
      add({ type: "external", target: href, text });
    }
  });

  for (const [match] of prose.matchAll(BARE_URL)) {
    const url = trimTrailingPunctuation(match);
    add({ type: "external", target: url, text: url });
  }
  // Skip the URLs themselves, so an "@" in a URL isn't read as an email.
  for (const [match] of prose.replace(BARE_URL, " ").matchAll(BARE_EMAIL)) {
    const email = trimTrailingPunctuation(match);
    add({ type: "email", target: email, text: email });
  }

  return [...links.values()];
}

export function toPlainText(markdown: string): string {
  return unwrapLinks(markdown)
    .replace(/<\/?[a-z][^>]*>/gi, "") // stray HTML such as <u>
    .replace(/^```.*$/gm, "") // code fence lines
    .replace(/^#{1,6}\s+/gm, "") // heading markers
    .replace(/\*\*|__|`/g, "") // bold and inline code
    .replace(/(^|\s)_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, "$1$2") // _italics_
    .replace(/(^|[\s(])\*(?=\S)([^*\n]+)\*(?=[\s.,;:!?)]|$)/gm, "$1$2") // *italics*
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
