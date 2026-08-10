// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FileTypeIcon } from "./file-type-icon";

afterEach(cleanup);

const symbolOf = (path: string) => {
  const { container } = render(<FileTypeIcon path={path} />);
  return container.querySelector("use")?.getAttribute("href");
};

describe("FileTypeIcon", () => {
  it("wears the tree's icon for the file's type", () => {
    expect(symbolOf("src/pull-request-list.tsx")).toBe(
      "#file-tree-builtin-react"
    );
    expect(symbolOf("src/lib/utils.ts")).toBe("#file-tree-builtin-typescript");
    expect(symbolOf("package.json")).toBe("#file-tree-builtin-json");
  });

  it("falls back to the plain file icon for a type it has none for", () => {
    expect(symbolOf("notes.qqq")).toBe("#file-tree-builtin-default");
  });

  it("mounts the sprite the symbols live in exactly once", () => {
    render(<FileTypeIcon path="a.ts" />);
    render(<FileTypeIcon path="b.ts" />);
    expect(document.querySelectorAll("[data-icon-sprite]")).toHaveLength(1);
  });
});
