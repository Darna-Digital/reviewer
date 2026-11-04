import { createFileRoute } from "@tanstack/react-router";

import { PageHero } from "#/components/card";
import { CloudIllustration } from "#/components/cloud-illustration";
import { Container, HERO_WIDTH } from "#/components/container";
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
 * illustration where the other products show their hero screenshot.
 */
function CloudPage() {
  return (
    <>
      <Container>
        <PageHero
          actions={
            <div className="w-full sm:w-[32rem]">
              <WaitlistForm />
            </div>
          }
          title={
            // Set in two tones, as the homepage's Reviewer Cloud view is.
            <>
              <span className="block text-neutral-400 dark:text-neutral-500">
                Reviewer Cloud
              </span>
              <span className="block">is what we're building next.</span>
            </>
          }
        />
      </Container>
      <Container className={HERO_WIDTH}>
        <div className="screen-shadow overflow-hidden rounded-[min(2vw,12px)]">
          <CloudIllustration />
        </div>
      </Container>
    </>
  );
}
