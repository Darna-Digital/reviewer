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
      className={`overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl shadow-black/10 ${className}`}
    >
      <div className="flex h-9 items-center gap-3 border-b border-black/8 bg-neutral-50 px-3">
        <div className="flex gap-1.5">
          {TRAFFIC_LIGHTS.map((color) => (
            <span className={`size-2.5 rounded-full ${color}`} key={color} />
          ))}
        </div>
        <span className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700">
          <span className="grid size-3.5 place-items-center rounded-[3px] bg-neutral-900 text-[7px] font-bold text-white">
            BY
          </span>
          byconvo
          <Chevron className="size-3 text-neutral-400" />
        </span>
        <span className="flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] text-neutral-600 ring-1 ring-black/8 ring-inset">
          <GitBranch className="size-3 text-neutral-400" />
          {branch}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
          {mode}
          <Search className="size-3.5 text-neutral-400" />
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
    <div className="flex h-8 items-center gap-2 border-b border-black/8 bg-neutral-50/70 px-3 text-[11px] text-neutral-600">
      {children}
      {actions ? (
        <span className="ml-auto flex items-center gap-2 text-neutral-400">
          {actions}
        </span>
      ) : null}
    </div>
  );
}
