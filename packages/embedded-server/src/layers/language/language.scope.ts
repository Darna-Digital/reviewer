/**
 * Which repository a language request is about.
 *
 * Normally the one the window has open. A GET may instead name its own with
 * `?repo=` — the absolute path of a git work-tree root — and is then answered
 * against that root, the way a comments request with `?repo=` is: the window's
 * open project is left exactly as it was. That is what lets a client working in
 * its own checkout (a terminal UI, a coding agent) ask about its files through
 * whichever server answers.
 *
 * Nothing about the providers needs to change for it. Everything they cache —
 * the provider list, TypeScript projects, language server connections — is
 * keyed by root already, so a second root gets its own and the window's are
 * not disturbed.
 */
import { existsSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import * as Effect from "effect/Effect";
import {
  LanguageRepository,
  LanguageService,
  makeLanguageService,
  type LanguageRepo,
  type LanguageServiceShape,
} from "@reviewer/core/language";
import { InvalidRepo } from "@reviewer/core/workspace";
import { pinnedTo, WorkspaceContext } from "../workspace/workspace-context.ts";

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * The root a `?repo=` names, or why it does not name one.
 *
 * Stricter than the comments endpoint, which accepts any path inside a
 * repository: a language request addresses files by paths relative to this
 * root, so a subdirectory would silently shift every path the client sends.
 * Only a work-tree root qualifies — a directory holding `.git`, which is a
 * directory in a clone and a file in a linked worktree. Symlinks are resolved
 * so the root reads the way the compiler and the language servers will name
 * the files under it.
 */
export const requireRepoRoot = (
  repo: string
): Effect.Effect<string, InvalidRepo> =>
  Effect.suspend(() => {
    const invalid = (reason: string) =>
      Effect.fail(new InvalidRepo({ path: repo, reason }));
    if (repo.trim().length === 0) return invalid("the repo path is empty");
    if (!isAbsolute(repo)) return invalid("the repo path must be absolute");
    if (!isDirectory(repo)) return invalid("no such directory");
    if (!existsSync(join(repo, ".git"))) {
      return invalid("not the root of a git work tree (no .git here)");
    }
    return Effect.succeed(realpathSync(repo));
  });

/**
 * Run `use` against the language service for `repo`, or against the window's
 * when `repo` is absent.
 *
 * A named root gets a service of its own, built over a workspace pinned to it.
 * That is cheap — the repository and the service are closures over caches that
 * already outlive the request — and it is made directly rather than by
 * providing `LanguageLive` again, because layers are memoised per request and a
 * second provide would hand back the service built on the window's repository.
 *
 * `makeRepository` is the live repository in the server; a test stands in its
 * own over stub providers.
 */
export const makeLanguageScope =
  (makeRepository: Effect.Effect<LanguageRepo, never, WorkspaceContext>) =>
  (repo: string | undefined) =>
  <A, E, R>(
    use: (language: LanguageServiceShape) => Effect.Effect<A, E, R>
  ): Effect.Effect<
    A,
    E | InvalidRepo,
    R | LanguageService | WorkspaceContext
  > =>
    Effect.gen(function* () {
      if (repo === undefined)
        return yield* Effect.flatMap(LanguageService, use);
      const root = yield* requireRepoRoot(repo);
      const context = yield* WorkspaceContext;
      const repository = yield* makeRepository.pipe(
        Effect.provideService(WorkspaceContext, pinnedTo(context, root))
      );
      const language = yield* makeLanguageService.pipe(
        Effect.provideService(LanguageRepository, repository)
      );
      return yield* use(language);
    });
