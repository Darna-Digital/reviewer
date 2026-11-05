import { Link, createFileRoute } from "@tanstack/react-router";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CHIP, CHIP_ICON } from "#/components/chip";
import { Container } from "#/components/container";
import { Screenshot } from "#/components/screenshot";
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
import { ogImage } from "#/lib/og-image";

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
      ...ogImage("about", "About Reviewer, signed by Rūtenis Raila"),
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
 * opens. The tooltip shifts sideways to stay on screen. It renders on
 * <body>, as inside the letter it would take on the crawl's fade and blur.
 */
function BusinessValue({
  children,
  onNote,
}: {
  children: ReactNode;
  onNote: (element: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const wrapper = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = wrapper.current!.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - TIP_WIDTH / 2;
    const max = window.innerWidth - TIP_WIDTH - TIP_MARGIN;
    setPosition({
      left: Math.min(Math.max(left, TIP_MARGIN), max) + window.scrollX,
      top: rect.top + window.scrollY,
    });
    setLoaded(true);
    setOpen(true);
    onNote(wrapper.current);
  };
  const hide = () => {
    setOpen(false);
    onNote(null);
  };

  // A tap elsewhere or Escape closes it, as hover and blur don't on touch.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : ![wrapper.current, tip.current].some((node) =>
              node?.contains(event.target as Node)
            )
      ) {
        setOpen(false);
        onNote(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, onNote]);

  return (
    <span
      className="relative"
      onBlur={hide}
      onFocus={show}
      // Only a mouse opens it on hover; a tap also fires these, then click.
      onPointerEnter={(event) => event.pointerType === "mouse" && show()}
      onPointerLeave={(event) => event.pointerType === "mouse" && hide()}
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
      {loaded &&
        createPortal(
          <span
            className={cn(
              "absolute z-50 block overflow-hidden rounded-xl bg-black shadow-xl ring-1 ring-black/10 transition duration-150 xl:hidden dark:ring-white/15",
              open
                ? "translate-y-[calc(-100%-12px)] opacity-100"
                : "pointer-events-none translate-y-[calc(-100%-8px)] opacity-0"
            )}
            id="business-value-tip"
            ref={tip}
            role="tooltip"
            style={{ width: TIP_WIDTH, ...position }}
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
          </span>,
          document.body
        )}
    </span>
  );
}

/** Shows a pill's note for the pill, or hides it for null. */
type ShowNote = (key: string | null, element?: HTMLElement | null) => void;

/** Opens a pill's note on mouse hover or keyboard focus. */
function noteHandlers(key: string, showNote: ShowNote) {
  return {
    onBlur: () => showNote(null),
    onFocus: (event: React.FocusEvent<HTMLElement>) =>
      showNote(key, event.currentTarget),
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) =>
      event.pointerType === "mouse" && showNote(key, event.currentTarget),
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) =>
      event.pointerType === "mouse" && showNote(null),
  };
}

/** A paragraph of the letter, with the names in CHIPS as chips. */
function withChips(paragraph: string, showNote: ShowNote) {
  return paragraph
    .split(
      /(Reviewer|macOS app|terminal app|Claude Code|Codex|told me|business value|code monkey)/
    )
    .map((part, index) => {
      if (part === "business value") {
        return (
          <BusinessValue
            key={index}
            onNote={(element) => showNote(element && part, element)}
          >
            {part}
          </BusinessValue>
        );
      }
      const chip = CHIPS[part];
      if (!chip) return part;
      // The lockup already spells the name.
      const label = part === "Reviewer" ? null : part;
      const handlers = noteHandlers(part, showNote);
      if (chip.to) {
        return (
          <Link className={CHIP_LINK} key={index} to={chip.to} {...handlers}>
            {chip.icon}
            {label}
          </Link>
        );
      }
      if (chip.href) {
        return (
          <a className={CHIP_LINK} href={chip.href} key={index} {...handlers}>
            {chip.icon}
            {label}
          </a>
        );
      }
      return (
        // Focusable, so its note opens from the keyboard too.
        <span className={CHIP} key={index} tabIndex={0} {...handlers}>
          {chip.icon}
          {label}
        </span>
      );
    });
}

/**
 * A target of dashed rings, like code.storage's diagrams, around an icon:
 * the illustration for a note without a screenshot.
 */
function Target({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex size-full items-center justify-center text-neutral-300 dark:text-neutral-700">
      <svg
        className="absolute size-full"
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 4"
        viewBox="0 0 320 200"
      >
        <circle cx="160" cy="100" r="84" />
        <circle cx="160" cy="100" r="58" />
        <circle cx="160" cy="100" r="32" strokeDasharray="none" />
      </svg>
      <span className="relative text-[28px] leading-none text-neutral-900 dark:text-white">
        {children}
      </span>
    </div>
  );
}

const NOTE_ICON = "size-7";

/** What each pill means, shown beside the letter when it is hovered. */
const NOTES: Record<string, { title: string; body: string; art: ReactNode }> = {
  Reviewer: {
    title: "Reviewer",
    body: "Read the diff, comment on any line and hand the comment to an agent. Then review its fix in the same place.",
    art: <Shot name="split-diff" width={2560} height={1477} />,
  },
  "macOS app": {
    title: "The macOS app",
    body: "A native app for Apple silicon. The diff, your comments and your agents' sessions in one window.",
    art: <Shot name="comment-assign" width={2076} height={1430} />,
  },
  "terminal app": {
    title: "The terminal app",
    body: "The same review in a terminal: on your laptop, on a server over SSH or in a multiplexer pane. macOS and Linux.",
    art: <Shot name="tui-hero" width={2560} height={1358} />,
  },
  "Claude Code": {
    title: "Claude Code",
    body: "Anthropic's coding agent. Reviewer runs the one you have installed and hands it the comments you assign.",
    art: (
      <Target>
        <ClaudeIcon className={`${NOTE_ICON} text-[#D97757]`} />
      </Target>
    ),
  },
  Codex: {
    title: "Codex",
    body: "OpenAI's coding agent. Reviewer works with it the same way as with Claude Code.",
    art: (
      <Target>
        <CodexIcon className={NOTE_ICON} />
      </Target>
    ),
  },
  "business value": {
    title: "Business value",
    body: "What you're asked to ship instead of code, usually by someone who won't read it.",
    art: (
      <video
        aria-hidden
        autoPlay
        className="block size-full object-cover"
        height={360}
        loop
        muted
        playsInline
        src="/videos/business-value.mp4"
        width={480}
      />
    ),
  },
  "code monkey": {
    title: "Code monkey",
    body: "Someone who types out what they're told. Reading your own code doesn't make you one.",
    art: <Target>🐒</Target>,
  },
  "told me": {
    title: "Tell me",
    body: "Email rutenis@darnadigital.com. Feedback, bug reports and questions are all welcome.",
    art: (
      <Target>
        <Mail className={NOTE_ICON} />
      </Target>
    ),
  },
};

/** A note's screenshot: the top left of the window, where the detail is. */
function Shot(props: { name: string; width: number; height: number }) {
  return (
    <Screenshot
      alt=""
      className="size-full object-cover object-left-top"
      lazy
      {...props}
    />
  );
}

/**
 * The open note, in the empty column right of the letter: a dashed arrow,
 * like code.storage's, from the letter's edge at the pill's line to a card
 * explaining it. It draws in from the left, and moves between pills without
 * redrawing. Only from `xl`, where the column is empty.
 */
function PillNote({
  note,
}: {
  note: { key: string; y: number; open: boolean; moving: boolean } | null;
}) {
  if (!note) return null;
  const { title, body, art } = NOTES[note.key];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 left-[calc(42rem+24px)] hidden xl:block"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0",
          note.moving && "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateY(${note.y}px)` }}
      >
        <div
          className={cn(
            "absolute top-0 right-[344px] left-0 flex -translate-y-1/2 items-center text-neutral-400 transition-[clip-path] duration-300 ease-out dark:text-neutral-600",
            note.open
              ? "[clip-path:inset(-8px_0_-8px_0)]"
              : "[clip-path:inset(-8px_100%_-8px_0)]"
          )}
        >
          <span className="size-[9px] shrink-0 rounded-full border border-current" />
          <span className="h-0 flex-1 border-t border-dashed border-current" />
          <svg
            className="-ml-[9px] shrink-0"
            fill="none"
            height="14"
            stroke="currentColor"
            viewBox="0 0 8 14"
            width="8"
          >
            <path d="M1 1l6 6-6 6" />
          </svg>
        </div>
        <div
          className={cn(
            "absolute top-0 right-0 w-80 -translate-y-6 overflow-hidden rounded-2xl bg-neutral-50 ring-1 ring-black/[0.06] transition duration-200 ease-out dark:bg-neutral-900 dark:ring-white/[0.08]",
            note.open ? "opacity-100 delay-100" : "translate-x-2 opacity-0"
          )}
        >
          <div className="aspect-[16/10] overflow-hidden border-b border-black/[0.06] dark:border-white/[0.08]">
            {art}
          </div>
          <div className="flex flex-col gap-1 p-4">
            <span className="text-sm leading-5 font-medium text-neutral-900 dark:text-neutral-100">
              {title}
            </span>
            <span className="text-sm leading-5 text-neutral-600 dark:text-neutral-400">
              {body}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [note, setNote] = useState<{
    key: string;
    y: number;
    open: boolean;
    moving: boolean;
  } | null>(null);
  const column = useRef<HTMLDivElement>(null);

  const showNote: ShowNote = (key, element) => {
    if (!key || !element) {
      setNote((current) => current && { ...current, open: false });
      return;
    }
    const pill = element.getBoundingClientRect();
    const y =
      pill.top + pill.height / 2 - column.current!.getBoundingClientRect().top;
    // Slides from pill to pill; appears in place when it was closed.
    setNote((current) => ({ key, y, open: true, moving: !!current?.open }));
  };

  return (
    <Container>
      <section className="flex flex-col gap-10 pt-24 pb-24 sm:pt-36 lg:gap-12 lg:pt-44 lg:pb-32">
        <div className="flex max-w-3xl flex-col gap-5">
          <h1 className="type-display">About</h1>
          <p className="max-w-2xl type-lede text-neutral-600 dark:text-neutral-400">
            {DESCRIPTION}
          </p>
        </div>
        <div aria-hidden className="h-px w-40 bg-black/10 dark:bg-white/20" />
        <div className="relative" ref={column}>
          <article className="crawl flex max-w-2xl flex-col gap-5 sm:gap-6">
            {LETTER.map((paragraph) => (
              <p
                className="type-lede text-neutral-600 dark:text-neutral-400"
                key={paragraph}
              >
                {withChips(paragraph, showNote)}
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
          <PillNote note={note} />
        </div>
      </section>
    </Container>
  );
}
