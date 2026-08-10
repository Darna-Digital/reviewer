import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A groove with a key sitting in it, not a pill with a ball. The track's sheen
 * runs bottom-up so it reads as recessed; the thumb's runs top-down so it reads
 * as the one raised part. The thumb holds its shape on hover — a control this
 * small reads as unstable if it resizes under the cursor.
 */
function Switch({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div
      data-slot="switch"
      className={cn(
        "switch-track group relative inline-flex h-[18px] w-7 shrink-0 items-center rounded-[5px] p-0.5 outline-offset-1 outline-ring transition-[background-color,box-shadow] duration-100 ease-out has-focus-visible:outline-2 has-disabled:opacity-50",
        className
      )}
    >
      <span className="switch-thumb h-3.5 w-3.5 rounded-[3px] border-[0.5px] border-white/60 transition-transform duration-100 ease-out group-has-checked:translate-x-2.5" />
      <input
        type="checkbox"
        className="absolute inset-0 size-full appearance-none focus:outline-hidden disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  );
}

export { Switch };
