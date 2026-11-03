import { createFileRoute } from "@tanstack/react-router";

import { PageHero } from "#/components/card";
import { Container } from "#/components/container";
import { Cloud } from "#/components/icons";
import { MARK_PATH } from "#/components/logo";
import { WaitlistForm } from "#/components/waitlist-form";
import { SITE_URL } from "#/lib/links";

const TITLE = "Reviewer Cloud · Reviewer";
const DESCRIPTION =
  "Reviewer Cloud is a paid service we're still building. Join the waitlist to hear when it opens.";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/cloud` },
    ],
  }),
  component: CloudPage,
});

/**
 * The homepage's opening, with the waitlist where its buttons are, then the
 * stage its screenshots sit on. Reviewer Cloud has no screenshot yet, so the
 * stage shows the mark on the noir backdrop.
 */
function CloudPage() {
  return (
    <Container>
      <PageHero
        actions={
          <div className="w-full sm:w-[32rem]">
            <WaitlistForm />
          </div>
        }
        title="Reviewer Cloud"
      >
        It's a paid service we're still building.
      </PageHero>

      <div
        aria-hidden="true"
        className="noir relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[min(2vw,12px)] sm:aspect-[2/1]"
      >
        <svg
          className="absolute h-[80%] w-auto text-white/[0.05]"
          fill="currentColor"
          viewBox="0 0 300 400"
        >
          <path d={MARK_PATH} />
        </svg>
        <Cloud className="relative size-14 text-neutral-300 sm:size-20" />
      </div>
    </Container>
  );
}
