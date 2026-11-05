import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import {
  formatReleaseDate,
  formatReleaseTime,
  type Release,
} from "#/lib/changelog";
import { cn } from "#/lib/cn";

/** The changelog's only inline markup is `code`; everything else is text. */
export function InlineMarkdown({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/).map((part, index) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code
        className="rounded-[5px] bg-black/[0.05] px-1 py-px font-mono text-[0.88em] dark:bg-white/[0.08]"
        key={index}
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

/** A release's sections (Added, Changed, Fixed), each a heading and a list. */
function ReleaseNotes({ release }: { release: Release }) {
  return (
    <div className="flex flex-col gap-7">
      {release.sections.map((section, index) => (
        <section className="flex flex-col gap-3" key={section.title ?? index}>
          {section.title && <h3 className="type-subhead">{section.title}</h3>}
          <ul className="flex list-disc flex-col gap-2.5 pl-5 type-body text-neutral-700 marker:text-neutral-300 dark:text-neutral-300 dark:marker:text-neutral-600">
            {section.items.map((item) => (
              <li className="pl-1" key={item}>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Moves something into the notes' column, past the rail and its gap. */
export const PAST_RAIL = "sm:pl-[220px] lg:pl-[308px]";

/**
 * One release, as conductor.build sets them: its version and date in a rail,
 * the notes beside it and a rule under the notes. In the list the heading
 * links to the release's own page; on that page (`standalone`) it is the
 * page's heading instead.
 */
export function ReleaseEntry({
  release,
  latest,
  standalone = false,
}: {
  release: Release;
  latest: boolean;
  standalone?: boolean;
}) {
  const heading = release.title ?? `Reviewer ${release.version}`;

  return (
    <article
      className={cn(
        "grid grid-cols-1 gap-4 pt-10 pb-10 sm:grid-cols-[180px_1fr] sm:gap-10 sm:pt-14 sm:pb-14 lg:grid-cols-[260px_1fr] lg:gap-12",
        // The rule between the two columns, centred in the gap. It runs the
        // entry's full height, so consecutive entries join into one line.
        !standalone &&
          "relative sm:before:absolute sm:before:inset-y-0 sm:before:left-[200px] sm:before:w-px sm:before:bg-black/[0.06] lg:before:left-[284px] dark:sm:before:bg-white/[0.08]",
        !standalone &&
          "border-b border-black/[0.06] group-last:border-b-0 dark:border-white/[0.08]"
      )}
    >
      <div className="flex items-center gap-3 sm:sticky sm:top-24 sm:flex-col sm:items-start sm:gap-2 sm:self-start">
        <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 font-mono text-xs text-neutral-600 ring-1 ring-black/[0.06] ring-inset dark:bg-white/[0.06] dark:text-neutral-300 dark:ring-white/[0.08]">
          {release.version}
        </span>
        <time
          className="flex flex-wrap gap-x-1.5 text-sm text-neutral-500 sm:flex-col lg:flex-row"
          dateTime={release.publishedAt ?? release.date}
        >
          {/* The UTC day of the publish time, so the two always agree. */}
          <span>
            {formatReleaseDate(
              release.publishedAt?.slice(0, 10) ?? release.date
            )}
          </span>
          {release.publishedAt && (
            <span aria-hidden className="sm:max-lg:hidden">
              ·
            </span>
          )}
          {release.publishedAt && (
            <span className="tabular-nums">
              {formatReleaseTime(release.publishedAt)}
            </span>
          )}
        </time>
        {latest && (
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-300/15 dark:text-sky-300">
            Latest
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        {standalone ? (
          <h1 className="type-title">{heading}</h1>
        ) : (
          <h2 className="type-heading">
            <Link
              className="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
              params={{ version: release.version }}
              to="/changelog/$version"
            >
              {heading}
            </Link>
          </h2>
        )}
        <ReleaseNotes release={release} />
      </div>
    </article>
  );
}
