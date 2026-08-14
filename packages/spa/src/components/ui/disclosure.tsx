/**
 * The height transition every collapsed section in the app rides on: a grid
 * whose single row goes `0fr` → `1fr`, with the content clipped inside it.
 *
 * The content is not built until the section is first opened. Kept mounted, a
 * collapsed section still costs a full subtree to render and lay out for
 * something nobody can see — and the work log stacks hundreds of them, each
 * holding a tool call's entire output, which is enough to make opening a
 * session take a visible beat. Once opened it stays mounted, so reopening is
 * instant and anything it holds keeps its state.
 *
 * Mounting the content in the same commit that starts the transition still
 * animates: the row is already `0fr`, so it grows from nothing exactly as it
 * did when the content sat there clipped the whole time.
 */
import { useRef } from "react";
import { cn } from "@/lib/utils";

export function Disclosure({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const opened = useRef(false);
  if (open) opened.current = true;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
    >
      <div className="overflow-hidden">{opened.current && children}</div>
    </div>
  );
}
