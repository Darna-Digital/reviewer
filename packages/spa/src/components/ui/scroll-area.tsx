import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
  type UIEventHandler,
} from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";
import { useTouchPrimary } from "@/hooks/use-touch-primary";
import { island } from "@/lib/shell";

/**
 * Touch devices scroll natively — their momentum and rubber-banding beat
 * anything scripted — so the custom scrollbar sits out; `ScrollBar` reads this
 * to render nothing there. So does an island of the macOS shell, for the
 * opposite reason: its web view sits beside the shell's own lists, and the
 * system's overlay scroller is the one bar the window should have (the plain
 * overflow containers keep it the same way, see `styles.css`).
 */
const NativeScrollingContext = createContext<boolean>(false);

type Orientation = "vertical" | "horizontal" | "both";

interface ScrollAreaProps extends ComponentPropsWithoutRef<"div"> {
  viewportClassName?: string;
  /** Ref to the scrolling viewport — needed for programmatic scroll. */
  viewportRef?: Ref<HTMLDivElement>;
  /** Scroll listener on the viewport (not the outer container). */
  onViewportScroll?: UIEventHandler<HTMLDivElement>;
  /** Which axes get scrollbars. Defaults to `"vertical"`. */
  orientation?: Orientation;
}

const overflowClass = (orientation: Orientation) =>
  orientation === "vertical"
    ? "overflow-x-hidden overflow-y-auto"
    : orientation === "horizontal"
      ? "overflow-x-auto"
      : "overflow-auto";

/**
 * The viewport takes its height from flexing rather than `h-full`: a percentage
 * height needs a definite one to resolve against, and a scroll area inside a
 * `max-h-*` box (a dialog) has none — the viewport grew past the container that
 * was meant to clip it and nothing ever scrolled. `flex-auto` still sizes to the
 * content when the container is free to grow.
 */
const CONTAINER_FILLS_VIEWPORT = "relative flex flex-col overflow-hidden";
const VIEWPORT_FILLS_CONTAINER = "w-full min-h-0 flex-auto rounded-[inherit]";

function NativeScrollArea({
  className,
  children,
  viewportClassName,
  viewportRef,
  onViewportScroll,
  orientation,
  containerRef,
  ...props
}: ScrollAreaProps & {
  orientation: Orientation;
  containerRef: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={containerRef}
      role="group"
      data-slot="scroll-area"
      aria-roledescription="scroll area"
      className={cn(CONTAINER_FILLS_VIEWPORT, className)}
      {...props}
    >
      <div
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          VIEWPORT_FILLS_CONTAINER,
          overflowClass(orientation),
          viewportClassName
        )}
        tabIndex={0}
        onScroll={onViewportScroll}
      >
        {children}
      </div>
    </div>
  );
}

const ScrollArea = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(
  (
    {
      className,
      children,
      viewportClassName,
      viewportRef,
      onViewportScroll,
      orientation = "vertical",
      ...props
    },
    ref
  ) => {
    const scrollsNatively = useTouchPrimary() || island !== undefined;

    return (
      <NativeScrollingContext.Provider value={scrollsNatively}>
        {scrollsNatively ? (
          <NativeScrollArea
            containerRef={ref}
            className={className}
            viewportClassName={viewportClassName}
            viewportRef={viewportRef}
            onViewportScroll={onViewportScroll}
            orientation={orientation}
            {...props}
          >
            {children}
          </NativeScrollArea>
        ) : (
          <ScrollAreaPrimitive.Root
            ref={ref}
            data-slot="scroll-area"
            className={cn(CONTAINER_FILLS_VIEWPORT, className)}
            {...props}
          >
            <ScrollAreaPrimitive.Viewport
              ref={viewportRef}
              data-slot="scroll-area-viewport"
              className={cn(
                VIEWPORT_FILLS_CONTAINER,
                orientation === "vertical" && "overflow-x-hidden",
                viewportClassName
              )}
              onScroll={onViewportScroll}
            >
              <ScrollAreaPrimitive.Content
                className={cn(orientation === "vertical" && "w-full min-w-0")}
                // Base UI's Content is min-width: fit-content so it can measure
                // horizontal overflow; a vertical list overrides that, or long
                // labels widen the viewport instead of truncating.
                style={orientation === "vertical" ? { minWidth: 0 } : undefined}
              >
                {children}
              </ScrollAreaPrimitive.Content>
            </ScrollAreaPrimitive.Viewport>
            {orientation !== "horizontal" && (
              <ScrollBar orientation="vertical" />
            )}
            {orientation !== "vertical" && (
              <ScrollBar orientation="horizontal" />
            )}
            {orientation === "both" && <ScrollAreaPrimitive.Corner />}
          </ScrollAreaPrimitive.Root>
        )}
      </NativeScrollingContext.Provider>
    );
  }
);

ScrollArea.displayName = "ScrollArea";

const REVEAL_ON_HOVER_OR_SCROLL = [
  "opacity-0 transition-opacity delay-160 duration-120 ease-out",
  "data-[hovering]:duration-160 data-[scrolling]:duration-160",
  "data-[hovering]:opacity-100 data-[scrolling]:opacity-100",
  "data-[hovering]:delay-0 data-[scrolling]:delay-0",
].join(" ");

const TRACK_BY_ORIENTATION = {
  vertical: "top-0 right-0 h-full w-2.5",
  horizontal: "bottom-0 left-0 h-2.5 w-full flex-col",
} as const;

const THUMB_RESTS_NARROW_WIDENS_ON_HOVER = {
  vertical:
    "mx-auto my-1 h-[var(--scroll-area-thumb-height)] w-1 -translate-x-0.5 group-hover/scrollbar:w-1.5",
  horizontal:
    "mx-1 my-auto h-1 w-[var(--scroll-area-thumb-width)] -translate-y-0.5 group-hover/scrollbar:h-1.5",
} as const;

const THUMB_OVERLAY_RAMP =
  "bg-[rgb(var(--overlay)/0.08)] group-hover/scrollbar:bg-[rgb(var(--overlay)/0.12)] active:!bg-[rgb(var(--overlay)/0.16)]";

const ScrollBar = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.Scrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => {
  const scrollsNatively = useContext(NativeScrollingContext);
  const shape = useShape();

  if (scrollsNatively) return null;

  return (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        "group/scrollbar absolute z-20 flex touch-none select-none",
        REVEAL_ON_HOVER_OR_SCROLL,
        TRACK_BY_ORIENTATION[orientation],
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative transition-[background-color,width,height] duration-160 ease-in-out",
          THUMB_OVERLAY_RAMP,
          shape.bg,
          THUMB_RESTS_NARROW_WIDENS_ON_HOVER[orientation]
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
});

ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
export type { ScrollAreaProps };
