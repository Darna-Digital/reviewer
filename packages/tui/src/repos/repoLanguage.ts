import { languageClient } from '../language/client';
import type {
  LanguageClient,
  Location,
  Position,
  SymbolReference,
  SymbolTarget,
} from '../language/client';
import { inRepo, locate } from './repos';
import type { Repo, Repos } from './repos';

/**
 * The language API over the workspace: each request goes to the repository
 * holding the file, and the locations it answers with come back as
 * workspace paths.
 */
export function reposLanguageClient(repos: Repos): LanguageClient {
  const clients = new Map(
    repos.list.map((repo) => [repo, languageClient(repo.root)]),
  );
  const ask = (path: string) => {
    const at = locate(repos, path);
    return { client: clients.get(at.repo)!, repo: at.repo, path: at.path };
  };
  const place = (repo: Repo, location: Location): Location => ({
    ...location,
    path: inRepo(repos, repo, location.path),
  });
  const placeTarget = (repo: Repo, target: SymbolTarget): SymbolTarget => ({
    ...target,
    location: place(repo, target.location),
  });
  const placeReference = (
    repo: Repo,
    reference: SymbolReference,
  ): SymbolReference => ({
    ...reference,
    location: place(repo, reference.location),
  });

  return {
    async definition(path: string, at: Position) {
      const { client, repo, path: inside } = ask(path);
      const result = await client.definition(inside, at);
      return {
        ...result,
        targets: result.targets.map((target) => placeTarget(repo, target)),
      };
    },
    async references(path: string, at: Position) {
      const { client, repo, path: inside } = ask(path);
      const result = await client.references(inside, at);
      return {
        ...result,
        declaration: result.declaration
          ? placeTarget(repo, result.declaration)
          : null,
        references: result.references.map((reference) =>
          placeReference(repo, reference),
        ),
      };
    },
    hover(path: string, at: Position) {
      const { client, path: inside } = ask(path);
      return client.hover(inside, at);
    },
    symbols(path: string) {
      const { client, path: inside } = ask(path);
      return client.symbols(inside);
    },
  };
}
