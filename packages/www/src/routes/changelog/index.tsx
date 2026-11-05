import { Link, createFileRoute } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { ChevronLeft, ChevronRight } from "#/components/icons";
import {
  PAGE_LINK,
  PAGE_STEP,
  PAGE_STEP_DISABLED,
  ReleaseEntry,
} from "#/components/release-notes";
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
  head: ({ loaderData }) => {
    // Each page of the list is its own URL, so it is its own canonical.
    const page = loaderData?.page ?? 1;
    const url = `${SITE_URL}/changelog${page > 1 ? `?page=${page}` : ""}`;
    return {
      meta: [
        { title: page > 1 ? `Changelog, page ${page} · Reviewer` : TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: url },
      ],
      links: [
        { rel: "canonical", href: url },
        {
          rel: "alternate",
          type: "application/atom+xml",
          title: "Reviewer releases",
          href: `${RELEASES_URL}.atom`,
        },
      ],
    };
  },
  component: Changelog,
});

function Pagination({ page, pages }: { page: number; pages: number }) {
  if (pages < 2) return null;
  const search = (to: number) => (to > 1 ? { page: to } : {});

  return (
    <nav
      aria-label="Changelog pages"
      className="flex items-center justify-between gap-4 pt-8"
    >
      {page > 1 ? (
        <Link
          className={cn(PAGE_LINK, PAGE_STEP, "-ml-3")}
          search={search(page - 1)}
          to="/changelog"
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
      <ol className="flex items-center gap-1">
        {Array.from({ length: pages }, (_, index) => index + 1).map((to) => (
          <li key={to}>
            <Link
              aria-current={to === page ? "page" : undefined}
              className={cn(
                PAGE_LINK,
                to === page
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : PAGE_STEP
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
          className={cn(PAGE_LINK, PAGE_STEP, "-mr-3")}
          search={search(page + 1)}
          to="/changelog"
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

      <Pagination page={page} pages={pages} />
    </Container>
  );
}
