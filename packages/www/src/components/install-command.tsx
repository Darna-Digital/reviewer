import { useEffect, useRef, useState } from "react";

import { Check, Copy } from "#/components/icons";
import { cn } from "#/lib/cn";

/**
 * Shell lines in a terminal-dark well with a copy button. A `#` line is a
 * comment: shown dimmed and left out of what is copied.
 */
export function InstallCommand({
  className,
  lines,
}: {
  className?: string;
  lines: ReadonlyArray<string>;
}) {
  const [copied, setCopied] = useState(false);
  const commands = lines.filter((line) => !line.startsWith("#"));
  const scrollRef = useRef<HTMLPreElement>(null);
  const [clippedRight, setClippedRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () =>
      setClippedRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(commands.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-2xl bg-[#17171a] text-[13px] leading-6 text-neutral-200 ring-1 ring-black/10 lg:text-sm lg:leading-7 dark:ring-white/10",
        className
      )}
    >
      {/* The button sits beside the scroll area, not over it, so a command
          wider than a phone scrolls clear of it. */}
      <div className="relative min-w-0 flex-1">
        <pre
          className="overflow-x-auto py-4 pr-3 pl-5 font-mono lg:py-5 lg:pl-6"
          ref={scrollRef}
        >
          {lines.map((line) =>
            line.startsWith("#") ? (
              <span className="block text-neutral-500" key={line}>
                {line}
              </span>
            ) : (
              <span className="block" key={line}>
                <span className="text-neutral-500 select-none">$ </span>
                {line}
              </span>
            )
          )}
        </pre>
        {/* Fades the command out before the button while more of it is
            hidden to the right. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-14 bg-linear-to-l from-[#17171a] transition-opacity",
            clippedRight ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
      <button
        aria-label={copied ? "Copied" : "Copy commands"}
        className={cn(
          "mr-3 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-neutral-400 lg:mr-4",
          // Centred on a single line; level with the first of several.
          lines.length === 1 ? "self-center" : "mt-3 lg:mt-4"
        )}
        onClick={copy}
        type="button"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
