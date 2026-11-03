import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { ChevronLeft, ChevronRight } from "#/components/icons";
import { ReleaseEntry } from "#/components/release-notes";
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
      <h1 className="text-3xl font-bold tracking-[-0.02em]">
        There’s no release with that version
      </h1>
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
  "group flex flex-col gap-1 rounded-2xl p-4 ring-1 ring-black/[0.06] transition-colors hover:bg-black/[0.03] dark:ring-white/[0.08] dark:hover:bg-white/[0.04]";

function ReleasePage() {
  const { release, latest, newer, older } = Route.useLoaderData();

  return (
    <Container className="pt-20 sm:pt-28 lg:pt-36">
      <Link
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
        to="/changelog"
      >
        <ChevronLeft className="size-4" />
        Changelog
      </Link>

      <ReleaseEntry latest={latest} release={release} standalone />

      <nav
        aria-label="Other releases"
        className="grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-8 dark:border-white/[0.08]"
      >
        {older ? (
          <Link
            className={STEP}
            params={{ version: older }}
            to="/changelog/$version"
          >
            <span className="inline-flex items-center gap-1 text-sm text-neutral-500">
              <ChevronLeft className="size-4" />
              Previous
            </span>
            <span className="font-mono text-[15px]">{older}</span>
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link
            className={`${STEP} items-end text-right`}
            params={{ version: newer }}
            to="/changelog/$version"
          >
            <span className="inline-flex items-center gap-1 text-sm text-neutral-500">
              Next
              <ChevronRight className="size-4" />
            </span>
            <span className="font-mono text-[15px]">{newer}</span>
          </Link>
        )}
      </nav>
    </Container>
  );
}
