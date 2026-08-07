/**
 * Message layout primitives following shadcn's Message anatomy: a row that
 * aligns its content to a side, plus a bubble surface. Assistant replies render
 * as plain markdown (no bubble); user prompts sit in a `MessageBubble`.
 */
import { cn } from "@/lib/utils";

/** A conversation row. `end` right-aligns (the user); `start` left-aligns. */
export function Message({
  align = "start",
  className,
  children,
}: {
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full",
        align === "end" ? "justify-end" : "justify-start",
        className
      )}
    >
      {children}
    </div>
  );
}

/** The rounded surface a user prompt sits on. */
export function MessageBubble({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
        className
      )}
    >
      {children}
    </div>
  );
}
