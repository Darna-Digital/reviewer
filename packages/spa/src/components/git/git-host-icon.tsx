/**
 * The mark of the forge a thing came from — GitHub's or GitLab's — wherever the
 * app has to say which of the two it is talking about.
 *
 * One component rather than a conditional at each call site, because the choice
 * is always the same choice and the accessible name has to travel with the
 * glyph: a logo with no name is a shape to a screen reader. Both are stroke
 * glyphs in `currentColor`, which is what keeps them legible on both themes —
 * the filled brand logos are black, and black on a dark header is a hole.
 */
import { IconBrandGithub, IconBrandGitlab } from "@tabler/icons-react";
import { gitHostLabel, type GitHost } from "@byconvo/core/ports/git-remote";

export function GitHostIcon({
  host,
  className,
}: {
  host: GitHost;
  className?: string;
}) {
  const Icon = host === "gitlab" ? IconBrandGitlab : IconBrandGithub;
  return <Icon className={className} aria-label={gitHostLabel(host)} />;
}
