import { Container } from "#/components/container";

export function SiteFooter() {
  return (
    <footer className="pb-20">
      <Container className="flex flex-col items-center gap-4 border-t border-black/[0.06] pt-10 text-center dark:border-white/[0.08]">
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
          . © 2026
        </p>
      </Container>
    </footer>
  );
}
