import { createFileRoute } from "@tanstack/react-router";

import { AppScreenshot, HERO_PHONE_CROP } from "#/components/app-screenshot";
import { DownloadButton } from "#/components/buttons";
import { PageHero } from "#/components/card";
import { Container, HERO_WIDTH } from "#/components/container";
import { MacFeatures } from "#/components/mac-features";
import { REPO_URL, SITE_URL } from "#/lib/links";

const TITLE = "The Mac app · Reviewer";
const DESCRIPTION =
  "The change, your comments and your Claude Code and Codex sessions in one window, so a wrong line goes to an agent and comes back fixed without switching tools.";

export const Route = createFileRoute("/mac")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/mac` },
    ],
  }),
  component: MacPage,
});

function MacPage() {
  return (
    <>
      <Container>
        <PageHero
          actions={<DownloadButton />}
          note={
            <>
              Apple silicon only, on macOS 26 or later. Free and{" "}
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
          title="Read, comment and hand off in one window."
        >
          Your diff, your comments and your Claude Code and Codex sessions sit
          side by side. Send a line to an agent and read its fix in the same
          place.
        </PageHero>
      </Container>

      <Container className={HERO_WIDTH}>
        <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
          <AppScreenshot
            label="The Mac app showing a side-by-side diff of uncommitted changes, with the changed files beside it"
            lazy={false}
            name="split-diff"
            phone={HERO_PHONE_CROP}
          />
        </div>
      </Container>

      <Container className="mt-10 sm:mt-16">
        <MacFeatures />
      </Container>
    </>
  );
}
