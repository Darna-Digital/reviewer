import type { ReactNode } from "react";

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
    <section className="border-t border-black/8 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex gap-4 sm:gap-6">
          <span className="pt-1 font-mono text-xs text-neutral-400 tabular-nums">
            {index}
          </span>
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-neutral-900 sm:text-3xl">
              {title}
            </h2>
            <p className="mt-4 text-base text-pretty text-neutral-600 sm:text-lg">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-10 sm:mt-12">{children}</div>

        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-baseline sm:gap-6">
          <span className="shrink-0 text-sm font-medium text-neutral-900">
            {capabilitiesLabel}
          </span>
          <ul className="flex flex-wrap gap-2">
            {capabilities.map((capability) => (
              <li
                className="rounded-full border border-black/8 bg-neutral-50 px-3 py-1 text-xs text-neutral-600"
                key={capability}
              >
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
