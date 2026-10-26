//  @ts-check

import baseConfig from "@reviewer/lint/eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...baseConfig,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The browser's own dialogs look nothing like the app, put their buttons
      // in the platform's order rather than ours, and block the renderer while
      // they are up — which in the desktop shell freezes the window. Ask with
      // `confirm`/`askForText` from `@/components/ui/alerts`, or `toast` from
      // sonner when nothing needs answering.
      "no-restricted-globals": [
        "error",
        {
          name: "alert",
          message:
            "Use toast() from sonner, or confirm() from @/components/ui/alerts.",
        },
        {
          name: "confirm",
          message: "Use confirm() from @/components/ui/alerts.",
        },
        {
          name: "prompt",
          message: "Use askForText() from @/components/ui/alerts.",
        },
      ],
    },
  },
  {
    ignores: ["eslint.config.js", "prettier.config.js", "src/routeTree.gen.ts"],
  },
];
