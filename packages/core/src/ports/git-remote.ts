/**
 * Who hosts `origin`, read out of the remote URL alone.
 *
 * Every review this app does — pull requests on GitHub, merge requests on
 * GitLab — starts with the same question: whose API answers for this checkout.
 * Git only ever tells us a URL, in one of four spellings (scp-style `git@`,
 * `ssh://` with an optional port, `https://` with optional credentials, and
 * `git://`), so reading the host out of it is a string problem and lives here
 * as a pure function rather than inside either provider.
 *
 * Self-hosted installs are the reason this takes options. `gitlab.com` names
 * itself, `git.acme.internal` does not, and no amount of pattern matching will
 * make it. So the caller passes the hostnames it has been told about
 * (BYCONVO_GITLAB_HOSTS / BYCONVO_GITHUB_HOSTS at the edge) and they win over
 * the built-in guesses.
 */
import * as Schema from "effect/Schema";

/** The forges byconvo can review against. */
export const GitHost = Schema.Literals(["github", "gitlab"]);
export type GitHost = typeof GitHost.Type;

/** `origin`, once we know who answers for it. */
export const GitRemoteInfo = Schema.Struct({
  host: GitHost,
  /** The hostname the remote points at — `gitlab.example.com`, say. */
  hostname: Schema.String,
  /**
   * The namespace the project sits in. One segment on GitHub; on GitLab it is
   * the whole group path, subgroups included (`team/platform`).
   */
  owner: Schema.String,
  /** The project's own name, with no `.git` suffix. */
  repo: Schema.String,
  /** `owner/repo` — GitLab's "project path with namespace". */
  path: Schema.String,
  /** Where the forge's web UI lives, with no trailing slash. */
  webUrl: Schema.String,
});
export type GitRemoteInfo = typeof GitRemoteInfo.Type;

export interface GitHostHints {
  /** Hostnames to read as GitLab even though their name does not say so. */
  readonly gitlabHosts?: ReadonlyArray<string>;
  /** The same, for a GitHub Enterprise install. */
  readonly githubHosts?: ReadonlyArray<string>;
}

interface RemoteParts {
  readonly hostname: string;
  readonly path: string;
}

/**
 * The hostname and repository path in a git remote URL, whichever way it was
 * written. Answers null for anything with no host in it — a local path, or a
 * file:// URL — because there is nothing for a forge to answer for there.
 */
const remoteParts = (url: string): RemoteParts | null => {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  // scp-style: [user@]host:path — the one form that is not a URL. Guarded
  // against a Windows drive letter (`C:\repo`) and against `ssh://` sneaking
  // in here, which the scheme test below catches first.
  const scp = /^(?:[^@/]+@)?([^/:]{2,}):(?!\/)(.+)$/.exec(trimmed);
  const scpHost = scp?.[1];
  if (scpHost !== undefined && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return { hostname: scpHost.toLowerCase(), path: scp?.[2] ?? "" };
  }

  // scheme://[user[:pass]@]host[:port]/path — read by hand rather than with
  // `URL`, which core cannot assume it has (it is built for the browser as
  // well as for Node).
  const parsed =
    /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^/:?#]+)(?::\d+)?(\/[^?#]*)?/i.exec(
      trimmed
    );
  const hostname = parsed?.[1];
  if (parsed === null || hostname === undefined) return null;
  return { hostname: hostname.toLowerCase(), path: parsed[2] ?? "" };
};

const listed = (hostname: string, hosts: ReadonlyArray<string>): boolean =>
  hosts.some((host) => host.trim().toLowerCase() === hostname);

/**
 * Which forge a hostname belongs to.
 *
 * The caller's own lists are asked first — a self-hosted install is only
 * knowable because somebody said so — then the two public hostnames, and only
 * then the guess that a host with the forge's name in it is that forge, which
 * is how nearly every self-hosted GitLab is actually named.
 */
export const gitHostOf = (
  hostname: string,
  hints: GitHostHints = {}
): GitHost | null => {
  const host = hostname.toLowerCase();
  if (listed(host, hints.githubHosts ?? [])) return "github";
  if (listed(host, hints.gitlabHosts ?? [])) return "gitlab";
  if (host === "github.com" || host.endsWith(".github.com")) return "github";
  if (host === "gitlab.com" || host.endsWith(".gitlab.com")) return "gitlab";
  if (/(^|\.)gitlab\./.test(host) || host.startsWith("gitlab.")) {
    return "gitlab";
  }
  if (/(^|\.)github\./.test(host)) return "github";
  return null;
};

/**
 * The project path in a remote URL: leading slash and `.git` suffix gone, and
 * GitLab's `/-/` marker (which appears when the URL was copied out of a
 * browser rather than the clone box) cut off with everything after it.
 */
const projectPath = (path: string): string =>
  path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .replace(/\/-\/.*$/, "");

/**
 * `origin` read into the forge, the namespace and the project — or null when
 * the URL names no host we review against.
 */
export const parseGitRemote = (
  url: string,
  hints: GitHostHints = {}
): GitRemoteInfo | null => {
  const parts = remoteParts(url);
  if (parts === null) return null;
  const host = gitHostOf(parts.hostname, hints);
  if (host === null) return null;

  const path = projectPath(parts.path);
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const repo = segments.at(-1);
  // A namespace and a project. GitHub has exactly one segment of namespace;
  // GitLab has one or more, and they are all part of the project's identity.
  if (repo === undefined || segments.length < 2) return null;
  const owner = segments.slice(0, -1).join("/");

  return {
    host,
    hostname: parts.hostname,
    owner,
    repo,
    path: `${owner}/${repo}`,
    webUrl: `https://${parts.hostname}`,
  };
};

/** How the forge is named in a sentence to a person. */
export const gitHostLabel = (host: GitHost): string =>
  host === "github" ? "GitHub" : "GitLab";

/** What the forge calls a change proposed against a branch. */
export const gitHostRequestLabel = (host: GitHost): string =>
  host === "github" ? "pull request" : "merge request";

/**
 * How the forge writes a request's number: GitHub's `#12`, GitLab's `!12`.
 * The sigil is worth keeping — it is what people paste to each other, and on
 * GitLab a `#12` is an issue rather than the merge request beside it.
 */
export const gitHostRequestRef = (host: GitHost, number: number): string =>
  `${host === "gitlab" ? "!" : "#"}${number}`;
