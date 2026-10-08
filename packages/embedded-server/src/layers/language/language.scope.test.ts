/**
 * `?repo=` on the language GETs: a request naming a work-tree root is answered
 * against that root, and the window's open project is left as it was. One that
 * names anything else — a subdirectory, a relative path, nothing at all — is
 * refused before any provider is asked.
 */
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect } from "vitest";
import {
  LanguageRepository,
  LanguageService,
  makeLanguageService,
  makeMemoryLanguageRepository,
} from "@reviewer/core/language";
import type { LanguageProvider } from "@reviewer/core/ports/language-provider";
import {
  memoryLayer,
  WorkspaceContext,
} from "../workspace/workspace-context.ts";
import { makeLanguageRepository } from "./language.repository.live.ts";
import { makeLanguageScope, requireRepoRoot } from "./language.scope.ts";

const OPEN_REPO = "/work/open";

let scratch: string;
let clone: string;
let worktree: string;

beforeAll(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), "reviewer-scope-")));
  clone = join(scratch, "clone");
  mkdirSync(join(clone, ".git"), { recursive: true });
  mkdirSync(join(clone, "src"));
  worktree = join(scratch, "worktree");
  mkdirSync(worktree);
  writeFileSync(
    join(worktree, ".git"),
    "gitdir: /elsewhere/.git/worktrees/x\n"
  );
  writeFileSync(join(scratch, "plain.txt"), "not a directory\n");
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const reasonFor = (repo: string) =>
  Effect.map(Effect.flip(requireRepoRoot(repo)), (error) => {
    expect(error._tag).toBe("InvalidRepo");
    expect(error.path).toBe(repo);
    return error.reason;
  });

describe("requireRepoRoot", () => {
  it.effect("accepts a clone's root and a linked worktree's root", () =>
    Effect.gen(function* () {
      expect(yield* requireRepoRoot(clone)).toBe(clone);
      expect(yield* requireRepoRoot(`${clone}/`)).toBe(clone);
      expect(yield* requireRepoRoot(worktree)).toBe(worktree);
    })
  );

  it.effect("refuses anything that is not a work-tree root", () =>
    Effect.gen(function* () {
      expect(yield* reasonFor("")).toContain("empty");
      expect(yield* reasonFor("relative/repo")).toContain("absolute");
      expect(yield* reasonFor(join(scratch, "missing"))).toContain(
        "no such directory"
      );
      expect(yield* reasonFor(join(scratch, "plain.txt"))).toContain(
        "no such directory"
      );
      // Inside a repository is not good enough: paths are relative to the root.
      expect(yield* reasonFor(join(clone, "src"))).toContain("no .git");
    })
  );
});

/** A provider that answers every outline with the root it was asked under. */
const rootEchoingProvider: LanguageProvider = {
  id: "echo",
  name: "Echo",
  patterns: [".ts"],
  transport: "in-process",
  capabilities: {
    diagnostics: false,
    definition: false,
    references: false,
    hover: true,
    completions: false,
    codeActions: false,
    documentSymbols: true,
  },
  probe: () => Effect.succeed({ available: true, detail: "" }),
  diagnostics: () => Effect.succeed([]),
  definition: () =>
    Effect.succeed({ providerId: null, origin: null, targets: [] }),
  references: () =>
    Effect.succeed({
      providerId: null,
      origin: null,
      symbol: null,
      declaration: null,
      references: [],
    }),
  hover: (request) =>
    Effect.succeed({ providerId: "echo", range: null, contents: request.root }),
  completions: () =>
    Effect.succeed({
      providerId: null,
      replace: null,
      items: [],
      incomplete: false,
    }),
  resolveCompletion: () =>
    Effect.succeed({ detail: "", documentation: "", additionalEdits: [] }),
  codeActions: () => Effect.succeed([]),
  documentSymbols: (request) =>
    Effect.succeed({
      providerId: "echo",
      symbols: [
        {
          name: request.root,
          kind: "file",
          containerName: "",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          selectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          depth: 0,
        },
      ],
    }),
};

const withLanguageOf = makeLanguageScope(
  makeLanguageRepository(() => ({
    providers: [rootEchoingProvider],
    problems: [],
  }))
);

/**
 * The window's own service is the in-memory one, so an answer from it is easy
 * to tell apart from one the echoing provider gave under a named root.
 */
const windowLayer = Layer.mergeAll(
  memoryLayer(OPEN_REPO),
  Layer.effect(LanguageService)(makeLanguageService).pipe(
    Layer.provide(
      Layer.effect(LanguageRepository)(makeMemoryLanguageRepository())
    )
  )
);

describe("makeLanguageScope", () => {
  it.effect("answers from the window's service when no repo is named", () =>
    Effect.gen(function* () {
      const result = yield* withLanguageOf(undefined)((language) =>
        language.documentSymbols("src/app.ts", null)
      );
      expect(result.providerId).toBe("memory");
    }).pipe(Effect.provide(windowLayer))
  );

  it.effect("answers under a named root, leaving the open project alone", () =>
    Effect.gen(function* () {
      const outline = yield* withLanguageOf(clone)((language) =>
        language.documentSymbols("src/app.ts", null)
      );
      expect(outline.providerId).toBe("echo");
      expect(outline.symbols[0]?.name).toBe(clone);

      const hover = yield* withLanguageOf(clone)((language) =>
        language.hover("src/app.ts", { line: 0, character: 0 }, null)
      );
      expect(hover.contents).toBe(clone);

      const workspace = yield* WorkspaceContext;
      expect(yield* workspace.current).toBe(OPEN_REPO);
    }).pipe(Effect.provide(windowLayer))
  );

  it.effect("refuses a named root that is not one, before asking anyone", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        withLanguageOf(join(clone, "src"))((language) =>
          language.documentSymbols("app.ts", null)
        )
      );
      expect(error._tag).toBe("InvalidRepo");
    }).pipe(Effect.provide(windowLayer))
  );
});
