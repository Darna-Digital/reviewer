import type { ReactNode } from "react";

import { Chevron, GitBranch, Search } from "#/components/icons";

const TRAFFIC_LIGHTS = ["bg-[#ff5f57]", "bg-[#febc2e]", "bg-[#28c840]"];

export function AppWindow({
  branch = "task/landing-page",
  mode = "Code",
  children,
  className = "",
}: {
  branch?: string;
  mode?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900 ${className}`}
    >
      <div className="flex h-9 items-center gap-3 border-b border-black/8 bg-neutral-50 px-3 dark:border-white/8 dark:bg-white/4">
        <div className="flex gap-1.5">
          {TRAFFIC_LIGHTS.map((color) => (
            <span className={`size-2.5 rounded-full ${color}`} key={color} />
          ))}
        </div>
        <span className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
          <span className="grid size-3.5 place-items-center rounded-[3px] bg-neutral-900 text-[7px] font-bold text-white dark:bg-white dark:text-neutral-950">
            BY
          </span>
          Reviewer
          <Chevron className="size-3 text-neutral-400 dark:text-neutral-500" />
        </span>
        <span className="flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] text-neutral-600 ring-1 ring-black/8 ring-inset dark:bg-white/5 dark:text-neutral-300 dark:ring-white/10">
          <GitBranch className="size-3 text-neutral-400 dark:text-neutral-500" />
          {branch}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          {mode}
          <Search className="size-3.5 text-neutral-400 dark:text-neutral-500" />
        </span>
      </div>
      {children}
    </div>
  );
}

export function PaneHeader({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-8 items-center gap-2 border-b border-black/8 bg-neutral-50/70 px-3 text-[11px] text-neutral-600 dark:border-white/8 dark:bg-white/3 dark:text-neutral-400">
      {children}
      {actions ? (
        <span className="ml-auto flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          {actions}
        </span>
      ) : null}
    </div>
  );
}
