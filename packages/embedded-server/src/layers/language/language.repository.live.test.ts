/**
 * The language backend over the open repository: a request reaches the
 * provider with the repository as its root and the path as the views name
 * it, and what comes back is handed on as the provider answered.
 */
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import type { LanguageRepo } from "@reviewer/core/language";
import type {
  LanguageFailure,
  LanguageProvider,
} from "@reviewer/core/ports/language-provider";
import { memoryLayer } from "../workspace/workspace-context.ts";
import { makeLanguageRepository } from "./language.repository.live.ts";
import type { RepositoryProviders } from "./language.providers.ts";

const REPO = "/work/backend";

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

/** The repository under test, over a stub provider recording what it was asked. */
const withRepo = <A>(
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
    Effect.provide(memoryLayer(REPO))
  );
};

describe("the language repository", () => {
  it.effect("asks the open repository, in its own terms", () =>
    withRepo((repo, asked) =>
      Effect.map(repo.definition("src/app.ts", position, null), (result) => {
        expect(asked).toEqual([{ root: REPO, path: "src/app.ts" }]);
        expect(result.targets[0].location.path).toBe("src/other.ts");
      })
    )
  );
  it.effect("hands references back as the provider named them", () =>
    withRepo((repo) =>
      Effect.map(repo.references("src/app.ts", position, null), (result) => {
        expect(result.declaration?.location.path).toBe("src/other.ts");
        expect(result.references.map((ref) => ref.location.path)).toEqual([
          "src/other.ts",
        ]);
      })
    )
  );
  it.effect("fails with NoRepoSelected when nothing is open", () =>
    Effect.gen(function* () {
      const asked: Array<Asked> = [];
      const providers: RepositoryProviders = {
        providers: [recordingProvider(asked)],
        problems: [],
      };
      const repo = yield* makeLanguageRepository(() => providers);
      const error = yield* Effect.flip(
        repo.definition("src/app.ts", position, null)
      );
      expect(error._tag).toBe("NoRepoSelected");
    }).pipe(Effect.provide(memoryLayer(null)))
  );
});
