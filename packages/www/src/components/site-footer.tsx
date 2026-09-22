import { Container } from "#/components/container";
import { GITHUB_URL } from "#/lib/links";

export function SiteFooter() {
  return (
    <footer className="pb-20">
      <Container className="flex flex-col items-center gap-4 border-t border-black/[0.06] pt-10 text-center dark:border-white/[0.08]">
        <p className="text-[15px] text-neutral-600 dark:text-neutral-400">
          Need some help with Reviewer?{" "}
          <a
            className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900 dark:text-white dark:decoration-neutral-600 dark:hover:decoration-white"
            href={GITHUB_URL}
          >
            Read the source
          </a>{" "}
          or{" "}
          <a
            className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900 dark:text-white dark:decoration-neutral-600 dark:hover:decoration-white"
            href={`${GITHUB_URL}/issues`}
          >
            open an issue
          </a>
          .
        </p>
        <p className="max-w-md text-[13px] text-pretty text-neutral-400 dark:text-neutral-500">
          Made by{" "}
          <a
            className="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            href="https://darnadigital.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            Darna Digital
          </a>
          , building tools for conversation based development. © 2026
        </p>
      </Container>
    </footer>
  );
}
