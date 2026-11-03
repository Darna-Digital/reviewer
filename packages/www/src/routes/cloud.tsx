import { createFileRoute } from "@tanstack/react-router";

import { PageHero } from "#/components/card";
import { Container } from "#/components/container";
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

/** The homepage's opening, with the waitlist where its buttons are. */
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
    </Container>
  );
}
