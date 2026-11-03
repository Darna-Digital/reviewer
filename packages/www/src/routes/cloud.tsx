import { createFileRoute } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { Logo } from "#/components/logo";
import { WaitlistForm } from "#/components/waitlist-form";
import { SITE_URL } from "#/lib/links";

const TITLE = "Reviewer Cloud · Reviewer";
const SENTENCE = "Reviewer Cloud is a paid service we're still building.";
const DESCRIPTION = `${SENTENCE} Join the waitlist to hear when it opens.`;

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

const RULE = "border-black/[0.08] dark:border-white/[0.08]";

/**
 * Laid out in opencode.ai's marketing language: one monospace column between
 * hairlines, opening on a dark screen in either scheme with the name on a
 * grid of the mark's cells, then one ruled band with the sentence and the form.
 */
function CloudPage() {
  return (
    <Container className="pt-20 sm:pt-28 lg:pt-32">
      <div className={`border font-mono ${RULE}`}>
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#0b0b0c] sm:aspect-[2/1] lg:aspect-[5/2]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] mask-radial-from-20% mask-radial-to-75% bg-size-[32px_32px] bg-center"
          />
          <h1 className="relative">
            <span className="sr-only">Reviewer Cloud</span>
            <span
              aria-hidden="true"
              className="flex items-center gap-[0.5em] text-[24px] sm:text-[40px] lg:text-[52px]"
            >
              <Logo className="h-[1.4em] text-white" />
              <span className="border border-white/20 px-[0.4em] py-[0.15em] text-[0.5em] leading-none text-neutral-400">
                Cloud
              </span>
            </span>
          </h1>
        </div>

        <section
          className={`flex flex-col gap-8 border-t px-5 py-12 sm:px-12 sm:py-16 ${RULE}`}
        >
          <p className="max-w-2xl text-[20px] leading-snug font-bold tracking-[-0.02em] text-pretty sm:text-[26px]">
            {SENTENCE}
          </p>
          <div className="max-w-xl">
            <WaitlistForm />
          </div>
        </section>
      </div>
    </Container>
  );
}
