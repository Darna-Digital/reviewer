import { createFileRoute } from "@tanstack/react-router";

import { Asciify } from "#/components/canvasui/Asciify";
import {
  Container,
  FeatureSection,
  SectionDivider,
} from "#/components/feature-section";
import { GitHub } from "#/components/icons";
import { Logo } from "#/components/logo";
import { SiteHeader } from "#/components/site-header";
import { SpaSnapshot } from "#/components/spa-snapshot";
import { usePrefersDark } from "#/hooks/use-prefers-dark";
import { GITHUB_URL } from "#/lib/links";

const HERO_SNAPSHOT = {
  src: "/spa-snapshots/hero.json",
  width: 1600,
  height: 1000,
};

/** Every section snapshot is framed on the app canvas, so they share a box. */
const SECTION_FRAME = { width: 1428, height: 854 };

function SectionSnapshot({ label, name }: { label: string; name: string }) {
  return (
    <SpaSnapshot
      className="rounded-xl ring-1 ring-black/10 dark:ring-white/10"
      height={SECTION_FRAME.height}
      label={label}
      src={`/spa-snapshots/${name}.json`}
      width={SECTION_FRAME.width}
    />
  );
}

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    links: [{ rel: "preload", as: "fetch", href: HERO_SNAPSHOT.src }],
  }),
});

const ASCII_INK_DARK: [number, number, number] = [0.42, 0.42, 0.42];

const VIDEO_CREDIT_TOOLTIP_ID = "background-video-credit";

function GithubCta() {
  return (
    <a
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 text-[15px] font-medium whitespace-nowrap text-white transition-colors hover:bg-neutral-900/90 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
      href={GITHUB_URL}
    >
      <GitHub className="size-4" />
      View on GitHub
    </a>
  );
}

function StatementWord({ word, index }: { word: string; index: string }) {
  return (
    <>
      <span className="relative isolate inline-block">
        {word}
        <span
          aria-hidden="true"
          className="absolute -inset-x-1 top-1/2 -z-10 h-7 -translate-y-1/2 rounded-lg bg-black/6 md:h-9 dark:bg-white/10"
        />
      </span>
      <span className="relative top-1 inline-flex justify-center pr-1 pl-2 align-top font-mono text-[10px] leading-none text-neutral-500">
        {index}
      </span>
    </>
  );
}

function VideoCredit() {
  return (
    <span className="group absolute right-6 bottom-6 z-20 inline-flex">
      <button
        aria-describedby={VIDEO_CREDIT_TOOLTIP_ID}
        className="cursor-default rounded-full bg-white/60 px-3 py-1 font-mono text-[10px] tracking-wide text-neutral-600 ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:text-neutral-900 dark:bg-white/5 dark:text-neutral-400 dark:ring-white/10 dark:hover:text-white"
        type="button"
      >
        Video copyright
      </button>
      <span
        className="pointer-events-none absolute top-1/2 right-[calc(100%+0.5rem)] translate-x-1 -translate-y-1/2 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition duration-150 group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100 dark:bg-white dark:text-neutral-950"
        id={VIDEO_CREDIT_TOOLTIP_ID}
        role="tooltip"
      >
        【=◈︿◈=】porter robinson - worlds
      </span>
    </span>
  );
}

function Home() {
  const prefersDark = usePrefersDark();

  return (
    <>
      <SiteHeader />

      <div className="relative isolate overflow-hidden bg-white dark:bg-neutral-950">
        <div className="pointer-events-none absolute inset-0">
          <Asciify className="h-full" ink={prefersDark ? ASCII_INK_DARK : null}>
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
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0.06)_10%,rgba(255,255,255,0)_26%,rgba(255,255,255,0.55)_78%,white_93%)] dark:bg-[linear-gradient(to_bottom,rgba(10,10,10,0.78)_0%,rgba(10,10,10,0.66)_10%,rgba(10,10,10,0.6)_30%,rgba(10,10,10,0.88)_78%,#0a0a0a_93%)]" />
          </Asciify>
        </div>

        <section className="relative mt-8 lg:mt-16">
          <Container>
            <div className="flex flex-col items-start gap-5 pt-24 pb-72 text-neutral-900 lg:pt-48 lg:pb-[30rem] dark:text-white">
              <h1 className="max-w-lg text-5xl leading-[1.02] font-medium tracking-[-0.02em] text-balance sm:text-[56px] md:text-[64px] lg:max-w-3xl lg:text-[72px]">
                Tools for conversation based development.
              </h1>
              <p className="max-w-2xl text-lg text-pretty text-neutral-800 md:text-xl dark:text-neutral-100">
                Engineered for writing reliable, maintainable and testable code
                — with the agents you already run, on your own machine.
              </p>
            </div>
          </Container>
        </section>

        <div className="relative z-10 -mt-52 pb-24 sm:pb-32 lg:-mt-[26rem]">
          <Container className="flex min-[1648px]:justify-center">
            <div className="hero-app-shadow w-[1600px] shrink-0">
              <SpaSnapshot
                className="rounded-xl ring-1 ring-black/10 dark:ring-white/10"
                eager
                height={HERO_SNAPSHOT.height}
                label="Reviewer reviewing a commit, with the file tree, the split diff and the project history"
                src={HERO_SNAPSHOT.src}
                width={HERO_SNAPSHOT.width}
              />
            </div>
          </Container>
        </div>

        <VideoCredit />
      </div>

      <section className="py-16 md:py-32">
        <Container>
          <p className="max-w-3xl text-[24px] leading-snug font-medium tracking-tight text-pretty text-neutral-900 sm:text-[32px] dark:text-neutral-100">
            Reviewer <StatementWord index="01" word="reviews" />
            what the agent wrote, <StatementWord index="02" word="runs" />
            it on your machine, and <StatementWord index="03" word="keeps" />
            the conversation on the line it belongs to.
          </p>
        </Container>
      </section>

      <SectionDivider />

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
        <SectionSnapshot
          label="A comment being written against a line of the diff, in the file it belongs to"
          name="review"
        />
      </FeatureSection>

      <SectionDivider />

      <FeatureSection
        capabilities={[
          "Claude Code",
          "Codex",
          "opencode",
          "Cursor",
          "Terminal sessions",
          "Custom CLIs",
          "Per-branch sessions",
          "Work log",
        ]}
        capabilitiesLabel="Agents, on your machine"
        description="Claude Code, Codex, opencode, Cursor, or a plain shell. Reviewer builds the command, drops the prompt in, and streams back whatever the tool prints. Point it at your own CLI with a {prompt} token and it behaves like the built-in ones."
        index="02"
        title="Hand the review to whichever agent you already run"
      >
        <SectionSnapshot
          label="An agent session in Reviewer: the thread, the model picker and the branch it runs on"
          name="agents"
        />
      </FeatureSection>

      <SectionDivider />

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
        description="An analysis is a graph: how one behaviour travels from the frontend through to storage, with notes pinned to real files and lines. When the code moves on, Reviewer re-checks every anchor and tells you which parts of the analysis it can still stand behind."
        index="03"
        title="The flow an agent worked out, drawn front to back"
      >
        <SectionSnapshot
          label="An analysis drawn front to back, with notes anchored to real files and lines"
          name="plans"
        />
      </FeatureSection>

      <SectionDivider />

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
        index="04"
        title="Run it, look at it, point at what is wrong"
      >
        <SectionSnapshot
          label="A run configuration and its service logs, docked beneath the code"
          name="local-dev"
        />
      </FeatureSection>

      <SectionDivider />

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
        index="05"
        title="The whole repository, not only the diff"
      >
        <SectionSnapshot
          label="The project history graph with branch refs, beside the file being browsed"
          name="git"
        />
      </FeatureSection>

      <footer className="w-full overflow-hidden bg-gradient-to-b from-neutral-100 to-white dark:from-neutral-900 dark:to-neutral-950">
        <Container className="relative">
          <div className="absolute top-0 left-1/2 h-px w-screen -translate-x-1/2 bg-black/8 dark:bg-white/10" />

          <div className="flex flex-col items-start gap-6 py-20 md:gap-10 md:py-36">
            <h2 className="text-4xl leading-[1.05] font-medium tracking-[-0.02em] text-neutral-900 md:text-[48px] dark:text-white">
              <span className="block">Tools for conversation</span>
              <span className="block">based development.</span>
            </h2>
            <p className="max-w-xl text-base text-balance text-neutral-600 dark:text-neutral-400">
              Reviewer runs on your machine, against your repository, with the
              agents you already run.
            </p>
            <GithubCta />
          </div>

          <div
            className="h-px w-full bg-black/8 dark:bg-white/10"
            role="separator"
          />

          <div className="flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
            <Logo className="h-6 w-auto shrink-0" />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              © 2026 Darna Digital. All rights reserved.
            </p>
          </div>
        </Container>
      </footer>
    </>
  );
}
