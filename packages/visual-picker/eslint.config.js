// @ts-check

import baseConfig from "@byconvo/lint/eslint"

export default [
  ...baseConfig,
  {
    ignores: [
      "eslint.config.js",
      "prettier.config.js",
      "vitest.config.ts",
      "src/bundle.generated.ts",
    ],
  },
]
