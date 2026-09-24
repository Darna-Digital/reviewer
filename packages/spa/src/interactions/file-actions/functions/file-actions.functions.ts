/** The path spellings the tree and the API disagree about. */

/** The tree writes directories as `src/`; the API takes plain repo paths. */
export const withoutTrailingSlash = (path: string): string =>
  path.endsWith("/") ? path.slice(0, -1) : path;
