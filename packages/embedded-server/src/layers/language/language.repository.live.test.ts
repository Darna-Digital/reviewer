/**
 * The language backend over a project holding several roots. What matters here
 * is the addressing: a file named from the project has to reach the root that
 * holds it, as that root knows it, and everything the provider answers with has
 * to come back named from the project again — otherwise a definition opens the
 * wrong file, or nothing at all.
 */
import { it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import * as ByteSize from "effect/ByteSize";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { describe, expect } from "vitest";
import type { LanguageRepo } from "@reviewer/core/language";
import type {
  LanguageFailure,
  LanguageProvider,
} from "@reviewer/core/ports/language-provider";
import {
  WorkspaceContext,
  makeMemory,
} from "../workspace/workspace-context.ts";
import { makeLanguageRepository } from "./language.repository.live.ts";
import type { RepositoryProviders } from "./language.providers.ts";

const PROJECT = "/work";

/** Every directory the stub filesystem knows, and what it holds. */
const TREE: Readonly<Record<string, ReadonlyArray<string>>> = {
  "/work": ["backend", "frontend"],
  "/work/backend": ["src"],
  "/work/frontend": ["src"],
};
/** Which of those are git roots. */
const ROOTS = ["/work/backend", "/work/frontend"];

const info = (): FileSystem.File.Info => ({
  type: "Directory",
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: ByteSize.bytes(0),
  blksize: Option.none(),
  blocks: Option.none(),
});

const missing = (path: string) =>
  Effect.fail(
    PlatformError.systemError({
      _tag: "NotFound",
      module: "FileSystem",
      method: "stub",
      pathOrDescriptor: path,
    })
  );

/** A filesystem over TREE, with a `.git` directory in each root. */
const stubFs = (
  tree: Readonly<Record<string, ReadonlyArray<string>>>,
  roots: ReadonlyArray<string>
) => {
  const isDotGit = (path: string) =>
    roots.some((root) => path === `${root}/.git`);
  const isHead = (path: string) =>
    roots.some((root) => path === `${root}/.git/HEAD`);
  return FileSystem.layerNoop({
    readDirectory: (path) => {
      const names = tree[String(path)];
      return names === undefined
        ? missing(String(path))
        : Effect.succeed([...names]);
    },
    stat: (path) => {
      const at = String(path);
      return tree[at] !== undefined || isDotGit(at)
        ? Effect.succeed(info())
        : missing(at);
    },
    exists: (path) => {
      const at = String(path);
      return Effect.succeed(tree[at] !== undefined || isDotGit(at));
    },
    readFileString: (path) =>
      isHead(String(path))
        ? Effect.succeed("ref: refs/heads/main\n")
        : missing(String(path)),
  });
};

const range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 1 },
};
const position = { line: 0, character: 0 };

interface Asked {
  readonly root: string;
  readonly path: string;
}

/**
 * A provider that records what it was asked about and answers with paths as its
 * own root knows them — a definition beside the file, and one in a sibling
 * folder, which is what a real server returns.
 */
const recordingProvider = (asked: Array<Asked>): LanguageProvider => {
  const empty = { providerId: "stub", origin: null };
  return {
    id: "stub",
    name: "Stub",
    patterns: [".ts"],
    transport: "in-process",
    capabilities: {
      diagnostics: true,
      definition: true,
      references: true,
      hover: true,
      completions: true,
      codeActions: true,
    },
    probe: () => Effect.succeed({ available: true, detail: "" }),
    diagnostics: (request) => {
      asked.push({ root: request.root, path: request.path });
      return Effect.succeed([
        {
          range: range,
          severity: "error" as const,
          code: "1",
          source: "stub",
          message: "broken",
          tags: [],
          related: [
            { location: { path: "src/other.ts", range }, message: "here" },
          ],
        },
      ]);
    },
    definition: (request) => {
      asked.push({ root: request.root, path: request.path });
      return Effect.succeed({
        ...empty,
        targets: [
          {
            location: { path: "src/other.ts", range },
            name: "thing",
            kind: "function",
            containerName: "",
            preview: "export const thing = 1",
          },
        ],
      });
    },
    references: (request) => {
      asked.push({ root: request.root, path: request.path });
      return Effect.succeed({
        ...empty,
        symbol: "thing",
        declaration: {
          location: { path: "src/other.ts", range },
          name: "thing",
          kind: "function",
          containerName: "",
          preview: "export const thing = 1",
        },
        references: [
          {
            location: { path: "src/other.ts", range },
            kind: "read" as const,
            preview: "thing()",
            containerName: "",
            containerKind: "",
          },
        ],
      });
    },
    hover: (request) => {
      asked.push({ root: request.root, path: request.path });
      return Effect.succeed({ providerId: "stub", range: null, contents: "" });
    },
    completions: () =>
      Effect.succeed({
        providerId: "stub",
        replace: null,
        items: [],
        incomplete: false,
      }),
    resolveCompletion: (request) => {
      asked.push({ root: request.root, path: request.path });
      return Effect.succeed({
        detail: "",
        documentation: "",
        additionalEdits: [
          { path: "src/other.ts", edits: [{ range, newText: "x" }] },
        ],
      });
    },
    codeActions: (request) => {
      asked.push({ root: request.root, path: request.path });
      return Effect.succeed([
        {
          title: "Fix it",
          kind: "quickfix",
          edits: [{ path: "src/other.ts", edits: [{ range, newText: "x" }] }],
        },
      ]);
    },
  };
};

/** The workspace as it stands with `project` open and `current` selected. */
const workspaceLayer = (project: string, current: string) =>
  Layer.effect(WorkspaceContext)(
    Effect.flatMap(makeMemory(project), (context) =>
      Effect.as(context.selectRepo(current), context)
    )
  );

/**
 * The repository under test, over a stub provider list every root shares —
 * language configuration is per root, but what is being tested is where the
 * request went, not which provider answered.
 */
const withRepo = <A>(
  options: {
    readonly project: string;
    readonly current: string;
    readonly tree?: Readonly<Record<string, ReadonlyArray<string>>>;
    readonly roots?: ReadonlyArray<string>;
  },
  use: (
    repo: LanguageRepo,
    asked: ReadonlyArray<Asked>
  ) => Effect.Effect<A, LanguageFailure>
) => {
  const asked: Array<Asked> = [];
  const providers: RepositoryProviders = {
    providers: [recordingProvider(asked)],
    problems: [],
  };
  return makeLanguageRepository(() => providers).pipe(
    Effect.flatMap((repo) => use(repo, asked)),
    Effect.provide(workspaceLayer(options.project, options.current)),
    Effect.provide(stubFs(options.tree ?? TREE, options.roots ?? ROOTS))
  );
};

const multiRepo = { project: PROJECT, current: "/work/backend" };

describe("the language repository over a multi-root project", () => {
  it.effect("asks the root that holds the file, in its own terms", () =>
    withRepo(multiRepo, (repo, asked) =>
      Effect.map(repo.diagnostics("frontend/src/app.ts", null), (result) => {
        // The selected root is `backend`; the file is the frontend's.
        expect(asked).toEqual([{ root: "/work/frontend", path: "src/app.ts" }]);
        expect(result.path).toBe("frontend/src/app.ts");
        expect(result.providerId).toBe("stub");
        expect(result.diagnostics[0].related[0].location.path).toBe(
          "frontend/src/other.ts"
        );
      })
    )
  );

  it.effect("names definition targets from the project", () =>
    withRepo(multiRepo, (repo, asked) =>
      Effect.map(
        repo.definition("frontend/src/app.ts", position, null),
        (result) => {
          expect(asked[0].root).toBe("/work/frontend");
          expect(result.targets[0].location.path).toBe("frontend/src/other.ts");
        }
      )
    )
  );

  it.effect("names references and their declaration from the project", () =>
    withRepo(multiRepo, (repo) =>
      Effect.map(
        repo.references("backend/src/app.ts", position, null),
        (result) => {
          expect(result.references[0].location.path).toBe(
            "backend/src/other.ts"
          );
          expect(result.declaration?.location.path).toBe(
            "backend/src/other.ts"
          );
        }
      )
    )
  );

  it.effect("names the edits of a code action from the project", () =>
    withRepo(multiRepo, (repo) =>
      Effect.map(
        repo.codeActions("frontend/src/app.ts", range, null),
        (result) => {
          expect(result.actions[0].edits[0].path).toBe("frontend/src/other.ts");
        }
      )
    )
  );

  it.effect("names an auto-import's edits from the project", () =>
    withRepo(multiRepo, (repo) =>
      Effect.map(
        repo.resolveCompletion(
          "frontend/src/app.ts",
          position,
          { label: "thing", source: "./other", data: null },
          null
        ),
        (result) => {
          expect(result.additionalEdits[0].path).toBe("frontend/src/other.ts");
        }
      )
    )
  );

  it.effect("falls back to the selected root for a path no root holds", () =>
    withRepo(multiRepo, (repo, asked) =>
      Effect.map(repo.diagnostics("mobile/src/app.ts", null), (result) => {
        // It falls back to the selected root, which holds no `mobile/src`
        // either — but the request is still answered rather than failing.
        expect(asked).toEqual([
          { root: "/work/backend", path: "mobile/src/app.ts" },
        ]);
        expect(result.diagnostics).toHaveLength(1);
      })
    )
  );

  it.effect("lists a provider found in several roots once", () =>
    withRepo(multiRepo, (repo) =>
      Effect.map(repo.providers, (providers) => {
        expect(providers.map((provider) => provider.id)).toEqual(["stub"]);
        expect(providers[0].available).toBe(true);
      })
    )
  );
});

describe("the language repository over a single-root project", () => {
  const itself = {
    project: "/work/backend",
    current: "/work/backend",
    tree: { "/work/backend": ["src"] },
    roots: ["/work/backend"],
  };

  it.effect("leaves paths as the repository already named them", () =>
    withRepo(itself, (repo, asked) =>
      Effect.map(repo.definition("src/app.ts", position, null), (result) => {
        expect(asked).toEqual([{ root: "/work/backend", path: "src/app.ts" }]);
        expect(result.targets[0].location.path).toBe("src/other.ts");
      })
    )
  );
});
