import { createFileRoute } from "@tanstack/react-router";

import { PageHero } from "#/components/card";
import { Container, HERO_WIDTH } from "#/components/container";
import { ShowcaseVideo } from "#/components/showcase-video";
import { InstallCommand } from "#/components/install-command";
import { TerminalFeatures } from "#/components/terminal-features";
import { REPO_URL, SITE_URL } from "#/lib/links";
import { ogImage } from "#/lib/og-image";

const TITLE = "The terminal app · Reviewer";
const DESCRIPTION =
  "Review your agent's changes without leaving the terminal, on macOS or Linux, on your laptop or on a server over SSH.";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/terminal` },
      ...ogImage(
        "terminal",
        "Review your agent's changes without leaving the terminal, above the terminal app"
      ),
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terminal` }],
  }),
  component: TerminalPage,
});

/** Laid out as the /mac page is: the claim, the window, then the cards. */
function TerminalPage() {
  return (
    <>
      <Container>
        <PageHero
          actions={
            <InstallCommand
              className="sm:min-w-[560px]"
              lines={["curl -fsSL https://reviewer.sh/install | bash"]}
            />
          }
          note={
            <>
              macOS and Linux, on arm64 and x64. Free and{" "}
              <a
                className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-900 dark:decoration-neutral-600 dark:hover:text-white"
                href={REPO_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                open source
              </a>
              .
            </>
          }
          title="Review your agent's changes without leaving the terminal"
        >
          Run it on your laptop, on a server over SSH or in a terminal
          multiplexer next to your agent. It works the same on macOS and Linux.
        </PageHero>
      </Container>

      <Container className={HERO_WIDTH}>
        <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
          <ShowcaseVideo
            label="The terminal app next to Claude Code, with a magnifier passing over the usages of a symbol in its bottom pane"
            name="tui-usages"
          />
        </div>
      </Container>

      <Container className="mt-10 sm:mt-16">
        <TerminalFeatures />
      </Container>
    </>
  );
}
