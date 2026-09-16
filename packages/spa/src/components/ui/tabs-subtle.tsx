import {
  createContext,
  forwardRef,
  useContext,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";

/** Tabler (or Lucide-compatible) icon accepted by TabsSubtleItem. */
export type TabsSubtleIcon = ComponentType<{
  size?: number;
  stroke?: number;
  strokeWidth?: number;
  className?: string;
}>;

interface TabsSubtleContextValue {
  selectedIndex: number;
  idPrefix: string | undefined;
}

const TabsSubtleContext = createContext<TabsSubtleContextValue | null>(null);

function useTabsSubtle() {
  const ctx = useContext(TabsSubtleContext);
  if (!ctx) throw new Error("useTabsSubtle must be used within a TabsSubtle");
  return ctx;
}

interface TabsSubtleProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  children: ReactNode;
  selectedIndex: number;
  onSelect: (index: number) => void;
  idPrefix?: string;
}

const TabsSubtle = forwardRef<HTMLDivElement, TabsSubtleProps>(
  (
    { children, selectedIndex, onSelect, idPrefix, className, ...props },
    ref
  ) => (
    <TabsSubtleContext.Provider value={{ selectedIndex, idPrefix }}>
      <Tabs.Root
        value={selectedIndex}
        onValueChange={(value) => {
          if (typeof value === "number") onSelect(value);
        }}
        render={
          // Rendered as the List so one <div> carries both; Base UI owns
          // role="tablist", roving tabindex and arrow keys, and manual
          // activation means arrows move focus while Enter/Space selects.
          <Tabs.List
            activateOnFocus={false}
            ref={ref}
            className={cn(
              "scrollbar-none flex max-w-full items-center gap-0.5 overflow-x-auto select-none",
              className
            )}
            {...props}
          >
            {children}
          </Tabs.List>
        }
      />
    </TabsSubtleContext.Provider>
  )
);

TabsSubtle.displayName = "TabsSubtle";

interface TabsSubtleItemProps extends HTMLAttributes<HTMLButtonElement> {
  icon?: TabsSubtleIcon;
  label: string;
  index: number;
}

const TabsSubtleItem = forwardRef<HTMLButtonElement, TabsSubtleItemProps>(
  ({ icon: Icon, label, index, className, ...props }, ref) => {
    const shape = useShape();
    const { selectedIndex, idPrefix } = useTabsSubtle();
    const isSelected = selectedIndex === index;

    return (
      <Tabs.Tab
        ref={ref}
        value={index}
        id={idPrefix ? `${idPrefix}-tab-${index}` : undefined}
        aria-controls={idPrefix ? `${idPrefix}-panel-${index}` : undefined}
        className={cn(
          // A fixed height keeps the label's text-box trim from shrinking the
          // tab, and stays under the dock header so the tab clears its border.
          "flex h-7 cursor-pointer items-center gap-1.5 border-none px-2.5 text-[13px] whitespace-nowrap outline-none",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          isSelected
            ? "bg-muted text-foreground"
            : "bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          shape.bg,
          className
        )}
        {...props}
      >
        {Icon && (
          <Icon size={16} stroke={isSelected ? 2 : 1.5} className="shrink-0" />
        )}
        <span className="[text-box:trim-both_cap_alphabetic]">{label}</span>
      </Tabs.Tab>
    );
  }
);

TabsSubtleItem.displayName = "TabsSubtleItem";

export { TabsSubtle, TabsSubtleItem };
export default TabsSubtle;
