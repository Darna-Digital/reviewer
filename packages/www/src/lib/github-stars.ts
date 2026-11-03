import { createServerFn } from "@tanstack/react-start";

const API = "https://api.github.com/repos/Darna-Digital/reviewer";
const FRESH_FOR_MS = 30 * 60 * 1000;

// Kept per Worker isolate; GitHub allows 60 unauthenticated requests an hour.
let cached: { at: number; stars: number | null } | null = null;

/** The repository's stargazer count, or null when GitHub can't be reached. */
export const getStarCount = createServerFn({ method: "GET" }).handler(
  async () => {
    if (cached && Date.now() - cached.at < FRESH_FOR_MS) return cached.stars;

    let stars = cached?.stars ?? null;
    try {
      const response = await fetch(API, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "reviewer.sh",
        },
      });
      if (response.ok) {
        const repo: { stargazers_count?: unknown } = await response.json();
        if (typeof repo.stargazers_count === "number") {
          stars = repo.stargazers_count;
        }
      }
    } catch {
      // Keep the last count we had, or show none.
    }

    cached = { at: Date.now(), stars };
    return stars;
  }
);

/** 842, 1.2K, 12K: the way GitHub abbreviates its own counts. */
export function formatStars(stars: number) {
  if (stars < 1000) return String(stars);
  const thousands = stars / 1000;
  return `${thousands < 10 ? Math.floor(thousands * 10) / 10 : Math.floor(thousands)}K`;
}
