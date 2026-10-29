import { describe, expect, it } from "vitest";
import { pathName } from "@/lib/display-path";
import { adoptTabKey, tabFile, tabKey } from "./tab-key";
import { reconcileTabs, tabToRestore } from "./tabs.functions";
import type { TabsState } from "../interfaces/tabs.interfaces";

const API = "/work/api";
const WEB = "/work/web";

const tab = (path: string) => ({ path, pinned: false, preview: false });

describe("a tab's key", () => {
  it("names the same file in two repositories apart", () => {
    expect(tabKey(API, "src/index.ts")).not.toBe(tabKey(WEB, "src/index.ts"));
  });

  it("reads back to its repository and path", () => {
    expect(tabFile(tabKey(API, "src/index.ts"))).toEqual({
      repo: API,
      path: "src/index.ts",
    });
    expect(tabFile("src/index.ts")).toEqual({
      repo: null,
      path: "src/index.ts",
    });
  });

  it("shows the file's own name", () => {
    expect(pathName(tabKey(API, "src/lib/client.ts"))).toBe("client.ts");
  });

  // `CSS.escape` turns a NUL into U+FFFD, and the strip finds its active
  // tab by an escaped selector.
  it("holds no NUL, which the strip's selector could not match", () => {
    expect(tabKey(API, "a.ts")).not.toContain("\u0000");
  });

  it("takes a strip saved before workspaces as its repository's", () => {
    expect(adoptTabKey("src/index.ts", API)).toBe(tabKey(API, "src/index.ts"));
    const qualified = tabKey(WEB, "a.ts");
    expect(adoptTabKey(qualified, API)).toBe(qualified);
  });
});

describe("a workspace's strip", () => {
  const strip: TabsState = {
    tabs: [tab(tabKey(API, "server.ts")), tab(tabKey(WEB, "page.tsx"))],
    active: tabKey(API, "server.ts"),
  };
  const webs = (key: string) => tabFile(key).repo === WEB;

  it("restores only the page's own repository's tab", () => {
    expect(tabToRestore(strip, webs)).toBe(tabKey(WEB, "page.tsx"));
    expect(tabToRestore(strip)).toBe(tabKey(API, "server.ts"));
  });

  it("keeps every repository's tabs when the page moves between them", () => {
    const { open, tabs } = reconcileTabs(strip, {
      viewing: null,
      switched: false,
      canRestore: true,
      restorable: webs,
    });
    expect(open).toBe(tabKey(WEB, "page.tsx"));
    expect(tabs.tabs.map((entry) => entry.path)).toEqual(
      strip.tabs.map((entry) => entry.path)
    );
  });
});
