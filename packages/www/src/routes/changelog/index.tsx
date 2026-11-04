import { Link, createFileRoute } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { ChevronLeft, ChevronRight } from "#/components/icons";
import { PAST_RAIL, ReleaseEntry } from "#/components/release-notes";
import { getChangelog } from "#/lib/changelog";
import { RELEASES_URL, SITE_URL } from "#/lib/links";
import { cn } from "#/lib/cn";

const PER_PAGE = 10;
const TITLE = "Changelog · Reviewer";
const DESCRIPTION =
  "Every release of the Mac app and the terminal app, newest first.";

export const Route = createFileRoute("/changelog/")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const page = Number(search.page);
    return Number.isInteger(page) && page > 1 ? { page } : {};
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ deps }) => {
    const releases = await getChangelog();
    const pages = Math.max(1, Math.ceil(releases.length / PER_PAGE));
    const page = Math.min(deps.page, pages);
    return {
      page,
      pages,
      latest: releases[0]?.version,
      releases: releases.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    };
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/changelog` },
    ],
    links: [
      {
        rel: "alternate",
        type: "application/atom+xml",
        title: "Reviewer releases",
        href: `${RELEASES_URL}.atom`,
      },
    ],
  }),
  component: Changelog,
});

const PAGE_LINK =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium tabular-nums transition-colors";

function Pagination({ page, pages }: { page: number; pages: number }) {
  if (pages < 2) return null;
  const search = (to: number) => (to > 1 ? { page: to } : {});
  const step =
    "text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white";

  return (
    <nav
      aria-label="Changelog pages"
      className="flex items-center justify-between gap-4 border-t border-black/[0.06] pt-8 dark:border-white/[0.08]"
    >
      {page > 1 ? (
        <Link
          className={cn(PAGE_LINK, step)}
          search={search(page - 1)}
          to="/changelog"
        >
          <ChevronLeft className="size-4" />
          Newer
        </Link>
      ) : (
        <span />
      )}
      <ol className="flex items-center gap-1">
        {Array.from({ length: pages }, (_, index) => index + 1).map((to) => (
          <li key={to}>
            <Link
              aria-current={to === page ? "page" : undefined}
              className={cn(
                PAGE_LINK,
                to === page
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : step
              )}
              search={search(to)}
              to="/changelog"
            >
              {to}
            </Link>
          </li>
        ))}
      </ol>
      {page < pages ? (
        <Link
          className={cn(PAGE_LINK, step)}
          search={search(page + 1)}
          to="/changelog"
        >
          Older
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * Laid out as conductor.build's changelog is: the version and its date in a
 * rail beside the notes, ten releases to a page.
 */
function Changelog() {
  const { page, pages, latest, releases } = Route.useLoaderData();

  return (
    <Container>
      <header className="flex flex-col gap-4 pt-28 pb-12 sm:pt-36 sm:pb-16 lg:pt-44">
        <h1 className="type-display">Changelog</h1>
        <p className="max-w-xl type-lede text-neutral-600 dark:text-neutral-400">
          Every release of the Mac app and the terminal app, newest first.{" "}
          <a
            className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-900 dark:decoration-neutral-600 dark:hover:text-white"
            href={`${RELEASES_URL}.atom`}
          >
            Follow with RSS
          </a>
          .
        </p>
      </header>

      <ol className="flex flex-col">
        {releases.map((release) => (
          <li className="group" key={release.version}>
            <ReleaseEntry
              latest={release.version === latest}
              release={release}
            />
          </li>
        ))}
      </ol>

      <div className={PAST_RAIL}>
        <Pagination page={page} pages={pages} />
      </div>
    </Container>
  );
}
