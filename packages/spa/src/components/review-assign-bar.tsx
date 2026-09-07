/**
 * ReviewAssignBar — a floating bottom bar that appears while you have local
 * review comments (left in the commit/PR diff or a code view, or on the running
 * UI in the browser pane). It lets you pick a target and hand the comments off:
 * either start a fresh chat with a chosen agent and model, or attach them to an
 * existing session (chat) picked from a searchable dropdown. Collapsing it parks
 * a count chip against the right edge of whatever it floats over; the bar comes
 * back from that chip, and on its own whenever a new comment is left.
 */
import {
  IconChevronDown,
  IconGitBranch,
  IconMessage,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AgentGlyph } from "@/interactions/threads/components/agent-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import {
  assignmentModel,
  isChatProviderKind,
} from "@/interactions/chats/functions/chat-assignment.functions";
import { ModelPicker } from "@/interactions/chats/components/model-picker";
import { AGENTS, agentLabel } from "@/interactions/threads/interfaces/agents";
import type {
  ChatModelCatalog,
  ChatProviderKind,
  ChatSummary,
} from "@reviewer/core/chats";
import { timeAgo } from "@/lib/relative-time";
import { rememberSession, useUiPrefs } from "@/lib/ui-prefs";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { cn } from "@/lib/utils";

/** Agent CLIs that can be assigned to chat flows (excludes the plain shell). */
const ASSIGNABLE = AGENTS.filter(
  (agent): agent is (typeof AGENTS)[number] & { kind: ChatProviderKind } =>
    isChatProviderKind(agent.kind)
);

const CommentCount = ({ count }: { count: number }) => (
  <>
    <span className="font-medium tabular-nums">{count}</span>
    <span className="font-normal text-muted-foreground">
      {count === 1 ? "comment" : "comments"}
    </span>
  </>
);

/**
 * One comment as the bar lists it: where it was left and what it says. Callers
 * flatten their own comment shape to this — a diff comment names a file and
 * line, a visual one names the element it was drawn on and has no line.
 */
export interface AssignBarComment {
  id: string;
  file: string;
  line: number | null;
  body: string;
}

/**
 * Where the review comments get handed off. A new chat carries the model as
 * well as the agent: which agent runs the work and which model it runs on are
 * two answers, and only saying the first leaves the second to the catalog.
 */
export type AssignTarget =
  | { kind: "new"; agent: ChatProviderKind; model: string }
  | { kind: "existing"; chatId: string };

export function ReviewAssignBar({
  comments,
  chats,
  catalog,
  branch,
  onAssign,
  onOpenComment,
  className,
}: {
  comments: ReadonlyArray<AssignBarComment>;
  chats: ReadonlyArray<ChatSummary>;
  /** The models each agent's CLI reported, for the model chip. */
  catalog: ChatModelCatalog | undefined;
  /**
   * The branch the comments are about — the one this checkout is on. Sessions
   * already working there lead the picker, and the newest of them is what the
   * bar opens on.
   */
  branch?: string;
  onAssign: (target: AssignTarget) => Promise<void> | void;
  /**
   * Jump to where a comment was left. Omitted by callers whose comments have
   * nowhere in the code to jump to — the list then just reads them back.
   */
  onOpenComment?: (id: string) => void;
  /**
   * Where the bar sits. Defaults to the bottom of the window; a caller that
   * owns a panel of its own passes positioning that keeps the bar inside it.
   */
  className?: string;
}) {
  const count = comments.length;
  /** Null until the reader picks: before that the diff answers for them. */
  const [picked, setPicked] = useState<AssignTarget | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current) setCollapsed(false);
    seen.current = count;
  }, [count]);
  const { level, className: surface } = useElevation(
    ELEVATION.menu,
    POPUP_SHADOW
  );
  const remembered = useUiPrefs().lastSession;
  /** Whoever you last worked with, or Claude until you have worked with anyone. */
  const lastAgent = remembered.provider ?? "claude";

  /** Sessions working where the comments are, newest first. */
  const onBranch = useMemo(
    () =>
      branch === undefined || branch.length === 0
        ? []
        : [...chats.filter((chat) => chat.branch === branch)].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          ),
    [chats, branch]
  );
  /**
   * What the bar is aimed at.
   *
   * A note left on a branch's diff is nearly always for whoever is working on
   * it, so that session is the answer until somebody says otherwise — which
   * makes the common case no clicks at all. A pick, once made, is held: the
   * list reloads as sessions come and go, and it must not quietly undo one.
   *
   * With no session to hand it to, the answer is a new one with whoever you
   * were last working with rather than a fixed agent: the choice was made the
   * last time this was asked, and asking again with a different answer is how
   * work quietly ends up spread across agents nobody chose.
   */
  const target: AssignTarget = picked ?? {
    ...(onBranch[0] === undefined
      ? {
          kind: "new" as const,
          agent: lastAgent,
          model: assignmentModel(lastAgent, catalog, remembered.model),
        }
      : { kind: "existing" as const, chatId: onBranch[0].id }),
  };

  const q = query.trim().toLowerCase();
  const agents = useMemo(
    () =>
      ASSIGNABLE.filter((a) => q === "" || a.label.toLowerCase().includes(q)),
    [q]
  );
  // Comments read as a review, not as a flat list: each file says its name once
  // and its notes hang under it in the order they were left.
  const byFile = useMemo(() => {
    const grouped = new Map<string, AssignBarComment[]>();
    for (const comment of comments) {
      const inFile = grouped.get(comment.file);
      if (inFile === undefined) grouped.set(comment.file, [comment]);
      else inFile.push(comment);
    }
    return [...grouped];
  }, [comments]);
  const sessions = useMemo(() => {
    const matches = (chat: ChatSummary) =>
      q === "" ||
      chat.title.toLowerCase().includes(q) ||
      chat.branch.toLowerCase().includes(q);
    const ids = new Set(onBranch.map((chat) => chat.id));
    const here = onBranch.filter(matches);
    return {
      here,
      elsewhere: chats.filter((chat) => !ids.has(chat.id) && matches(chat)),
      get all() {
        return [...here, ...this.elsewhere];
      },
    };
  }, [chats, onBranch, q]);

  const selectedChat =
    target.kind === "existing"
      ? (chats.find((c) => c.id === target.chatId) ?? null)
      : null;
  const targetAgent =
    target.kind === "new" ? target.agent : (selectedChat?.provider ?? "claude");
  const targetLabel =
    target.kind === "new"
      ? `New ${agentLabel(target.agent)} chat`
      : (selectedChat?.title ?? "Session");

  const pick = (next: AssignTarget) => {
    setPicked(next);
    if (next.kind === "new") {
      rememberSession({ provider: next.agent, model: next.model });
    }
    setQuery("");
    setOpen(false);
  };

  const assign = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAssign(target);
    } finally {
      setBusy(false);
    }
  };

  if (collapsed) {
    return (
      <div
        className={cn(
          "pointer-events-none z-40 flex justify-end",
          className ?? "fixed inset-x-4 bottom-6"
        )}
      >
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto animate-in gap-1.5 duration-150 fade-in slide-in-from-right-2"
          aria-label={`Show ${count} review ${count === 1 ? "comment" : "comments"}`}
          onClick={() => setCollapsed(false)}
        >
          <IconMessage className="size-4 text-muted-foreground" />
          {count}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none z-40 flex justify-center",
        className ?? "fixed inset-x-4 bottom-6"
      )}
    >
      <SurfaceProvider value={level}>
        <div
          data-surface={level}
          className={cn(
            "pointer-events-auto flex max-w-full animate-in items-center gap-1 rounded-xl p-1 duration-150 fade-in slide-in-from-bottom-2",
            surface
          )}
        >
          <Popover open={listOpen} onOpenChange={setListOpen}>
            <PopoverTrigger
              aria-label={`${count} review ${count === 1 ? "comment" : "comments"}`}
              render={<Button variant="ghost" size="sm" className="gap-1" />}
            >
              <CommentCount count={count} />
              <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-80 gap-0 p-1">
              <div className="flex max-h-72 min-w-0 scroll-fade flex-col gap-3 overflow-x-hidden overflow-y-auto py-1">
                {byFile.map(([file, inFile]) => (
                  <div key={file} className="flex min-w-0 flex-col gap-0.5">
                    <FileHeading file={file} />
                    {inFile.map((comment) => (
                      <CommentRow
                        key={comment.id}
                        comment={comment}
                        onOpen={
                          // A comment on the running UI sits on no line, so
                          // there is nowhere in the code to send a click.
                          onOpenComment === undefined || comment.line === null
                            ? undefined
                            : () => {
                                setListOpen(false);
                                onOpenComment(comment.id);
                              }
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              aria-label="Assign target"
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-w-56 min-w-0 justify-start"
                />
              }
            >
              <AgentGlyph kind={targetAgent} className="size-4 shrink-0" />
              <span className="truncate">{targetLabel}</span>
              <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 gap-0 p-1">
              <div className="-mx-1 mb-1 flex items-center gap-2 border-b px-2.5 py-2">
                <IconSearch className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sessions…"
                  className="h-auto rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              {/* Native overflow (not ScrollArea) so max-height actually scrolls —
                  Base UI ScrollArea's size-full viewport won't constrain under a
                  max-h parent, so content is clipped with nowhere to scroll. */}
              <div className="max-h-64 min-w-0 scroll-fade overflow-x-hidden overflow-y-auto">
                {agents.length > 0 && (
                  <div className="px-2 pt-1 pb-0.5 text-xs text-muted-foreground">
                    New chat
                  </div>
                )}
                {agents.map((a) => {
                  const active =
                    target.kind === "new" && target.agent === a.kind;
                  return (
                    <button
                      key={a.kind}
                      type="button"
                      onClick={() =>
                        pick({
                          kind: "new",
                          agent: a.kind,
                          // Swapping agents keeps the model you were on when
                          // the new one can run it, and falls back to its own
                          // first answer when it cannot.
                          model: assignmentModel(
                            a.kind,
                            catalog,
                            remembered.model
                          ),
                        })
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                        active && "bg-muted"
                      )}
                    >
                      <AgentGlyph kind={a.kind} className="size-4 shrink-0" />
                      <span className="truncate">{a.label}</span>
                    </button>
                  );
                })}
                {/* Two headings rather than one, so the rows that lead the
                    list say why they lead it instead of looking like an
                    arbitrary order. */}
                {[
                  {
                    heading: `On ‘${branch}’`,
                    items: sessions.here,
                  },
                  {
                    // Everything else this project has going, so a comment can
                    // still be handed to a session that is not on this branch.
                    heading:
                      sessions.here.length > 0 ? "Other sessions" : "Sessions",
                    items: sessions.elsewhere,
                  },
                ]
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <Fragment key={group.heading}>
                      <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
                        {group.heading}
                      </div>
                      {group.items.map((chat) => (
                        <SessionRow
                          key={chat.id}
                          chat={chat}
                          showBranch={group.items !== sessions.here}
                          active={
                            target.kind === "existing" &&
                            target.chatId === chat.id
                          }
                          onSelect={() =>
                            pick({ kind: "existing", chatId: chat.id })
                          }
                        />
                      ))}
                    </Fragment>
                  ))}
                {agents.length === 0 && sessions.all.length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No matches
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {/* Only a new chat has a model left to choose — an existing session
              already runs on the one it was started with. */}
          {target.kind === "new" && (
            <ModelPicker
              catalog={catalog}
              model={target.model}
              onSelect={(model, provider) =>
                pick({ kind: "new", agent: provider, model })
              }
            />
          )}
          <Button size="sm" disabled={busy} onClick={() => void assign()}>
            {busy ? "Assigning…" : "Assign"}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost-muted"
            aria-label="Hide"
            onClick={() => setCollapsed(true)}
          >
            <IconX className="size-4" />
          </Button>
        </div>
      </SurfaceProvider>
    </div>
  );
}

/**
 * A comment in the count's list: where it sits over what it says. Clicking it
 * goes there, so the bar doubles as the way around the review.
 */
/**
 * The file a group of comments was left in — a quiet label over its notes, the
 * way the tab strip names a file: the leaf alone, since the folders above it
 * are the same for most of a review and only push the names out of view.
 */
function FileHeading({ file }: { file: string }) {
  return (
    <div className="truncate px-2 type-xs text-muted-foreground">
      {file.slice(file.lastIndexOf("/") + 1)}
    </div>
  );
}

/**
 * A comment under its file: the line it sits on in a gutter, then what it says.
 * Clicking it goes there, so the bar doubles as the way around the review.
 */
function CommentRow({
  comment,
  onOpen,
}: {
  comment: AssignBarComment;
  onOpen?: () => void;
}) {
  const content = (
    <>
      {comment.line !== null && (
        <span className="min-w-7 shrink-0 text-right text-muted-foreground tabular-nums">
          {comment.line}
        </span>
      )}
      <span className="line-clamp-2 min-w-0 flex-1">{comment.body}</span>
    </>
  );
  const className = "flex min-w-0 items-baseline gap-2 px-2 py-1 type-body";
  if (onOpen === undefined) {
    return <div className={className}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(className, "w-full rounded-md text-left hover:bg-muted")}
    >
      {content}
    </button>
  );
}

/**
 * A session row in the picker. Hovering opens a side preview card.
 *
 * Wider than the picker it hangs off, and showing what the row cannot: the last
 * thing said in the session. Which session to hand a review to is a question
 * about what is going on in it, and a title alone rarely answers that — the
 * card has to be big enough to hold a few lines of the conversation, or hovering
 * only repeats the row.
 */
function SessionRow({
  chat,
  active,
  showBranch,
  onSelect,
}: {
  chat: ChatSummary;
  active: boolean;
  /** Off under a heading that already named the branch — it would say it twice. */
  showBranch: boolean;
  onSelect: () => void;
}) {
  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={400}
        closeDelay={100}
        render={
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
              active && "bg-muted"
            )}
          />
        }
      >
        <AgentGlyph kind={chat.provider} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{chat.title}</span>
        {showBranch && (
          <span className="max-w-36 shrink-0 truncate text-xs text-muted-foreground">
            {chat.branch}
          </span>
        )}
      </PreviewCardTrigger>
      <PreviewCardContent side="right" align="start" className="w-96 gap-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 leading-snug font-medium">
            {chat.title}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(chat.updatedAt)}
          </span>
        </div>
        {chat.lastMessage !== null && chat.lastMessage.trim().length > 0 && (
          <p className="line-clamp-5 text-xs/5 whitespace-pre-line text-muted-foreground">
            {chat.lastMessage.trim()}
          </p>
        )}
        <div className="flex min-w-0 items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconGitBranch className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{chat.branch}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <AgentGlyph kind={chat.provider} className="size-3.5 shrink-0" />
            {agentLabel(chat.provider)}
          </span>
          <span className="ml-auto shrink-0 tabular-nums">
            {chat.messageCount}{" "}
            {chat.messageCount === 1 ? "message" : "messages"}
          </span>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
