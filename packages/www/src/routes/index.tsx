import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Asciify } from "#/components/canvasui/Asciify";
import {
  Container,
  FeatureSection,
  SectionDivider,
} from "#/components/feature-section";
import { ArrowRight } from "#/components/icons";
import { Logo } from "#/components/logo";
import { SiteHeader } from "#/components/site-header";
import { SpaSnapshot } from "#/components/spa-snapshot";
import { AgentsShowcase } from "#/components/showcase/agents";
import { CollaborationShowcase } from "#/components/showcase/collaboration";
import { GitShowcase } from "#/components/showcase/git";
import { LocalDevShowcase } from "#/components/showcase/local-dev";
import { PlansShowcase } from "#/components/showcase/plans";
import { ReviewShowcase } from "#/components/showcase/review";
import { usePrefersDark } from "#/hooks/use-prefers-dark";

const HERO_SNAPSHOT = {
  src: "/spa-snapshots/hero.json",
  width: 1600,
  height: 1000,
};

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    links: [{ rel: "preload", as: "fetch", href: HERO_SNAPSHOT.src }],
  }),
});

const ASCII_INK_DARK: [number, number, number] = [0.32, 0.32, 0.32];

function CtaButton({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const tone =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-900/90 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
      : "bg-white text-neutral-900 shadow-sm ring-1 ring-black/10 ring-inset hover:bg-neutral-50 dark:bg-white/5 dark:text-white dark:shadow-none dark:ring-white/15 dark:hover:bg-white/10";
  return (
    <a
      className={`group inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium whitespace-nowrap transition-colors ${tone}`}
      href={href}
    >
      {children}
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

function Home() {
  const prefersDark = usePrefersDark();

  return (
    <>
      <SiteHeader />

      <div className="relative isolate overflow-hidden bg-white dark:bg-neutral-950">
        <Asciify className="relative" ink={prefersDark ? ASCII_INK_DARK : null}>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0">
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
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.12)_18%,rgba(255,255,255,0)_40%,rgba(255,255,255,0.55)_78%,white_93%)] dark:bg-[linear-gradient(to_bottom,rgba(10,10,10,0.72)_0%,rgba(10,10,10,0.62)_18%,rgba(10,10,10,0.6)_40%,rgba(10,10,10,0.85)_78%,#0a0a0a_93%)]" />
            </div>

            <section className="relative">
              <Container>
                <div className="flex flex-col items-start justify-between gap-6 pt-16 pb-80 text-neutral-900 lg:flex-row lg:items-end lg:gap-0 lg:pt-32 lg:pb-[34rem] dark:text-white">
                  <h1 className="max-w-lg text-5xl leading-[1.02] font-medium tracking-[-0.02em] text-balance sm:text-[56px] md:text-[64px] lg:max-w-3xl lg:text-[72px]">
                    Tools for conversation based development.
                  </h1>
                  <div className="flex flex-col items-start gap-5 lg:items-end">
                    <p className="max-w-lg text-base text-balance text-neutral-700 lg:text-right dark:text-neutral-300">
                      Engineered for writing reliable, maintainable and testable
                      code — with the agents you already run, on your own
                      machine.
                    </p>
                    <div className="flex items-center gap-3">
                      <CtaButton href="/docs" variant="secondary">
                        Read the docs
                      </CtaButton>
                      <CtaButton href="/download">
                        Get byconvo
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </CtaButton>
                    </div>
                  </div>
                </div>
              </Container>
            </section>

            <div className="relative z-10 -mt-52 flex justify-center pb-24 sm:pb-32 lg:-mt-[26rem]">
              <div className="hero-app-shadow w-full max-w-[1760px] shrink-0 px-6">
                <SpaSnapshot
                  className="rounded-xl ring-1 ring-black/10 dark:ring-white/10"
                  height={HERO_SNAPSHOT.height}
                  label="byconvo reviewing a commit, with the file tree, the split diff and the project history"
                  src={HERO_SNAPSHOT.src}
                  width={HERO_SNAPSHOT.width}
                />
              </div>
            </div>
          </div>
        </Asciify>
      </div>

      <section className="py-16 md:py-32">
        <Container>
          <p className="max-w-3xl text-[24px] leading-snug font-medium tracking-tight text-pretty text-neutral-900 sm:text-[32px] dark:text-neutral-100">
            byconvo <StatementWord index="01" word="reviews" />
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
        <ReviewShowcase />
      </FeatureSection>

      <SectionDivider />

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
        description="An analysis is a graph: how one behaviour travels from the frontend through to storage, with notes pinned to real files and lines. When the code moves on, byconvo re-checks every anchor and tells you which parts of the analysis it can still stand behind."
        index="03"
        title="The flow an agent worked out, drawn front to back"
      >
        <PlansShowcase />
      </FeatureSection>

      <SectionDivider />

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
        index="05"
        title="Run it, look at it, point at what is wrong"
      >
        <LocalDevShowcase />
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
        index="06"
        title="The whole repository, not only the diff"
      >
        <GitShowcase />
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
              byconvo runs on your machine, against your repository, with the
              agents you already run.
            </p>
            <div className="flex items-center gap-3">
              <CtaButton href="/docs" variant="secondary">
                Read the docs
              </CtaButton>
              <CtaButton href="/download">
                Get byconvo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </CtaButton>
            </div>
          </div>

          <div
            className="h-px w-full bg-black/8 dark:bg-white/10"
            role="separator"
          />

          <div className="flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
            <a aria-label="byconvo home" className="flex shrink-0" href="/">
              <Logo className="h-6 w-auto" />
            </a>
            <nav aria-label="Footer" className="flex items-center gap-6">
              {[
                { label: "Changelog", href: "/changelog" },
                { label: "Docs", href: "/docs" },
                { label: "Pricing", href: "/pricing" },
                { label: "Download", href: "/download" },
              ].map((link) => (
                <a
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              © 2026 Darna Digital. All rights reserved.
            </p>
          </div>
        </Container>
      </footer>
    </>
  );
}
