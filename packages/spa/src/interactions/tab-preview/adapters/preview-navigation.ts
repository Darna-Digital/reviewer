/**
 * The preview end of the mill's channel: a page that answers to being sent
 * somewhere, so the frame it lives in never has to be reloaded.
 *
 * It is installed on the router rather than in a component, because it has to
 * be listening before anything is rendered — the mill asks for the next section
 * as soon as it has a picture of this one, which can be sooner than the tree
 * that would have mounted a listener.
 */
import type { AnyRouter } from "@tanstack/react-router";
import {
  asPreviewGoto,
  previewShown,
} from "../functions/preview-channel.functions";

export function answerPreviewNavigation(router: AnyRouter): void {
  if (typeof window === "undefined") return;

  window.addEventListener("message", (event: MessageEvent) => {
    // Only the window this preview is being rendered for. Nothing else has any
    // business steering it, and a frame that took directions from anywhere is
    // a frame the page under it can drive.
    if (event.source !== window.parent) return;
    const goto = asPreviewGoto(event.data);
    if (goto === null) return;

    const answer = () => {
      window.parent.postMessage(
        previewShown(goto.nonce),
        window.location.origin
      );
    };

    // Already there: the router has nothing to resolve, so waiting for it to
    // say so would be waiting for something that has already happened.
    if (router.state.location.href === goto.href) {
      answer();
      return;
    }

    const stop = router.subscribe("onResolved", () => {
      stop();
      answer();
    });
    // A navigation that will not happen leaves the mill waiting for an answer
    // it gives up on, and the next asking boots the frame afresh.
    void router.navigate({ href: goto.href }).catch(() => stop());
  });
}
