/**
 * The live formatting backend: find the root that holds the file, and hand it
 * to the formatter that root would run itself.
 *
 * The same root-relative bookkeeping the language feature does, for the same
 * reason — paths arrive named from the project, a formatter only ever sees an
 * absolute root plus a path inside it, and what comes back is named from the
 * project again. A monorepo therefore formats each package by its own rules
 * without any of that reaching the HTTP API.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { FormattingRepo, FormatterInfo } from "@byconvo/core/formatting";
import { locateProjectPath, prefixProjectPath } from "@byconvo/core/project";
import type {
  Formatter,
  FormattingFailure,
} from "@byconvo/core/ports/formatter";
import { scanRepos } from "../workspace/repo-scan.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import { prettierFormatter } from "./prettier/prettier-formatter.ts";

/** A file located in the project, and the root a formatter would run in. */
interface Resolved {
  readonly root: string;
  readonly path: string;
}

/**
 * The repository over a formatter. `prettierFormatter` is the real one; a test
 * stands in its own to see which root a request reached.
 */
export const makeFormattingRepository = (formatter: Formatter) =>
  Effect.gen(function* () {
    const workspace = yield* WorkspaceContext;
    const fs = yield* FileSystem.FileSystem;

    const roots = Effect.flatMap(workspace.requireProject, (project) =>
      Effect.map(scanRepos(fs, project), (repos) => ({ project, repos }))
    );

    const resolve = (
      path: string
    ): Effect.Effect<Resolved, FormattingFailure> =>
      Effect.gen(function* () {
        const { project, repos } = yield* roots;
        const located = locateProjectPath(project, repos, path);
        // A path no root claims is one named from the selected repository
        // rather than from the project — what a repo-scoped view sends.
        return {
          root: located?.repo.path ?? (yield* workspace.requireCurrent),
          path: located?.path ?? path,
        };
      });

    const infoOf = (
      setup: {
        readonly available: boolean;
        readonly version: string | null;
        readonly configPath: string | null;
        readonly detail: string;
      },
      prefix: string
    ): FormatterInfo => ({
      id: formatter.id,
      name: formatter.name,
      available: setup.available,
      version: setup.version,
      configPath:
        setup.configPath === null
          ? null
          : prefixProjectPath(prefix, setup.configPath),
      detail: setup.detail,
    });

    const repo: FormattingRepo = {
      /**
       * The project's formatter. A project holding several roots is formatted
       * by whichever of them is set up for it — the first that can run wins, so
       * one repository bringing Prettier is enough for the files it holds, and
       * a project with none still says what it looked for.
       */
      formatter: Effect.gen(function* () {
        const { project, repos } = yield* roots;
        const candidates =
          repos.length === 0
            ? [{ path: yield* workspace.requireCurrent, name: "" }]
            : repos.map((entry) => ({ path: entry.path, name: entry.name }));
        let fallback: FormatterInfo | null = null;
        for (const candidate of candidates) {
          const prefix =
            candidate.path.replace(/\/+$/, "") === project.replace(/\/+$/, "")
              ? ""
              : candidate.name;
          const info = infoOf(yield* formatter.probe(candidate.path), prefix);
          if (info.available) return info;
          fallback ??= info;
        }
        return (
          fallback ?? {
            id: formatter.id,
            name: formatter.name,
            available: false,
            version: null,
            configPath: null,
            detail: "no repository is open",
          }
        );
      }),

      format: (path, contents) =>
        Effect.flatMap(resolve(path), (target) =>
          Effect.map(
            formatter.format({
              root: target.root,
              path: target.path,
              contents,
            }),
            (document) => ({
              path,
              // Null when the formatter declined the file — an extension it has
              // no parser for, or one an ignore file excludes.
              formatterId: document.contents === null ? null : formatter.id,
              changed:
                document.contents !== null && document.contents !== contents,
              contents: document.contents ?? contents,
            })
          )
        ),
    };

    return repo;
  });

export const makeLivePrettierRepository =
  makeFormattingRepository(prettierFormatter);
