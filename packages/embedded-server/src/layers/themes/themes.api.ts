/**
 * HTTP endpoints for the theme catalog: the list a picker shows, one theme
 * resolved to the chrome a shell paints its window in, and a snippet
 * coloured in it. The macOS shell reads all three — it draws its own frame,
 * sidebar, panes and conversations, and has neither theme JSON nor a
 * grammar of its own to draw them from.
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import {
  HighlightedCode,
  HighlightRequest,
  ThemeChrome,
  ThemeDescriptor,
  ThemeNameParam,
  ThemeNotFound,
} from "@reviewer/core/themes";

export class ThemesApi extends HttpApiGroup.make("themes")
  .add(
    HttpApiEndpoint.get("list", "/themes", {
      success: Schema.Array(ThemeDescriptor),
    })
  )
  .add(
    HttpApiEndpoint.get("chrome", "/themes/:name", {
      params: ThemeNameParam,
      success: ThemeChrome,
      error: ThemeNotFound,
    })
  )
  .add(
    // A fenced snippet from a reply, read with Shiki's grammar for the
    // language the fence named and coloured by the theme — the tokens the
    // shell sets its own code in.
    HttpApiEndpoint.post("highlight", "/themes/:name/highlight", {
      params: ThemeNameParam,
      payload: HighlightRequest,
      success: HighlightedCode,
      error: ThemeNotFound,
    })
  ) {}
