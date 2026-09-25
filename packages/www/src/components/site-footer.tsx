import { Container } from "#/components/container";
import { REPO_URL } from "#/lib/links";

export function SiteFooter() {
  return (
    <footer className="pb-16">
      <Container>
        <div className="flex flex-col items-center gap-4 border-t border-black/[0.06] pt-16 text-center dark:border-white/[0.08]">
          <p className="max-w-md text-[13px] text-pretty text-neutral-500">
            Made by{" "}
            <a
              className="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
              href="https://darnadigital.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              Darna Digital
            </a>
            .{" "}
            <a
              className="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
              href={REPO_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Source on GitHub
            </a>
            . © {new Date().getFullYear()}
          </p>
        </div>
      </Container>
    </footer>
  );
}
