import { UnresolvedFile } from "@pierre/diffs/react"
import { IconPencil, IconX } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { THEMES, useLangReady } from "@/components/editor/highlighter"
import { Button } from "@/components/ui/button"
import { useFile } from "@/lib/queries"
import type { Theme } from "@/lib/ui-prefs"

interface ConflictViewProps {
  path: string
  theme: Theme
  /** Take one whole side for the entire file (server-side checkout). */
  onUseSide: (side: "ours" | "theirs") => void
  /** Persist the user-merged content and stage it as resolved. */
  onResolve: (mergedContent: string) => void
  /** Open the file in the full editor for freeform fixes. */
  onEdit: (path: string) => void
  onClose: () => void
}

// Git conflict markers. Matched line-exact or with a trailing label
// (`<<<<<<< HEAD`), mirroring how git writes them.
const OURS = "<<<<<<<"
const BASE = "|||||||"
const SEP = "======="
const THEIRS = ">>>>>>>"
const isMarker = (line: string, marker: string): boolean =>
  line === marker || line.startsWith(`${marker} `)

type Resolution = "current" | "incoming" | "both"

/** How many unresolved conflict blocks remain in the buffer. */
const countConflicts = (contents: string): number =>
  contents.split("\n").filter((l) => isMarker(l, OURS)).length

/**
 * Replace the `targetIndex`-th conflict block with the chosen side, dropping the
 * markers (and the diff3 base section). Returns the buffer unchanged if the
 * block is malformed. Line semantics match how the file is split (`\n`).
 */
function resolveConflictInText(
  contents: string,
  targetIndex: number,
  resolution: Resolution
): string {
  const lines = contents.split("\n")
  let index = -1
  for (let start = 0; start < lines.length; start++) {
    if (!isMarker(lines[start], OURS)) continue
    index++
    if (index !== targetIndex) continue

    let baseAt = -1
    let sepAt = -1
    let endAt = -1
    for (let j = start + 1; j < lines.length; j++) {
      if (baseAt === -1 && isMarker(lines[j], BASE)) baseAt = j
      else if (sepAt === -1 && isMarker(lines[j], SEP)) sepAt = j
      else if (isMarker(lines[j], THEIRS)) {
        endAt = j
        break
      }
    }
    if (sepAt === -1 || endAt === -1) return contents

    const ours = lines.slice(start + 1, baseAt === -1 ? sepAt : baseAt)
    const theirs = lines.slice(sepAt + 1, endAt)
    const replacement =
      resolution === "current"
        ? ours
        : resolution === "incoming"
          ? theirs
          : [...ours, ...theirs]
    return [
      ...lines.slice(0, start),
      ...replacement,
      ...lines.slice(endAt + 1),
    ].join("\n")
  }
  return contents
}

/**
 * Merge resolver built on Pierre's `UnresolvedFile`: the conflicted file renders
 * as a unified current/incoming diff with a per-conflict accept toolbar. Each
 * accept rewrites the buffer (dropping that block's markers) and re-renders;
 * "Mark resolved" persists once no markers remain. Freeform fixes are delegated
 * to the full editor via "Edit"; whole-file resolution to "Use ours/theirs".
 */
export function ConflictView({
  path,
  theme,
  onUseSide,
  onResolve,
  onEdit,
  onClose,
}: ConflictViewProps) {
  const file = useFile(path)
  const langReady = useLangReady(path)
  const [result, setResult] = useState<string | null>(null)

  const original = file.data?.contents ?? null

  // Seed (and re-seed on file change) the working buffer with the conflicted
  // file. Re-keyed by path so switching files resets cleanly.
  useEffect(() => {
    setResult(original)
  }, [original])

  const resolveAt = (conflictIndex: number, resolution: Resolution) =>
    setResult((cur) =>
      cur === null ? cur : resolveConflictInText(cur, conflictIndex, resolution)
    )

  if (file.isPending || result === null || !langReady) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading {path}…</div>
    )
  }
  if (file.error) {
    return (
      <div className="p-8 text-sm text-destructive">Could not open {path}</div>
    )
  }

  const remaining = countConflicts(result)
  const resolved = remaining === 0

  return (
    <div className="flex h-full flex-col">
      {/* Resolver toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <span className="truncate font-mono text-xs">{path}</span>
        <span className="text-xs text-muted-foreground">
          {resolved
            ? "all conflicts resolved"
            : `${remaining} conflict${remaining === 1 ? "" : "s"} left`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="xs" variant="outline" onClick={() => onUseSide("ours")}>
            Use ours
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onUseSide("theirs")}
          >
            Use theirs
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="gap-1"
            onClick={() => onEdit(path)}
          >
            <IconPencil className="size-3" />
            Edit
          </Button>
          <Button
            size="xs"
            disabled={!resolved}
            onClick={() => onResolve(result)}
          >
            Mark resolved
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX />
          </Button>
        </div>
      </div>

      {/* The scroll container stays mounted across re-keys of the inner
          UnresolvedFile, so scroll position survives each accept. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <UnresolvedFile
          key={remaining}
          file={{ name: path, contents: result }}
          disableWorkerPool
          options={{
            theme: THEMES,
            themeType: theme,
            overflow: "wrap",
            stickyHeader: false,
          }}
          renderMergeConflictUtility={(action) => (
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <Button
                size="xs"
                variant="outline"
                onClick={() => resolveAt(action.conflictIndex, "current")}
              >
                Accept ours
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => resolveAt(action.conflictIndex, "both")}
              >
                Accept both
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => resolveAt(action.conflictIndex, "incoming")}
              >
                Accept theirs
              </Button>
            </div>
          )}
        />
      </div>
    </div>
  )
}
