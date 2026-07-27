/** The trailing segment a folder is known by, e.g. "/a/b/web-app" → "web-app". */
export function pathName(path: string): string {
  const trimmed = path.replace(/\/+$/, "")
  return trimmed.split("/").at(-1) ?? trimmed
}

/** The full path as a person reads it: "/Users/ada/code/web-app" → "~/code/web-app". */
export function displayPath(path: string, home: string | undefined): string {
  if (home === undefined || home.length === 0) return path
  if (path === home) return "~"
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`
  return path
}
