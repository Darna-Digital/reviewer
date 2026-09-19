import { describe, expect, it } from "vitest";
import { withoutTrailingSlash } from "./file-actions.functions";

describe("withoutTrailingSlash", () => {
  it("drops the slash the tree writes on a folder", () => {
    expect(withoutTrailingSlash("src/")).toBe("src");
  });

  it("leaves a file path alone", () => {
    expect(withoutTrailingSlash("src/a.ts")).toBe("src/a.ts");
  });
});
