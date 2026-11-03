import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "#/components/buttons";
import { NoteCard, PageHero, SectionHeading } from "#/components/card";
import { Container } from "#/components/container";
import {
  Bubbles,
  Cloud,
  Document,
  Folders,
  GitHub,
  Laptop,
  Terminal,
} from "#/components/icons";
import { ISSUES_URL, REPO_URL, SITE_URL } from "#/lib/links";

const TITLE = "About · Reviewer";
const DESCRIPTION =
  "Reviewer is for reading the code agents write: read the change, comment on what's wrong and hand it back. Made by Darna Digital.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/about` },
    ],
  }),
  component: AboutPage,
});

const INLINE_LINK =
  "underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-900 dark:decoration-neutral-600 dark:hover:text-white";

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className={INLINE_LINK}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function AboutPage() {
  return (
    <Container>
      <PageHero title="Agents write the code. You still have to read it.">
        Reviewer is where you read a change, comment on what's wrong and hand it
        back to the agent that wrote it. When it looks right, you commit.
      </PageHero>

      <div className="mt-10 flex flex-col gap-24 sm:mt-14 sm:gap-36">
        <section className="flex flex-col gap-10 sm:gap-14">
          <SectionHeading lead="Three ways in,">
            one set of comments.
          </SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <NoteCard icon={<Laptop className="size-6" />} title="The Mac app">
              The change, your comments and your Claude Code and Codex sessions
              in one window. Free and open source.{" "}
              <Link className={INLINE_LINK} to="/mac">
                See the Mac app
              </Link>
            </NoteCard>
            <NoteCard
              icon={<Terminal className="size-6" />}
              title="The terminal app"
            >
              The same diffs and comments from the keyboard, over SSH or on
              Linux. Free and open source.{" "}
              <Link className={INLINE_LINK} to="/terminal">
                See the terminal app
              </Link>
            </NoteCard>
            <NoteCard
              icon={<Cloud className="size-6" />}
              title="Reviewer Cloud"
            >
              A paid service we're building next. It has a waitlist for now.{" "}
              <Link className={INLINE_LINK} to="/cloud">
                Join the waitlist
              </Link>
            </NoteCard>
          </div>
        </section>

        <section className="flex flex-col gap-10 sm:gap-14">
          <SectionHeading lead="How we build it">
            and what you can expect.
          </SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <NoteCard
              icon={<GitHub className="size-6" />}
              title="Open source, MIT-licensed"
            >
              The Mac app, the terminal app and this site are in one{" "}
              <External href={REPO_URL}>repository on GitHub</External>. Read
              the code, build it yourself or send a pull request.
            </NoteCard>
            <NoteCard
              icon={<Folders className="size-6" />}
              title="Your code stays on your machine"
            >
              Both apps read your repository from disk and keep comments in a
              local database.
            </NoteCard>
            <NoteCard
              icon={<Document className="size-6" />}
              title="Small releases, often"
            >
              Every release is listed in the{" "}
              <Link className={INLINE_LINK} to="/changelog">
                changelog
              </Link>{" "}
              with what changed. The Mac app updates itself.
            </NoteCard>
            <NoteCard
              icon={<Bubbles className="size-6" />}
              title="Issues are public"
            >
              Bugs and feature requests go to{" "}
              <External href={ISSUES_URL}>GitHub issues</External>, where you
              can see what's been reported and what we're working on.
            </NoteCard>
          </div>
        </section>

        <section className="flex flex-col items-start gap-6">
          <SectionHeading lead="Made by">Darna Digital.</SectionHeading>
          <p className="max-w-2xl text-lg leading-normal text-pretty text-neutral-600 sm:text-[21px] lg:text-2xl lg:leading-[1.4] dark:text-neutral-400">
            Most of our own code is now written by agents, so most of our day
            goes into reading it. We build Reviewer for that part. Find us at{" "}
            <External href="https://darnadigital.com">
              darnadigital.com
            </External>
            .
          </p>
          <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link className={PRIMARY_BUTTON} to="/download">
              Download Reviewer
            </Link>
            <a
              className={SECONDARY_BUTTON}
              href={REPO_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <GitHub className="size-5" />
              Read the source
            </a>
          </div>
        </section>
      </div>
    </Container>
  );
}
