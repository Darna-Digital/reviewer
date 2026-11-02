/**
 * The app's toasts — what an action came to, a save, a request the server
 * refused — handed to the shell, which draws them.
 *
 * The page is an island under the macOS shell's own chrome, and the shell keeps
 * a stack of notices at the foot of the window (`Notices` in packages/mac-os):
 * a toast drawn in the web view would be clipped by it and stand under the
 * native pane, so the page draws none of its own. Absent the shell the channel
 * has nobody on the other end, and a toast goes unsaid.
 */
import { shell } from "@/lib/shell";

export type NotifyKind = "success" | "error" | "info";

export interface NotifyOptions {
  /** Prose under the title, muted — the reason, or what to try next. */
  readonly description?: string;
}

const post = (kind: NotifyKind, title: string, options?: NotifyOptions) =>
  void shell.post({
    type: "notice",
    kind,
    title,
    detail: options?.description ?? null,
  });

export const notify = {
  success: (title: string, options?: NotifyOptions) =>
    post("success", title, options),
  error: (title: string, options?: NotifyOptions) =>
    post("error", title, options),
  info: (title: string, options?: NotifyOptions) =>
    post("info", title, options),
};
