import { createFileRoute } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { SITE_URL } from "#/lib/links";

const TITLE = "About · Reviewer";
const DESCRIPTION =
  "Reviewer is an agentic development environment for engineers who deeply care about the quality of their work.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/about` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/about` }],
  }),
  component: AboutPage,
});

/** Rūtenis's letter, one paragraph per entry, as he wrote it. */
const LETTER = [
  "Tell me if this sounds like you:",
  "You hear every tech influencer talking about how you need to ship faster.",
  "You need to stop reading the code.",
  "You need to run 10, 20, or 100 Claude Code sessions in parallel.",
  "You need to bring ‘business value’ instead of just code. ‘Code is cheap’. ‘You’re a code monkey if you still care about the code’; ‘coding is solved’…",
  "On the one hand, the hype is incredibly annoying.",
  "It’s obnoxious. It’s even disrespectful.",
  "It ignores the intricacies of the day-to-day work you’re doing.",
  "It ignores the fact that ultimately you are responsible for the code you ship, not the 100 parallel agents.",
  "On the other hand, you don’t want to feel like your skills as a programmer are getting obsolete.",
  "You do see the value in agents.",
  "But you still want to be involved in the design process of the systems you’re building.",
  "You want to understand the changes being made now, as well as historical changes made in the past.",
  "I know I was in this position. As a freelance developer I needed to work fast and juggle multiple projects. But I still was responsible for the outcomes and the quality of the code I was putting out.",
  "That’s why I built Reviewer. It combines classic IDE features like code diffs, Git integration, go-to-definition, and LSP support. But it also supports agentic coding powered by Claude Code and Codex.",
  "Reviewer ships as a native macOS app as well as a terminal app. I would be delighted for you to try these applications and tell me what you think.",
];

const LINK =
  "underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100";

function AboutPage() {
  return (
    <Container>
      <section className="flex flex-col gap-6 pt-24 pb-10 sm:pt-36 sm:pb-14 lg:pt-44 lg:pb-16">
        <h1 className="type-display">About</h1>
        <p className="max-w-2xl type-lede text-neutral-600 dark:text-neutral-400">
          {DESCRIPTION}
        </p>
        {/* The letter and sign-off follow darnadigital.com's. */}
        <article className="mt-6 flex max-w-2xl flex-col gap-10 rounded-[20px] bg-black/[0.035] px-6 py-10 ring-1 ring-black/[0.06] ring-inset sm:px-10 sm:py-12 dark:bg-white/[0.04] dark:ring-white/[0.08]">
          <div className="flex flex-col gap-5 type-body">
            {LETTER.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <footer className="flex flex-col items-start gap-3">
            <img
              alt="Rūtenis Raila"
              className="size-12 rounded-full object-cover object-top ring-1 ring-black/10 dark:ring-white/15"
              decoding="async"
              height={48}
              loading="lazy"
              src="/about/rutenis-raila.webp"
              width={48}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm leading-5 font-medium">
                Rūtenis Raila
              </span>
              <ul className="flex flex-col text-[13px] leading-5 text-neutral-600 dark:text-neutral-400">
                <li>
                  Founder of{" "}
                  <a className={LINK} href="/">
                    reviewer.sh
                  </a>
                </li>
                <li>
                  Consultant at{" "}
                  <a
                    className={LINK}
                    href="https://darnadigital.com"
                    rel="noreferrer"
                    target="_blank"
                  >
                    darnadigital.com
                  </a>
                </li>
              </ul>
            </div>
          </footer>
        </article>
      </section>
    </Container>
  );
}
