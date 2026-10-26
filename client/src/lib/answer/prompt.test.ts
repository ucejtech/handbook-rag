import { describe, expect, it } from "vitest";

import { buildUserPrompt, NOT_FOUND_PHRASE, SYSTEM_PROMPT } from "./prompt";
import type { Source } from "./sources";

// Chunk 2571 of the handbook, as the source registry stores it.
const timeOff: Source = {
  id: "S1",
  chunkId: 2571,
  sectionPath: ["Benefits", "Time off"],
  pages: [899],
  text: "Time off\n\nEveryone in the team has unlimited, permissionless time off.",
  links: [
    {
      type: "external",
      target: "https://posthog.com/handbook/people/time-off",
      text: "unlimited, permissionless time off.",
    },
  ],
};

describe("SYSTEM_PROMPT", () => {
  it("tells the model the exact phrase for unanswered questions", () => {
    expect(SYSTEM_PROMPT).toContain(`start your reply with exactly: "${NOT_FOUND_PHRASE}"`);
  });
});

describe("buildUserPrompt", () => {
  const prompt = buildUserPrompt("Do I need approval for time off?", [timeOff]);

  it("labels each excerpt with its id, section and pages", () => {
    expect(prompt).toContain('<excerpt id="S1" section="Benefits › Time off" pages="p. 899">');
  });

  it("includes the excerpt's links so the model can pass them on", () => {
    expect(prompt).toContain("- unlimited, permissionless time off.: https://posthog.com/handbook/people/time-off");
  });

  it("puts the question last, in its own tags", () => {
    expect(prompt.endsWith("<question>\nDo I need approval for time off?\n</question>")).toBe(true);
  });

  it("says so when the search found nothing", () => {
    expect(buildUserPrompt("Anything?", [])).toContain("(no excerpts found)");
  });
});
