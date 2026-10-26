import { describe, expect, it } from "vitest";

import { extractLinks, toPlainText } from "./markdown";

// Real snippets from the extracted handbook.

// Chunk 2571
const TIME_OFF =
  "## **Time off**\n\nEveryone in the team has [unlimited, permissionless time off.](https://posthog.com/handbook/people/time-off)\n\nWe also offer [parental leave](https://posthog.com/handbook/people/time-off#parental-leave) for new parents.";

// Chunk 32
const PRESS =
  "Any press-related enquiries should be directed to [press@posthog.com](mailto:press@posthog.com) - this includes any emails you receive personally.";

// Chunk 11: extraction wrapped this link twice.
const NESTED = "- Sending emails from [[hey@posthog.com](mailto:hey@posthog.com)](mailto:hey@posthog.com)";

// Chunk 14
const BACKTICK_EMAIL = "These emails come from the `hey@posthog.com` email address.";

// Chunk 1019
const BARE_URL = "featuredVideo: https://www.youtube-nocookie.com/embed/TCyCryTiTbQ";

describe("extractLinks", () => {
  it("finds Markdown links with their anchor text", () => {
    expect(extractLinks(TIME_OFF)).toEqual([
      {
        type: "external",
        target: "https://posthog.com/handbook/people/time-off",
        text: "unlimited, permissionless time off.",
      },
      {
        type: "external",
        target: "https://posthog.com/handbook/people/time-off#parental-leave",
        text: "parental leave",
      },
    ]);
  });

  it("turns mailto links into email links", () => {
    expect(extractLinks(PRESS)).toEqual([
      { type: "email", target: "press@posthog.com", text: "press@posthog.com" },
    ]);
  });

  it("handles nested links and lists the address once", () => {
    expect(extractLinks(NESTED)).toEqual([
      { type: "email", target: "hey@posthog.com", text: "hey@posthog.com" },
    ]);
  });

  it("finds email addresses and URLs written as plain text", () => {
    expect(extractLinks(BACKTICK_EMAIL)).toEqual([
      { type: "email", target: "hey@posthog.com", text: "hey@posthog.com" },
    ]);
    expect(extractLinks(BARE_URL)).toEqual([
      {
        type: "external",
        target: "https://www.youtube-nocookie.com/embed/TCyCryTiTbQ",
        text: "https://www.youtube-nocookie.com/embed/TCyCryTiTbQ",
      },
    ]);
  });

  it("drops sentence punctuation after a plain-text URL", () => {
    expect(extractLinks(`See ${BARE_URL.split(" ")[1]}.`)[0].target).toBe(
      "https://www.youtube-nocookie.com/embed/TCyCryTiTbQ",
    );
  });
});

describe("toPlainText", () => {
  it("keeps the words but drops headings, bold and link syntax", () => {
    expect(toPlainText(TIME_OFF)).toBe(
      "Time off\n\nEveryone in the team has unlimited, permissionless time off.\n\nWe also offer parental leave for new parents.",
    );
  });

  it("fully unwraps nested links", () => {
    expect(toPlainText(NESTED)).toBe("- Sending emails from hey@posthog.com");
  });

  it("drops single-asterisk italics", () => {
    // Chunk 1803
    const line = "*\"Before we dive in, I'm curious - what made you decide to take this call?*";
    expect(toPlainText(line)).toBe("\"Before we dive in, I'm curious - what made you decide to take this call?");
  });

  it("drops inline code backticks and stray HTML tags", () => {
    expect(toPlainText(BACKTICK_EMAIL)).toBe("These emails come from the hey@posthog.com email address.");
    expect(toPlainText("Day 4: <u>SuperDay</u> ( _optional_ )")).toBe("Day 4: SuperDay ( optional )");
  });
});
