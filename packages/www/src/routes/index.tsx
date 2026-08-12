import { createFileRoute } from "@tanstack/react-router";

import { Asciify } from "#/components/canvasui/Asciify";
import { FeatureSection } from "#/components/feature-section";
import { ArrowRight } from "#/components/icons";
import { SiteHeader } from "#/components/site-header";
import { AgentsShowcase } from "#/components/showcase/agents";
import { CollaborationShowcase } from "#/components/showcase/collaboration";
import { GitShowcase } from "#/components/showcase/git";
import { HeroApp } from "#/components/showcase/hero-app";
import { LocalDevShowcase } from "#/components/showcase/local-dev";
import { PlansShowcase } from "#/components/showcase/plans";
import { ReviewShowcase } from "#/components/showcase/review";

export const Route = createFileRoute("/")({ component: Home });

const STATEMENT = [
  { text: "byconvo reviews" },
  { mark: "01" },
  { text: "what the agent wrote, runs" },
  { mark: "02" },
  { text: "it on your machine, and keeps" },
  { mark: "03" },
  { text: "the conversation on the line it belongs to." },
];

function Home() {
  return (
    <>
      <SiteHeader />

      <div className="relative isolate overflow-hidden bg-white">
        <Asciify className="relative">
          <div className="min-h-[calc(62svh_-_var(--spacing-header))]">
            <div className="pointer-events-none absolute inset-0 mask-b-from-75%">
              <video
                className="size-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
                tabIndex={-1}
              >
                <source
                  src="/background-video.av1.mp4"
                  type='video/mp4; codecs="av01.0.08M.08"'
                />
                <source
                  src="/background-video.mp4"
                  type='video/mp4; codecs="avc1.640032"'
                />
              </video>
              <div className="absolute inset-0 bg-gradient-to-b from-white via-white/40 to-transparent" />
            </div>

            <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 text-neutral-900 sm:pt-24 sm:pb-32 md:px-8">
              <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="block">Tools for conversation</span>
                <span className="block">based development.</span>
              </h1>
              <p className="mb-8 max-w-xl text-lg text-neutral-700">
                Engineered for writing reliable, maintainable and testable code.
              </p>
              <a
                className="group inline-flex h-10 items-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-900/90"
                href="/download"
              >
                Get byconvo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </section>
          </div>
        </Asciify>

        <div className="relative -mt-16 mb-16 sm:-mt-20 sm:mb-24">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <HeroApp />
          </div>
        </div>
      </div>

      <section className="border-t border-black/8 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <p className="max-w-4xl text-2xl leading-snug font-medium tracking-tight text-balance text-neutral-400 sm:text-4xl">
            {STATEMENT.map((part) =>
              part.mark ? (
                <span
                  className="mx-1.5 align-super font-mono text-xs text-neutral-900 sm:text-sm"
                  key={part.mark}
                >
                  {part.mark}
                </span>
              ) : (
                <span className="text-neutral-900" key={part.text}>
                  {part.text}{" "}
                </span>
              )
            )}
          </p>
        </div>
      </section>

      <FeatureSection
        capabilities={[
          "Inline comments",
          "Local changes",
          "Commits & ranges",
          "GitHub pull requests",
          "Threaded replies",
          "Resolve",
          "Comment-carrying file tree",
        ]}
        capabilitiesLabel="Review anywhere"
        description="Comment on any line of any file — your local changes, a single commit, a range of them, or a GitHub pull request. Comments are stored with the code, so the next agent to open the repository reads exactly what you wrote, against the lines you wrote it about."
        index="01"
        title="Say it on the line it belongs to"
      >
        <ReviewShowcase />
      </FeatureSection>

      <FeatureSection
        capabilities={[
          "Claude Code",
          "Codex",
          "opencode",
          "Cursor",
          "Terminal threads",
          "Custom CLIs",
          "Per-branch sessions",
          "Work log",
        ]}
        capabilitiesLabel="Agents, on your machine"
        description="Claude Code, Codex, opencode, Cursor, or a plain shell. byconvo builds the command, drops the prompt in, and streams back whatever the tool prints. Point it at your own CLI with a {prompt} token and it behaves like the built-in ones."
        index="02"
        title="Hand the review to whichever agent you already run"
      >
        <AgentsShowcase />
      </FeatureSection>

      <FeatureSection
        capabilities={[
          "Front-to-back flow graph",
          "Layer lanes",
          "Notes anchored to lines",
          "Anchor re-checking",
          "Relocated & lost anchors",
          "Drafts and saved analyses",
        ]}
        capabilitiesLabel="Analyses that age honestly"
        description="An analysis is a graph: how one behaviour travels from the frontend through to storage, with notes pinned to real files and lines. When the code moves on, byconvo re-checks every anchor and tells you which parts of the analysis it can still stand behind."
        index="03"
        title="The flow an agent worked out, drawn front to back"
      >
        <PlansShowcase />
      </FeatureSection>

      <FeatureSection
        capabilities={[
          "Task board",
          "Chats",
          "Docs",
          "Up for grabs",
          "Agent assignees",
          "Inbox",
          "Project-wide search",
        ]}
        capabilitiesLabel="One workspace"
        description="Tasks, chats and docs sit in the same workspace. Assign a card to a person or to an agent, leave the brief in the thread beside it, and read back what the work turned up on the way through."
        index="04"
        title="Humans and agents, working the same board"
      >
        <CollaborationShowcase />
      </FeatureSection>

      <FeatureSection
        capabilities={[
          "Run configurations",
          "Service logs",
          "Start & stop all",
          "Browser pane",
          "Element picker",
          "Visual comments",
        ]}
        capabilitiesLabel="From the diff to the running app"
        description="Named run configurations start your services from inside the app and keep their logs beside the diff. The browser pane loads the running site; pick an element and the comment is filed with a shot of what you were pointing at."
        index="05"
        title="Run it, look at it, point at what is wrong"
      >
        <LocalDevShowcase />
      </FeatureSection>

      <FeatureSection
        capabilities={[
          "Browse & edit",
          "Commit & push",
          "Branch switcher",
          "History graph",
          "Pull requests",
          "Conflict resolution",
          "Multi-repo roots",
        ]}
        capabilitiesLabel="Git, in full"
        description="Browse and edit files, stage and commit, page through history, and open a pull request without leaving the review. Several repository roots can sit in one window when a project spans more than one."
        index="06"
        title="The whole repository, not only the diff"
      >
        <GitShowcase />
      </FeatureSection>

      <section className="border-t border-black/8 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance text-neutral-900 sm:text-3xl">
            Engineered for writing reliable, maintainable and testable code.
          </h2>
          <p className="mt-4 max-w-xl text-base text-neutral-600 sm:text-lg">
            byconvo runs on your machine, against your repository, with the
            agents you already run.
          </p>
          <a
            className="group mt-8 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-900/90"
            href="/download"
          >
            Get byconvo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>
    </>
  );
}
