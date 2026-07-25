import {
  IconChevronRight,
  IconGitBranch,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react"
import { useRef, useState } from "react"
import type {
  BranchLeaf,
  BranchTreeItem,
} from "@/interactions/branch-tree/interfaces/branch-tree.interfaces"
import { useBranchTree } from "@/interactions/branch-tree/adapters/branch-tree.hook.adapter"
import type { BranchInfo, RemoteBranchInfo } from "@byconvo/core/repo"
import { cn } from "@/lib/utils"

interface BranchTreeProps {
  branches: ReadonlyArray<BranchInfo>
  remoteBranches: ReadonlyArray<RemoteBranchInfo>
  currentBranch: string | null
  /** The ref the history is currently showing (drives the selected highlight). */
  selectedRef: string | null
  query?: string
  onSelect: (ref: string) => void
  onCheckout: (ref: string) => void
}

type NavRow =
  | {
      kind: "section"
      id: string
      sectionId: string
      label: string
      expanded: boolean
    }
  | {
      kind: "folder"
      id: string
      path: string
      label: string
      depth: number
      expanded: boolean
    }
  | { kind: "branch"; id: string; item: BranchLeaf; depth: number }

export function BranchTree({
  branches,
  remoteBranches,
  currentBranch,
  selectedRef,
  query = "",
  onSelect,
  onCheckout,
}: BranchTreeProps) {
  const { functions, favorites, expanded, toggleFavorite, toggleFolder } =
    useBranchTree()
  const [activeId, setActiveId] = useState<string | null>(null)
  const rows = useRef(new Map<string, HTMLElement>())

  const {
    local,
    remote,
    favorites: favoriteLeaves,
  } = functions.buildTrees({
    branches,
    remoteBranches,
    favorites,
    query,
  })

  // While filtering, force every folder open so matches are never hidden.
  const filtering = query.trim().length > 0
  const isOpen = (path: string) => filtering || expanded.has(path)

  // The flat, top-to-bottom list of focusable rows (drives roving tabindex + arrows).
  const navRows: NavRow[] = []
  const pushSection = (
    sectionId: string,
    label: string,
    items: ReadonlyArray<BranchTreeItem>
  ) => {
    const open = isOpen(sectionId)
    navRows.push({
      kind: "section",
      id: sectionId,
      sectionId,
      label,
      expanded: open,
    })
    if (!open) return
    for (const row of functions.flatten(items, isOpen, 2)) {
      // Prefix with section so favourites + local don't share React/focus keys.
      const id = `${sectionId}:${row.key}`
      navRows.push(
        row.item.kind === "folder"
          ? {
              kind: "folder",
              id,
              path: row.item.path,
              label: row.item.label,
              depth: row.depth,
              expanded: row.expanded,
            }
          : { kind: "branch", id, item: row.item, depth: row.depth }
      )
    }
  }
  if (favoriteLeaves.length > 0) {
    pushSection("__favorites", "Favorites", favoriteLeaves)
  }
  pushSection("__local", "Local", local)
  if (remote.length > 0) pushSection("__remote", "Remote", remote)

  const effectiveActive =
    activeId ?? (navRows.length > 0 ? navRows[0].id : null)

  const move = (delta: number) => {
    if (navRows.length === 0) return
    const idx = navRows.findIndex((r) => r.id === effectiveActive)
    const next = navRows[Math.max(0, Math.min(navRows.length - 1, idx + delta))]
    setActiveId(next.id)
    rows.current.get(next.id)?.focus()
  }

  const focusId = (id: string) => {
    setActiveId(id)
    requestAnimationFrame(() => rows.current.get(id)?.focus())
  }

  const activate = (row: NavRow) => {
    if (row.kind === "section") toggleFolder(row.sectionId)
    else if (row.kind === "folder") toggleFolder(row.path)
    else onSelect(row.item.fullName)
  }

  const onKeyDown = (event: React.KeyboardEvent, row: NavRow) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        move(1)
        break
      case "ArrowUp":
        event.preventDefault()
        move(-1)
        break
      case "Home":
        event.preventDefault()
        if (navRows[0]) focusId(navRows[0].id)
        break
      case "End":
        event.preventDefault()
        if (navRows.at(-1)) focusId(navRows.at(-1)!.id)
        break
      case "ArrowRight":
        if (row.kind !== "branch" && !row.expanded) {
          event.preventDefault()
          toggleFolder(row.kind === "section" ? row.sectionId : row.path)
        } else {
          event.preventDefault()
          move(1)
        }
        break
      case "ArrowLeft":
        if (row.kind !== "branch" && row.expanded && !filtering) {
          event.preventDefault()
          toggleFolder(row.kind === "section" ? row.sectionId : row.path)
        } else {
          event.preventDefault()
          move(-1)
        }
        break
      case "Enter":
      case " ":
        event.preventDefault()
        activate(row)
        break
    }
  }

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el)
    else rows.current.delete(id)
  }

  const rowClass = (active: boolean, selected = false) =>
    cn(
      "flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-sm outline-none",
      "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
      active && "ring-2 ring-ring/40",
      selected && "bg-muted text-foreground"
    )

  const chevron = (open: boolean) => (
    <IconChevronRight
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground transition-transform",
        open && "rotate-90"
      )}
    />
  )

  const depthStyle = (depth: number): React.CSSProperties => ({
    // Nested folders step in from the row's own px-2; keep the math in rem.
    ["--indent" as string]: `${0.5 + (depth - 1) * 0.875}rem`,
  })

  const favoriteButton = (branch: BranchLeaf) => {
    const fav = favorites.has(branch.fullName)
    return (
      <button
        type="button"
        tabIndex={-1}
        className={cn(
          "shrink-0 rounded-md p-1 text-muted-foreground",
          // Stay invisible until the row is hovered — trailing placement means
          // it never shoves the branch icon / label around.
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "hover:bg-muted hover:text-amber-500",
          fav && "text-amber-500 opacity-100 hover:text-amber-600"
        )}
        aria-label={
          fav ? `Unfavorite ${branch.fullName}` : `Favorite ${branch.fullName}`
        }
        aria-pressed={fav}
        title={fav ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(branch.fullName)
        }}
      >
        {fav ? (
          <IconStarFilled className="size-3.5" />
        ) : (
          <IconStar className="size-3.5" />
        )}
      </button>
    )
  }

  return (
    <div
      role="tree"
      aria-label="Branches"
      className="flex flex-col gap-1 px-1.5 py-2 text-sm select-none"
    >
      {currentBranch !== null && (
        <div className="mb-1.5">
          <button
            type="button"
            role="treeitem"
            aria-level={1}
            aria-selected={selectedRef === currentBranch}
            tabIndex={effectiveActive === "__head" ? 0 : -1}
            ref={setRef("__head")}
            className={cn(
              rowClass(
                effectiveActive === "__head",
                selectedRef === currentBranch
              ),
              "gap-2"
            )}
            onFocus={() => setActiveId("__head")}
            onClick={() => onSelect(currentBranch)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect(currentBranch)
                return
              }
              if (e.key === "ArrowDown") {
                e.preventDefault()
                move(1)
              }
            }}
            title="Current branch"
          >
            <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate font-medium">
              {currentBranch}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">HEAD</span>
          </button>
        </div>
      )}

      {navRows.map((row, index) => {
        const active = effectiveActive === row.id
        const prev = navRows[index - 1]
        const sectionStart =
          row.kind === "section" &&
          prev !== undefined &&
          prev.kind !== "section"

        if (row.kind === "section") {
          return (
            <button
              key={row.id}
              type="button"
              role="treeitem"
              aria-level={1}
              aria-expanded={row.expanded}
              tabIndex={active ? 0 : -1}
              ref={setRef(row.id)}
              className={cn(
                "flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left outline-none",
                "text-[11px] font-medium text-muted-foreground",
                "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
                active && "ring-2 ring-ring/40",
                sectionStart && "mt-2"
              )}
              onFocus={() => setActiveId(row.id)}
              onClick={() => toggleFolder(row.sectionId)}
              onKeyDown={(e) => onKeyDown(e, row)}
            >
              {chevron(row.expanded)}
              <span>{row.label}</span>
            </button>
          )
        }
        if (row.kind === "folder") {
          return (
            <button
              key={row.id}
              type="button"
              role="treeitem"
              aria-level={row.depth}
              aria-expanded={row.expanded}
              tabIndex={active ? 0 : -1}
              ref={setRef(row.id)}
              className={cn(rowClass(active), "pl-(--indent)")}
              style={depthStyle(row.depth)}
              onFocus={() => setActiveId(row.id)}
              onClick={() => toggleFolder(row.path)}
              onKeyDown={(e) => onKeyDown(e, row)}
            >
              {chevron(row.expanded)}
              <span className="min-w-0 truncate text-muted-foreground">
                {row.label}
              </span>
            </button>
          )
        }
        const branch = row.item
        const selected = selectedRef === branch.fullName
        return (
          <div
            key={row.id}
            role="treeitem"
            aria-level={row.depth}
            aria-selected={selected}
            tabIndex={active ? 0 : -1}
            ref={setRef(row.id)}
            className={cn(
              rowClass(active, selected),
              "group cursor-pointer pl-(--indent)"
            )}
            style={depthStyle(row.depth)}
            onFocus={() => setActiveId(row.id)}
            onClick={() => onSelect(branch.fullName)}
            onDoubleClick={() => onCheckout(branch.fullName)}
            onKeyDown={(e) => onKeyDown(e, row)}
            title={`${branch.fullName}\nDouble-click to check out`}
          >
            <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "min-w-0 truncate",
                branch.isCurrent && "font-medium"
              )}
            >
              {branch.label}
            </span>
            {branch.isCurrent && (
              <span className="shrink-0 text-xs text-muted-foreground">HEAD</span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {(branch.behind > 0 || branch.ahead > 0) && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {branch.behind > 0 && (
                    <span title={`${branch.behind} incoming`}>
                      ↓{branch.behind}
                    </span>
                  )}
                  {branch.ahead > 0 && (
                    <span title={`${branch.ahead} outgoing`}>
                      {" "}
                      ↑{branch.ahead}
                    </span>
                  )}
                </span>
              )}
              {favoriteButton(branch)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
