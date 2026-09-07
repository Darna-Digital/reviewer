/** A region of the captured element, in its own pixels. */
export interface SpaSnapshotRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SpaSnapshotVariant {
  html: string;
  css: string;
  fontCss: string;
  shadowSheets: Record<string, string>;
  htmlAttrs: Record<string, string>;
  bodyAttrs: Record<string, string>;
  rootWidth: number;
  rootHeight: number;
  /** Set when captured with `--focus`: the part of the app to show. */
  focus: SpaSnapshotRegion | null;
  viewport: { width: number; height: number };
  nodes: number;
  droppedNodes: number;
  fontFamilies: Array<string>;
  warnings: Array<string>;
}

export interface SpaSnapshotFile {
  url: string;
  selector: string;
  capturedAt: string;
  variants: Record<SpaSnapshotScheme, SpaSnapshotVariant>;
}

export type SpaSnapshotScheme = "light" | "dark";

export interface CaptureOptions {
  selector: string;
  /**
   * Region to show. The whole `selector` subtree is still captured, so every
   * rule that depends on an ancestor keeps applying — only the framing narrows.
   */
  focus: string | null;
  exclude: Array<string>;
  width: number;
  height: number;
  fonts: "skip" | "inline";
  inlineAssetMaxBytes: number;
}
