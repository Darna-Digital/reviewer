import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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
  PaperPlane,
  Play,
  PlusMinus,
  LayoutColumns,
  LayoutRows,
  Terminal,
} from "#/components/icons";
import { Screenshot, type ScreenshotCrop } from "#/components/screenshot";
import { cn } from "#/lib/cn";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { DOWNLOAD_URL, REPO_URL } from "#/lib/links";

/**
 * Display captures are encoded at half their Retina resolution, still more
 * pixels than the widest layout draws. The hero is scaled to nearly 2× its
 * widest container, and the close crops (diff layouts, branch picker, the
 * hero's phone crop) keep their native size.
 */
const SCREENSHOT_SIZES = {
  "split-diff": { width: 2560, height: 1477 },
  "diff-split": { width: 1772, height: 1290 },
  "diff-stacked": { width: 1772, height: 1290 },
  "agent-models": { width: 2492, height: 1564 },
  "comment-assign": { width: 2076, height: 1430 },
  "run-services": { width: 2456, height: 942 },
  "branch-picker": { width: 1470, height: 1326 },
  history: { width: 1854, height: 1192 },
  "find-symbol": { width: 2798, height: 1884 },
} as const;

type ScreenshotName = keyof typeof SCREENSHOT_SIZES;

const HERO_PHONE_CROP: ScreenshotCrop = {
  name: "split-diff-mobile",
  width: 1060,
  height: 1232,
};

export const Route = createFileRoute("/")({
  component: Home,
});

function AppScreenshot({
  label,
  lazy = false,
  name,
  phone,
}: {
  label: string;
  lazy?: boolean;
  name: ScreenshotName;
  phone?: ScreenshotCrop;
}) {
  return (
    <Screenshot
      alt={label}
      lazy={lazy}
      name={name}
      phone={phone}
      {...SCREENSHOT_SIZES[name]}
    />
  );
}

function SectionScreenshot(props: { label: string; name: ScreenshotName }) {
  return <AppScreenshot lazy {...props} />;
}

const DIFF_LAYOUTS = [
  {
    name: "diff-split",
    label: "Horizontal",
    icon: LayoutColumns,
    alt: "A diff laid out side by side, with the old and new lines joined across the gutter",
  },
  {
    name: "diff-stacked",
    label: "Vertical",
    icon: LayoutRows,
    alt: "The same diff laid out top to bottom, removed lines above the lines that replaced them",
  },
] as const satisfies ReadonlyArray<{
  name: ScreenshotName;
  label: string;
  icon: typeof LayoutColumns;
  alt: string;
}>;

type DiffLayout = (typeof DIFF_LAYOUTS)[number]["name"];

/**
 * A segmented control in the style of the app's own: a recessed track with a
 * raised pill that slides under the chosen option. Both options share one
 * width so the pill only ever has to translate, never resize.
 */
function DiffLayoutSwitcher({
  value,
  onChange,
}: {
  value: DiffLayout;
  onChange: (layout: DiffLayout) => void;
}) {
  const selectedIndex = DIFF_LAYOUTS.findIndex(
    (layout) => layout.name === value
  );

  return (
    <div
      aria-label="Diff layout"
      className="relative grid w-full grid-cols-2 rounded-full bg-black/[0.05] p-1 ring-1 ring-black/[0.04] ring-inset sm:inline-grid sm:w-auto dark:bg-white/[0.06] dark:ring-white/[0.06]"
      role="group"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none dark:bg-white/[0.14] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(255,255,255,0.08)]"
        style={{ transform: `translateX(${selectedIndex * 100}%)` }}
      />
      {DIFF_LAYOUTS.map(({ name, label, icon: Icon }) => {
        const selected = name === value;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 sm:h-8 sm:px-4 sm:text-[13px]",
              selected
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            )}
            key={name}
            onClick={() => onChange(name)}
            type="button"
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Both layouts stay mounted in one grid cell and crossfade, so switching never
 * waits on a download or shifts the page.
 */
function DiffLayoutCard() {
  const [layout, setLayout] = useState<DiffLayout>("diff-split");

  return (
    <ShowcaseCard
      controls={<DiffLayoutSwitcher onChange={setLayout} value={layout} />}
      description="Toggle between split and unified views. When a hunk isn't enough context, open the whole file."
      icon={<PlusMinus className="size-7" />}
      title="Review diffs your way"
    >
      <div className="grid">
        {DIFF_LAYOUTS.map(({ name, alt }) => {
          const shown = name === layout;
          return (
            <div
              aria-hidden={!shown}
              className={cn(
                "transition-opacity duration-300 ease-out [grid-area:1/1] motion-reduce:transition-none",
                !shown && "opacity-0"
              )}
              key={name}
            >
              <SectionScreenshot label={alt} name={name} />
            </div>
          );
        })}
      </div>
    </ShowcaseCard>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 pt-24 pb-10 text-center sm:pt-36 sm:pb-16">
      <h1 className="max-w-2xl text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-balance sm:text-[44px]">
        Understand <span className="whitespace-nowrap">AI-generated</span> code.
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

      <p className="text-sm leading-relaxed text-pretty text-neutral-500 sm:text-[13px]">
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

        <Container className="max-w-[1440px]">
          <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)] ring-1 ring-black/10 dark:ring-white/10">
            <AppScreenshot
              label="Reviewer showing a side-by-side diff of uncommitted changes, with the changed files beside it"
              name="split-diff"
              phone={HERO_PHONE_CROP}
            />
          </div>
        </Container>

        <Container className="mt-6 flex flex-col gap-4 sm:mt-10 sm:gap-16">
          <ShowcaseCard
            description="Leave a comment on any line, then assign it to an agent to pick up and fix."
            icon={<Bubble className="size-7" />}
            title="Comment, then hand it off"
          >
            <SectionScreenshot
              label="A comment on a line of code, being assigned to a new Claude chat with its model picker open"
              name="comment-assign"
            />
          </ShowcaseCard>

          <DiffLayoutCard />

          <ShowcaseCard
            description="Use popular harnesses directly in Reviewer, or use skills to connect to any harness you have on your machine."
            icon={<PaperPlane className="size-7" />}
            title="Work with Claude Code and Codex from the same interface"
          >
            <SectionScreenshot
              label="Picking the model for an agent chat, with Claude and Codex models side by side"
              name="agent-models"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Set up your local services once from a macOS widget and start them with a single click. Ruby, NPM, Docker or any other development service you use."
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
            title="Intuitive Git integration"
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
            title="Follow a code symbol to its source"
          >
            <SectionScreenshot
              label="Find symbol listing every usage of a class across the codebase"
              name="find-symbol"
            />
          </ShowcaseCard>
        </Container>

        <Container className="grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-8">
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
            Built for Apple silicon macOS 26 and later.
          </NoteCard>
        </Container>

        <div className="mt-4 sm:mt-10">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
