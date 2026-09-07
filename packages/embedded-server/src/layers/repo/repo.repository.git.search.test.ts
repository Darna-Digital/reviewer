import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import { describe, expect, it } from "vitest";
import { GitExec, type GitExecShape } from "@reviewer/core/ports/git-exec";
import type { SearchQuery } from "@reviewer/core/repo";
import {
  makeGitRepoRepository,
  parseContentMatches,
  searchArgs,
} from "./repo.repository.git.ts";

const NUL = "\0";
const record = (path: string, line: number, column: number, text: string) =>
  [path, String(line), String(column), text].join(NUL);

const query = (over: Partial<SearchQuery> = {}): SearchQuery => ({
  query: "openLocation",
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  limit: 200,
  ...over,
});

/** Records every invocation so the test can assert on the git command itself. */
const fakeGit = (stdout: string) => {
  const calls: Array<ReadonlyArray<string>> = [];
  const unused = () => Effect.succeed("");
  const git: GitExecShape = {
    run: unused,
    runVerbose: unused,
    runTolerant: (...args) => {
      calls.push(args);
      return Effect.succeed(stdout);
    },
    lines: () => Effect.succeed([]),
  };
  return { git, calls };
};

const runSearch = (stdout: string, q: SearchQuery) => {
  const { git, calls } = fakeGit(stdout);
  return Effect.runPromise(
    Effect.flatMap(makeGitRepoRepository, (repo) => repo.search(q)).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(GitExec)(GitExec.of(git)),
          FileSystem.layerNoop({})
        )
      )
    )
  ).then((results) => ({ results, calls }));
};

describe("parseContentMatches", () => {
  it("reads path, line, column and text off each record", () => {
    const out = `${record("src/app.ts", 12, 7, "const openLocation = () => {}")}\n`;

    expect(parseContentMatches(out, 200)).toEqual({
      matches: [
        {
          path: "src/app.ts",
          line: 12,
          column: 7,
          text: "const openLocation = () => {}",
        },
      ],
      truncated: false,
    });
  });

  it("keeps a path or a match containing colons intact", () => {
    const out = `${record("src/a:b.ts", 3, 1, "http://example.com:8080")}\n`;

    expect(parseContentMatches(out, 200).matches[0]).toEqual({
      path: "src/a:b.ts",
      line: 3,
      column: 1,
      text: "http://example.com:8080",
    });
  });

  it("reports truncation once the limit is reached, without over-collecting", () => {
    const out = [
      record("a.ts", 1, 1, "one"),
      record("b.ts", 2, 1, "two"),
      record("c.ts", 3, 1, "three"),
      "",
    ].join("\n");

    const { matches, truncated } = parseContentMatches(out, 2);

    expect(matches.map((m) => m.path)).toEqual(["a.ts", "b.ts"]);
    expect(truncated).toBe(true);
  });

  it("drops the carriage return of a CRLF file and caps very long lines", () => {
    const out = [
      record("crlf.ts", 1, 1, "const a = 1;\r"),
      record("min.js", 1, 1, "x".repeat(900)),
      "",
    ].join("\n");

    const [crlf, minified] = parseContentMatches(out, 200).matches;

    expect(crlf.text).toBe("const a = 1;");
    expect(minified.text).toHaveLength(400);
  });

  it("ignores blank and malformed records", () => {
    const out = `\n${record("a.ts", 1, 1, "kept")}\nnot-a-record\n\n`;

    expect(parseContentMatches(out, 200).matches).toHaveLength(1);
  });
});

describe("searchArgs", () => {
  it("searches literal text, case-insensitively, by default", () => {
    const args = searchArgs(query());

    expect(args).toContain("-F");
    expect(args).toContain("-i");
    expect(args).not.toContain("-w");
    expect(args.slice(-2)).toEqual(["-e", "openLocation"]);
  });

  it("switches to extended regex, whole words and case sensitivity on request", () => {
    const args = searchArgs(
      query({ regex: true, wholeWord: true, caseSensitive: true })
    );

    expect(args).toContain("-E");
    expect(args).toContain("-w");
    expect(args).not.toContain("-i");
  });

  it("passes the pattern behind -e so a leading dash is not read as a flag", () => {
    expect(searchArgs(query({ query: "--force" })).slice(-2)).toEqual([
      "-e",
      "--force",
    ]);
  });
});

describe("search", () => {
  it("greps the working tree and parses what git returned", async () => {
    const out = `${record("src/app.ts", 12, 7, "openLocation")}\n`;

    const { results, calls } = await runSearch(out, query());

    expect(calls[0][0]).toBe("grep");
    expect(results.matches).toHaveLength(1);
  });

  it("never shells out for an empty query", async () => {
    const { results, calls } = await runSearch("", query({ query: "" }));

    expect(calls).toEqual([]);
    expect(results).toEqual({ matches: [], truncated: false });
  });

  it("treats git's no-match exit as an empty result, not a failure", async () => {
    const { results } = await runSearch("", query());

    expect(results).toEqual({ matches: [], truncated: false });
  });
});
