import * as React from "react";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div
      data-slot="switch"
      className={cn(
        "group relative inline-flex w-11 shrink-0 rounded-full bg-input p-0.5 inset-ring inset-ring-foreground/5 outline-offset-2 outline-ring transition-colors duration-200 ease-in-out has-checked:bg-primary has-focus-visible:outline-2 has-disabled:opacity-50 sm:w-9",
        className
      )}
    >
      <span className="aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-foreground/10 transition-transform duration-200 ease-in-out group-has-checked:translate-x-full dark:shadow-none" />
      <input
        type="checkbox"
        className="absolute inset-0 size-full appearance-none focus:outline-hidden disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  );
}

export { Switch };
