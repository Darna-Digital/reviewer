/**
 * Hanging a captured page back up: the markup a card puts into its shadow root.
 *
 * A page was rendered inside a window, and a window is two elements the card
 * has not got — `html` and `body` carry the theme, the scrollbars and half the
 * app's own rules. So the card builds a stand-in for each, wearing the
 * attributes the real ones wore, and the captured rules are scoped to match
 * (see `preview-capture`). The pair are also what gives the page its size back:
 * it was laid out in a window, and the card is a smaller view of that window
 * rather than a narrower one.
 */
import {
  BODY_STAND_IN,
  ROOT_STAND_IN,
  type PreviewCapture,
} from "./preview-capture.functions";

const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");

/**
 * The stand-in's own attributes. The captured id is dropped: a picture is not
 * the page, and two of them in a window would be two of the same id.
 */
const standIn = (source: Record<string, string>, attribute: string): string =>
  [
    `${attribute}=""`,
    ...Object.entries(source)
      .filter(([name]) => name !== "id")
      .map(([name, value]) => `${name}="${escapeAttribute(value)}"`),
  ].join(" ");

const framing = ({ width, height }: PreviewCapture): string => `
  :host { display: block; }
  [${ROOT_STAND_IN}] {
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    color-scheme: inherit;
  }
  [${BODY_STAND_IN}] { width: 100%; height: 100%; margin: 0; }
  [${BODY_STAND_IN}] > * {
    width: ${width}px !important;
    height: ${height}px !important;
  }
`;

export const previewDocument = (capture: PreviewCapture): string =>
  [
    `<style>${framing(capture)}</style>`,
    `<div ${standIn(capture.rootAttrs, ROOT_STAND_IN)}>`,
    `<div ${standIn(capture.bodyAttrs, BODY_STAND_IN)}>`,
    capture.html,
    "</div></div>",
  ].join("");
