import { Link, createFileRoute } from "@tanstack/react-router";

import type { ReactNode } from "react";

import { CHIP, CHIP_ICON } from "#/components/chip";
import { Container } from "#/components/container";
import {
  Apple,
  ClaudeIcon,
  CodexIcon,
  Mail,
  Terminal,
} from "#/components/icons";
import { Logo } from "#/components/logo";
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

/** Sign-off links: the line's own colour, darkening and underlined on hover. */
const ICON = `${CHIP_ICON} text-neutral-900 dark:text-white`;
/** A chip that is a link: the same pill, a little darker on hover. */
const CHIP_LINK = `${CHIP} transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.12]`;

/**
 * The names the letter shows as chips, each with its icon. The apps link to
 * their pages and "told me" emails Rūtenis. Reviewer is the header's lockup,
 * at the icons' 0.9em and centred on the caps like them, so the chip is no
 * bigger than the others.
 */
const CHIPS: Record<
  string,
  { icon: ReactNode; to?: "/mac" | "/terminal"; href?: string }
> = {
  Reviewer: {
    icon: <Logo className="inline-block h-[0.9em] w-auto align-[-0.09em]" />,
  },
  "macOS app": { icon: <Apple className={ICON} />, to: "/mac" },
  "terminal app": { icon: <Terminal className={ICON} />, to: "/terminal" },
  "Claude Code": {
    icon: <ClaudeIcon className={`${CHIP_ICON} text-[#D97757]`} />,
  },
  Codex: { icon: <CodexIcon className={ICON} /> },
  "told me": {
    icon: <Mail className={ICON} />,
    href: "mailto:rutenis@darnadigital.com",
  },
};

/** A paragraph of the letter, with the names in CHIPS as chips. */
function withChips(paragraph: string) {
  return paragraph
    .split(/(Reviewer|macOS app|terminal app|Claude Code|Codex|told me)/)
    .map((part, index) => {
      const chip = CHIPS[part];
      if (!chip) return part;
      // The lockup already spells the name.
      const label = part === "Reviewer" ? null : part;
      if (chip.to) {
        return (
          <Link className={CHIP_LINK} key={index} to={chip.to}>
            {chip.icon}
            {label}
          </Link>
        );
      }
      if (chip.href) {
        return (
          <a className={CHIP_LINK} href={chip.href} key={index}>
            {chip.icon}
            {label}
          </a>
        );
      }
      return (
        <span className={CHIP} key={index}>
          {chip.icon}
          {label}
        </span>
      );
    });
}

const LINK =
  "underline-offset-4 decoration-current/30 transition-colors hover:text-neutral-950 hover:underline dark:hover:text-neutral-50";

/**
 * The letter, set like the intro above it and left-aligned like the other
 * pages' heroes. Each paragraph rises in tilted back like the Star Wars
 * opening crawl and settles flat as it reaches reading height (`.crawl` in
 * styles.css). Its chips are sized in em, so they follow the text.
 */
function AboutPage() {
  return (
    <Container>
      <section className="flex max-w-3xl flex-col gap-10 pt-24 pb-24 sm:pt-36 lg:gap-12 lg:pt-44 lg:pb-32">
        <div className="flex flex-col gap-5">
          <h1 className="type-display">About</h1>
          <p className="max-w-2xl type-lede text-neutral-600 dark:text-neutral-400">
            {DESCRIPTION}
          </p>
        </div>
        <div aria-hidden className="h-px w-40 bg-black/10 dark:bg-white/20" />
        <article className="crawl flex max-w-2xl flex-col gap-5 sm:gap-6">
          {LETTER.map((paragraph) => (
            <p
              className="type-lede text-neutral-600 dark:text-neutral-400"
              key={paragraph}
            >
              {withChips(paragraph)}
            </p>
          ))}
          <footer className="mt-8 flex flex-col items-start gap-3 lg:mt-10">
            <img
              alt="Rūtenis Raila"
              className="size-14 rounded-full object-cover object-top ring-1 ring-neutral-950/10 dark:ring-neutral-50/10"
              decoding="async"
              height={56}
              loading="lazy"
              src="/about/rutenis-raila.webp"
              width={56}
            />
            <div className="flex flex-col gap-1 tracking-[-0.01em]">
              <span className="text-base leading-6 font-medium">
                Rūtenis Raila
              </span>
              <span className="text-sm leading-5 text-neutral-950/70 dark:text-neutral-400">
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
