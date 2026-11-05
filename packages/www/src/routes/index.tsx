import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { version } from "../../../../package.json";
import { AppScreenshot, HERO_PHONE_CROP } from "#/components/app-screenshot";
import { GetReviewerButtons } from "#/components/buttons";
import { SURFACE, SectionHeading } from "#/components/card";
import { Container, HERO_WIDTH } from "#/components/container";
import { CHIP, CHIP_ICON } from "#/components/chip";
import { ClaudeIcon, CodexIcon, ChevronRight } from "#/components/icons";
import { MacFeatures } from "#/components/mac-features";
import { TerminalFeatures } from "#/components/terminal-features";
import { InlineMarkdown } from "#/components/release-notes";
import { WaitlistForm } from "#/components/waitlist-form";
import { CloudIllustration } from "#/components/cloud-illustration";
import { ShowcaseVideo } from "#/components/showcase-video";
import { Crossfade, SegmentedControl } from "#/components/segmented-control";
import { getChangelog } from "#/lib/changelog";
import { cn } from "#/lib/cn";
import { REPO_URL, SITE_URL } from "#/lib/links";

const RECENT_RELEASES = 6;

/** What search engines read about Reviewer, as schema.org structured data. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Reviewer",
  url: SITE_URL,
  description:
    "Reviewer is an agentic development environment for engineers who deeply care about the quality of their work. Works with Claude Code, Codex and any agent that runs skills.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS 26 or later, Linux",
  softwareVersion: version,
  downloadUrl: `${SITE_URL}/download`,
  license: "https://opensource.org/licenses/MIT",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  sameAs: [REPO_URL],
  publisher: {
    "@type": "Organization",
    name: "Darna Digital",
    url: "https://darnadigital.com",
  },
};

export const Route = createFileRoute("/")({
  loader: async () => (await getChangelog()).slice(0, RECENT_RELEASES),
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(STRUCTURED_DATA),
      },
    ],
  }),
  component: Home,
});

const PLACES = [
  { value: "mac", label: "Mac" },
  { value: "terminal", label: "Terminal" },
  { value: "cloud", label: "Cloud" },
] as const;

type Place = (typeof PLACES)[number]["value"];

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
        <h3 className="type-heading">{name}</h3>
        <p className="type-body text-neutral-600 dark:text-neutral-400">
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
    <section className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="type-title">Recently shipped</h2>
        <Link
          className="inline-flex items-center gap-1 text-[15px] font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          to="/changelog"
        >
          Read the changelog
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <ul className="flex flex-col border-t border-black/[0.06] dark:border-white/[0.08]">
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
              <span className="truncate text-[15px] text-neutral-800 transition-colors group-hover:text-neutral-950 sm:pr-6 lg:text-base dark:text-neutral-200 dark:group-hover:text-white">
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
      "Reviewer works locally on your machine. It orchestrates GitHub and your locally installed agents, so your code never reaches Reviewer's servers.",
  },
  {
    question: "Which agents work with it?",
    answer:
      "Claude Code and Codex run inside the Mac app. Any other agent can pick up your comments with the resolve-reviewer-comments skill.",
  },
  {
    question: "Where does the terminal app run?",
    answer:
      "On macOS or Linux, on your laptop or on a server over SSH. curl -fsSL https://reviewer.sh/install | bash installs it with everything it needs. If you also use the Mac app, they share your comments.",
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
        Reviewer Cloud is going to focus on making you and your team more
        productive through isolated cloud sandboxes.{" "}
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
      "If you run 100 parallel agents and don't check their work, then Reviewer is not for you. Reviewer is designed for engineers who care about their work deeply and verify it before shipping.",
  },
];

function Questions() {
  return (
    <section className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_2.4fr] sm:gap-12">
      <h2 className="type-title">FAQ</h2>
      <dl className="flex flex-col">
        {QUESTIONS.map(({ question, answer }) => (
          <div
            className="flex flex-col gap-2 border-b border-black/[0.06] py-5 first:pt-0 last:border-b-0 last:pb-0 dark:border-white/[0.08]"
            key={question}
          >
            <dt className="type-subhead">{question}</dt>
            <dd className="type-body text-neutral-600 dark:text-neutral-400">
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
      <section className="flex flex-col items-start pt-24 sm:pt-36 lg:pt-44">
        <h1 className="max-w-4xl type-display">
          Focused system for building software with agents
        </h1>
        <div className="mt-5 flex max-w-2xl flex-col gap-4 type-lede text-neutral-600 sm:mt-7 dark:text-neutral-400">
          <p>
            Reviewer is an agentic development environment for engineers who
            deeply care about the quality of their work.
          </p>
          <p>
            Works with{" "}
            <span className={CHIP}>
              <ClaudeIcon className={`${CHIP_ICON} text-[#D97757]`} />
              Claude Code
            </span>{" "}
            <span className={CHIP}>
              <CodexIcon
                className={`${CHIP_ICON} text-neutral-900 dark:text-white`}
              />
              Codex
            </span>{" "}
            and any agent that runs skills.
          </p>
        </div>
        <GetReviewerButtons className="mt-8 w-full sm:mt-10 sm:w-auto" />
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
      {/* The spacing sits outside the sticky bar so the bar keeps one height
          when it sticks. A bar that shrinks as it sticks shortens the page
          under the reader, and scroll anchoring then pulls them back up. */}
      <div aria-hidden="true" className="h-8 sm:h-12" />
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
          <div className="flex items-center gap-3 py-2 sm:py-2.5">
            <span
              aria-hidden="true"
              // On phones the control takes the full width.
              className="shrink-0 text-[15px] text-neutral-600 max-sm:hidden lg:text-base dark:text-neutral-400"
            >
              Where do you work?
            </span>
            <SegmentedControl
              label="Where do you work?"
              onChange={(value) => {
                onChange(value);
                // Bring the chosen product's view up under the picker,
                // wherever the reader clicked from.
                const top = sentinel.current!.getBoundingClientRect().top;
                const header =
                  parseFloat(
                    getComputedStyle(document.documentElement).fontSize
                  ) * 3.25;
                window.scrollBy({ top: top - header, behavior: "instant" });
              }}
              segments={PLACES}
              value={place}
            />
          </div>
        </Container>
      </div>
      <div aria-hidden="true" className="h-6 sm:h-10" />
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
              <ShowcaseVideo
                label="The terminal app next to Claude Code, with a magnifier passing over the usages of a symbol in its bottom pane"
                name="tui-usages"
                paused={place !== "terminal"}
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
      <section className="mt-8 flex flex-col gap-6 sm:mt-20">
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
            description="Review from the keyboard, on your laptop or on a server over SSH. Free and open source."
            name="Terminal app"
            to="/terminal"
          >
            <div className="overflow-hidden rounded-xl">
              <AppScreenshot
                label="The terminal app showing a side-by-side diff, with the changed files beside it and the branch's history below"
                name="tui-hero"
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
        className="fade-in mt-10 flex flex-col gap-24 sm:mt-16 sm:gap-36"
        key={place}
      >
        <Sections />
        <RecentlyShipped />
        <Questions />
      </Container>
    </>
  );
}
