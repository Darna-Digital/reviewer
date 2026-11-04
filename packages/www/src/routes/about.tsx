import { createFileRoute } from "@tanstack/react-router";

import { Container } from "#/components/container";
import { SITE_URL } from "#/lib/links";

const TITLE = "About · Reviewer";
const DESCRIPTION =
  "Reviewer is a focused system for building software with agents.";

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

/** After the opening line, each line is one plain fact, starting with "It". */
const LINES = [
  "It helps you understand the changes through local diffs, git history.",
  "It keeps you in control",
  "It lets you comment on the lines that are wrong and hand them to Claude Code, Codex or any agent that runs skills.",
  "It shows the agent's fix as a new diff, so you read it before you commit.",
  "It runs on your machine, in a window on your Mac or in a terminal on macOS and Linux.",
  "It's free and open source. Reviewer Cloud, the paid part, is what we're building next.",
];

function AboutPage() {
  return (
    <Container>
      <section className="flex max-w-4xl flex-col gap-8 pt-24 pb-10 sm:gap-10 sm:pt-36 sm:pb-14 lg:gap-12 lg:pt-44 lg:pb-16">
        <h1 className="type-display">{DESCRIPTION}</h1>
        {LINES.map((line) => (
          <p
            className="type-heading font-medium text-neutral-600 dark:text-neutral-400"
            key={line}
          >
            {line}
          </p>
        ))}
      </section>
    </Container>
  );
}
