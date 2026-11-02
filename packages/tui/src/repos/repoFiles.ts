import { grep, listFiles, readFile, statusMap } from '../git/files';
import type {
  FileContent,
  FileStatus,
  GrepOptions,
  GrepResult,
} from '../git/files';
import { inRepo, locate } from './repos';
import type { Repos } from './repos';

/** A workspace path's file as it stands in its repository's working tree. */
export function readRepoFile(repos: Repos, path: string): Promise<FileContent> {
  const at = locate(repos, path);
  return readFile(at.repo.root, at.path);
}

/** Every repository's files, each led by its name when there are several. */
export async function listRepoFiles(repos: Repos): Promise<string[]> {
  const lists = await Promise.all(
    repos.list.map(async (repo) =>
      (await listFiles(repo.root)).map((path) => inRepo(repos, repo, path)),
    ),
  );
  return lists.flat();
}

export async function repoStatusMap(
  repos: Repos,
): Promise<Map<string, FileStatus>> {
  const maps = await Promise.all(
    repos.list.map(async (repo) =>
      [...(await statusMap(repo.root))].map(
        ([path, status]) => [inRepo(repos, repo, path), status] as const,
      ),
    ),
  );
  return new Map(maps.flat());
}

/** `git grep` in each repository, the matches in workspace order. */
export async function grepRepos(
  repos: Repos,
  query: string,
  opts: GrepOptions,
): Promise<GrepResult> {
  const results = await Promise.all(
    repos.list.map(async (repo) => {
      const result = await grep(repo.root, query, opts);
      return {
        ...result,
        matches: result.matches.map((match) => ({
          ...match,
          path: inRepo(repos, repo, match.path),
        })),
      };
    }),
  );
  return {
    matches: results.flatMap((result) => result.matches),
    truncated: results.some((result) => result.truncated),
  };
}
