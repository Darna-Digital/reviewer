// @ts-check

import baseConfig from "@byconvo/lint/eslint"

export default [
  ...baseConfig,
  {
    ignores: [
      "dist",
      "drizzle.config.ts",
      "drizzle",
      "eslint.config.js",
      "prettier.config.js",
      "vitest.config.ts",
    ],
  },
]
