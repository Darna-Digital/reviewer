import { createFileRoute } from "@tanstack/react-router";

import { NoteCard, PointCard, ShowcaseCard } from "#/components/card";
import { Container } from "#/components/container";
import {
  Branch,
  Bubble,
  Bubbles,
  Command,
  Folders,
  GitHub,
  History,
  Laptop,
  Play,
  PullRequest,
  Sparkles,
  Terminal,
} from "#/components/icons";
import { AppIcon } from "#/components/logo";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { SpaSnapshot } from "#/components/spa-snapshot";
import { GITHUB_URL } from "#/lib/links";

const HERO_SNAPSHOT = {
  src: "/spa-snapshots/hero.json",
  width: 1600,
  height: 1000,
};

/** Every section snapshot is framed on the app canvas, so they share a box. */
const SECTION_FRAME = { width: 1428, height: 854 };

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    links: [{ rel: "preload", as: "fetch", href: HERO_SNAPSHOT.src }],
  }),
});

function SectionSnapshot({ label, name }: { label: string; name: string }) {
  return (
    <SpaSnapshot
      height={SECTION_FRAME.height}
      label={label}
      src={`/spa-snapshots/${name}.json`}
      width={SECTION_FRAME.width}
    />
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 pt-28 pb-16 text-center sm:pt-36">
      <AppIcon className="size-[84px] rounded-[22.37%] shadow-[0_14px_30px_rgba(0,0,0,0.14),0_3px_8px_rgba(0,0,0,0.10)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.5)]" />

      <h1 className="bg-gradient-to-b from-neutral-900 to-neutral-500 bg-clip-text text-[64px] leading-none font-semibold tracking-[-0.03em] text-transparent sm:text-[88px] dark:from-white dark:to-neutral-400">
        Reviewer
      </h1>

      <p className="max-w-2xl text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-balance sm:text-[44px]">
        Tools for conversation based development.
      </p>

      <p className="max-w-2xl text-lg leading-normal text-pretty text-neutral-600 sm:text-[21px] dark:text-neutral-400">
        Reviewer reviews what the agent wrote, runs it on your machine, and
        keeps the conversation on the line it belongs to.
      </p>

      <a
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 text-[15px] font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        href={GITHUB_URL}
      >
        <GitHub className="size-4" />
        View on GitHub
      </a>

      <p className="text-[13px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        Free and open source.
        <br />
        Runs on your own machine, against your own repository.
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

        <Container>
          <div className="screen-shadow overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10">
            <SpaSnapshot
              eager
              height={HERO_SNAPSHOT.height}
              label="Reviewer reviewing a commit, with the file tree, the split diff and the project history"
              src={HERO_SNAPSHOT.src}
              width={HERO_SNAPSHOT.width}
            />
          </div>
        </Container>

        <Container className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PointCard icon={<Bubble className="size-7" />}>
            Comment on any line of any file, and the next agent reads it.
          </PointCard>
          <PointCard icon={<Sparkles className="size-7" />}>
            Hand the review to whichever agent you already run.
          </PointCard>
          <PointCard icon={<Play className="size-7" />}>
            Start the services and keep their logs beside the diff.
          </PointCard>
        </Container>

        <Container className="mt-6 flex flex-col gap-4">
          <ShowcaseCard
            description="Comment on your local changes, a single commit, a range of them, or a GitHub pull request. Comments are stored with the code, so the next agent to open the repository reads exactly what you wrote, against the lines you wrote it about."
            icon={<Bubble className="size-7" />}
            title="Say it on the line it belongs to"
          >
            <SectionSnapshot
              label="A comment being written against a line of the diff, in the file it belongs to"
              name="review"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Claude Code, Codex, opencode, Cursor, or a plain shell. Reviewer builds the command, drops the prompt in, and streams back whatever the tool prints. Point it at your own CLI with a {prompt} token and it behaves like the built-in ones."
            icon={<Sparkles className="size-7" />}
            title="Hand it to the agent you already run"
          >
            <SectionSnapshot
              label="An agent session in Reviewer: the thread, the model picker and the branch it runs on"
              name="agents"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Named run configurations start your services from inside the app and keep their logs beside the diff, so the change and what it does at runtime are read in one window."
            icon={<Play className="size-7" />}
            title="Run it and look at it"
          >
            <SectionSnapshot
              label="A run configuration and its service logs, docked beneath the code"
              name="local-dev"
            />
          </ShowcaseCard>

          <ShowcaseCard
            description="Browse files, stage and commit, page through history, and open a pull request without leaving the review. Several repository roots can sit in one window when a project spans more than one."
            icon={<Branch className="size-7" />}
            title="The whole repository, not only the diff"
          >
            <SectionSnapshot
              label="The project history graph with branch refs, beside the file being browsed"
              name="git"
            />
          </ShowcaseCard>
        </Container>

        <Container className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NoteCard icon={<Bubbles className="size-7" />} title="Threads">
            Reply on a comment and resolve it, with the file tree marking every
            file still carrying one.
          </NoteCard>
          <NoteCard icon={<History className="size-7" />} title="History">
            Page through the project graph with its branch refs, and review any
            commit or range of them.
          </NoteCard>
          <NoteCard
            icon={<PullRequest className="size-7" />}
            title="Pull requests"
          >
            Open a pull request, review one from GitHub, and resolve conflicts
            without leaving the window.
          </NoteCard>
          <NoteCard icon={<Folders className="size-7" />} title="Multi-repo">
            Several repository roots sit in one window when a project spans more
            than a single checkout.
          </NoteCard>
          <NoteCard icon={<Terminal className="size-7" />} title="Terminals">
            Terminal sessions as tabs, per branch, beside the code they were
            opened against.
          </NoteCard>
          <NoteCard icon={<Command className="size-7" />} title="Keyboard">
            A command palette on ⌘K reaches every file, branch and action in the
            project.
          </NoteCard>
          <NoteCard icon={<Laptop className="size-7" />} title="Local">
            Your repository never leaves the machine — Reviewer runs the agents
            you have already installed.
          </NoteCard>
          <NoteCard icon={<GitHub className="size-7" />} title="Open source">
            Read the source, file an issue, or build it yourself from the
            repository.
          </NoteCard>
        </Container>

        <div className="mt-16">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
