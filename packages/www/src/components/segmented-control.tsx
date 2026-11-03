import type { ComponentType } from "react";

import { cn } from "#/lib/cn";

export type Segment<Value extends string> = {
  value: Value;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

/**
 * A segmented control in the style of the app's own: a recessed track with a
 * raised pill that slides under the chosen option. Every option shares one
 * width so the pill only ever has to translate, never resize.
 */
export function SegmentedControl<Value extends string>({
  label,
  onChange,
  segments,
  value,
}: {
  label: string;
  onChange: (value: Value) => void;
  segments: ReadonlyArray<Segment<Value>>;
  value: Value;
}) {
  const selectedIndex = segments.findIndex(
    (segment) => segment.value === value
  );

  return (
    <div
      aria-label={label}
      className="relative grid w-full auto-cols-fr grid-flow-col rounded-full bg-black/[0.05] p-1 ring-1 ring-black/[0.04] ring-inset sm:inline-grid sm:w-auto dark:bg-white/[0.06] dark:ring-white/[0.06]"
      role="group"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none dark:bg-white/[0.14] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(255,255,255,0.08)]"
        style={{
          width: `calc((100% - 8px) / ${segments.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {segments.map(({ value: segmentValue, label: text, icon: Icon }) => {
        const selected = segmentValue === value;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 sm:h-8 sm:px-4 sm:text-[13px] lg:h-10 lg:px-5 lg:text-[15px]",
              selected
                ? "text-neutral-900 dark:text-white"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            )}
            key={segmentValue}
            onClick={() => onChange(segmentValue)}
            type="button"
          >
            {Icon && <Icon className="size-4 lg:size-4.5" />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Every view stays mounted in one grid cell and they crossfade, so switching
 * never waits on a download or shifts the page.
 */
export function Crossfade<Value extends string>({
  value,
  views,
}: {
  value: Value;
  views: ReadonlyArray<{ value: Value; node: React.ReactNode }>;
}) {
  return (
    <div className="grid">
      {views.map((view) => {
        const shown = view.value === value;
        return (
          <div
            aria-hidden={!shown}
            className={cn(
              "transition-opacity duration-300 ease-out [grid-area:1/1] motion-reduce:transition-none",
              !shown && "opacity-0"
            )}
            key={view.value}
          >
            {view.node}
          </div>
        );
      })}
    </div>
  );
}
