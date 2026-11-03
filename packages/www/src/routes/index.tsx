import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { AppScreenshot, HERO_PHONE_CROP } from "#/components/app-screenshot";
import { GetReviewerButtons } from "#/components/buttons";
import { SURFACE, SectionHeading } from "#/components/card";
import { Container, HERO_WIDTH } from "#/components/container";
import { ClaudeIcon, CodexIcon, ChevronRight } from "#/components/icons";
import { MacFeatures } from "#/components/mac-features";
import { TerminalFeatures } from "#/components/terminal-features";
import { InlineMarkdown } from "#/components/release-notes";
import { WaitlistForm } from "#/components/waitlist-form";
import { CloudIllustration } from "#/components/cloud-illustration";
import { Crossfade } from "#/components/segmented-control";
import { getChangelog } from "#/lib/changelog";
import { cn } from "#/lib/cn";
import { REPO_URL } from "#/lib/links";

const RECENT_RELEASES = 6;

export const Route = createFileRoute("/")({
  loader: async () => (await getChangelog()).slice(0, RECENT_RELEASES),
  component: Home,
});

const PLACES = [
  { value: "mac", label: "Mac" },
  { value: "terminal", label: "Terminal" },
  { value: "cloud", label: "Reviewer Cloud" },
] as const;

type Place = (typeof PLACES)[number]["value"];

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full align-[0.05em] bg-black/[0.04] px-2.5 py-0.5 font-medium text-neutral-800 ring-1 ring-black/[0.06] ring-inset dark:bg-white/[0.06] dark:text-neutral-200 dark:ring-white/[0.08]";

function SurfaceCard({
  to,
  name,
  description,
  action,
  children,
}: {
  to: "/mac" | "/terminal" | "/cloud";
  name: string;
  description: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <Link
      className={`${SURFACE} group flex flex-col overflow-hidden transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06]`}
      to={to}
    >
      <div className="flex flex-col gap-2 p-6 lg:p-8">
        <h3 className="text-xl font-semibold tracking-[-0.02em] lg:text-2xl">
          {name}
        </h3>
        <p className="text-[15px] leading-normal text-pretty text-neutral-600 lg:text-base dark:text-neutral-400">
          {description}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[15px] font-medium">
          {action}
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="mt-auto px-2 pb-2 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
        {children}
      </div>
    </Link>
  );
}

/** "11.02", the way devin.ai dates the rows of its shipped list. */
function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}

function RecentlyShipped() {
  const releases = Route.useLoaderData();
  if (releases.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_2.4fr] sm:gap-12">
      <div className="flex flex-col items-start gap-4">
        <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.015em] sm:text-[36px] lg:text-[44px]">
          Recently shipped
        </h2>
        <Link
          className="inline-flex items-center gap-1 text-[15px] font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          to="/changelog"
        >
          Read the changelog
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <ul className="flex flex-col">
        {releases.map((release) => (
          <li key={release.version}>
            <Link
              className="group grid grid-cols-[3rem_1fr] items-center gap-4 border-b border-black/[0.06] py-4 sm:grid-cols-[3.5rem_1fr_4.5rem_1rem] sm:gap-6 dark:border-white/[0.08]"
              params={{ version: release.version }}
              to="/changelog/$version"
            >
              <time
                className="text-sm text-neutral-400 tabular-nums dark:text-neutral-500"
                dateTime={release.date}
              >
                {shortDate(release.date)}
              </time>
              <span className="truncate text-[15px] text-neutral-800 transition-colors group-hover:text-neutral-950 lg:text-base dark:text-neutral-200 dark:group-hover:text-white">
                {release.title ?? (
                  <InlineMarkdown text={release.sections[0]?.items[0] ?? ""} />
                )}
              </span>
              <span className="hidden font-mono text-xs text-neutral-400 sm:block dark:text-neutral-500">
                {release.version}
              </span>
              <ChevronRight className="hidden size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 sm:block" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const QUESTIONS: Array<{ question: string; answer: ReactNode }> = [
  {
    question: "Is it free?",
    answer: (
      <>
        The Mac app and the terminal app are free and{" "}
        <a
          className="underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 dark:decoration-neutral-600 dark:hover:text-white"
          href={`${REPO_URL}/blob/main/LICENSE`}
          rel="noopener noreferrer"
          target="_blank"
        >
          MIT-licensed
        </a>
        , and they stay that way. Reviewer Cloud will be a paid service.
      </>
    ),
  },
  {
    question: "Does my code leave my machine?",
    answer:
      "Not through Reviewer. Both apps read your repository from disk and keep comments in a local database. The agents you hand comments to, and GitHub for pull requests, see what they'd see without Reviewer.",
  },
  {
    question: "Which agents work with it?",
    answer:
      "Claude Code and Codex run inside the Mac app. Any other agent can pick up your comments with the resolve-reviewer-comments skill.",
  },
  {
    question: "Do I need the Mac app to use the terminal app?",
    answer:
      "No. curl -fsSL https://reviewer.sh/install | bash installs the terminal app with everything it needs, on macOS or Linux. If you use both, they share your comments.",
  },
  {
    question: "What does the Mac app need?",
    answer:
      "An Apple silicon Mac on macOS 26 or later. There's no Intel build.",
  },
  {
    question: "What's Reviewer Cloud going to be?",
    answer: (
      <>
        A paid service we're building next.{" "}
        <Link
          className="underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 dark:decoration-neutral-600 dark:hover:text-white"
          to="/cloud"
        >
          Join the waitlist
        </Link>{" "}
        to hear when it opens.
      </>
    ),
  },
  {
    question: "Who isn't it for?",
    answer:
      "If you write most of your code yourself and review a pull request or two a day, GitHub's review page is probably all you need.",
  },
];

function Questions() {
  return (
    <section className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_2.4fr] sm:gap-12">
      <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.015em] sm:text-[36px] lg:text-[44px]">
        Questions
      </h2>
      <dl className="flex flex-col">
        {QUESTIONS.map(({ question, answer }) => (
          <div
            className="flex flex-col gap-2 border-b border-black/[0.06] py-5 first:pt-0 dark:border-white/[0.08]"
            key={question}
          >
            <dt className="text-[17px] font-semibold tracking-[-0.01em] lg:text-lg">
              {question}
            </dt>
            <dd className="text-[15px] leading-relaxed text-pretty text-neutral-600 lg:text-base dark:text-neutral-400">
              {answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Laid out as jetbrains.com/air opens: the name in its own type inside the
 * claim, the agents it works with, and how to get it.
 */
function Hero() {
  return (
    <Container>
      <section className="flex flex-col items-start gap-6 pt-24 sm:pt-36 lg:pt-44">
        <h1 className="max-w-4xl text-[34px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance sm:text-[52px] lg:text-[68px]">
          Focused system for building software with agents
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-neutral-600 sm:text-xl dark:text-neutral-400">
          Works with the agents you already use{" "}
          <span className={CHIP}>
            <ClaudeIcon className="size-[0.95em] text-[#D97757]" />
            Claude Code
          </span>{" "}
          <span className={CHIP}>
            <CodexIcon className="size-[0.95em] text-neutral-900 dark:text-white" />
            Codex
          </span>{" "}
          and any agent that runs skills.
        </p>
        <GetReviewerButtons className="mt-2 w-full sm:w-auto" />
        <p className="text-sm text-pretty text-neutral-500 lg:text-[15px]">
          The Mac app needs Apple silicon and macOS 26 or later. Both apps are
          free and{" "}
          <a
            className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-900 dark:decoration-neutral-600 dark:hover:text-white"
            href={REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            open source
          </a>
          .
        </p>
      </section>
    </Container>
  );
}

/**
 * The row of places. Once scrolled past it pins under the header, on the
 * header's own frosted backdrop, so the page can be switched from anywhere.
 */
function PlacePicker({
  place,
  onChange,
}: {
  place: Place;
  onChange: (place: Place) => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const header =
      parseFloat(getComputedStyle(document.documentElement).fontSize) * 3.25;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setStuck(
          !entry.isIntersecting && entry.boundingClientRect.top < header
        ),
      { rootMargin: `-${header}px 0px 0px 0px` }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" ref={sentinel} />
      <div
        className={cn(
          "sticky top-header z-30 border-b transition-colors duration-200",
          stuck
            ? "border-black/[0.06] bg-white/75 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111113]/75"
            : "border-transparent"
        )}
      >
        <Container>
          <div
            aria-label="Choose where you work"
            className={cn(
              "flex items-center gap-2 overflow-x-auto transition-[padding] duration-200",
              stuck ? "py-2.5" : "py-8 sm:py-12"
            )}
            role="group"
          >
            <span
              className={cn(
                "mr-1 shrink-0 text-[15px] text-neutral-600 lg:text-base dark:text-neutral-400",
                stuck && "max-sm:hidden"
              )}
            >
              Choose where you work:
            </span>
            {PLACES.map(({ value, label }) => (
              <button
                aria-pressed={place === value}
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400",
                  place === value
                    ? "text-neutral-900 ring-2 ring-neutral-900 ring-inset dark:text-white dark:ring-white"
                    : "text-neutral-600 ring-1 ring-black/15 ring-inset hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-400 dark:ring-white/20 dark:hover:bg-white/[0.06] dark:hover:text-white"
                )}
                key={value}
                onClick={() => {
                  onChange(value);
                  // Switched from further down: start the new page at the top.
                  if (stuck) {
                    const top = sentinel.current!.getBoundingClientRect().top;
                    const header =
                      parseFloat(
                        getComputedStyle(document.documentElement).fontSize
                      ) * 3.25;
                    window.scrollBy({ top: top - header });
                  }
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </Container>
      </div>
    </>
  );
}

function Stage({ place }: { place: Place }) {
  return (
    <Crossfade
      value={place}
      views={[
        {
          value: "mac",
          node: (
            <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
              <AppScreenshot
                label="The Mac app showing a side-by-side diff of uncommitted changes, with the changed files beside it"
                lazy={false}
                name="split-diff"
                phone={HERO_PHONE_CROP}
              />
            </div>
          ),
        },
        {
          value: "terminal",
          node: (
            <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
              <AppScreenshot
                label="The terminal app reviewing a branch against main, with a comment on a changed line"
                lazy={false}
                name="tui-review"
              />
            </div>
          ),
        },
        {
          value: "cloud",
          node: (
            <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
              <CloudIllustration />
            </div>
          ),
        },
      ]}
    />
  );
}

/** The Mac app view is the homepage as it was before the terminal app. */
function MacSections() {
  return <MacFeatures />;
}

/** The Terminal app view, in the same structure as the Mac app view. */
function TerminalSections() {
  return <TerminalFeatures />;
}

function CloudSections() {
  return (
    <>
      <section className="flex flex-col gap-6">
        <SectionHeading lead="Reviewer Cloud">
          is what we're building next.
        </SectionHeading>
        <div className="max-w-md">
          <WaitlistForm />
        </div>
      </section>

      <section className="flex flex-col gap-10 sm:gap-14">
        <SectionHeading lead="Until then,">
          use Reviewer on your own machine.
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <SurfaceCard
            action="See the Mac app"
            description="The change, your comments and your agent sessions in one window. Free and open source."
            name="Mac app"
            to="/mac"
          >
            <div className="overflow-hidden rounded-xl">
              <AppScreenshot
                label="A comment on a line of code, being assigned to a new Claude session"
                name="comment-assign"
              />
            </div>
          </SurfaceCard>
          <SurfaceCard
            action="See the terminal app"
            description="The same diffs and comments from the keyboard, over SSH or in a tmux pane. Free and open source."
            name="Terminal app"
            to="/terminal"
          >
            <div className="overflow-hidden rounded-xl">
              <AppScreenshot
                label="The terminal app's command palette open over a diff"
                name="tui-palette"
              />
            </div>
          </SurfaceCard>
        </div>
      </section>
    </>
  );
}

const SECTIONS: Record<Place, () => ReactNode> = {
  mac: MacSections,
  terminal: TerminalSections,
  cloud: CloudSections,
};

function Home() {
  const [place, setPlace] = useState<Place>("mac");
  const Sections = SECTIONS[place];

  return (
    <>
      <Hero />
      <PlacePicker onChange={setPlace} place={place} />
      <Container className={HERO_WIDTH}>
        <Stage place={place} />
      </Container>
      <Container
        className="fade-in mt-24 flex flex-col gap-24 sm:mt-36 sm:gap-36"
        key={place}
      >
        <Sections />
        <RecentlyShipped />
        <Questions />
      </Container>
    </>
  );
}
