import {
  IconAdjustmentsHorizontal,
  IconArrowUpRight,
  IconClock,
  IconFileCode,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  applyFilters,
  buildAssignmentPrompt,
  buildAssignmentTitle,
  fileLabel,
  filtersActive as areFiltersActive,
  groupByFile,
  listComments,
  noFilters,
  targetLabel,
  type ListedComment,
} from "@/interactions/comments/functions/comment-list.functions";
import { AuthorAvatar } from "@/interactions/comments/components/author-avatar";
import { CommentComposer } from "@/interactions/comments/components/comment-thread";
import {
  ReviewAssignBar,
  type AssignTarget,
} from "@/components/review-assign-bar";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import { buildChatAssignmentSettings } from "@/interactions/chats/functions/chat-assignment.functions";
import {
  DATE_FILTERS,
  dateFilterLabel,
  type DateFilter,
} from "@/lib/date-filter";
import { useChatModels, useChats, useComments, useRepo } from "@/lib/queries";
import { useCommentsActions } from "@/interactions/comments/adapters/comments.hook.adapter";
import { timeAgo } from "@/lib/relative-time";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

function FilterMenu({
  dateValue,
  onDateChange,
  active,
}: {
  dateValue: DateFilter;
  onDateChange: (value: DateFilter) => void;
  active: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="relative size-7 shrink-0"
            aria-label="Filter comments"
          >
            <IconAdjustmentsHorizontal className="size-4" />
            {active && (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand-500" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconClock className="size-4" />
            <span>Time</span>
            <span className="ml-auto max-w-28 truncate text-xs text-muted-foreground">
              {dateFilterLabel(dateValue)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <DropdownMenuRadioGroup
              value={dateValue}
              onValueChange={(v) => onDateChange(v as DateFilter)}
            >
              {DATE_FILTERS.map((d) => (
                <DropdownMenuRadioItem key={d.value} value={d.value}>
                  {d.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A file's heading in the list, and the count of what sits under it. */
function FileHeading({ filePath, count }: { filePath: string; count: number }) {
  const { name, dir } = fileLabel(filePath);
  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b bg-background/85 px-3 py-1.5 backdrop-blur-sm">
      <IconFileCode className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 truncate text-xs font-medium">{name}</span>
      {dir.length > 0 && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {dir}
        </span>
      )}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}

function CommentRow({
  comment,
  selected,
  onSelect,
  onOpen,
  onResolve,
}: {
  comment: ListedComment;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onResolve: () => void;
}) {
  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onOpen}
        className={cn(
          "flex w-full gap-2.5 px-3 py-2.5 pr-9 text-left outline-none hover:bg-elevate",
          selected && "bg-muted hover:bg-muted"
        )}
      >
        <AuthorAvatar
          author={comment.author}
          source={comment.code.source}
          className="size-6"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-medium">
              {comment.author}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {timeAgo(comment.createdAt)}
            </span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">
            {comment.body}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded bg-elevate px-1 py-px font-mono text-foreground">
              L{comment.code.lineNumber}
            </span>
            <span className="truncate">{targetLabel(comment.code.target)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Resolve comment"
        className="absolute top-2.5 right-2.5 text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100"
        onClick={onResolve}
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 text-xs">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

function CommentDetail({
  comment,
  onOpen,
  onResolve,
  onSave,
}: {
  comment: ListedComment;
  onOpen: () => void;
  onResolve: () => void;
  onSave: (body: string) => Promise<void>;
}) {
  const { code } = comment;
  const { name, dir } = fileLabel(code.filePath);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [comment.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <IconFileCode className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[13px] font-medium">
            {name}:{code.lineNumber}
          </span>
          {dir.length > 0 && (
            <span className="truncate text-xs text-muted-foreground max-lg:hidden">
              {dir}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <IconArrowUpRight data-icon="inline-start" className="size-3.5" />
            Open in code
          </Button>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onResolve}>
            Resolve
          </Button>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5">
          <div className="flex items-center gap-2.5">
            <AuthorAvatar author={comment.author} source={code.source} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">
                {comment.author}
              </div>
              <div className="text-xs text-muted-foreground">
                {timeAgo(comment.createdAt)}
              </div>
            </div>
          </div>

          {editing ? (
            <CommentComposer
              initialBody={comment.body}
              submitLabel="Save"
              placeholder="Edit comment…"
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await onSave(body);
                setEditing(false);
              }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
          )}

          <dl className="space-y-1.5 border-t pt-4">
            <Field label="File">
              <code className="font-mono">
                {code.filePath}:{code.lineNumber}
              </code>
            </Field>
            <Field label="Side">{code.side}</Field>
            <Field label="Target">{targetLabel(code.target)}</Field>
          </dl>
        </div>
      </ScrollArea>
    </div>
  );
}

export function CommentsPage() {
  const codeComments = useComments();
  const commentActions = useCommentsActions();
  const chatActions = useChatsActions();
  const chatModels = useChatModels();
  const chats = useChats();
  const repo = useRepo();
  const navigate = useNavigate();

  const prefs = useUiPrefs();
  const [sidebarWidth, setSidebarWidth] = useState(prefs.workspaceSidebarWidth);
  const [date, setDate] = useState<DateFilter>(noFilters.date);
  const [search, setSearch] = useState(noFilters.search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignBarDismissed, setAssignBarDismissed] = useState(false);

  const all = useMemo(
    () => listComments(codeComments.data ?? []),
    [codeComments.data]
  );

  const filters = useMemo(() => ({ date, search }), [date, search]);
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const groups = useMemo(() => groupByFile(filtered), [filtered]);
  const filtersOn = areFiltersActive(filters);

  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (all.length > 0) setAssignBarDismissed(false);
  }, [all.length]);

  const remove = (comment: ListedComment) =>
    commentActions.remove(comment.code);

  const assign = async (dest: AssignTarget) => {
    if (filtered.length === 0) return;
    const assigned = filtered;
    const count = assigned.length;
    const prompt = buildAssignmentPrompt(assigned);
    try {
      const chatId =
        dest.kind === "new"
          ? ((
              await chatActions.startWithTitle(
                buildChatAssignmentSettings(dest.agent, chatModels.data),
                repo.data?.currentBranch ?? "",
                buildAssignmentTitle(count),
                prompt
              )
            )?.id ?? null)
          : (await chatActions.send(dest.chatId, prompt)) !== null
            ? dest.chatId
            : null;
      if (chatId === null) return;

      // Handing them off is what resolves them — the text now lives in the chat.
      await Promise.all(assigned.map(remove));
      setSelectedId(null);
      toast.success(`Assigned ${count} comment${count === 1 ? "" : "s"}`);
      void navigate({ to: "/modes/code/chats/$chatId", params: { chatId } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not assign comments"
      );
    }
  };

  const resolve = async (comment: ListedComment) => {
    try {
      await remove(comment);
      if (comment.id === selectedId) setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "resolve failed");
    }
  };

  const save = async (comment: ListedComment, body: string) => {
    await commentActions.update(comment.code, body);
  };

  /**
   * Go to the code the comment was left on. A comment on the working tree opens
   * the file itself, at its line, where the comment renders inline; one left on
   * a diff opens that diff, scrolled to the file.
   */
  const openInCode = (comment: ListedComment) => {
    const { filePath, lineNumber, target } = comment.code;
    if (target === "worktree") {
      void navigate({
        to: "/modes/code/commit",
        search: { path: filePath, file: filePath, line: lineNumber },
      });
      return;
    }
    if (target.startsWith("commit-")) {
      void navigate({
        to: "/modes/code/browse/commit/$sha",
        params: { sha: target.slice("commit-".length) },
        search: { path: filePath },
      });
      return;
    }
    if (target.includes("...")) {
      const [base, head] = target.split("...");
      if (base === undefined || head === undefined) return;
      void navigate({
        to: "/modes/code/browse/range",
        search: { path: filePath, base, head },
      });
      return;
    }
    if (target.startsWith("pr-")) {
      void navigate({
        to: "/modes/code/review/$pull",
        params: { pull: target.slice("pr-".length) },
        search: { path: filePath },
      });
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search comments"
              placeholder="Search comments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 rounded-md pr-7 pl-8"
            />
            {search.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>
          <FilterMenu
            dateValue={date}
            onDateChange={setDate}
            active={filtersOn}
          />
        </div>
        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          {all.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No comments yet. Leave one with the + in a file's gutter.
            </p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <p className="text-xs text-muted-foreground">
                No comments match these filters.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setDate(noFilters.date);
                  setSearch(noFilters.search);
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.filePath}>
                <FileHeading
                  filePath={group.filePath}
                  count={group.comments.length}
                />
                {group.comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    selected={comment.id === selectedId}
                    onSelect={() => setSelectedId(comment.id)}
                    onOpen={() => openInCode(comment)}
                    onResolve={() => void resolve(comment)}
                  />
                ))}
              </div>
            ))
          )}
        </ScrollArea>
      </aside>
      <ResizeHandle
        orientation="col"
        value={sidebarWidth}
        min={180}
        max={() => Math.max(240, window.innerWidth - 480)}
        onResize={setSidebarWidth}
        onResizeEnd={(w) => setUiPrefs({ workspaceSidebarWidth: w })}
        label="Resize sidebar"
      />
      <section className="flex min-w-0 flex-1 flex-col">
        {selected === null ? (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-center text-sm text-muted-foreground">
              Select a comment to read it, then open the code it was left on.
            </p>
          </div>
        ) : (
          <CommentDetail
            comment={selected}
            onOpen={() => openInCode(selected)}
            onResolve={() => void resolve(selected)}
            onSave={async (body) => {
              try {
                await save(selected, body);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "save failed"
                );
                throw error;
              }
            }}
          />
        )}
      </section>
      {filtered.length > 0 && !assignBarDismissed && (
        <ReviewAssignBar
          count={filtered.length}
          chats={chats.data ?? []}
          onAssign={assign}
          onDismiss={() => setAssignBarDismissed(true)}
        />
      )}
    </div>
  );
}
