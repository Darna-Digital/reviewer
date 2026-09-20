/**
 * The results tree — categories, directories, files, the symbols the usages sit
 * in, and the usages themselves.
 *
 * Hand-rolled rather than built on the project's file tree: that one is a
 * shadow-rooted virtualiser that models a filesystem, and this is five levels of
 * something else, three of which are not paths at all. What it does borrow is
 * the behaviour — one tab stop for the whole tree with a roving selection
 * inside it, arrows to walk, ←/→ to fold, Enter to open — because that is what
 * a tree is expected to answer to whatever it is made of.
 *
 * The rows are plain elements. The list is capped at a thousand results by the
 * language service, which is a few hundred rows of text: virtualising it would
 * buy nothing and cost the browser's own find-in-page over the results.
 */
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { SymbolReference } from "@reviewer/core/language";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { cn } from "@/lib/utils";
import { previewParts } from "../functions/find-usages.functions";
import type { UsageNode, UsageRow } from "../interfaces/find-usages.interfaces";

interface UsageTreeProps {
  rows: ReadonlyArray<UsageRow>;
  /** The row the selection is on, by node id. */
  selected: string | null;
  /** The symbol the search was for, picked out of each preview line. */
  symbol: string;
  onSelect: (node: UsageNode) => void;
  /** Fold a branch shut or open it again. */
  onToggle: (id: string) => void;
  /** Open a usage in the editor — a double-click, or Enter on the row. */
  onOpen: (node: UsageNode) => void;
}

const COUNT_LABEL = (count: number) =>
  `${count} ${count === 1 ? "result" : "results"}`;

/** The icon a branch wears — its level said in one glyph. */
function RowIcon({ node }: { readonly node: UsageNode }) {
  if (node.kind === "usage") return null;
  if (node.kind === "file") {
    return <FileTypeIcon path={node.label} className="size-3.5" />;
  }
  if (node.kind === "directory") {
    return <IconFolder className="size-3.5 text-muted-foreground" />;
  }
  return null;
}

export function UsageTree({
  rows,
  selected,
  symbol,
  onSelect,
  onToggle,
  onOpen,
}: UsageTreeProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected row on screen however the selection moved — the arrows,
  // the toolbar's next/previous, or a fresh search landing on its first result.
  useEffect(() => {
    if (selected === null) return;
    const row = listRef.current?.querySelector(
      `[data-row-id="${CSS.escape(selected)}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const at = rows.findIndex((row) => row.node.id === selected);

  const move = (step: number) => {
    const next = rows[Math.min(rows.length - 1, Math.max(0, at + step))];
    if (next !== undefined) onSelect(next.node);
  };

  const keys = (event: React.KeyboardEvent) => {
    const row = rows[at];
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(at === -1 ? 0 : 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        move(at === -1 ? 0 : -1);
        return;
      case "Home":
        event.preventDefault();
        if (rows[0] !== undefined) onSelect(rows[0].node);
        return;
      case "End":
        event.preventDefault();
        if (rows.at(-1) !== undefined) onSelect(rows[rows.length - 1].node);
        return;
      case "ArrowRight":
        // On a shut branch, open it; on an open one, step into its first child,
        // which is the row immediately below.
        if (row === undefined || row.node.kind === "usage") return;
        event.preventDefault();
        if (row.expanded) move(1);
        else onToggle(row.node.id);
        return;
      case "ArrowLeft": {
        if (row === undefined) return;
        event.preventDefault();
        if (row.node.kind !== "usage" && row.expanded) {
          onToggle(row.node.id);
          return;
        }
        // Otherwise leave for the parent: the nearest row above that is drawn
        // one level further out.
        for (let index = at - 1; index >= 0; index -= 1) {
          const candidate = rows[index];
          if (candidate !== undefined && candidate.depth < row.depth) {
            onSelect(candidate.node);
            return;
          }
        }
        return;
      }
      case "Enter":
        if (row === undefined) return;
        event.preventDefault();
        if (row.node.kind === "usage") onOpen(row.node);
        else onToggle(row.node.id);
        return;
      default:
        return;
    }
  };

  if (rows.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="tree"
      aria-label="Usages"
      // One tab stop for the tree, as a tree has: the arrows do the rest, and a
      // tab through the panel must not walk a thousand rows on the way out.
      tabIndex={0}
      className="min-h-0 flex-1 overflow-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      onKeyDown={keys}
    >
      {/* Long lines scroll sideways rather than being cut off. The rows sit in
          a strip as wide as the longest of them, so a selected row's highlight
          runs the full scrolled width instead of stopping at the viewport. */}
      <div className="w-max min-w-full">
        {rows.map((row) => (
          <Row
            key={row.node.id}
            row={row}
            symbol={symbol}
            selected={row.node.id === selected}
            onSelect={onSelect}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  symbol,
  selected,
  onSelect,
  onToggle,
  onOpen,
}: {
  readonly row: UsageRow;
  readonly symbol: string;
  readonly selected: boolean;
  readonly onSelect: (node: UsageNode) => void;
  readonly onToggle: (id: string) => void;
  readonly onOpen: (node: UsageNode) => void;
}) {
  const { node, depth, expanded } = row;
  const branch = node.kind !== "usage";
  const Chevron = expanded ? IconChevronDown : IconChevronRight;

  return (
    <div
      data-row-id={node.id}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      {...(branch ? { "aria-expanded": expanded } : {})}
      className={cn(
        // `select-none`: a double-click on a row opens it, so the browser
        // must not answer the same gesture by selecting the word under it.
        "flex h-6 cursor-default items-center gap-1.5 pr-2 text-xs select-none",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-elevate"
      )}
      // The chevron column is the indent: every level steps in by one of them,
      // so a row's glyph lands under its parent's label rather than beside it.
      style={{ paddingLeft: 4 + depth * 14 }}
      // A single click selects, which is what moves the preview; folding is the
      // chevron's job and the double-click's, as in any tree. Toggling on a
      // plain click too would mean a double-click opened a branch and shut it
      // again, leaving the reader where they started.
      onClick={() => onSelect(node)}
      onDoubleClick={() => (branch ? onToggle(node.id) : onOpen(node))}
    >
      {branch ? (
        <button
          type="button"
          // Not a tab stop: the tree is one, and the arrows do this from the
          // keyboard.
          tabIndex={-1}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="-m-0.5 shrink-0 rounded p-0.5 hover:bg-elevate"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node);
            onToggle(node.id);
          }}
        >
          <Chevron className="size-3.5 text-muted-foreground" />
        </button>
      ) : (
        <span className="size-3.5 shrink-0" />
      )}
      <RowIcon node={node} />
      {node.kind === "usage" ? (
        <UsageLabel reference={node.reference} symbol={symbol} />
      ) : (
        <>
          <span
            className={cn(
              "whitespace-nowrap",
              node.kind === "category" && "font-medium",
              node.kind === "container" && "font-mono"
            )}
          >
            {node.label}
          </span>
          {node.detail !== "" && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {node.detail}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {COUNT_LABEL(node.count)}
          </span>
        </>
      )}
    </div>
  );
}

/** A usage: its line number, then the line it sits on with the name picked out. */
function UsageLabel({
  reference,
  symbol,
}: {
  readonly reference: SymbolReference;
  readonly symbol: string;
}) {
  return (
    <>
      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
        {reference.location.range.start.line + 1}
      </span>
      <span className="font-mono whitespace-pre text-foreground">
        {previewParts(reference.preview, symbol).map((part) =>
          part.match ? (
            <mark
              key={part.at}
              className="rounded-[2px] bg-ring-accent/25 text-foreground"
            >
              {part.text}
            </mark>
          ) : (
            <span key={part.at}>{part.text}</span>
          )
        )}
      </span>
    </>
  );
}
