import { createFileRoute } from "@tanstack/react-router";

import { AppScreenshot } from "#/components/app-screenshot";
import { PageHero } from "#/components/card";
import { Container, HERO_WIDTH } from "#/components/container";
import { InstallCommand } from "#/components/install-command";
import { TerminalFeatures } from "#/components/terminal-features";
import { SITE_URL } from "#/lib/links";

const TITLE = "The terminal app · Reviewer";
const DESCRIPTION =
  "Review a branch, a commit or a pull request without leaving the terminal. A comment you leave here shows up in the Mac app.";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/terminal` },
    ],
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
          note="macOS and Linux, on arm64 and x64. Free and open source."
          title="Review a branch without leaving the terminal."
        >
          The terminal app reads the same changes and comments as the Mac app.
          Run it over SSH, in a tmux pane next to your agent, or on Linux.
        </PageHero>
      </Container>

      <Container className={HERO_WIDTH}>
        <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
          <AppScreenshot
            label="The terminal app reviewing a branch against main, with a comment on a changed line"
            lazy={false}
            name="tui-review"
          />
        </div>
      </Container>

      <Container className="mt-10 sm:mt-20">
        <TerminalFeatures />
      </Container>
    </>
  );
}
