import { describe, expect, it } from "vitest";
import { previewedHref, previewWindowUrl } from "./preview-window";

describe("previewWindowUrl", () => {
  it("loads the app's root, whatever page asked for the preview", () => {
    expect(
      previewWindowUrl(
        "/modes/code/commit",
        "http://localhost:41812/modes/agent-session/abc"
      )
    ).toBe("http://localhost:41812/?preview=%2Fmodes%2Fcode%2Fcommit");
  });

  it("keeps the search a location carries", () => {
    expect(
      previewWindowUrl("/modes/agent-session?new=true", "http://app.test/")
    ).toBe("http://app.test/?preview=%2Fmodes%2Fagent-session%3Fnew%3Dtrue");
  });

  it("stays on the packaged shell's own protocol", () => {
    expect(previewWindowUrl("/modes/code/docs", "byconvo://app/")).toBe(
      "byconvo://app/?preview=%2Fmodes%2Fcode%2Fdocs"
    );
  });
});

describe("previewedHref", () => {
  it("reads the location a preview was opened for", () => {
    expect(
      previewedHref(previewWindowUrl("/modes/code/tasks", "http://app.test/"))
    ).toBe("/modes/code/tasks");
  });

  it("is null for an ordinary window", () => {
    expect(previewedHref("http://app.test/modes/code/commit")).toBeNull();
  });
});
