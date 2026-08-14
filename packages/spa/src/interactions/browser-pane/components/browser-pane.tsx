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
  IconMessagePlus,
  IconReload,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
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
  captureRect,
  displayUrl,
  elementPickerScript,
  normalizeUrl,
  PICKER_CANCEL_HOOK,
} from "../functions/browser-pane.functions";
import type {
  PickedElement,
  WebviewElement,
} from "../interfaces/browser-pane.interfaces";
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
  useVisualCommentActions,
  useVisualComments,
} from "@/interactions/visual-comments/adapters/visual-comments.hook.adapter";
import { useChatModels, useRecentChats, useRepo } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { activeWorkMode } from "@/lib/work-mode";

const CONSOLE_LEVELS = ["verbose", "info", "warning", "error"] as const;

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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const inCodeMode = activeWorkMode(pathname, prefs.workMode) === "code";

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
    const onNavigate = () => {
      clearConsoleMessages();
      updateBrowserPane({ url: element.getURL() });
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
    updateBrowserPane({ draft: { ...picked, screenshot } });
  };

  const close = () => setUiPrefs({ browserPaneOpen: false });

  const saveDraft = async (body: string) => {
    const draft = pane.draft;
    if (draft === null) return;
    try {
      await visualComments.add({
        url: draft.url,
        selector: draft.selector,
        elementLabel: draft.label,
        body,
        screenshot: draft.screenshot,
        viewport: draft.viewport,
      });
      updateBrowserPane({ draft: null });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not save the comment"
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
        branch: repo.data?.currentBranch ?? "",
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

  const blank = pane.url === "";
  const pending = comments.data ?? [];

  return (
    <aside
      aria-label="Browser"
      className="browser-pane flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-frame-border"
      style={width.style}
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
        {pane.draft !== null && (
          <VisualCommentComposer
            draft={pane.draft}
            onSubmit={saveDraft}
            onCancel={() => updateBrowserPane({ draft: null })}
          />
        )}
        {pane.draft === null && pending.length > 0 && inCodeMode && (
          <ReviewAssignBar
            comments={pending.map((comment) => ({
              id: comment.id,
              file: comment.elementLabel,
              line: null,
              body: comment.body,
            }))}
            chats={chats.data?.items ?? []}
            onAssign={assign}
            className="absolute inset-x-2 bottom-3"
          />
        )}
      </div>
    </aside>
  );
}
