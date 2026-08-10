import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-md border border-border bg-background bg-linear-[180deg,var(--sheen-faint),var(--sheen-none)] px-2 py-2 type-body transition-[color,border-color] duration-100 outline-none placeholder:text-muted-foreground placeholder:select-none focus-visible:border-ring-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
