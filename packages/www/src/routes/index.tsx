import { createFileRoute } from "@tanstack/react-router";

import { NoteCard, ShowcaseCard } from "#/components/card";
import { Container } from "#/components/container";
import {
  Braces,
  Branch,
  Bubble,
  Contrast,
  Apple,
  History,
  Laptop,
  Palette,
  Play,
  Sparkles,
  SplitDiff,
  Terminal,
} from "#/components/icons";
import { Screenshot } from "#/components/screenshot";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { DOWNLOAD_URL, REPO_URL } from "#/lib/links";

/**
 * Display captures are encoded at half their Retina resolution, still more
 * pixels than the widest layout draws. The hero is a window crop scaled to
 * exactly that width, and the branch picker, a close crop, keeps its native
 * size.
 */
const SCREENSHOT_SIZES = {
  "split-diff": { width: 2560, height: 1524 },
  "stacked-diff": { width: 2880, height: 1503 },
  "agent-chat": { width: 2880, height: 1503 },
  "comment-assign": { width: 2880, height: 1503 },
  "run-services": { width: 2880, height: 1503 },
  "branch-picker": { width: 1740, height: 1286 },
  history: { width: 2880, height: 1496 },
  "find-symbol": { width: 2880, height: 1496 },
} as const;

type ScreenshotName = keyof typeof SCREENSHOT_SIZES;

export const Route = createFileRoute("/")({
  component: Home,
});

function AppScreenshot({
  label,
  lazy = false,
  name,
}: {
  label: string;
  lazy?: boolean;
  name: ScreenshotName;
}) {
  return (
    <Screenshot
      alt={label}
      lazy={lazy}
      name={name}
      {...SCREENSHOT_SIZES[name]}
    />
  );
}

function SectionScreenshot(props: { label: string; name: ScreenshotName }) {
  return <AppScreenshot lazy {...props} />;
}

function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 pt-28 pb-16 text-center sm:pt-36">
      <h1 className="max-w-2xl text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-balance sm:text-[44px]">
        Understand AI-generated code.
      </h1>

      <p className="max-w-2xl text-lg leading-normal text-pretty text-neutral-600 sm:text-[21px] dark:text-neutral-400">
        In a world where we no longer write code, we spend a lot more time
        reviewing it. Reviewer is a delightful, smooth macOS app built precisely
        for that.
      </p>

      <a
        className="mt-4 inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-neutral-900 px-7 text-[17px] font-semibold text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        href={DOWNLOAD_URL}
      >
        <Apple className="size-5" />
        Download for macOS
      </a>

      <p className="text-[13px] leading-relaxed text-neutral-500">
        For Apple silicon Macs, on macOS 26 or later. Free and{" "}
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
  );
}

function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex flex-col gap-6">
        <Container>
          <Hero />
        </Container>

        <Container className="max-w-[1280px]">
          <div className="screen-shadow overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10">
            <AppScreenshot
              label="Reviewer showing a side-by-side diff of uncommitted changes, with the changed files beside it"
              name="split-diff"
            />
          </div>
        </Container>

        <Container className="mt-10 flex flex-col gap-4">
          <ShowcaseCard
            description="Lay the diff out side by side or top to bottom, whichever reads better for the change in front of you. Click any file to open it on its own and read it whole."
            icon={<SplitDiff className="size-7" />}
            title="A diff viewer that reads the way you do"
          >
            <SectionScreenshot
              label="A single file's changes laid out top to bottom in a stacked diff"
              name="stacked-diff"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Chat with Claude Code, Codex and the other harnesses you already use, right beside the code they wrote."
            icon={<Sparkles className="size-7" />}
            title="Talk to the agent that wrote it"
          >
            <SectionScreenshot
              label="An agent chat session, with the list of past sessions beside it"
              name="agent-chat"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Leave a comment on any line, then assign it to an agent to pick up and fix."
            icon={<Bubble className="size-7" />}
            title="Comment, then hand it off"
          >
            <SectionScreenshot
              label="A comment on a line of code, being assigned to a new Claude chat"
              name="comment-assign"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Set up your local services once from a macOS widget and start them with a single click. If it runs in a terminal, it runs here."
            icon={<Play className="size-7" />}
            title="Run your services in one click"
          >
            <SectionScreenshot
              label="The Run panel, with local services running and the dev server's logs"
              name="run-services"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Create new branches, and let Reviewer write the commit message from what actually changed."
            icon={<Branch className="size-7" />}
            title="Powerful git integration"
          >
            <SectionScreenshot
              label="The branch picker, with recent and local branches"
              name="branch-picker"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Filter the history by author, date or branch. Click any entry to see what changed and when, or open a single file's history to follow how it got to where it is."
            icon={<History className="size-7" />}
            title="Know what changed, and when"
          >
            <SectionScreenshot
              label="The version control history, with its branch graph and filters"
              name="history"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Language server protocol integration for TypeScript, Swift and Ruby. Hover a symbol for its signature and docs, or find every usage of it across the codebase."
            icon={<Braces className="size-7" />}
            title="Follow a symbol anywhere"
          >
            <SectionScreenshot
              label="Find symbol listing every usage of a class across the codebase"
              name="find-symbol"
            />
          </ShowcaseCard>
        </Container>

        <Container className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NoteCard icon={<Terminal className="size-7" />} title="Terminal">
            A built-in terminal for ad hoc work, right next to the code.
          </NoteCard>
          <NoteCard
            icon={<Contrast className="size-7" />}
            title="Light and dark"
          >
            Follows your Mac, or pick the appearance you prefer.
          </NoteCard>
          <NoteCard icon={<Palette className="size-7" />} title="Themes">
            Shiki and Pierre themes to make the environment your own.
          </NoteCard>
          <NoteCard
            icon={<Laptop className="size-7" />}
            title="Native to the Mac"
          >
            Built for Apple silicon and macOS 26, signed and notarized.
          </NoteCard>
        </Container>

        <div className="mt-16">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
