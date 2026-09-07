/**
 * The diagnostics for one line, rendered as an annotation row underneath it —
 * the same slot inline review comments use, so a type error and a colleague's
 * note read as the same kind of thing attached to the same line.
 */
import {
  IconAlertTriangle,
  IconBulb,
  IconInfoCircle,
  IconXboxX,
} from "@tabler/icons-react";
import type { Diagnostic, DiagnosticSeverity } from "@reviewer/core/language";
import { cn } from "@/lib/utils";

/** One look per severity, shared by every surface that names a diagnostic. */
export const SEVERITY_STYLE: Record<
  DiagnosticSeverity,
  {
    readonly icon: typeof IconXboxX;
    readonly className: string;
    readonly label: string;
  }
> = {
  error: { icon: IconXboxX, className: "text-destructive", label: "Error" },
  warning: {
    icon: IconAlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
    label: "Warning",
  },
  information: {
    icon: IconInfoCircle,
    className: "text-sky-600 dark:text-sky-400",
    label: "Information",
  },
  hint: { icon: IconBulb, className: "text-muted-foreground", label: "Hint" },
};

export function DiagnosticRow({ diagnostic }: { diagnostic: Diagnostic }) {
  const { icon: Icon, className, label } = SEVERITY_STYLE[diagnostic.severity];
  return (
    <li className="flex items-start gap-2 py-0.5 text-xs leading-relaxed">
      <Icon
        className={cn("mt-0.5 size-3.5 shrink-0", className)}
        aria-label={label}
      />
      <span className="min-w-0 whitespace-pre-wrap text-foreground">
        {diagnostic.message}
        <span className="ml-1.5 text-muted-foreground">
          {diagnostic.source}
          {diagnostic.code === null ? "" : `(${diagnostic.code})`}
        </span>
      </span>
    </li>
  );
}

export function DiagnosticsAnnotation({
  diagnostics,
}: {
  diagnostics: ReadonlyArray<Diagnostic>;
}) {
  if (diagnostics.length === 0) return null;
  return (
    <ul className="border-l-2 border-destructive/40 bg-muted/40 px-3 py-1">
      {diagnostics.map((diagnostic, index) => (
        <DiagnosticRow
          // Diagnostics have no identity of their own; position plus message is
          // as stable as it gets, and the list is re-rendered wholesale anyway.
          key={`${diagnostic.range.start.character}:${diagnostic.code ?? ""}:${index}`}
          diagnostic={diagnostic}
        />
      ))}
    </ul>
  );
}
