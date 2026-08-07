/**
 * `browser-pane` feature — the split beside the app canvas that runs the site
 * under review, opened from the window bar's globe.
 *
 * Native shell only: the pane is an Electron `<webview>`, which is what lets the
 * app read the guest's DOM and paint the element picker over it. An iframe could
 * do neither across origins, so in a plain browser tab the pane never renders.
 */

/**
 * The subset of Electron's `WebviewTag` the pane uses. Declared structurally
 * rather than imported so the SPA keeps no dependency on `electron` — the tag is
 * only ever present in the native shell anyway.
 */
export interface WebviewElement extends HTMLElement {
  src: string;
  loadURL: (url: string) => Promise<void>;
  getURL: () => string;
  getTitle: () => string;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  reload: () => void;
  stop: () => void;
  isLoading: () => boolean;
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
  capturePage: (rect?: PickedRect) => Promise<{ toDataURL: () => string }>;
}

export interface PickedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a click in comment mode captured about the element under the pointer. */
export interface PickedElement {
  readonly selector: string;
  readonly label: string;
  readonly rect: PickedRect;
  readonly url: string;
  readonly viewport: { readonly width: number; readonly height: number };
}

/** A picked element plus the screenshot taken of it, awaiting a comment body. */
export interface VisualCommentDraft extends PickedElement {
  readonly screenshot: string | null;
}

/**
 * "browse" is the ordinary pane; in "picking" the guest is running the element
 * picker and the next click there becomes a draft instead of reaching the page.
 */
export type BrowserPaneMode = "browse" | "picking";

export interface BrowserPaneState {
  /** The address bar's committed location — what the webview is asked to show. */
  readonly url: string;
  readonly title: string;
  readonly loading: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly mode: BrowserPaneMode;
  readonly draft: VisualCommentDraft | null;
}
