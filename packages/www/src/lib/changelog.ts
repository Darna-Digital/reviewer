import { createServerFn } from "@tanstack/react-start";

import { REPO_URL } from "#/lib/links";
// The copy this build was cut from, for when GitHub cannot be reached.
import bundled from "../../../../CHANGELOG.md?raw";

/**
 * The repository's CHANGELOG.md on `main`, so a release shows on the site as
 * soon as its notes are pushed, without redeploying.
 */
const SOURCE = `${REPO_URL.replace("github.com", "raw.githubusercontent.com")}/main/CHANGELOG.md`;
const FRESH_FOR_MS = 5 * 60 * 1000;

export type ChangelogSection = { title: string | null; items: Array<string> };

export type Release = {
  /** Without the leading `v`, e.g. `0.0.38`. */
  version: string;
  /** `YYYY-MM-DD`, as the changelog writes it. */
  date: string;
  /** An optional third part of the heading: `## v1.0.0 — 2026-12-01 — Title`. */
  title: string | null;
  sections: Array<ChangelogSection>;
};

const RELEASE_HEADING = /^## v(\S+)\s+—\s+(\d{4}-\d{2}-\d{2})(?:\s+—\s+(.+))?$/;

export function parseChangelog(markdown: string): Array<Release> {
  const releases: Array<Release> = [];
  let section: ChangelogSection | null = null;

  for (const line of markdown.split("\n")) {
    const release = releases.at(-1);
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      const [, version, date, title] = heading;
      releases.push({ version, date, title: title ?? null, sections: [] });
      section = null;
    } else if (!release) {
      continue;
    } else if (line.startsWith("### ")) {
      section = { title: line.slice(4).trim(), items: [] };
      release.sections.push(section);
    } else if (line.startsWith("- ")) {
      if (!section) {
        section = { title: null, items: [] };
        release.sections.push(section);
      }
      section.items.push(line.slice(2).trim());
    } else if (line.startsWith("  ") && section?.items.length) {
      // A bullet wrapped onto the next line.
      section.items[section.items.length - 1] += ` ${line.trim()}`;
    }
  }

  return releases;
}

// Kept per Worker isolate, so a busy page asks GitHub once every few minutes.
let cached: { at: number; releases: Array<Release> } | null = null;

export const getChangelog = createServerFn({ method: "GET" }).handler(
  async () => {
    if (cached && Date.now() - cached.at < FRESH_FOR_MS) return cached.releases;

    let markdown = bundled;
    try {
      const response = await fetch(SOURCE);
      if (response.ok) markdown = await response.text();
    } catch {
      // Offline or GitHub is down: the bundled copy stands in.
    }

    const releases = parseChangelog(markdown);
    cached = { at: Date.now(), releases };
    return releases;
  }
);

/** "November 2, 2026", read as a calendar date rather than a UTC instant. */
export function formatReleaseDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
