import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { ChevronLeft, ChevronRight } from "#/components/icons";
import { PAST_RAIL, ReleaseEntry } from "#/components/release-notes";
import { getChangelog } from "#/lib/changelog";
import { SITE_URL } from "#/lib/links";

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
    return {
      meta: [
        { title },
        { property: "og:title", content: title },
        {
          property: "og:url",
          content: `${SITE_URL}/changelog/${release.version}`,
        },
      ],
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

const STEP =
  "group flex flex-col gap-0.5 text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-white";

/**
 * One release on its own, as conductor.build shows them: the way back above
 * the notes, then the entry, then the releases either side of it.
 */
function ReleasePage() {
  const { release, latest, newer, older } = Route.useLoaderData();

  return (
    <Container className="pt-20 sm:pt-28 lg:pt-36">
      <div className={PAST_RAIL}>
        <Link
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
          to="/changelog"
        >
          <ChevronLeft className="size-4" />
          Back to changelog
        </Link>
      </div>

      <ReleaseEntry latest={latest} release={release} standalone />

      <div className={PAST_RAIL}>
        <nav
          aria-label="Other releases"
          className="flex justify-between gap-4 border-t border-black/[0.06] pt-8 dark:border-white/[0.08]"
        >
          {older ? (
            <Link
              className={STEP}
              params={{ version: older }}
              to="/changelog/$version"
            >
              <span className="inline-flex items-center gap-1 text-sm">
                <ChevronLeft className="size-4" />
                Older
              </span>
              <span className="pl-5 font-mono text-[15px] text-neutral-900 dark:text-white">
                {older}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {newer && (
            <Link
              className={`${STEP} items-end`}
              params={{ version: newer }}
              to="/changelog/$version"
            >
              <span className="inline-flex items-center gap-1 text-sm">
                Newer
                <ChevronRight className="size-4" />
              </span>
              <span className="pr-5 font-mono text-[15px] text-neutral-900 dark:text-white">
                {newer}
              </span>
            </Link>
          )}
        </nav>
      </div>
    </Container>
  );
}
