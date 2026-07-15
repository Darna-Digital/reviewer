/**
 * ReviewAssignBar — a Figma-style floating bottom bar that appears while you have
 * local review comments (left in the commit/PR diff or a code view). It lets you
 * pick a target and hand the comments off: either start a fresh chat with a chosen
 * agent, or attach them to an existing session (chat) picked from a searchable
 * dropdown. Dismissable; it re-appears when you leave more.
 */
import { IconChevronDown, IconSearch, IconX } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { agentIcon } from "@/components/threads/agent-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { isChatProviderKind } from "@/features/chats/functions/chat-assignment.functions"
import { AGENTS, agentLabel } from "@/features/threads/entity/agents"
import type { ChatProviderKind, ChatSummary } from "@/lib/api/types"
import { cn } from "@/lib/utils"

/** Agent CLIs that can be assigned to chat flows (excludes the plain shell). */
const ASSIGNABLE: ReadonlyArray<{
  kind: ChatProviderKind
  label: string
  hint: string
}> = AGENTS.filter(
  (
    agent
  ): agent is {
    kind: ChatProviderKind
    label: string
    hint: string
  } => isChatProviderKind(agent.kind)
)

/** Where the review comments get handed off. */
export type AssignTarget =
  | { kind: "new"; agent: ChatProviderKind }
  | { kind: "existing"; chatId: string }

export function ReviewAssignBar({
  count,
  chats,
  onAssign,
  onDismiss,
}: {
  count: number
  chats: ReadonlyArray<ChatSummary>
  onAssign: (target: AssignTarget) => Promise<void> | void
  onDismiss: () => void
}) {
  const [target, setTarget] = useState<AssignTarget>({
    kind: "new",
    agent: "claude",
  })
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const q = query.trim().toLowerCase()
  const agents = useMemo(
    () =>
      ASSIGNABLE.filter((a) => q === "" || a.label.toLowerCase().includes(q)),
    [q]
  )
  const sessions = useMemo(
    () =>
      chats.filter(
        (c) =>
          q === "" ||
          c.title.toLowerCase().includes(q) ||
          c.branch.toLowerCase().includes(q)
      ),
    [chats, q]
  )

  const selectedChat =
    target.kind === "existing"
      ? (chats.find((c) => c.id === target.chatId) ?? null)
      : null
  const TargetIcon = agentIcon(
    target.kind === "new" ? target.agent : (selectedChat?.provider ?? "claude")
  )
  const targetLabel =
    target.kind === "new"
      ? `New ${agentLabel(target.agent)} chat`
      : (selectedChat?.title ?? "Session")

  const pick = (next: AssignTarget) => {
    setTarget(next)
    setQuery("")
    setOpen(false)
  }

  const assign = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onAssign(target)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div className="pointer-events-auto flex animate-in items-center gap-2 rounded-full border bg-popover/95 py-1.5 pr-1.5 pl-4 shadow-lg ring-1 ring-foreground/5 backdrop-blur duration-150 fade-in slide-in-from-bottom-2">
        <span className="text-sm whitespace-nowrap">
          <span className="font-medium tabular-nums">{count}</span>{" "}
          <span className="text-muted-foreground">
            {count === 1 ? "comment" : "comments"}
          </span>
        </span>
        <div className="h-5 w-px bg-border" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="flex h-8 w-auto max-w-56 min-w-40 items-center gap-1.5 rounded-full px-3 text-sm hover:bg-muted"
            aria-label="Assign target"
          >
            <TargetIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{targetLabel}</span>
            <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 gap-0 p-0">
            <div className="flex items-center gap-2 border-b px-3">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions…"
                className="h-9 rounded-none border-0 bg-transparent px-0 focus-visible:ring-0"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {agents.length > 0 && (
                <div className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
                  New chat
                </div>
              )}
              {agents.map((a) => {
                const Icon = agentIcon(a.kind)
                const active = target.kind === "new" && target.agent === a.kind
                return (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => pick({ kind: "new", agent: a.kind })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                      active && "bg-muted"
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.label}</span>
                  </button>
                )
              })}
              {sessions.length > 0 && (
                <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
                  Sessions
                </div>
              )}
              {sessions.map((c) => {
                const Icon = agentIcon(c.provider)
                const active =
                  target.kind === "existing" && target.chatId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick({ kind: "existing", chatId: c.id })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                      active && "bg-muted"
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.branch}
                    </span>
                  </button>
                )
              })}
              {agents.length === 0 && sessions.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No matches
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          className="rounded-full"
          disabled={busy}
          onClick={() => void assign()}
        >
          <TargetIcon className="size-4" />
          {busy
            ? "Starting…"
            : target.kind === "new"
              ? "Assign to fix"
              : "Send to session"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 rounded-full"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <IconX className="size-4" />
        </Button>
      </div>
    </div>
  )
}
