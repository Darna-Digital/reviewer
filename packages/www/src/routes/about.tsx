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
  "You need to bring ‘business value’ instead of just code. ‘Code is cheap’. ‘You’re a code monkey if you still care about the code’; ‘coding is solved’…",
  "On the one hand, the hype is incredibly annoying.",
  "It’s obnoxious. It’s even disrespectful.",
  "It ignores the intricacies of the day-to-day work you’re doing.",
  "It ignores the fact that ultimately you are responsible for the code you ship, not the AI agents you use, however powerful they are.",
  "On the other hand, you don’t want to feel like your skills as a programmer are getting obsolete.",
  "You do see the value in agents.",
  "But you still want to be involved in the design process of the systems you’re building.",
  "You want to understand the changes being made now, as well as historical changes made in the past.",
  "I know I was in this position. As a freelance developer I needed to work fast and juggle multiple projects. But I still was responsible for the outcomes and the quality of the code I was putting out.",
  "That’s why I built Reviewer. It combines classic IDE features like code diffs, Git integration, go-to-definition, and LSP support. But it also supports agentic coding powered by Claude Code and Codex.",
  "Reviewer ships as a native macOS app as well as a terminal app. I would be delighted if you tried these applications and told me what you think.",
];

const LINK =
  "underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100";

/** Laid out like the letter on darnadigital.com: one centred column. */
function AboutPage() {
  return (
    <Container>
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-10 pt-24 pb-10 text-center sm:pt-36 sm:pb-14 lg:gap-12 lg:pt-44 lg:pb-16">
        <div className="flex flex-col items-center gap-5">
          <h1 className="type-title">About</h1>
          <p className="max-w-[34ch] type-lede text-balance text-neutral-600 dark:text-neutral-400">
            {DESCRIPTION}
          </p>
        </div>
        <div aria-hidden className="h-px w-40 bg-black/10 dark:bg-white/15" />
        <article className="flex w-full flex-col gap-10 rounded-2xl bg-black/[0.03] px-6 py-10 text-left lg:px-10 lg:py-12 dark:bg-white/5">
          <div className="flex flex-col gap-5 [font-feature-settings:'zero','cpsp','ss03','ss02'] text-[15px] leading-[26px] tracking-[-0.01em]">
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
            <div className="flex flex-col gap-1 tracking-[-0.01em]">
              <span className="text-sm leading-5 font-medium">
                Rūtenis Raila
              </span>
              <span className="text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                Founder of{" "}
                <a className={LINK} href="/">
                  reviewer.sh
                </a>{" "}
                &amp;{" "}
                <a
                  className={LINK}
                  href="https://darnadigital.com"
                  rel="noreferrer"
                  target="_blank"
                >
                  darnadigital.com
                </a>
              </span>
            </div>
          </footer>
        </article>
      </section>
    </Container>
  );
}
