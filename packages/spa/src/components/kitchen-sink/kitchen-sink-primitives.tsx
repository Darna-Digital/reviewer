import type * as React from "react";

import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-xl font-semibold text-balance">{title}</h2>
      <p className="mt-1 max-w-[56ch] text-base/7 text-pretty text-muted-foreground sm:text-sm/6">
        {description}
      </p>
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

export function Subsection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h3 className="text-base font-medium sm:text-sm">{title}</h3>
        {hint !== undefined && (
          <p className="max-w-[56ch] text-sm/6 text-pretty text-muted-foreground sm:text-xs/5">
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** A labelled specimen: the thing itself, with the token or class beneath it. */
export function Specimen({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-2", className)}>
      {children}
      <p className="truncate font-mono text-sm text-muted-foreground sm:text-xs">
        {label}
      </p>
    </div>
  );
}

/** Wraps specimens in an evenly-spaced row that wraps on narrow screens. */
export function SpecimenRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-x-6 gap-y-5", className)}>
      {children}
    </div>
  );
}
