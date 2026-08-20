/**
 * The find bar — one box floating over the top-right of the code, the same one
 * whether the file underneath is being read or edited.
 *
 * It is deliberately built out of the same parts as the content search in the
 * command dialog: the same three modifier glyphs in the same order, the same
 * muted-until-on treatment. ⌘F and ⌘⇧F are neighbours on the keyboard and
 * should be neighbours on screen.
 */
import {
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { ELEVATION, useElevation } from "@/lib/surface-context";
import { cn } from "@/lib/utils";
import type {
  FindDirection,
  FindOptions,
} from "../interfaces/find-in-file.interfaces";

const TOGGLES: ReadonlyArray<{
  key: keyof FindOptions;
  label: string;
  glyph: string;
}> = [
  { key: "caseSensitive", label: "Match case", glyph: "Aa" },
  { key: "wholeWord", label: "Match whole word", glyph: "ab" },
  { key: "regex", label: "Use regular expression", glyph: ".*" },
];

interface FindBarProps {
  /** The file being searched, so the bar says which one it belongs to. */
  path: string;
  query: string;
  onQueryChange: (query: string) => void;
  options: FindOptions;
  onOptionsChange: (options: FindOptions) => void;
  /** "3 of 17", "No results", or empty before anything is typed. */
  status: string;
  /** Whether there is anywhere to step to. */
  hasMatches: boolean;
  onStep: (direction: FindDirection) => void;
  onClose: () => void;
  /**
   * Bumped every time ⌘F is pressed. Pressing it again while the bar is open
   * takes the box back and selects what is in it, as every editor does.
   */
  focusKey: number;
}

export function FindBar({
  path,
  query,
  onQueryChange,
  options,
  onOptionsChange,
  status,
  hasMatches,
  onStep,
  onClose,
  focusKey,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { className: surface } = useElevation(ELEVATION.menu);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusKey]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onStep(event.shiftKey ? "previous" : "next");
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="search"
      aria-label={`Find in ${path}`}
      // Above the code and its annotations, below the dialogs that open over
      // the whole window.
      className={cn(
        "absolute top-2 right-4 z-20 flex items-center gap-1 rounded-lg border py-1 pr-1 pl-2",
        surface
      )}
    >
      <IconSearch className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        aria-label="Find in file"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find in file…"
        autoComplete="off"
        spellCheck={false}
        className="h-7 w-48 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {/* Reserved even while empty, so the row does not jump the moment the
          first letter lands. */}
      <span
        aria-live="polite"
        className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
      >
        {status}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {TOGGLES.map((toggle) => (
          <button
            key={toggle.key}
            type="button"
            aria-label={toggle.label}
            aria-pressed={options[toggle.key]}
            onClick={() =>
              onOptionsChange({
                ...options,
                [toggle.key]: !options[toggle.key],
              })
            }
            className={cn(
              "flex size-6 items-center justify-center rounded-md font-mono text-[0.6875rem] outline-none",
              options[toggle.key]
                ? "bg-elevate-strong text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {toggle.glyph}
          </button>
        ))}
      </div>
      <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />
      <div className="flex shrink-0 items-center gap-0.5">
        <StepButton
          label="Previous match"
          disabled={!hasMatches}
          onClick={() => onStep("previous")}
        >
          <IconChevronUp className="size-3.5" />
        </StepButton>
        <StepButton
          label="Next match"
          disabled={!hasMatches}
          onClick={() => onStep("next")}
        >
          <IconChevronDown className="size-3.5" />
        </StepButton>
        <StepButton label="Close find" onClick={onClose}>
          <IconX className="size-3.5" />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
