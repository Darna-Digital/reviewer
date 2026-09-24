import { Apple } from "#/components/icons";
import { Logo } from "#/components/logo";
import { DOWNLOAD_URL } from "#/lib/links";

export function SiteHeader() {
  return (
    <header className="relative z-40 -mb-header h-header">
      <div className="mx-auto flex h-full max-w-[1008px] items-center gap-4 px-6">
        <a href="/">
          <Logo className="h-5 w-auto" />
        </a>
        <a
          className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          href={DOWNLOAD_URL}
        >
          <Apple className="size-4" />
          Download
        </a>
      </div>
    </header>
  );
}
