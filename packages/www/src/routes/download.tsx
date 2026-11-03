import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { version } from "../../../../package.json";
import { AppScreenshot } from "#/components/app-screenshot";
import { PRIMARY_BUTTON } from "#/components/buttons";
import { PageHero, SURFACE } from "#/components/card";
import { Container } from "#/components/container";
import { Apple, ChevronRight, Terminal } from "#/components/icons";
import { InstallCommand } from "#/components/install-command";
import { Crossfade, SegmentedControl } from "#/components/segmented-control";
import { DOWNLOAD_URL, RELEASES_URL, SITE_URL } from "#/lib/links";

const TITLE = "Download · Reviewer";
const DESCRIPTION =
  "Download the Mac app or install the terminal app. Both are free and open source, and they share your comments.";

const APPS = [
  { value: "mac", label: "Mac app", icon: Apple },
  { value: "terminal", label: "Terminal app", icon: Terminal },
] as const;

type App = (typeof APPS)[number]["value"];

export const Route = createFileRoute("/download")({
  validateSearch: (search: Record<string, unknown>): { app?: App } =>
    search.app === "terminal" || search.app === "mac"
      ? { app: search.app }
      : {},
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/download` },
    ],
  }),
  component: DownloadPage,
});

const TEXT_LINK =
  "inline-flex items-center gap-1 text-[15px] font-medium text-neutral-600 transition-colors hover:text-neutral-900 lg:text-base dark:text-neutral-400 dark:hover:text-white";

/** One fact about a build: what it runs on, its version, what it costs. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-black/[0.06] py-3 text-[15px] last:border-b-0 lg:text-base dark:border-white/[0.08]">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900 dark:text-neutral-100">
        {children}
      </dd>
    </div>
  );
}

/**
 * The chosen app: what it is and how to get it on the left, the facts under
 * that, and the app itself on the right.
 */
function AppPanel({
  name,
  description,
  action,
  facts,
  more,
  screenshot,
}: {
  name: string;
  description: string;
  action: ReactNode;
  facts: ReactNode;
  more: ReactNode;
  screenshot: ReactNode;
}) {
  return (
    <div
      className={`${SURFACE} grid grid-cols-1 gap-8 overflow-hidden p-5 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12 lg:p-12`}
    >
      <div className="flex flex-col items-start gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.02em] sm:text-[30px] lg:text-4xl">
            {name}
          </h2>
          <p className="text-pretty text-neutral-600 lg:text-lg dark:text-neutral-400">
            {description}
          </p>
        </div>
        <div className="w-full">{action}</div>
        <dl className="w-full">{facts}</dl>
        {more}
      </div>
      <div className="overflow-hidden rounded-xl">{screenshot}</div>
    </div>
  );
}

function MacPanel() {
  return (
    <AppPanel
      action={
        <a className={PRIMARY_BUTTON} href={DOWNLOAD_URL}>
          <Apple className="size-5" />
          Download for Mac
        </a>
      }
      description="The change, your comments and your Claude Code and Codex sessions in one window."
      facts={
        <>
          <Fact label="Version">{version}</Fact>
          <Fact label="Requires">macOS 26 or later</Fact>
          <Fact label="Runs on">Apple silicon</Fact>
          <Fact label="Updates">Inside the app</Fact>
        </>
      }
      more={
        <Link className={TEXT_LINK} to="/mac">
          See what the Mac app does
          <ChevronRight className="size-4" />
        </Link>
      }
      name="The Mac app"
      screenshot={
        <AppScreenshot
          label="A comment on a line of code, being assigned to a new Claude session"
          lazy={false}
          name="comment-assign"
        />
      }
    />
  );
}

function TerminalPanel() {
  return (
    <AppPanel
      action={
        <InstallCommand
          lines={["curl -fsSL https://reviewer.sh/install | bash"]}
        />
      }
      description="The same diffs and comments from the keyboard, over SSH or in a tmux pane next to your agent."
      facts={
        <>
          <Fact label="Version">{version}</Fact>
          <Fact label="Requires">macOS or Linux</Fact>
          <Fact label="Runs on">arm64 and x64</Fact>
          <Fact label="Includes">Node.js</Fact>
        </>
      }
      more={
        <Link className={TEXT_LINK} to="/terminal">
          See what the terminal app does
          <ChevronRight className="size-4" />
        </Link>
      }
      name="The terminal app"
      screenshot={
        <AppScreenshot
          label="The terminal app reviewing a branch against main, with a comment on a changed line"
          lazy={false}
          name="tui-review"
        />
      }
    />
  );
}

function DownloadPage() {
  const { app = "mac" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Container>
      <PageHero
        actions={
          <SegmentedControl
            label="Choose an app"
            onChange={(next) =>
              navigate({
                search: { app: next },
                replace: true,
                resetScroll: false,
              })
            }
            segments={APPS}
            value={app}
          />
        }
        title="Download Reviewer"
      >
        Pick the Mac app or the terminal app. Both are free and open source, and
        if you use both they share your comments.
      </PageHero>

      <Crossfade
        value={app}
        views={[
          { value: "mac", node: <MacPanel /> },
          { value: "terminal", node: <TerminalPanel /> },
        ]}
      />

      <div className="mt-10 flex flex-col gap-x-8 gap-y-3 sm:mt-14 sm:flex-row">
        <a
          className={TEXT_LINK}
          href={RELEASES_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Browse every release on GitHub
          <ChevronRight className="size-4" />
        </a>
        <Link className={TEXT_LINK} to="/cloud">
          Join the Reviewer Cloud waitlist
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </Container>
  );
}
