/**
 * BrowserPane — the site under review, split beside the app canvas.
 *
 * The `<webview>` is an out-of-process guest, so none of its state is knowable
 * from React: the title, the spinner and the history flags all arrive as DOM
 * events off the tag and are mirrored into the pane store, which is also where
 * the agent bridge finds the live element.
 *
 * Its location is driven by the `src` attribute rather than `loadURL` — React
 * only writes the attribute when the value actually changes, so a navigation the
 * user makes inside the page (which flows back through `did-navigate`) settles
 * without bouncing the guest back to where it started.
 */
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconMessagePlus,
  IconReload,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { connectBrowserBridge } from "../adapters/browser-bridge.adapter";
import {
  clearConsoleMessages,
  recordConsoleMessage,
  registerPaneWebview,
  updateBrowserPane,
  useBrowserPane,
} from "../adapters/browser-pane.store";
import {
  applyStyleScript,
  captureRect,
  displayUrl,
  elementPickerScript,
  endInspectionScript,
  inspectedRectScript,
  inspectSelectorScript,
  locateSelectorsScript,
  normalizeUrl,
  outlineInspectedScript,
  PICKER_CANCEL_HOOK,
  restoreStyleScript,
} from "../functions/browser-pane.functions";
import type {
  PickedElement,
  PickedRect,
  WebviewElement,
} from "../interfaces/browser-pane.interfaces";
import type {
  StyleChange,
  VisualComment,
} from "@reviewer/core/visual-comments";
import {
  ReviewAssignBar,
  type AssignTarget,
} from "@/components/review-assign-bar";
import { assignToChat } from "@/interactions/chats/adapters/assign-to-chat.adapter";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import {
  buildVisualAssignmentPrompt,
  buildVisualAssignmentTitle,
} from "@/interactions/chats/functions/chat-assignment.functions";
import { VisualCommentComposer } from "@/interactions/visual-comments/components/visual-comment-composer";
import {
  samePage,
  visualCommentSummary,
} from "@/interactions/visual-comments/functions/visual-style.functions";
import {
  useVisualCommentActions,
  useVisualComments,
} from "@/interactions/visual-comments/adapters/visual-comments.hook.adapter";
import { useChatModels, useRecentChats, useRepo } from "@/lib/queries";
import { isCodeSurface, shellRoute } from "@/lib/shell-route";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const CONSOLE_LEVELS = ["verbose", "info", "warning", "error"] as const;

/**
 * How often the dot re-measures the element it marks. The guest has no way to
 * push a scroll or reflow to the host, so the host asks — seldom enough to be
 * free, often enough that the dot never visibly lags a scroll.
 */
const DOT_FOLLOW_MS = 120;

/**
 * Saved comments' dots are re-measured a little less eagerly than the draft's:
 * there may be many, and none is being edited.
 */
const MARKER_FOLLOW_MS = 200;

/** Where a dot goes on a comment saved before dots remembered their spot. */
const DEFAULT_ANCHOR = { x: 8, y: 8 };

const DOT =
  "absolute z-10 size-3 -translate-1/2 rounded-full bg-sky-400 shadow-[0_0_0_2px_white,0_1px_4px_rgb(0_0_0/0.4)]";

interface Marker {
  readonly comment: VisualComment;
  readonly x: number;
  readonly y: number;
}

function ChromeButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "rounded-lg text-muted-foreground",
              active === true && "bg-elevate-strong text-foreground"
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function BrowserPane() {
  const pane = useBrowserPane();
  const prefs = useUiPrefs();
  // Dragged by a handle in the window frame, which writes the same variable —
  // so resizing the pane never re-renders it (or the `<webview>` inside it).
  // See `usePanelSize`.
  const width = usePanelSize("browser-w", prefs.browserPaneWidth, "width");
  const repo = useRepo();
  const repoRoot = repo.data?.root ?? "";

  // The guest is held in state rather than a ref: the listener effect below has
  // to re-run when the tag mounts, and a ref assignment does not re-render.
  const [guest, setGuest] = useState<WebviewElement | null>(null);
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(false);

  // Handing visual comments to an agent is code work, so the bar keeps to code
  // mode even though the pane itself rides along beside every mode.
  //
  // Over a diff it does not appear at all: the review there carries these
  // comments too, and two bars over one review are two hand-offs of the same
  // notes. Everywhere else — a session, the branches dock — this is the only
  // bar there is, so the pane grows its own.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const ownsHandoff =
    isCodeSurface(pathname) && shellRoute(pathname).kind !== "code";

  const navigate = useNavigate();
  const comments = useVisualComments();
  const visualComments = useVisualCommentActions();
  const chatActions = useChatsActions();
  const chatModels = useChatModels();
  const chats = useRecentChats();

  // The pane opens where it was left for this repository, and remembers each
  // page it settles on. A repo with no remembered page opens blank.
  useEffect(() => {
    if (repoRoot === "") return;
    updateBrowserPane({ url: prefs.browserPaneUrls[repoRoot] ?? "" });
    // Only when the repository changes — later edits to the map are this
    // component writing its own page back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoRoot]);

  useEffect(() => {
    if (repoRoot === "" || pane.url === "") return;
    if (prefs.browserPaneUrls[repoRoot] === pane.url) return;
    setUiPrefs({
      browserPaneUrls: { ...prefs.browserPaneUrls, [repoRoot]: pane.url },
    });
  }, [repoRoot, pane.url, prefs.browserPaneUrls]);

  useEffect(() => {
    if (!editing) setAddress(displayUrl(pane.url));
  }, [pane.url, editing]);

  // The agents' way in, open for exactly as long as there is a pane to drive.
  useEffect(() => connectBrowserBridge(), []);

  const attach = useCallback((element: HTMLElement | null) => {
    const guestElement = element as WebviewElement | null;
    setGuest(guestElement);
    registerPaneWebview(guestElement);
  }, []);

  useEffect(() => {
    const element = guest;
    if (element === null) return;

    const syncHistory = () =>
      updateBrowserPane({
        canGoBack: element.canGoBack(),
        canGoForward: element.canGoForward(),
      });
    const onStart = () => updateBrowserPane({ loading: true });
    const onStop = () => {
      updateBrowserPane({ loading: false, title: element.getTitle() });
      syncHistory();
    };
    // A draft is about an element on the page that just left, so it goes too
    // — the guest's inspection state went with the old document.
    const onNavigate = () => {
      clearConsoleMessages();
      updateBrowserPane({ url: element.getURL(), draft: null });
      syncHistory();
    };
    const onTitle = (event: Event) =>
      updateBrowserPane({
        title: (event as Event & { title: string }).title,
      });
    // Kept so an agent can ask what the page complained about after its change;
    // the levels are Chromium's 0–3, named here rather than at the far end.
    const onConsole = (event: Event) => {
      const entry = event as Event & {
        level: number;
        message: string;
        sourceId: string;
        line: number;
      };
      recordConsoleMessage({
        level: CONSOLE_LEVELS[entry.level] ?? "info",
        message: entry.message,
        source: entry.sourceId,
        line: entry.line,
      });
    };

    element.addEventListener("did-start-loading", onStart);
    element.addEventListener("did-stop-loading", onStop);
    element.addEventListener("did-navigate", onNavigate);
    element.addEventListener("did-navigate-in-page", onNavigate);
    element.addEventListener("page-title-updated", onTitle);
    element.addEventListener("console-message", onConsole);
    return () => {
      element.removeEventListener("did-start-loading", onStart);
      element.removeEventListener("did-stop-loading", onStop);
      element.removeEventListener("did-navigate", onNavigate);
      element.removeEventListener("did-navigate-in-page", onNavigate);
      element.removeEventListener("page-title-updated", onTitle);
      element.removeEventListener("console-message", onConsole);
    };
  }, [guest]);

  const commitAddress = () => {
    const next = normalizeUrl(address);
    setEditing(false);
    if (next === null) {
      setAddress(displayUrl(pane.url));
      return;
    }
    updateBrowserPane({ url: next });
  };

  const close = () => {
    updateBrowserPane({ expanded: false });
    setUiPrefs({ browserPaneOpen: false });
  };

  /**
   * The dot sits where the click landed, and keeps that spot on the element as
   * the page scrolls under it. Measured from the guest at a steady tick; when
   * the element cannot be found any more the dot simply stays put.
   */
  const [dot, setDot] = useState<HTMLElement | null>(null);
  const [dotAt, setDotAt] = useState<{ x: number; y: number } | null>(null);
  const draft = pane.draft;
  useEffect(() => {
    if (draft === null || guest === null) {
      setDotAt(null);
      return;
    }
    setDotAt(draft.point);
    const offset = {
      x: draft.point.x - draft.rect.x,
      y: draft.point.y - draft.rect.y,
    };
    let cancelled = false;
    const follow = async () => {
      const rect = (await guest.executeJavaScript(
        inspectedRectScript()
      )) as PickedRect | null;
      if (cancelled || rect === null) return;
      setDotAt({ x: rect.x + offset.x, y: rect.y + offset.y });
    };
    const timer = window.setInterval(() => void follow(), DOT_FOLLOW_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [draft, guest]);

  // Everything the inspection asks of the guest goes one after another, in
  // the order it was asked: a fast drag on a colour swatch cannot land an older
  // value after a newer, and a cancel cannot overtake the outline it removes.
  const styleQueue = useRef<Promise<unknown>>(Promise.resolve());
  const runInGuest = (script: string): Promise<unknown> => {
    const element = guest;
    if (element === null) return Promise.resolve(null);
    styleQueue.current = styleQueue.current
      .catch(() => undefined)
      .then(() => element.executeJavaScript(script));
    return styleQueue.current;
  };
  const tweakStyle = (property: string, value: string | null) =>
    void runInGuest(
      value === null
        ? restoreStyleScript(property)
        : applyStyleScript(property, value)
    );

  const cancelDraft = () => {
    void runInGuest(endInspectionScript(true));
    updateBrowserPane({ draft: null });
  };

  /**
   * Comment mode runs the picker inside the guest and waits. The click that
   * resolves it is swallowed there, so the page never sees it; what comes back
   * becomes a draft, screenshotted before anything can scroll out from under it.
   */
  const togglePicking = async () => {
    const element = guest;
    if (element === null) return;
    if (pane.mode === "picking") {
      updateBrowserPane({ mode: "browse" });
      await element.executeJavaScript(
        `window.${PICKER_CANCEL_HOOK} && window.${PICKER_CANCEL_HOOK}()`
      );
      return;
    }
    // Picking again while a draft is open means the draft was the wrong
    // element: it goes, with its edits, before the next one is chosen.
    if (pane.draft !== null) cancelDraft();
    updateBrowserPane({ mode: "picking" });
    const picked = (await element.executeJavaScript(
      elementPickerScript()
    )) as PickedElement | null;
    updateBrowserPane({ mode: "browse" });
    if (picked === null) return;

    const bounds = captureRect(picked);
    let screenshot: string | null = null;
    if (bounds !== null) {
      try {
        const image = await element.capturePage(bounds);
        screenshot = image.toDataURL();
      } catch {
        screenshot = null;
      }
    }
    // The click that made the pick landed in the guest, so the guest's own
    // process is holding the keyboard — and while it does, this window counts as
    // unfocused: the composer below would take DOM focus with no caret in it,
    // nothing typed would arrive, and dragging over the words would highlight
    // them in the greyed-out way an inactive window does. Handing focus back
    // before the composer mounts is what makes it an ordinary text box.
    element.blur();
    void runInGuest(outlineInspectedScript());
    updateBrowserPane({ draft: { ...picked, screenshot, existing: null } });
  };

  /**
   * Every comment saved on this page keeps its dot, so a note can be found
   * again and opened. The dots are measured from the guest like the draft's:
   * one trip for all of them, on a steady tick, and only while there is a page
   * and no picker over it.
   */
  const blank = pane.url === "";
  const pageComments = useMemo(
    () =>
      (comments.data ?? []).filter((comment) =>
        samePage(comment.url, pane.url)
      ),
    [comments.data, pane.url]
  );
  const [markers, setMarkers] = useState<ReadonlyArray<Marker>>([]);
  useEffect(() => {
    if (
      guest === null ||
      blank ||
      pane.loading ||
      pane.mode === "picking" ||
      pageComments.length === 0
    ) {
      setMarkers([]);
      return;
    }
    const selectors = [...new Set(pageComments.map((c) => c.selector))];
    let cancelled = false;
    const locate = async () => {
      let found: Record<string, PickedRect | null>;
      try {
        found = (await guest.executeJavaScript(
          locateSelectorsScript(selectors)
        )) as Record<string, PickedRect | null>;
      } catch {
        return;
      }
      if (cancelled) return;
      setMarkers(
        pageComments.flatMap((comment) => {
          const rect = found[comment.selector];
          if (rect === null || rect === undefined) return [];
          const anchor = comment.anchor ?? DEFAULT_ANCHOR;
          return [{ comment, x: rect.x + anchor.x, y: rect.y + anchor.y }];
        })
      );
    };
    void locate();
    const timer = window.setInterval(() => void locate(), MARKER_FOLLOW_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guest, blank, pane.loading, pane.mode, pageComments]);

  /**
   * A dot clicked opens its comment for editing: the element is taken under
   * inspection again, the words and tweaks come back into the composer, and
   * the tweaks' "before" is what was recorded, not whatever the page shows
   * now — a reload may have undone them, and the record must not drift.
   */
  const reopen = async (comment: VisualComment) => {
    const element = guest;
    if (element === null) return;
    if (draft !== null) cancelDraft();
    const inspected = (await runInGuest(
      inspectSelectorScript(comment.selector)
    )) as Omit<PickedElement, "point"> | null;
    if (inspected === null) {
      toast.error("that element is no longer on the page");
      return;
    }
    const anchor = comment.anchor ?? DEFAULT_ANCHOR;
    const styleChanges = comment.styleChanges ?? [];
    element.blur();
    void runInGuest(outlineInspectedScript());
    updateBrowserPane({
      draft: {
        ...inspected,
        point: {
          x: inspected.rect.x + anchor.x,
          y: inspected.rect.y + anchor.y,
        },
        styles: {
          ...inspected.styles,
          ...Object.fromEntries(styleChanges.map((c) => [c.property, c.from])),
        },
        screenshot: comment.screenshot,
        existing: { id: comment.id, body: comment.body, styleChanges },
      },
    });
  };

  const saveDraft = async (
    body: string,
    styleChanges: ReadonlyArray<StyleChange>
  ) => {
    if (draft === null) return;
    try {
      if (draft.existing !== null) {
        await visualComments.update(draft.existing.id, { body, styleChanges });
      } else {
        await visualComments.add({
          url: draft.url,
          selector: draft.selector,
          elementLabel: draft.label,
          body,
          screenshot: draft.screenshot,
          viewport: draft.viewport,
          styleChanges,
          anchor: {
            x: draft.point.x - draft.rect.x,
            y: draft.point.y - draft.rect.y,
          },
        });
      }
      void runInGuest(endInspectionScript(false));
      updateBrowserPane({ draft: null });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not save the comment"
      );
    }
  };

  const deleteDraft = async () => {
    if (draft?.existing === null || draft === undefined || draft === null) {
      return;
    }
    try {
      await visualComments.remove(draft.existing.id);
      void runInGuest(endInspectionScript(true));
      updateBrowserPane({ draft: null });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not delete the comment"
      );
    }
  };

  /**
   * Handing the comments to a session resolves them, exactly as the review bar
   * does: the text now lives in the chat, so leaving copies here would only get
   * them applied twice.
   */
  const assign = async (dest: AssignTarget) => {
    const pending = comments.data ?? [];
    if (pending.length === 0) return;
    try {
      const chatId = await assignToChat(chatActions, {
        target: dest,
        catalog: chatModels.data,
        place: { branch: repo.data?.currentBranch ?? "" },
        title: buildVisualAssignmentTitle(pending.length),
        prompt: buildVisualAssignmentPrompt(pending),
      });
      if (chatId === null) return;
      await Promise.all(
        pending.map((comment) => visualComments.remove(comment.id))
      );
      toast.success(
        `Assigned ${pending.length} comment${pending.length === 1 ? "" : "s"}`
      );
      void navigate({ to: "/modes/agent-session/$chatId", params: { chatId } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not assign comments"
      );
    }
  };

  const pending = comments.data ?? [];

  return (
    <aside
      aria-label="Browser"
      className={cn(
        "browser-pane flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-frame-border",
        pane.expanded && "min-w-0 flex-1"
      )}
      style={pane.expanded ? undefined : width.style}
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-frame-border px-1.5">
        <ChromeButton
          label="Back"
          disabled={!pane.canGoBack}
          onClick={() => guest?.goBack()}
        >
          <IconArrowLeft className="size-4" />
        </ChromeButton>
        <ChromeButton
          label="Forward"
          disabled={!pane.canGoForward}
          onClick={() => guest?.goForward()}
        >
          <IconArrowRight className="size-4" />
        </ChromeButton>
        <ChromeButton
          label={pane.loading ? "Stop" : "Reload"}
          disabled={blank}
          onClick={() => (pane.loading ? guest?.stop() : guest?.reload())}
        >
          <IconReload
            className={cn("size-4", pane.loading && "animate-spin")}
          />
        </ChromeButton>
        <Input
          value={address}
          spellCheck={false}
          placeholder="localhost:3000"
          aria-label="Address"
          className="h-7 flex-1 rounded-lg text-xs"
          onChange={(event) => {
            setEditing(true);
            setAddress(event.target.value);
          }}
          onBlur={commitAddress}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setEditing(false);
              setAddress(displayUrl(pane.url));
            }
          }}
        />
        <ChromeButton
          label="Comment on an element"
          active={pane.mode === "picking"}
          disabled={blank}
          onClick={() => void togglePicking()}
        >
          <IconMessagePlus className="size-4" />
        </ChromeButton>
        <ChromeButton
          label={pane.expanded ? "Show the code" : "Expand browser"}
          active={pane.expanded}
          onClick={() => updateBrowserPane({ expanded: !pane.expanded })}
        >
          {pane.expanded ? (
            <IconArrowsMinimize className="size-4" />
          ) : (
            <IconArrowsMaximize className="size-4" />
          )}
        </ChromeButton>
        <ChromeButton label="Close browser" onClick={close}>
          <IconX className="size-4" />
        </ChromeButton>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {blank ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center text-sm">
            <div className="font-medium">No page open</div>
            <div className="text-muted-foreground">
              Enter the address your dev server is running on to review it here.
            </div>
          </div>
        ) : (
          <webview ref={attach} src={pane.url} className="min-h-0 flex-1" />
        )}
        {markers.map((marker) =>
          draft?.existing?.id === marker.comment.id ? null : (
            <button
              key={marker.comment.id}
              type="button"
              aria-label={`Open comment: ${visualCommentSummary(marker.comment)}`}
              title={visualCommentSummary(marker.comment)}
              onClick={() => void reopen(marker.comment)}
              className={cn(
                DOT,
                "cursor-pointer transition-transform hover:scale-125"
              )}
              style={{ left: marker.x, top: marker.y }}
            />
          )
        )}
        {draft !== null && dotAt !== null && (
          <>
            <span
              ref={setDot}
              aria-hidden
              className={cn(DOT, "pointer-events-none")}
              style={{ left: dotAt.x, top: dotAt.y }}
            />
            <VisualCommentComposer
              key={draft.existing?.id ?? "new"}
              draft={draft}
              anchor={dot}
              onStyle={tweakStyle}
              onSubmit={saveDraft}
              onCancel={cancelDraft}
              {...(draft.existing !== null ? { onDelete: deleteDraft } : {})}
            />
          </>
        )}
        {draft === null && pending.length > 0 && ownsHandoff && (
          <ReviewAssignBar
            comments={pending.map((comment) => ({
              id: comment.id,
              file: comment.elementLabel,
              line: null,
              body: visualCommentSummary(comment),
            }))}
            chats={chats.data?.items ?? []}
            catalog={chatModels.data}
            onAssign={assign}
            onDeleteComment={(id) => visualComments.remove(id)}
          />
        )}
      </div>
    </aside>
  );
}
