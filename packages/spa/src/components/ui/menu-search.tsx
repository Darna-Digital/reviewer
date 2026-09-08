import { IconSearch } from "@tabler/icons-react";
import { useRef } from "react";
import { handleSearchKeyDown } from "@/components/ui/search-keydown";

/**
 * The filter box every long menu in this app wears: a plain row rather than a
 * menu item, so typing never navigates and the arrows still walk the rows.
 * Inset out to the panel's edges, since a rule that stops short of them reads
 * as a box inside a box.
 */
export function MenuSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="-mx-1 -mt-1 mb-1 flex items-center gap-2 border-b px-2.5 py-2">
      <IconSearch className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        autoFocus
        data-search-input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        placeholder={label}
        aria-label={label}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
