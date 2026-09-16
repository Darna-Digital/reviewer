import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";

import { cn } from "@/lib/utils";

/**
 * A number the way an inspector edits one: typed, stepped with the arrow keys
 * (⇧ for ten, ⌥ for a tenth), wheeled, and scrubbed by dragging the label —
 * Base UI carries all of that; these parts only dress it.
 */
function NumberField(props: NumberFieldPrimitive.Root.Props) {
  return <NumberFieldPrimitive.Root data-slot="number-field" {...props} />;
}

function NumberFieldGroup({
  className,
  ...props
}: NumberFieldPrimitive.Group.Props) {
  return (
    <NumberFieldPrimitive.Group
      data-slot="number-field-group"
      className={cn(
        "flex h-6 min-w-0 items-center rounded-md border border-transparent bg-input/50 transition-[color,box-shadow] duration-200 focus-within:border-ring-accent has-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function NumberFieldInput({
  className,
  ...props
}: NumberFieldPrimitive.Input.Props) {
  return (
    <NumberFieldPrimitive.Input
      data-slot="number-field-input"
      className={cn(
        "h-full w-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[0.6875rem] text-foreground tabular-nums outline-none placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

/**
 * The label that scrubs: press and drag sideways to change the value, as in
 * every design tool. The cursor is Base UI's own so it can leave the label and
 * keep going across the screen.
 */
function NumberFieldScrubArea({
  className,
  children,
  ...props
}: NumberFieldPrimitive.ScrubArea.Props) {
  return (
    <NumberFieldPrimitive.ScrubArea
      data-slot="number-field-scrub-area"
      className={cn("cursor-ew-resize select-none", className)}
      {...props}
    >
      {children}
      <NumberFieldPrimitive.ScrubAreaCursor className="drop-shadow-[0_1px_1px_rgb(0_0_0/0.4)] filter">
        <svg
          width="26"
          height="14"
          viewBox="0 0 24 14"
          fill="black"
          stroke="white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
        </svg>
      </NumberFieldPrimitive.ScrubAreaCursor>
    </NumberFieldPrimitive.ScrubArea>
  );
}

export {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
};
