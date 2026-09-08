// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { externalFileFor, fileForHighlighting } from "./highlighter";

const PATH = "src/a.ts";
const ORIGINAL = "one\n";
const EDITED = "two\n";

describe("externalFileFor", () => {
  it("builds a file for the first read", () => {
    const file = externalFileFor(null, PATH, ORIGINAL, null);
    expect(file.name).toBe(PATH);
    expect(file.contents).toBe(ORIGINAL);
  });

  it("keeps the file it has when the read repeats it", () => {
    const held = fileForHighlighting(PATH, ORIGINAL);
    expect(externalFileFor(held, PATH, ORIGINAL, ORIGINAL)).toBe(held);
  });

  it("keeps the file it has when the read is the round trip of a save", () => {
    // Saving writes the buffer and re-reads the file, so the read comes back
    // holding what the editor is holding — text the view has never been given,
    // but not a new document either. Handing it over would rebuild the edit
    // session around identical text and take the pane down with it.
    const held = fileForHighlighting(PATH, ORIGINAL);
    expect(externalFileFor(held, PATH, EDITED, EDITED)).toBe(held);
  });

  it("brings the file it keeps up to date", () => {
    // The kept file is the text a later change on disk is merged against, so
    // it has to say what was saved rather than what was there before.
    const held = fileForHighlighting(PATH, ORIGINAL);
    const kept = externalFileFor(held, PATH, EDITED, EDITED);
    expect(kept.contents).toBe(EDITED);
    expect(kept.cacheKey).toBe(fileForHighlighting(PATH, EDITED).cacheKey);
  });

  it("takes the file when it changed underneath the editor", () => {
    const held = fileForHighlighting(PATH, ORIGINAL);
    const next = externalFileFor(held, PATH, "elsewhere\n", EDITED);
    expect(next).not.toBe(held);
    expect(next.contents).toBe("elsewhere\n");
  });

  it("takes the file when another one is opened", () => {
    const held = fileForHighlighting(PATH, ORIGINAL);
    const next = externalFileFor(held, "src/b.ts", ORIGINAL, ORIGINAL);
    expect(next).not.toBe(held);
    expect(next.name).toBe("src/b.ts");
  });

  it("takes the file before an editor is attached", () => {
    const held = fileForHighlighting(PATH, ORIGINAL);
    const next = externalFileFor(held, PATH, EDITED, null);
    expect(next).not.toBe(held);
    expect(next.contents).toBe(EDITED);
  });
});
