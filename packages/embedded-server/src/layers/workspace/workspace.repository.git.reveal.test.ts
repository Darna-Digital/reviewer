import { describe, expect, it } from "vitest";
import { revealCommand } from "./workspace.repository.git.ts";

describe("revealCommand", () => {
  it("selects the file itself on macOS and Windows", () => {
    expect(revealCommand("darwin", "/repo/src/a.ts")).toEqual({
      command: "open",
      args: ["-R", "/repo/src/a.ts"],
    });
    expect(revealCommand("win32", "/repo/src/a.ts")).toEqual({
      command: "explorer",
      args: ["/select,/repo/src/a.ts"],
    });
  });

  it("opens the folder it sits in everywhere else", () => {
    expect(revealCommand("linux", "/repo/src/a.ts")).toEqual({
      command: "xdg-open",
      args: ["/repo/src"],
    });
    expect(revealCommand("linux", "/a.ts").args).toEqual(["/"]);
  });
});
