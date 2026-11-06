import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { ChevronLeft, ChevronRight } from "#/components/icons";
import {
  PAGE_LINK,
  PAGE_STEP,
  PAGE_STEP_DISABLED,
  ReleaseEntry,
} from "#/components/release-notes";
import { cn } from "#/lib/cn";
import { getChangelog } from "#/lib/changelog";
import { SITE_URL } from "#/lib/links";
import { ogImage } from "#/lib/og-image";

export const Route = createFileRoute("/changelog/$version")({
  loader: async ({ params }) => {
    const releases = await getChangelog();
    const index = releases.findIndex(
      (release) => release.version === params.version
    );
    if (index === -1) throw notFound();
    return {
      release: releases[index],
      latest: index === 0,
      newer: releases[index - 1]?.version ?? null,
      older: releases[index + 1]?.version ?? null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { release } = loaderData;
    const title = `${release.title ?? `Reviewer ${release.version}`} · Changelog`;
    const url = `${SITE_URL}/changelog/${release.version}`;
    // The release's first note, without its Markdown, describes it in search
    // results and link previews.
    const first = release.sections[0]?.items[0];
    const description = first
      ? first
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[`*_]/g, "")
          .slice(0, 300)
      : `What changed in Reviewer ${release.version}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        ...ogImage(
          "changelog",
          "Changelog, above the terminal app's commit history"
        ),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <Container className="pt-28 sm:pt-36 lg:pt-44">
      <h1 className="type-title">There’s no release with that version</h1>
      <Link
        className="mt-4 inline-block text-neutral-600 underline underline-offset-2 dark:text-neutral-400"
        to="/changelog"
      >
        See every release
      </Link>
    </Container>
  ),
  component: ReleasePage,
});

/**
 * One release on its own, laid out like an entry in the list: the way back
 * above it and Newer and Older below, as the list's pagination is.
 */
function ReleasePage() {
  const { release, latest, newer, older } = Route.useLoaderData();

  return (
    <Container className="pt-20 sm:pt-28 lg:pt-36">
      <Link
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900 sm:mb-8 dark:hover:text-white"
        to="/changelog"
      >
        <ChevronLeft className="size-4" />
        Back to changelog
      </Link>

      <ReleaseEntry latest={latest} release={release} standalone />

      <nav
        aria-label="Other releases"
        className="flex items-center justify-between gap-4 pt-8"
      >
        {newer ? (
          <Link
            className={cn(PAGE_LINK, PAGE_STEP, "-ml-3")}
            params={{ version: newer }}
            title={`Reviewer ${newer}`}
            to="/changelog/$version"
          >
            <ChevronLeft className="size-4" />
            Newer
          </Link>
        ) : (
          <span
            aria-disabled
            className={cn(PAGE_LINK, PAGE_STEP_DISABLED, "-ml-3")}
          >
            <ChevronLeft className="size-4" />
            Newer
          </span>
        )}
        {older ? (
          <Link
            className={cn(PAGE_LINK, PAGE_STEP, "-mr-3")}
            params={{ version: older }}
            title={`Reviewer ${older}`}
            to="/changelog/$version"
          >
            Older
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span
            aria-disabled
            className={cn(PAGE_LINK, PAGE_STEP_DISABLED, "-mr-3")}
          >
            Older
            <ChevronRight className="size-4" />
          </span>
        )}
      </nav>
    </Container>
  );
}
