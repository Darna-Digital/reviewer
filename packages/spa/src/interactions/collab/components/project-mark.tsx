/**
 * A project's colour, as the square that stands for it wherever it is named.
 *
 * The colour arrives as a value rather than a class, so it rides in a custom
 * property: Tailwind only emits utilities for literal strings it finds in
 * source, and `bg-[${project.color}]` compiles to nothing.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function ProjectMark({
  color,
  className,
}: {
  readonly color: string;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ "--mark": color } as CSSProperties}
      className={cn(
        "size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)",
        className
      )}
    />
  );
}
