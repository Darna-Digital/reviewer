import { Link, createFileRoute } from "@tanstack/react-router";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
import { cn } from "#/lib/cn";
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
  "Reviewer ships as a native macOS app as well as a terminal app.",
  "I would be delighted if you tried these applications and told me what you think.",
];

/** Sign-off links: the line's own colour, darkening and underlined on hover. */
const ICON = `${CHIP_ICON} text-neutral-900 dark:text-white`;

/** An emoji as a chip's icon: the icons' size, before the label. */
function Emoji({ children }: { children: string }) {
  return (
    <span aria-hidden className="mr-[0.3em] text-[0.9em]">
      {children}
    </span>
  );
}
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
  "code monkey": { icon: <Emoji>🐒</Emoji> },
  "told me": {
    icon: <Mail className={ICON} />,
    href: "mailto:rutenis@darnadigital.com",
  },
};

/** The tooltip's width, and its margin from the edges of the screen. */
const TIP_WIDTH = 256;
const TIP_MARGIN = 12;

/**
 * "business value" as a chip, and on hover, focus or tap a
 * tooltip above it: Michael Scott quoting Wayne Gretzky quoting himself.
 * The clip is The Office's Giphy GIF as a 105 KB MP4, cropped above the
 * Peacock logo (public/videos), and only loads the first time the tooltip
 * opens. The tooltip shifts sideways to stay on screen.
 */
function BusinessValue({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapper = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = wrapper.current!.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - TIP_WIDTH / 2;
    const max = window.innerWidth - TIP_WIDTH - TIP_MARGIN;
    setShift(Math.min(Math.max(left, TIP_MARGIN), max) - left);
    setLoaded(true);
    setOpen(true);
  };

  // A tap elsewhere or Escape closes it, as hover and blur don't on touch.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !wrapper.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span
      className="relative"
      onBlur={() => setOpen(false)}
      onFocus={show}
      // Only a mouse opens it on hover; a tap also fires these, then click.
      onPointerEnter={(event) => event.pointerType === "mouse" && show()}
      onPointerLeave={(event) =>
        event.pointerType === "mouse" && setOpen(false)
      }
      ref={wrapper}
    >
      <button
        aria-describedby="business-value-tip"
        // A button lays out as inline-block, taking the line's full height;
        // Inter's glyph box as its line height draws it like the span chips.
        className={`${CHIP_LINK} cursor-help leading-[1.19]`}
        onClick={show}
        type="button"
      >
        <Emoji>📈</Emoji>
        {children}
      </button>
      {loaded && (
        <span
          className={cn(
            "absolute bottom-full left-1/2 z-10 mb-3 block overflow-hidden rounded-xl bg-black shadow-xl ring-1 ring-black/10 transition duration-150 dark:ring-white/15",
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-1 opacity-0"
          )}
          id="business-value-tip"
          role="tooltip"
          style={{
            width: TIP_WIDTH,
            marginLeft: shift - TIP_WIDTH / 2,
          }}
        >
          <video
            aria-label="Michael Scott from The Office, pensive in the conference room under his whiteboard quote: You miss 100% of the shots you don't take. Wayne Gretzky. Michael Scott."
            autoPlay
            className="block aspect-[480/360] w-full"
            height={360}
            loop
            muted
            playsInline
            src="/videos/business-value.mp4"
            width={480}
          />
        </span>
      )}
    </span>
  );
}

/** A paragraph of the letter, with the names in CHIPS as chips. */
function withChips(paragraph: string) {
  return paragraph
    .split(
      /(Reviewer|macOS app|terminal app|Claude Code|Codex|told me|business value|code monkey)/
    )
    .map((part, index) => {
      if (part === "business value") {
        return <BusinessValue key={index}>{part}</BusinessValue>;
      }
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
