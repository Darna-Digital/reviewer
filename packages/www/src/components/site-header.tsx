import { Container } from "#/components/container";
import { Apple, GitHub } from "#/components/icons";
import { Logo } from "#/components/logo";
import { useScrolled } from "#/hooks/use-scrolled";
import { DOWNLOAD_URL, REPO_URL } from "#/lib/links";

function TouchTarget() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
    />
  );
}

const NAV_LINK =
  "relative inline-flex items-center gap-1.5 text-sm sm:text-[13px] lg:text-[15px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white";

export function SiteHeader() {
  const scrolled = useScrolled();
  const backdrop = scrolled
    ? "border-black/[0.06] bg-white/75 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111113]/75"
    : "border-transparent bg-transparent";

  return (
    <header
      className={`sticky top-0 z-40 -mb-header h-header border-b transition-colors duration-200 ${backdrop}`}
    >
      <Container className="flex h-full items-center gap-5 lg:gap-7">
        <a href="/">
          <Logo className="h-5 w-auto lg:h-6" />
        </a>
        <a
          className={`ml-auto ${NAV_LINK}`}
          href={REPO_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <TouchTarget />
          <GitHub className="size-4 lg:size-4.5" />
          GitHub
        </a>
        <a className={NAV_LINK} href={DOWNLOAD_URL}>
          <TouchTarget />
          <Apple className="size-4 lg:size-4.5" />
          Download
        </a>
      </Container>
    </header>
  );
}
