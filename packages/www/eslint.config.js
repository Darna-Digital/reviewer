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
    },
  },
  {
    ignores: [
      "eslint.config.js",
      "prettier.config.js",
      // Snippets evaluated inside the captured page, not modules of this app.
      "scripts/capture-spa/prepare/**",
      "src/routeTree.gen.ts",
    ],
  },
];
