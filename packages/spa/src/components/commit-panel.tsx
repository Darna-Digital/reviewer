import { IconSparkles } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { agentIcon } from "@/interactions/threads/components/agent-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TruncatedText } from "@/components/ui/truncated-text";
import { AGENTS, agentLabel } from "@/interactions/threads/interfaces/agents";
import type { GitFileStatus, GitStatusEntry } from "@byconvo/core/repo";
import { STATUS_COLOR } from "@/lib/git-status";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { setUiPrefs, useUiPrefs, type CommitAgent } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

/** Agents that can draft a message — every kind except the plain terminal. */
const COMMIT_AGENTS = AGENTS.filter((a) => a.kind !== "terminal");

interface CommitPanelProps {
  changes: ReadonlyArray<GitStatusEntry>;
  busy: boolean;
  onCommit: (
    message: string,
    paths: ReadonlyArray<string>,
    andPush: boolean
  ) => Promise<unknown>;
  /** Draft a commit message for the chosen paths with the chosen agent CLI. */
  onGenerate?: (
    paths: ReadonlyArray<string>,
    agent: CommitAgent
  ) => Promise<string | null>;
}

const STATUS_LETTER: Record<GitFileStatus, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  ignored: "I",
};

export function CommitPanel({
  changes,
  busy,
  onCommit,
  onGenerate,
}: CommitPanelProps) {
  const { commitFilesHeight, commitMessageHeight, commitAgent } = useUiPrefs();
  // Live heights for smooth dragging; committed back to prefs on release.
  const [filesHeight, setFilesHeight] = useState(commitFilesHeight);
  const [messageHeight, setMessageHeight] = useState(commitMessageHeight);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  // The picker's popup is portalled, so opening it takes focus out of the
  // composer -- track it so the controls it belongs to do not vanish.
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  // Which action is in flight, so its button can show a spinner.
  const [pending, setPending] = useState<"commit" | "push" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(changes.map((c) => c.path))
  );

  // Keep the selection in sync as the change set shifts.
  const paths = useMemo(() => changes.map((c) => c.path).join("\n"), [changes]);
  useMemo(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const c of changes) if (prev.has(c.path)) next.add(c.path);
      // Newly appeared files default to selected.
      for (const c of changes)
        if (!prev.has(c.path) && prev.size === 0) next.add(c.path);
      return next.size === 0 && changes.length > 0
        ? new Set(changes.map((c) => c.path))
        : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const chosen = changes.filter((c) => selected.has(c.path)).map((c) => c.path);
  const canCommit =
    message.trim().length > 0 &&
    chosen.length > 0 &&
    !busy &&
    !generating &&
    pending === null;
  const canGenerate =
    onGenerate !== undefined &&
    chosen.length > 0 &&
    !generating &&
    !busy &&
    pending === null;

  const commit = async (andPush: boolean) => {
    if (!canCommit) return;
    setPending(andPush ? "push" : "commit");
    try {
      const ok = await onCommit(message.trim(), chosen, andPush);
      if (ok !== false) setMessage("");
    } finally {
      setPending(null);
    }
  };

  const generate = async () => {
    if (!canGenerate || onGenerate === undefined) return;
    setGenerating(true);
    try {
      const generated = await onGenerate(chosen, commitAgent);
      if (generated !== null && generated.length > 0) setMessage(generated);
    } finally {
      setGenerating(false);
    }
  };

  const AgentGlyph = agentIcon(commitAgent);
  const showGenerateControls = composerFocused || agentPickerOpen || generating;
  // The controls float over the message field, so they lift off the substrate
  // the same way a menu does -- brighter than the input rather than a wash of
  // it -- and publish that level so the agent picker opens a rung above them.
  const { level: controlsLevel, className: controlsSurface } = useElevation(
    ELEVATION.menu,
    POPUP_SHADOW
  );

  return (
    <div className="flex shrink-0 flex-col border-t">
      {/* Drag the top edge to grow/shrink the changed-files list. The handle
          straddles the panel's top border (negative margin), so dragging up
          expands the list into the tree above it. */}
      <ResizeHandle
        orientation="row"
        value={filesHeight}
        min={80}
        max={() => Math.max(120, window.innerHeight - 320)}
        direction={-1}
        onResize={setFilesHeight}
        onResizeEnd={(h) => setUiPrefs({ commitFilesHeight: h })}
        label="Resize changed files"
      />
      <ScrollArea
        style={{ height: filesHeight }}
        viewportClassName="scroll-fade px-3 pt-2"
      >
        {changes.map((c) => (
          <label
            key={c.path}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-xs hover:bg-muted"
          >
            <Checkbox
              checked={selected.has(c.path)}
              onCheckedChange={() => toggle(c.path)}
              className="size-3.5"
            />
            <span
              className={cn(
                "w-3 font-mono font-medium",
                STATUS_COLOR[c.status]
              )}
            >
              {STATUS_LETTER[c.status]}
            </span>
            <TruncatedText text={c.path} />
          </label>
        ))}
      </ScrollArea>
      {/* Drag the message box's top border to grow/shrink the composer. */}
      <ResizeHandle
        orientation="row"
        value={messageHeight}
        min={48}
        max={() => Math.max(80, window.innerHeight - 360)}
        direction={-1}
        onResize={setMessageHeight}
        onResizeEnd={(h) => setUiPrefs({ commitMessageHeight: h })}
        label="Resize commit message"
      />
      {/* pb-2.5 vertically centres the commit button box on the rail's bottom
          icon (its hover box, not the glyph): the rail icon button is 8px off
          the viewport bottom and taller than our sm button, so matching its
          centre -- not its bottom edge -- is what visually lines them up. */}
      <div className="flex flex-col gap-2 border-t px-3 pt-3 pb-2.5">
        <div
          className="relative"
          onFocus={() => setComposerFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget))
              setComposerFocused(false);
          }}
        >
          {/* Bottom padding clears the floating controls' full height plus
              their inset, so scrolling to the end reveals the last line. */}
          <Textarea
            value={message}
            placeholder="Commit message..."
            wrap="off"
            className="pb-12 text-sm"
            style={{ height: messageHeight }}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                void commit(false);
            }}
          />
          {onGenerate !== undefined && (
            <SurfaceProvider value={controlsLevel}>
              <div
                data-surface={controlsLevel}
                className={cn(
                  "absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-md p-1",
                  controlsSurface,
                  "transition-opacity duration-150",
                  showGenerateControls
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                )}
              >
                <Button
                  type="button"
                  size="xs"
                  variant="ghost-muted"
                  className="gap-0"
                  disabled={!canGenerate}
                  title={`Generate a commit message with ${agentLabel(commitAgent)}`}
                  onClick={() => void generate()}
                >
                  {generating ? (
                    <LoadingCursor label={null} />
                  ) : (
                    <IconSparkles className="size-3.5" />
                  )}
                  {/* The label is a hover affordance: at rest the control is
                      just the sparkle, and it widens into its name on hover,
                      focus, or while a draft is running. */}
                  <span
                    className={cn(
                      "max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity,margin] duration-200 ease-out",
                      "group-hover/button:ml-1 group-hover/button:max-w-24 group-hover/button:opacity-100",
                      "group-focus-visible/button:ml-1 group-focus-visible/button:max-w-24 group-focus-visible/button:opacity-100",
                      generating && "ml-1 max-w-24 opacity-100"
                    )}
                  >
                    {generating ? "Generating…" : "Generate"}
                  </span>
                </Button>
                {/* Pick which local agent CLI drafts the message. */}
                <Select
                  value={commitAgent}
                  open={agentPickerOpen}
                  onOpenChange={setAgentPickerOpen}
                  onValueChange={(v) => v && setUiPrefs({ commitAgent: v })}
                >
                  <SelectTrigger
                    size="sm"
                    hideIcon
                    className="h-6 w-auto gap-1 rounded-md border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:bg-elevate"
                    aria-label="Commit message agent"
                    title={`Draft with ${agentLabel(commitAgent)}`}
                  >
                    <AgentGlyph className="size-3.5 shrink-0" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {COMMIT_AGENTS.map((a) => {
                      const Icon = agentIcon(a.kind);
                      return (
                        <SelectItem key={a.kind} value={a.kind}>
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          {a.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </SurfaceProvider>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={!canCommit}
            onClick={() => void commit(false)}
          >
            {pending === "commit" && (
              <LoadingCursor
                label="Committing…"
                className="bg-primary-foreground"
              />
            )}
            Commit
          </Button>
          <Button
            size="sm"
            variant="ghost-muted"
            disabled={!canCommit}
            onClick={() => void commit(true)}
          >
            {pending === "push" && (
              <LoadingCursor label="Committing and pushing…" />
            )}
            Commit & push
          </Button>
        </div>
      </div>
    </div>
  );
}
