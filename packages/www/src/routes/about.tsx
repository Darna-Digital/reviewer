import { Link, createFileRoute } from "@tanstack/react-router";

import { useRef, useState, type ReactNode } from "react";

import { PRIMARY_BUTTON } from "#/components/buttons";
import { CHIP, CHIP_ICON } from "#/components/chip";
import { Container } from "#/components/container";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "#/components/ui/drawer";
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
  "Reviewer is a macOS app and a terminal app for reviewing the changes your coding agents make and sending your comments back to them.";

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

/**
 * Rūtenis's letter, one paragraph per entry. A list is set as bullets: what
 * each app does.
 */
const LETTER: (string | string[])[] = [
  "Reviewer is for reading and reviewing the code your coding agents write.",
  "Agents like Claude Code and Codex make changes quickly, but you’re still the one responsible for what ships. Reviewer gives you one place to read those changes, comment on what’s wrong and send it back to the agent to fix.",
  "It comes as a macOS app and a terminal app. Comments are shared between them, so you can leave one in either and pick it up in the other.",
  "The macOS app:",
  [
    "Shows the diff side by side or top to bottom, and opens the whole file when a hunk isn’t enough context.",
    "Lets you comment on any line and assign the comment to an agent session to fix.",
    "Runs Claude Code and Codex sessions in the same window as the diff.",
    "Follows a symbol to its definition or lists every usage, in TypeScript, Swift, Ruby and PHP.",
    "Creates branches, writes commit messages from what changed, and filters history by author, date or branch.",
    "Starts your local services in one click.",
  ],
  "The terminal app:",
  [
    "Opens your branch, a single commit or a GitHub pull request with one command.",
    "Lets you comment on any line from the keyboard. Any agent can pick the comments up with the resolve-reviewer-comments skill.",
    "Runs on macOS and Linux, on your laptop or on a server over SSH.",
    "Puts every action in a command palette: go to file, search, switch branch and Git.",
    "Supports opening several repositories side by side.",
  ],
  "I built Reviewer while freelancing across several projects at once. I wanted to move fast with agents and still understand every change I shipped.",
  "Both apps are free and open source. I’d be glad if you tried them and told me what you think.",
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

/** Shows a pill's note for the pill, or hides it for null. */
type ShowNote = (key: string | null, element?: HTMLElement | null) => void;

/** Where the letter has the empty column for notes: Tailwind's `xl`. */
const NOTE_COLUMN = "(min-width: 80rem)";

/**
 * Opens a pill's note beside the letter on mouse hover or keyboard focus.
 * Without that column, a tap or click opens it in a drawer instead, in
 * place of following the pill's link; the drawer has the link.
 */
function noteHandlers(
  key: string,
  showNote: ShowNote,
  openDrawer: (key: string) => void
) {
  return {
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (window.matchMedia(NOTE_COLUMN).matches) return;
      event.preventDefault();
      openDrawer(key);
    },
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
function withChips(
  paragraph: string,
  showNote: ShowNote,
  openDrawer: (key: string) => void
) {
  return paragraph
    .split(/(Reviewer|macOS app|terminal app|Claude Code|Codex|told me)/)
    .map((part, index) => {
      const handlers = noteHandlers(part, showNote, openDrawer);
      const chip = CHIPS[part];
      if (!chip) return part;
      // The lockup already spells the name.
      const label = part === "Reviewer" ? null : part;
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
        <span
          className={`${CHIP} cursor-help`}
          key={index}
          tabIndex={0}
          {...handlers}
        >
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

/** What each pill means: beside the letter on hover, or in a drawer. */
const NOTES: Record<
  string,
  { title: string; body: string; art: ReactNode; action?: string }
> = {
  Reviewer: {
    title: "Reviewer",
    body: "Read the diff, comment on any line and hand the comment to an agent. Then review its fix in the same place.",
    art: <Shot name="split-diff" width={2560} height={1477} />,
  },
  "macOS app": {
    title: "The macOS app",
    body: "A native app for Apple silicon. The diff, your comments and your agents' sessions in one window.",
    art: <Shot name="comment-assign" width={2076} height={1430} />,
    action: "See the macOS app",
  },
  "terminal app": {
    title: "The terminal app",
    body: "The same review in a terminal: on your laptop, on a server over SSH or in a multiplexer pane. macOS and Linux.",
    art: <Shot name="tui-hero" width={2560} height={1358} />,
    action: "See the terminal app",
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
    body: "OpenAI's coding agent. Reviewer runs the one you have installed and hands it the comments you assign.",
    art: (
      <Target>
        <CodexIcon className={NOTE_ICON} />
      </Target>
    ),
  },
  "told me": {
    title: "Tell me",
    body: "Email rutenis@darnadigital.com. Feedback, bug reports and questions are all welcome.",
    art: (
      <Target>
        <Mail className={NOTE_ICON} />
      </Target>
    ),
    action: "Email me",
  },
};

/**
 * A pill's note as a bottom sheet, for screens without the column beside
 * the letter. It keeps the last pill while it slides away.
 */
function PillDrawer({
  pill,
  open,
  onOpenChange,
}: {
  pill: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const note = pill ? NOTES[pill] : null;
  const chip = pill ? CHIPS[pill] : undefined;
  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent>
        {note && (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-neutral-50 ring-1 ring-black/[0.06] dark:bg-neutral-950 dark:ring-white/[0.08]">
              {note.art}
            </div>
            <div className="flex flex-col gap-1.5">
              <DrawerTitle>{note.title}</DrawerTitle>
              <DrawerDescription>{note.body}</DrawerDescription>
            </div>
            {note.action && chip?.to && (
              <Link
                className={PRIMARY_BUTTON}
                onClick={() => onOpenChange(false)}
                to={chip.to}
              >
                {note.action}
              </Link>
            )}
            {note.action && chip?.href && (
              <a className={PRIMARY_BUTTON} href={chip.href}>
                {note.action}
              </a>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

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
 * pages' heroes. Its chips are sized in em, so they follow the text.
 */
function AboutPage() {
  const [note, setNote] = useState<{
    key: string;
    y: number;
    open: boolean;
    moving: boolean;
  } | null>(null);
  const column = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState<{ pill: string | null; open: boolean }>({
    pill: null,
    open: false,
  });
  const openDrawer = (pill: string) => setDrawer({ pill, open: true });

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
          <article className="flex max-w-2xl flex-col gap-5 sm:gap-6">
            {LETTER.map((entry) =>
              typeof entry === "string" ? (
                <p
                  className="type-lede text-neutral-600 dark:text-neutral-400"
                  key={entry}
                >
                  {withChips(entry, showNote, openDrawer)}
                </p>
              ) : (
                <ul
                  className="-mt-2 flex list-disc flex-col gap-2 pl-[1.2em] marker:text-neutral-400 sm:-mt-3 dark:marker:text-neutral-600"
                  key={entry[0]}
                >
                  {entry.map((line) => (
                    <li
                      className="type-lede text-neutral-600 dark:text-neutral-400"
                      key={line}
                    >
                      {withChips(line, showNote, openDrawer)}
                    </li>
                  ))}
                </ul>
              )
            )}
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
          <PillDrawer
            onOpenChange={(open) =>
              setDrawer((current) => ({ ...current, open }))
            }
            open={drawer.open}
            pill={drawer.pill}
          />
        </div>
      </section>
    </Container>
  );
}
