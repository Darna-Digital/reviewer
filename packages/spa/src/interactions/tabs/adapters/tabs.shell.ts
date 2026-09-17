/**
 * The open-file strip, handed to the native shell.
 *
 * In the macOS window the code island has no header band to portal the strip
 * into: the row over the page is the window's own, so the shell draws the
 * strip there itself, natively, under the window tabs. The tabs are still this
 * page's state — the store, the preview slot, the pinning — so what crosses
 * the bridge is a picture of the strip going out and the clicks coming back,
 * the same props `TabStrip` takes, minus the DOM.
 *
 * The icon crosses as markup: the shell has no sprite to `<use>`, so each tab
 * carries its own copy of the symbol, coloured for either palette.
 */
import { useEffect, useMemo, useRef } from "react";
import { fileIconMarkup } from "@/components/ui/file-type-icon";
import { pathName } from "@/lib/display-path";
import {
  island,
  shell,
  type ShellTabAction,
  type ShellTabStrip,
} from "@/lib/shell";
import { orderTabs } from "../functions/tabs.functions";
import type { TabStripProps } from "../components/tab-strip";

/** Whether the strip is the shell's to draw rather than this document's. */
export const shellDrawsTabs = island === "code";

const act = (props: TabStripProps, action: ShellTabAction): void => {
  switch (action.kind) {
    case "select":
      return props.onSelect(action.path);
    case "keep":
      return props.onKeep(action.path);
    case "close":
      return props.onClose(action.path);
    case "togglePin":
      return props.onTogglePin(action.path);
    case "closeOthers":
      return props.onCloseOthers(action.path);
    case "closeAll":
      return props.onCloseAll();
    case "move":
      return props.onMove(action.path, action.toIndex);
  }
};

const report = (
  tabs: TabStripProps["tabs"],
  active: TabStripProps["active"],
  dirty: TabStripProps["dirty"]
): ShellTabStrip => ({
  tabs: orderTabs(tabs).map((tab) => ({
    path: tab.path,
    name: pathName(tab.path),
    pinned: tab.pinned,
    preview: tab.preview,
    dirty: dirty.has(tab.path),
    icon: fileIconMarkup(tab.path),
  })),
  active,
});

/**
 * Keep the shell's strip in step with `props`, and its actions flowing back
 * into them; null where the page shows no strip, which takes the shell's down.
 */
export function useShellTabStrip(props: TabStripProps | null): void {
  const latest = useRef(props);
  latest.current = props;

  // The handlers are remade every render; the picture only follows the state.
  const tabs = props?.tabs ?? null;
  const active = props?.active ?? null;
  const dirty = props?.dirty ?? null;
  const picture = useMemo(
    () =>
      shellDrawsTabs && tabs !== null && dirty !== null
        ? report(tabs, active, dirty)
        : null,
    [tabs, active, dirty]
  );
  useEffect(() => {
    if (!shellDrawsTabs) return;
    void shell.post({ type: "tabs", strip: picture });
  }, [picture]);
  useEffect(() => {
    if (!shellDrawsTabs) return;
    return () => void shell.post({ type: "tabs", strip: null });
  }, []);

  useEffect(() => {
    if (!shellDrawsTabs) return;
    return shell.subscribe((event) => {
      if (event.type !== "tabs" || latest.current === null) return;
      act(latest.current, event.action);
    });
  }, []);
}
