/**
 * The Prettier formatter — the project's own copy, run over one buffer.
 *
 * Two things it deliberately does not do. It never formats what is on disk: the
 * buffer travels in, so saving an unsaved file formats what the user is looking
 * at. And it declines rather than fails for a file Prettier has no parser for
 * or an ignore file excludes — most repositories format some of their files and
 * not others, and a save is not the place to be told so.
 */
import * as Effect from "effect/Effect";
import { dirname, join } from "node:path";
import {
  FormatError,
  type Formatter,
  type FormatterSetup,
  type FormatRequest,
  type FormattedDocument,
} from "@reviewer/core/ports/formatter";
import { loadPrettier, resolvePlugins } from "./prettier-module.ts";
import { detectPrettier } from "./prettier-setup.ts";

const FORMATTER_ID = "prettier";

const DECLINED: FormattedDocument = { contents: null };

const failure = (reason: string) =>
  new FormatError({ formatterId: FORMATTER_ID, reason });

const format = (
  request: FormatRequest
): Effect.Effect<FormattedDocument, FormatError> =>
  Effect.tryPromise({
    try: async () => {
      const file = join(request.root, request.path);
      const prettier = loadPrettier(dirname(file), request.root);
      if (prettier === null) return DECLINED;

      const configFile = await prettier.resolveConfigFile(file);
      const config =
        (await prettier.resolveConfig(file, {
          editorconfig: true,
        })) ?? {};
      const plugins = resolvePlugins(
        config["plugins"],
        dirname(configFile ?? file)
      );

      // Both the repository's ignore file and the one beside the configuration
      // that governs this file — a monorepo package excludes its own generated
      // code, and the root knows nothing about it.
      const ignorePaths = [
        join(request.root, ".prettierignore"),
        ...(configFile === null
          ? []
          : [join(dirname(configFile), ".prettierignore")]),
      ];

      const info = await prettier.getFileInfo(file, {
        ignorePath: ignorePaths,
        plugins,
      });
      if (info.ignored || info.inferredParser === null) return DECLINED;

      return {
        contents: await prettier.format(request.contents, {
          ...config,
          plugins,
          filepath: file,
        }),
      };
    },
    catch: (cause) =>
      failure(cause instanceof Error ? cause.message : String(cause)),
  });

export const prettierFormatter: Formatter = {
  id: FORMATTER_ID,
  name: "Prettier",
  probe: (root: string): Effect.Effect<FormatterSetup> =>
    Effect.sync(() => detectPrettier(root)),
  format,
};
