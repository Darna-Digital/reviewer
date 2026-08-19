import type { ReactNode } from "react";

import { cn } from "#/lib/utils";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1248px] px-6", className)}>
      {children}
    </div>
  );
}

export function SectionDivider() {
  return (
    <Container>
      <div
        className="h-px w-full bg-black/8 dark:bg-white/10"
        role="separator"
      />
    </Container>
  );
}

export function FeatureSection({
  index,
  title,
  description,
  capabilitiesLabel,
  capabilities,
  children,
}: {
  index: string;
  title: string;
  description: string;
  capabilitiesLabel: string;
  capabilities: ReadonlyArray<string>;
  children: ReactNode;
}) {
  return (
    <section className="overflow-x-clip py-16 md:py-24">
      <Container className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex items-center">
          <div className="flex h-full max-w-120 flex-col md:py-10">
            <span className="font-mono text-xs leading-none text-neutral-400 tabular-nums select-none dark:text-neutral-500">
              {index}
            </span>
            <h2 className="mt-4 text-[26px] leading-tight font-medium tracking-tight text-pretty text-neutral-900 md:text-[28px] dark:text-white">
              {title}
            </h2>
            <p className="mt-4 text-base text-pretty text-neutral-600 dark:text-neutral-400">
              {description}
            </p>
            <p className="mt-10 text-sm font-medium text-neutral-900 md:mt-auto dark:text-white">
              {capabilitiesLabel}
            </p>
            <div className="mt-4">
              <div
                className="h-px w-full bg-black/8 dark:bg-white/10"
                role="separator"
              />
              <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {capabilities.map((capability) => (
                  <p
                    className="text-sm text-neutral-600 dark:text-neutral-400"
                    key={capability}
                  >
                    {capability}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="relative h-[420px] min-w-0 md:h-[560px]">
          <div className="absolute inset-y-0 -right-50 left-0 flex items-center justify-start overflow-hidden py-2 pl-2">
            <div className="w-[1000px] shrink-0">{children}</div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 -right-50 w-40 bg-gradient-to-r from-transparent to-white dark:to-neutral-950" />
        </div>
      </Container>
    </section>
  );
}
