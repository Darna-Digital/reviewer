import type { ReactNode } from "react";

/** One labelled setting: what it is on the left, what changes it on the right. */
export function SettingRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {detail !== undefined && (
          <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
