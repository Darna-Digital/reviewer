import { Link, createFileRoute, useLoaderData } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Container } from "#/components/container";
import { WaitlistForm } from "#/components/waitlist-form";
import { formatStars } from "#/lib/github-stars";
import { cn } from "#/lib/cn";
import { DOWNLOAD_URL, REPO_URL, SITE_URL } from "#/lib/links";

const TITLE = "Reviewer Cloud · Reviewer";
const DESCRIPTION =
  "Reviewer Cloud is the paid part of Reviewer we're building next. Join the waitlist to hear when it opens.";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/cloud` },
    ],
  }),
  component: CloudPage,
});

/** One ruled band of the page, as opencode.ai stacks them. */
function Band({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 border-t border-black/[0.08] px-5 py-10 first:border-t-0 sm:px-12 sm:py-14 dark:border-white/[0.08]",
        className
      )}
    >
      {title && <h2 className="text-[13px] font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] text-[13px] leading-6 text-neutral-600 dark:text-neutral-400">
      <span className="text-neutral-400 dark:text-neutral-500">[*]</span>
      <span className="text-pretty">{children}</span>
    </li>
  );
}

const CELL =
  "flex h-16 items-center justify-center text-[13px] text-neutral-700 transition-colors hover:bg-black/[0.03] dark:text-neutral-300 dark:hover:bg-white/[0.04]";

/**
 * Laid out in opencode.ai's marketing language: one monospace column between
 * hairlines, ruled bands, [*] points. It says only what's decided: the cloud
 * is paid, and it's next.
 */
function CloudPage() {
  const { stars } = useLoaderData({ from: "__root__" });

  return (
    <Container className="pt-20 sm:pt-28 lg:pt-32">
      <div className="border-x border-b border-black/[0.08] font-mono dark:border-white/[0.08]">
        <Band className="gap-5 pt-14 sm:pt-20">
          <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
            [ waitlist ]
          </p>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[36px]">
            Reviewer Cloud
          </h1>
          <p className="max-w-xl text-[14px] leading-6 text-pretty text-neutral-600 dark:text-neutral-400">
            The paid part of Reviewer, and what we're building next. Leave your
            email and we'll tell you when it opens.
          </p>
          <div className="mt-2 max-w-xl">
            <WaitlistForm />
          </div>
        </Band>

        <Band title="What's decided">
          <ul className="flex flex-col gap-2">
            <Point>
              It's paid. The Mac app and the terminal app stay free and
              MIT-licensed.
            </Point>
            <Point>
              It's next. What it does and what it costs go on this page when it
              has a date, not behind a "Contact sales".
            </Point>
            <Point>
              Everything you do in Reviewer today keeps working on your machine
              without it.
            </Point>
          </ul>
        </Band>

        <Band title="Use Reviewer today">
          <p className="text-[13px] leading-6 text-neutral-600 dark:text-neutral-400">
            Read the change, comment on the lines that are wrong and hand them
            to an agent, on your Mac or in your terminal.
          </p>
        </Band>

        <nav className="grid grid-cols-2 border-t border-black/[0.08] sm:grid-cols-4 dark:border-white/[0.08] [&>*]:border-black/[0.08] dark:[&>*]:border-white/[0.08] [&>*:not(:first-child)]:sm:border-l [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0">
          <a className={CELL} href={DOWNLOAD_URL}>
            Download for Mac
          </a>
          <Link className={CELL} to="/terminal">
            Terminal app
          </Link>
          <Link className={CELL} to="/changelog">
            Changelog
          </Link>
          <a
            className={CELL}
            href={REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
            {stars !== null && (
              <span className="ml-1.5 text-neutral-400 dark:text-neutral-500">
                [{formatStars(stars)}]
              </span>
            )}
          </a>
        </nav>
      </div>
    </Container>
  );
}
