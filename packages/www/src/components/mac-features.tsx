import { useState } from "react";

import {
  AppScreenshot,
  type ScreenshotName,
} from "#/components/app-screenshot";
import { NoteCard, ShowcaseCard } from "#/components/card";
import {
  Braces,
  Branch,
  Bubble,
  Contrast,
  Folders,
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
    label: "Side by side",
    icon: LayoutColumns,
    alt: "A diff laid out side by side, with the old and new lines joined across the gutter",
  },
  {
    value: "diff-stacked",
    label: "Top to bottom",
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
      description="Switch layouts whenever you like. When a hunk isn't enough, open the whole file."
      icon={<PlusMinus className={SECTION_ICON} />}
      title="Side by side or top to bottom"
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
          description="Leave a comment on any line, then assign it to a new Claude Code or Codex session to fix."
          icon={<Bubble className={SECTION_ICON} />}
          title="Comment on a line, assign it to an agent"
        >
          <AppScreenshot
            label="A comment on a line of code, being assigned to a new Claude session with its model picker open"
            name="comment-assign"
          />
        </ShowcaseCard>

        <DiffLayoutCard />

        <ShowcaseCard
          description="Pick the model and effort for each session. Other agents can pick up your comments with the resolve-reviewer-comments skill."
          icon={<PaperPlane className={SECTION_ICON} />}
          title="Run Claude Code and Codex in the same window"
        >
          <AppScreenshot
            label="Picking the model for an agent session, with Claude and Codex models side by side"
            name="agent-models"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Set up your dev commands once in the Run panel. Start all brings the whole workspace up: Ruby, npm, Docker or anything else you run."
          icon={<Play className={SECTION_ICON} />}
          title="Start every dev server with one click"
        >
          <AppScreenshot
            label="The Run panel, with local services running and the dev server's logs"
            name="run-services"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="⇧⌘B switches branch, ⌃G drafts the commit message from the diff and ⌘K commits."
          icon={<Branch className={SECTION_ICON} />}
          title="Commit what you reviewed, where you reviewed it"
        >
          <AppScreenshot
            label="The branch picker, with recent and local branches"
            name="branch-picker"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Filter history by author, date or branch. Open one file's history to see how it got here."
          icon={<History className={SECTION_ICON} />}
          title="See what changed, and when"
        >
          <AppScreenshot
            label="The version control history, with its branch graph and filters"
            name="history"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Go to definition, find usages and hover docs for TypeScript, Swift, Ruby and PHP."
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
        <NoteCard icon={<Folders className={NOTE_ICON} />} title="Workspaces">
          Open several repositories in one window. Each keeps its own branches,
          terminals and pull requests.
        </NoteCard>
        <NoteCard icon={<Terminal className={NOTE_ICON} />} title="Terminal">
          A built-in terminal next to the code.
        </NoteCard>
        <NoteCard
          icon={<Contrast className={NOTE_ICON} />}
          title="Light and dark"
        >
          Follows your Mac's appearance, or pick one.
        </NoteCard>
        <NoteCard
          icon={<Palette className={NOTE_ICON} />}
          title="Your editor's colours, in your diffs"
        >
          Shiki and Pierre themes, the same ones the terminal app uses.
        </NoteCard>
      </div>
    </div>
  );
}
