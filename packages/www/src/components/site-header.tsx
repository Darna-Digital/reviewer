import { GitHub } from "#/components/icons";
import { Logo } from "#/components/logo";
import { useScrolled } from "#/hooks/use-scrolled";
import { GITHUB_URL } from "#/lib/links";

export function SiteHeader() {
  const scrolled = useScrolled();
  const backdrop = scrolled
    ? "border-black/[0.06] bg-white/75 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111113]/75"
    : "border-transparent bg-transparent";

  return (
    <header className="sticky top-0 z-40 -mb-header">
      <div
        className={`h-header border-b transition-colors duration-200 ${backdrop}`}
      >
        <div className="mx-auto flex h-full max-w-[1008px] items-center gap-4 px-6">
          <a className="flex items-center gap-2" href="/">
            <Logo className="h-[18px] w-auto" />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">
              Reviewer
            </span>
          </a>
          <a
            className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            href={GITHUB_URL}
          >
            <GitHub className="size-4" />
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
