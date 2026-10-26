import baseConfig from '@reviewer/lint/prettier';

/** @type {import("prettier").Config} */
export default {
  ...baseConfig,
  singleQuote: true,
  trailingComma: 'all',
};
