/**
 * HTTP endpoints for the theme catalog: the list a picker shows, and one
 * theme resolved to the chrome a shell paints its window in. The macOS
 * shell reads both — it draws its own frame, sidebar and panes, and has no
 * theme JSON of its own to draw them from.
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import {
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
  ) {}
