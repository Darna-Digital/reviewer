export interface SpaSnapshotVariant {
  html: string;
  css: string;
  fontCss: string;
  shadowSheets: Record<string, string>;
  htmlAttrs: Record<string, string>;
  bodyAttrs: Record<string, string>;
  rootWidth: number;
  rootHeight: number;
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
  exclude: Array<string>;
  width: number;
  height: number;
  fonts: "skip" | "inline";
  inlineAssetMaxBytes: number;
}
