import { useState } from "react";

import {
  AppScreenshot,
  type ScreenshotName,
} from "#/components/app-screenshot";
import { NoteCard, ShowcaseCard } from "#/components/card";
import { CHIP } from "#/components/chip";
import {
  Braces,
  DockerIcon,
  NpmIcon,
  PhpIcon,
  RubyIcon,
  SwiftIcon,
  TypeScriptIcon,
  Branch,
  Bubble,
  Contrast,
  Laptop,
  History,
  LayoutColumns,
  LayoutRows,
  Palette,
  PaperPlane,
  Play,
  PlusMinus,
  Terminal,
} from "#/components/icons";
import {
  Crossfade,
  SegmentedControl,
  type Segment,
} from "#/components/segmented-control";

const SECTION_ICON = "size-7 lg:size-10";
const NOTE_ICON = "size-7 lg:size-8";

const DIFF_LAYOUTS = [
  {
    value: "diff-split",
    label: "Horizontal",
    icon: LayoutColumns,
    alt: "A diff laid out side by side, with the old and new lines joined across the gutter",
  },
  {
    value: "diff-stacked",
    label: "Vertical",
    icon: LayoutRows,
    alt: "The same diff laid out top to bottom, removed lines above the lines that replaced them",
  },
] as const satisfies ReadonlyArray<Segment<ScreenshotName> & { alt: string }>;

type DiffLayout = (typeof DIFF_LAYOUTS)[number]["value"];

function DiffLayoutCard() {
  const [layout, setLayout] = useState<DiffLayout>("diff-split");

  return (
    <ShowcaseCard
      controls={
        <SegmentedControl
          label="Diff layout"
          onChange={setLayout}
          segments={DIFF_LAYOUTS}
          value={layout}
        />
      }
      description="Toggle between split and unified views. When a hunk isn't enough context, open the whole file."
      icon={<PlusMinus className={SECTION_ICON} />}
      title="Review diffs your way"
    >
      <Crossfade
        value={layout}
        views={DIFF_LAYOUTS.map(({ value, alt }) => ({
          value,
          node: <AppScreenshot label={alt} name={value} />,
        }))}
      />
    </ShowcaseCard>
  );
}

/**
 * What the Mac app does, card by card: the homepage's Mac app view and the
 * /mac page both show it.
 */
export function MacFeatures() {
  return (
    <div className="flex flex-col gap-4 sm:gap-16">
      <div className="flex flex-col gap-4 sm:gap-16">
        <ShowcaseCard
          description="Leave a comment on any line, then assign it to an agent to pick up and fix."
          icon={<Bubble className={SECTION_ICON} />}
          title="Comment, then hand it off"
        >
          <AppScreenshot
            label="A comment on a line of code, being assigned to a new Claude session with its model picker open"
            name="comment-assign"
          />
        </ShowcaseCard>

        <DiffLayoutCard />

        <ShowcaseCard
          description="Use popular harnesses directly in Reviewer, or use skills to connect to any harness you have on your machine."
          icon={<PaperPlane className={SECTION_ICON} />}
          title="Work with Claude Code and Codex from the same interface"
        >
          <AppScreenshot
            label="Picking the model for an agent session, with Claude and Codex models side by side"
            name="agent-models"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description={
            <>
              Set up your local services once from a macOS widget and start them
              with a single click.{" "}
              <span className={CHIP}>
                <RubyIcon className="size-[0.85em] text-[#CC342D]" />
                Ruby
              </span>
              ,{" "}
              <span className={CHIP}>
                <NpmIcon className="size-[0.85em] text-[#CB3837]" />
                NPM
              </span>
              ,{" "}
              <span className={CHIP}>
                <DockerIcon className="size-[0.95em] text-[#2496ED]" />
                Docker
              </span>{" "}
              or any other development service you use.
            </>
          }
          icon={<Play className={SECTION_ICON} />}
          title="Run your services in one click"
        >
          <AppScreenshot
            label="The Run panel, with local services running and the dev server's logs"
            name="run-services"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Create new branches, and let Reviewer write the commit message from what actually changed."
          icon={<Branch className={SECTION_ICON} />}
          title="Intuitive Git integration"
        >
          <AppScreenshot
            label="The branch picker, with recent and local branches"
            name="branch-picker"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Filter the history by author, date or branch. Click any entry to see what changed and when, or open a single file's history to follow how it got to where it is."
          icon={<History className={SECTION_ICON} />}
          title="Know what changed, and when"
        >
          <AppScreenshot
            label="The version control history, with its branch graph and filters"
            name="history"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description={
            <>
              Language server protocol integration for{" "}
              <span className={CHIP}>
                <TypeScriptIcon className="size-[0.85em] text-[#3178C6]" />
                TypeScript
              </span>
              ,{" "}
              <span className={CHIP}>
                <SwiftIcon className="size-[0.85em] text-[#F05138]" />
                Swift
              </span>
              ,{" "}
              <span className={CHIP}>
                <RubyIcon className="size-[0.85em] text-[#CC342D]" />
                Ruby
              </span>{" "}
              and{" "}
              <span className={CHIP}>
                <PhpIcon className="size-[1.1em] text-[#777BB4]" />
                PHP
              </span>
              . Hover a symbol for its signature and docs, or find every usage
              of it across the codebase.
            </>
          }
          icon={<Braces className={SECTION_ICON} />}
          title="Follow a code symbol to its source"
        >
          <AppScreenshot
            label="Find symbol listing every usage of a class across the codebase"
            name="find-symbol"
          />
        </ShowcaseCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
        <NoteCard icon={<Terminal className={NOTE_ICON} />} title="Terminal">
          A built-in terminal for ad hoc work, right next to the code.
        </NoteCard>
        <NoteCard
          icon={<Contrast className={NOTE_ICON} />}
          title="Light and dark"
        >
          Follows your Mac, or pick the appearance you prefer.
        </NoteCard>
        <NoteCard icon={<Palette className={NOTE_ICON} />} title="Themes">
          Shiki and Pierre themes to make the environment your own.
        </NoteCard>
        <NoteCard
          icon={<Laptop className={NOTE_ICON} />}
          title="Native to the Mac"
        >
          Built for Apple silicon macOS 26 and later.
        </NoteCard>
      </div>
    </div>
  );
}
