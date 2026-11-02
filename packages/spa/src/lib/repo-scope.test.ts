import { afterEach, describe, expect, it } from "vitest";
import { fetchClient, ptySocketUrl } from "@/lib/api/client";
import {
  readScopedRepoFrom,
  REPO_HEADER,
  repoFromSearch,
  scopedRepo,
} from "@/lib/repo-scope";

const WEB = "/Users/dev/Rūta's web";

afterEach(() => readScopedRepoFrom(() => undefined));

describe("the repository the page is about", () => {
  it("is read off the search, ignoring an empty one", () => {
    expect(repoFromSearch({ repo: WEB })).toBe(WEB);
    expect(repoFromSearch({ repo: "" })).toBeUndefined();
    expect(repoFromSearch({ file: "a.ts" })).toBeUndefined();
  });

  it("names none until the page names one", () => {
    expect(scopedRepo()).toBeUndefined();
    readScopedRepoFrom(() => WEB);
    expect(scopedRepo()).toBe(WEB);
  });

  it("is stamped on every request, encoded", async () => {
    readScopedRepoFrom(() => WEB);
    let sent: string | null = null;
    await fetchClient.GET("/api/status", {
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        sent = request.headers.get(REPO_HEADER);
        return new Response("{}", {
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(sent).toBe(encodeURIComponent(WEB));
  });

  it("is named in a socket's query", () => {
    readScopedRepoFrom(() => WEB);
    const url = new URL(
      ptySocketUrl({
        id: "t1",
        agent: "terminal",
        cols: 80,
        rows: 24,
        theme: "dark",
      })
    );
    expect(url.searchParams.get("repo")).toBe(WEB);
  });
});
