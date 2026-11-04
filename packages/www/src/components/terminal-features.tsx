import { useState } from "react";

import {
  AppScreenshot,
  type ScreenshotName,
} from "#/components/app-screenshot";
import { NoteCard, ShowcaseCard } from "#/components/card";
import { Kbd } from "#/components/kbd";
import { ShowcaseVideo } from "#/components/showcase-video";
import {
  Bubble,
  Bubbles,
  Checkmark,
  Command,
  Folders,
  History,
  LayoutColumns,
  LayoutRows,
  Palette,
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
    value: "tui-unified",
    label: "Top to bottom",
    icon: LayoutRows,
    alt: "A branch laid out top to bottom in the terminal app, with the changed files beside it",
  },
  {
    value: "tui-split",
    label: "Side by side",
    icon: LayoutColumns,
    alt: "The same branch side by side in the terminal app",
  },
] as const satisfies ReadonlyArray<Segment<ScreenshotName> & { alt: string }>;

type DiffLayout = (typeof DIFF_LAYOUTS)[number]["value"];

function DiffLayoutCard() {
  const [layout, setLayout] = useState<DiffLayout>("tui-unified");

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
      description={
        <>
          <Kbd>s</Kbd> switches layouts. Hunks or full files, wrapped or not,
          with the changed files beside the diff.
        </>
      }
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

const USAGE = [
  ["reviewer", "The repository you're in"],
  ["reviewer --against main", "The branch against main"],
  ["reviewer --commit 3f2a9c1", "A single commit"],
  ["reviewer --pr 42", "A GitHub pull request"],
  ["reviewer ~/code/web ~/code/api", "Several repositories side by side"],
] as const;

/**
 * What the terminal app does, card by card, in the same structure as the
 * Mac app's: the homepage's Terminal app view and the /terminal page both
 * show it.
 */
export function TerminalFeatures() {
  return (
    <div className="flex flex-col gap-4 sm:gap-16">
      <div className="flex flex-col gap-4 sm:gap-16">
        <ShowcaseCard
          description={
            <>
              Press <Kbd>c</Kbd> on any line and write what's wrong. The comment
              shows up in the Mac app's diff too.
            </>
          }
          icon={<Bubble className={SECTION_ICON} />}
          title="Comment on the line that's wrong"
        >
          <AppScreenshot
            label="A comment being written under a changed line: rewrite this to not use ternary"
            name="tui-comment"
          />
        </ShowcaseCard>

        <DiffLayoutCard />

        <ShowcaseCard
          description={
            <>
              <Kbd>⌘K</Kbd> opens the command palette: go to file, search in
              files, switch branch and every Git action. <Kbd>u</Kbd> finds
              every usage of a symbol and <Kbd>?</Kbd> lists every key.
            </>
          }
          icon={<Command className={SECTION_ICON} />}
          title="Every action is a keystroke away"
        >
          <AppScreenshot
            label="The terminal app's command palette open over a diff"
            name="tui-palette"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="The History pane lists the branch's commits. Open one to read it like any other change."
          icon={<History className={SECTION_ICON} />}
          title="See what changed, and when"
        >
          <AppScreenshot
            label="The branch's history in the terminal app's bottom pane"
            name="tui-history"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Reviewer TUI works with a wide variety of themes."
          icon={<Palette className={SECTION_ICON} />}
          title="Customize your terminal experience"
        >
          <ShowcaseVideo
            label="The terminal app's theme picker, stepping through dark themes as the diff and history repaint in each"
            name="tui-themes"
          />
        </ShowcaseCard>

        <ShowcaseCard
          description="Open the branch, a single commit or a GitHub pull request, from any repository."
          icon={<Terminal className={SECTION_ICON} />}
          title="One command for whatever you're reviewing"
        >
          <dl className="flex flex-col bg-[#17171a] p-3 font-mono text-[13px] sm:p-5 lg:text-sm">
            {USAGE.map(([command, does]) => (
              <div
                className="flex flex-col gap-1 rounded-lg px-3 py-2.5 sm:grid sm:grid-cols-2 sm:gap-6"
                key={command}
              >
                <dt className="text-white">{command}</dt>
                <dd className="text-neutral-500">{does}</dd>
              </div>
            ))}
          </dl>
        </ShowcaseCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
        <NoteCard
          icon={<Bubbles className={NOTE_ICON} />}
          title="Shared with the Mac app"
        >
          A comment you leave here shows up in the Mac app, and the other way
          round. Any agent can pick them up with the resolve-reviewer-comments
          skill.
        </NoteCard>
        <NoteCard
          icon={<Terminal className={NOTE_ICON} />}
          title="Runs on any machine"
        >
          macOS or Linux, on your laptop or on a server over SSH. The install
          brings Node.js and everything else it needs.
        </NoteCard>
        <NoteCard
          icon={<Checkmark className={NOTE_ICON} />}
          title="Updates itself"
        >
          It checks for a new release at launch. Run update Reviewer from{" "}
          <Kbd>⌘K</Kbd>, or reviewer upgrade from the shell.
        </NoteCard>
        <NoteCard icon={<Folders className={NOTE_ICON} />} title="Workspaces">
          Open several repositories side by side, or a saved workspace with
          reviewer -w.
        </NoteCard>
      </div>
    </div>
  );
}
