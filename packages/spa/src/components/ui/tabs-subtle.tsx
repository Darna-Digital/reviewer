import {
  useRef,
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  forwardRef,
  type ComponentType,
  type ReactNode,
  type HTMLAttributes,
} from "react"
import { Tabs } from "@base-ui/react/tabs"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/springs"
import { useShape } from "@/lib/shape-context"
import { useProximityHover } from "@/hooks/use-proximity-hover"

/** Tabler (or Lucide-compatible) icon accepted by TabsSubtleItem. */
export type TabsSubtleIcon = ComponentType<{
  size?: number
  stroke?: number
  strokeWidth?: number
  className?: string
}>

interface TabsSubtleContextValue {
  registerTab: (index: number, element: HTMLElement | null) => void
  hoveredIndex: number | null
  selectedIndex: number
  idPrefix: string | undefined
  activeLabel: boolean
}

const TabsSubtleContext = createContext<TabsSubtleContextValue | null>(null)

/** Without the padding, `overflow-x-auto` clips the ring's 2px outset. */
const ROOM_FOR_THE_OUTSET_FOCUS_RING = "-mx-1 -my-1 px-1 py-1"

/** Weight is off-limits for the active state: changing `wght` reflows glyph
 * advance widths and shoves neighbouring tabs. */
const ACTIVE_TAB_TEXT = "text-foreground"
const INACTIVE_TAB_TEXT = "text-muted-foreground"

function useTabsSubtle() {
  const ctx = useContext(TabsSubtleContext)
  if (!ctx) throw new Error("useTabsSubtle must be used within a TabsSubtle")
  return ctx
}

interface TabsSubtleProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  children: ReactNode
  selectedIndex: number
  onSelect: (index: number) => void
  idPrefix?: string
  /** When true, only the selected tab shows its text label. Requires icons on tabs. */
  activeLabel?: boolean
}

const TabsSubtle = forwardRef<HTMLDivElement, TabsSubtleProps>(
  (
    {
      children,
      selectedIndex,
      onSelect,
      idPrefix,
      activeLabel = false,
      className,
      ...props
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const isMouseInside = useRef(false)
    const shape = useShape()

    const {
      activeIndex: hoveredIndex,
      setActiveIndex: setHoveredIndex,
      itemRects: tabRects,
      handlers,
      registerItem,
      measureItems: measureTabs,
    } = useProximityHover(containerRef, { axis: "x" })

    const tabElementsRef = useRef(new Map<number, HTMLElement>())
    const registerTab = useCallback(
      (index: number, element: HTMLElement | null) => {
        registerItem(index, element)
        if (element) {
          tabElementsRef.current.set(index, element)
        } else {
          tabElementsRef.current.delete(index)
        }
      },
      [registerItem]
    )

    useEffect(() => {
      measureTabs()
    }, [measureTabs, children])

    // A tab resizes on its own when `activeLabel` expands or collapses its
    // label, which the container's own resize never sees.
    useEffect(() => {
      const tabs = tabElementsRef.current
      if (tabs.size === 0) return
      const observer = new ResizeObserver(() => measureTabs())
      tabs.forEach((tab) => observer.observe(tab))
      return () => observer.disconnect()
    }, [measureTabs, children])

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        isMouseInside.current = true
        handlers.onMouseMove(e)
      },
      [handlers]
    )

    const handleMouseLeave = useCallback(() => {
      isMouseInside.current = false
      handlers.onMouseLeave()
    }, [handlers])

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

    const selectedRect = tabRects[selectedIndex]
    const hoverRect = hoveredIndex !== null ? tabRects[hoveredIndex] : null
    const focusRect = focusedIndex !== null ? tabRects[focusedIndex] : null
    const isHoveringSelected = hoveredIndex === selectedIndex
    const isHovering = hoveredIndex !== null && !isHoveringSelected

    return (
      <TabsSubtleContext.Provider
        value={{
          registerTab,
          hoveredIndex,
          selectedIndex,
          idPrefix,
          activeLabel,
        }}
      >
        <Tabs.Root
          value={selectedIndex}
          onValueChange={(value) => {
            if (typeof value === "number") onSelect(value)
          }}
          render={
            // Rendered as the List so one <div> carries both; Base UI owns
            // role="tablist", roving tabindex and arrow keys, and manual
            // activation means arrows move focus while Enter/Space selects.
            <Tabs.List
              activateOnFocus={false}
              ref={(node: HTMLDivElement | null) => {
                containerRef.current = node
                if (typeof ref === "function") ref(node)
                else if (ref) ref.current = node
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
                const indexAttr = (e.target as HTMLElement)
                  .closest("[data-proximity-index]")
                  ?.getAttribute("data-proximity-index")
                if (indexAttr != null) {
                  const idx = Number(indexAttr)
                  setHoveredIndex(idx)
                  setFocusedIndex(
                    (e.target as HTMLElement).matches(":focus-visible")
                      ? idx
                      : null
                  )
                }
              }}
              onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
                if (containerRef.current?.contains(e.relatedTarget)) return
                setFocusedIndex(null)
                if (isMouseInside.current) return
                setHoveredIndex(null)
              }}
              className={cn(
                "relative flex max-w-full [scrollbar-width:none] items-center gap-0.5 overflow-x-auto select-none [&::-webkit-scrollbar]:hidden",
                ROOM_FOR_THE_OUTSET_FOCUS_RING,
                className
              )}
              {...props}
            >
              {/* Selected pill */}
              {selectedRect && (
                <motion.div
                  className={cn(
                    "pointer-events-none absolute bg-muted",
                    shape.bg
                  )}
                  initial={false}
                  animate={{
                    left: selectedRect.left,
                    width: selectedRect.width,
                    top: selectedRect.top,
                    height: selectedRect.height,
                    opacity: isHovering ? 0.8 : 1,
                  }}
                  transition={{
                    ...spring.moderate,
                    opacity: { duration: 0.08 },
                  }}
                />
              )}

              {/* Hover pill */}
              <AnimatePresence>
                {hoverRect && !isHoveringSelected && selectedRect && (
                  <motion.div
                    className={cn(
                      "pointer-events-none absolute bg-muted",
                      shape.bg
                    )}
                    initial={{
                      left: selectedRect.left,
                      width: selectedRect.width,
                      top: selectedRect.top,
                      height: selectedRect.height,
                      opacity: 0,
                    }}
                    animate={{
                      left: hoverRect.left,
                      width: hoverRect.width,
                      top: hoverRect.top,
                      height: hoverRect.height,
                      opacity: 0.4,
                    }}
                    exit={
                      !isMouseInside.current && selectedRect
                        ? {
                            left: selectedRect.left,
                            width: selectedRect.width,
                            top: selectedRect.top,
                            height: selectedRect.height,
                            opacity: 0,
                            transition: {
                              ...spring.moderate,
                              opacity: { duration: 0.06 },
                            },
                          }
                        : { opacity: 0, transition: spring.fast.exit }
                    }
                    transition={{
                      ...spring.fast,
                      opacity: { duration: 0.08 },
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Focus ring */}
              <AnimatePresence>
                {focusRect && (
                  <motion.div
                    className={cn(
                      "pointer-events-none absolute z-20 border border-[color:var(--focus-ring,#6B97FF)]",
                      shape.focusRing
                    )}
                    initial={false}
                    animate={{
                      left: focusRect.left - 2,
                      top: focusRect.top - 2,
                      width: focusRect.width + 4,
                      height: focusRect.height + 4,
                    }}
                    exit={{ opacity: 0, transition: spring.fast.exit }}
                    transition={{
                      ...spring.fast,
                      opacity: { duration: 0.08 },
                    }}
                  />
                )}
              </AnimatePresence>

              {children}
            </Tabs.List>
          }
        />
      </TabsSubtleContext.Provider>
    )
  }
)

TabsSubtle.displayName = "TabsSubtle"

interface TabsSubtleItemProps extends HTMLAttributes<HTMLButtonElement> {
  icon?: TabsSubtleIcon
  label: string
  index: number
}

const TabsSubtleItem = forwardRef<HTMLButtonElement, TabsSubtleItemProps>(
  ({ icon: Icon, label, index, className, ...props }, ref) => {
    const internalRef = useRef<HTMLButtonElement | null>(null)
    const shape = useShape()
    const { registerTab, hoveredIndex, selectedIndex, idPrefix, activeLabel } =
      useTabsSubtle()

    useEffect(() => {
      registerTab(index, internalRef.current)
      return () => registerTab(index, null)
    }, [index, registerTab])

    const isSelected = selectedIndex === index
    const isActive = hoveredIndex === index || isSelected
    const collapseLabel = activeLabel && !!Icon
    const showLabel = !collapseLabel || isSelected

    const labelContent = (
      <span
        className={cn(
          "text-[13px] whitespace-nowrap transition-colors duration-[80ms] [text-box:trim-both_cap_alphabetic]",
          isActive ? ACTIVE_TAB_TEXT : INACTIVE_TAB_TEXT
        )}
      >
        {label}
      </span>
    )

    return (
      <Tabs.Tab
        ref={(node: HTMLElement | null) => {
          const button = node as HTMLButtonElement | null
          internalRef.current = button
          if (typeof ref === "function") ref(button)
          else if (ref) ref.current = button
        }}
        value={index}
        data-proximity-index={index}
        id={idPrefix ? `${idPrefix}-tab-${index}` : undefined}
        aria-controls={idPrefix ? `${idPrefix}-panel-${index}` : undefined}
        aria-label={collapseLabel && !showLabel ? label : undefined}
        className={cn(
          // A fixed height keeps the label's text-box trim from shrinking the
          // tab, and stays under the dock header so the pill clears its border.
          "relative z-10 flex h-7 cursor-pointer items-center border-none bg-transparent px-2.5 outline-none",
          !collapseLabel && "gap-1.5",
          shape.bg,
          className
        )}
        {...props}
      >
        {Icon && (
          <Icon
            size={16}
            stroke={isActive ? 2 : 1.5}
            className={cn(
              "shrink-0 transition-[color,stroke-width] duration-[80ms]",
              isActive ? ACTIVE_TAB_TEXT : INACTIVE_TAB_TEXT
            )}
          />
        )}
        {collapseLabel ? (
          <AnimatePresence initial={false}>
            {showLabel && (
              <motion.span
                key="label"
                className="overflow-hidden"
                initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                animate={{ width: "auto", opacity: 1, marginLeft: 8 }}
                exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                transition={{
                  ...spring.fast,
                  opacity: { duration: 0.06 },
                }}
              >
                {labelContent}
              </motion.span>
            )}
          </AnimatePresence>
        ) : (
          labelContent
        )}
      </Tabs.Tab>
    )
  }
)

TabsSubtleItem.displayName = "TabsSubtleItem"

interface TabsSubtlePanelProps extends HTMLAttributes<HTMLDivElement> {
  index: number
  selectedIndex: number
  idPrefix: string
  children: ReactNode
}

/** Every call site renders this outside `<TabsSubtle>`, beyond the reach of
 * `Tabs.Root`'s context — so it is a plain tabpanel linked by `idPrefix`
 * rather than Base UI's `Tabs.Panel`. */
const TabsSubtlePanel = forwardRef<HTMLDivElement, TabsSubtlePanelProps>(
  ({ index, selectedIndex, idPrefix, children, className, ...props }, ref) => {
    const isSelected = selectedIndex === index

    return (
      <div
        ref={ref}
        id={`${idPrefix}-panel-${index}`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${index}`}
        hidden={!isSelected}
        tabIndex={-1}
        className={cn("outline-none", className)}
        {...props}
      >
        {isSelected && children}
      </div>
    )
  }
)

TabsSubtlePanel.displayName = "TabsSubtlePanel"

export { TabsSubtle, TabsSubtleItem, TabsSubtlePanel }
export default TabsSubtle
