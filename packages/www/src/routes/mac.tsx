import { createFileRoute } from "@tanstack/react-router";

import { AppScreenshot, HERO_PHONE_CROP } from "#/components/app-screenshot";
import { DownloadButton } from "#/components/buttons";
import { PageHero } from "#/components/card";
import { Container, HERO_WIDTH } from "#/components/container";
import { MacFeatures } from "#/components/mac-features";
import { SITE_URL } from "#/lib/links";

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
          note="Apple silicon only, on macOS 26 or later. Free and open source."
          title="Read, comment and hand off in one window."
        >
          The Mac app puts the change, your comments and your Claude Code and
          Codex sessions side by side, so a wrong line goes to an agent and
          comes back fixed without switching tools.
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
