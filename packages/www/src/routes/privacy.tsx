import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Container } from "#/components/container";
import { InlineMarkdown } from "#/components/release-notes";
import { SITE_URL } from "#/lib/links";

const TITLE = "Privacy · Reviewer";
const DESCRIPTION =
  "What Reviewer sends, what it never sends, and how to turn the count off.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/privacy` },
    ],
  }),
  component: PrivacyPage,
});

/**
 * What the first update check of a day carries, as src/lib/usage.ts reads
 * it. Keep the two, and the README's Privacy section, in step.
 */
const SENT: Array<[string, string]> = [
  ["App", "Mac app or terminal app"],
  ["Version", "The one you run, such as `0.0.42`"],
  ["OS", "macOS major version (`26`), or `linux` / `darwin`"],
  ["Day", "Your local date"],
  ["First this week", "Yes or no"],
  ["First this month", "Yes or no"],
  ["New install", "Yes or no"],
  ["Install month", "Such as `2026-11`"],
  ["Country", "Added by Cloudflare; the IP isn't kept"],
];

const NEVER = [
  "Your code, diffs, comments, file paths or repository names.",
  "Your name, email, GitHub account or git identity.",
  "An install ID, a device ID or anything else that tells one person from another.",
  "Your IP address. Cloudflare uses it to deliver the request; we don't store it.",
  "What you do in the app: which views, which commands, how long.",
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex scroll-mt-28 flex-col gap-4" id={id}>
      <h2 className="text-[22px] font-semibold tracking-[-0.01em] sm:text-[26px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

const TEXT =
  "text-[15px] leading-relaxed text-neutral-700 lg:text-base dark:text-neutral-300";

const LIST = `flex list-disc flex-col gap-2.5 pl-5 marker:text-neutral-300 dark:marker:text-neutral-600 ${TEXT}`;

function P({ children }: { children: string }) {
  return (
    <p className={TEXT}>
      <InlineMarkdown text={children} />
    </p>
  );
}

function List({ items }: { items: Array<string> }) {
  return (
    <ul className={LIST}>
      {items.map((item) => (
        <li className="pl-1" key={item}>
          <InlineMarkdown text={item} />
        </li>
      ))}
    </ul>
  );
}

function PrivacyPage() {
  return (
    <Container>
      <article className="flex max-w-3xl flex-col gap-12 pt-24 sm:pt-36 lg:pt-44">
        <header className="flex flex-col gap-6">
          <h1 className="text-[36px] leading-[1.05] font-bold tracking-[-0.02em] text-balance sm:text-[52px]">
            Privacy
          </h1>
          <p className="text-[19px] leading-snug font-medium text-neutral-600 sm:text-[22px] dark:text-neutral-400">
            Reviewer runs on your machine. Your code stays there. The one thing
            the apps tell us is that they were used today, and you can turn that
            off.
          </p>
        </header>

        <Section id="apps" title="What the apps send">
          <P>
            Both apps check for updates: the Mac app on launch and every few
            hours, the terminal app while it runs. The check goes to
            reviewer.sh, which sends it straight on to the latest release on
            GitHub. That is how updates have always worked; only the stop on the
            way is new.
          </P>
          <P>
            The first check of each day also says the following, and nothing
            else. Every later check that day says nothing at all.
          </P>
          <dl className="w-full">
            {SENT.map(([label, value]) => (
              <div
                className="flex items-baseline justify-between gap-6 border-b border-black/[0.06] py-3 text-[15px] last:border-b-0 lg:text-base dark:border-white/[0.08]"
                key={label}
              >
                <dt className="shrink-0 text-neutral-500">{label}</dt>
                <dd className="text-right text-pretty text-neutral-900 dark:text-neutral-100">
                  <InlineMarkdown text={value} />
                </dd>
              </div>
            ))}
          </dl>
          <P>
            The app works out the yes-or-no answers itself, from the dates it
            last counted, so we never need anything that identifies it. Two days
            from the same install can't be linked to each other.
          </P>
        </Section>

        <Section id="never" title="What they never send">
          <List items={NEVER} />
        </Section>

        <Section id="opt-out" title="Turning it off">
          <P>
            Counting is on by default and off with one switch. Updates keep
            working either way; a check from an app you've turned off simply
            carries none of the details above.
          </P>
          <List
            items={[
              "Mac app: Settings (⌘,) → Privacy → turn off Share anonymous usage counts.",
              "Terminal app: run Turn usage counting off / on from the command palette, or set `REVIEWER_DISABLE_ANALYTICS=1` or `DO_NOT_TRACK=1` in your environment.",
              "Development builds never count.",
            ]}
          />
        </Section>

        <Section id="storage" title="Where it goes">
          <P>
            The checks are written to Cloudflare Workers Analytics Engine, which
            keeps them for three months. Once a day they're added up into daily
            totals, by app, version, OS, country and install month, kept in
            Cloudflare D1. The totals are what we look at: how many installs ran
            each day, week and month, and which versions they run.
          </P>
        </Section>

        <Section id="elsewhere" title="Other places the apps connect to">
          <P>
            These go directly from your machine, not through us, and the
            services' own policies apply:
          </P>
          <List
            items={[
              "GitHub, to download updates, and for pull requests and other GitHub views, as the account you've signed in with.",
              "The coding agents you choose to run from Reviewer, such as Claude Code or Codex, which send what you give them to their providers.",
              "The npm registry, if you ask Reviewer to install the PHP language server.",
            ]}
          />
        </Section>

        <Section id="website" title="This website">
          <P>
            reviewer.sh has no analytics scripts and sets no tracking cookies.
            It runs on Cloudflare, which handles each request, including your IP
            address, to serve and protect the site, and keeps short-lived
            request logs we can read when something breaks.
          </P>
          <P>
            If you join the Reviewer Cloud waitlist, we keep your email address
            and the time you joined, in Cloudflare D1, and use it only to tell
            you when Cloud opens. The form is guarded by Cloudflare Turnstile,
            which checks the browser is used by a person before it sends.
          </P>
        </Section>

        <Section id="contact" title="Questions">
          <p className={TEXT}>
            Reviewer is made by{" "}
            <a
              className="underline underline-offset-2"
              href="https://darnadigital.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              Darna Digital
            </a>
            . To ask about your data or to be taken off the waitlist, email{" "}
            <a
              className="underline underline-offset-2"
              href="mailto:rutenis@darnadigital.com"
            >
              rutenis@darnadigital.com
            </a>
            .
          </p>
        </Section>
      </article>
    </Container>
  );
}
