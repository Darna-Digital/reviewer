import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "@/lib/utils";

/**
 * A segmented control: a recessed strip with one raised, pressed segment. Base
 * UI keeps the group exclusive and gives the arrow keys the roving focus.
 */
function ToggleGroup<Value extends string>({
  className,
  ...props
}: ToggleGroupPrimitive.Props<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        "flex h-6 min-w-0 items-center gap-px rounded-md bg-input/50 p-0.5",
        className
      )}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "flex h-full min-w-0 flex-1 items-center justify-center rounded-[5px] text-muted-foreground outline-offset-1 outline-ring transition-[background-color,color] duration-100 hover:text-foreground focus-visible:outline-2 data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-[0_0_0_1px_var(--color-frame-border),0_1px_2px_rgb(0_0_0/0.08)] [&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
