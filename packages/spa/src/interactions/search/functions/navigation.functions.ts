/**
 * Pages that can show a file themselves — the diff shells. Opening a search
 * result from one of these keeps you where you are (reviewing a pull request
 * stays a review); opening one from a chat or a doc has to go somewhere that
 * can show code.
 */
const FILE_VIEWING_ROUTES = ["/modes/code/review", "/modes/code/browse"];

/** Where a file opens when the current page has nowhere to put it. */
export const FILE_FALLBACK_ROUTE = "/modes/code/review";

export const opensFileInPlace = (pathname: string): boolean =>
  FILE_VIEWING_ROUTES.some((route) => pathname.startsWith(route));
