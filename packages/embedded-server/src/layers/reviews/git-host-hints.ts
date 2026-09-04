/**
 * The self-hosted forges this machine has been told about.
 *
 * `github.com` and `gitlab.com` name themselves and most self-hosted GitLabs
 * are called `gitlab.something`, but `git.acme.internal` is knowable only
 * because somebody says so. That somebody is the environment:
 *
 *   BYCONVO_GITLAB_HOSTS=git.acme.internal,code.acme.dev
 *   BYCONVO_GITHUB_HOSTS=github.acme.internal
 *
 * Read at the edge and handed to the pure parser, so the parser stays a
 * function of its arguments and the environment is read in exactly one place.
 */
import type { GitHostHints } from "@byconvo/core/ports/git-remote";

const hosts = (value: string | undefined): Array<string> =>
  (value ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

export const gitHostHints = (
  env: Record<string, string | undefined> = process.env
): GitHostHints => ({
  gitlabHosts: hosts(env["BYCONVO_GITLAB_HOSTS"]),
  githubHosts: hosts(env["BYCONVO_GITHUB_HOSTS"]),
});
