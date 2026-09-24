/**
 * Which files the code view types into. Code is read here and written by the
 * agents; the one exception is a `.env` file — `.env`, `.env.local`,
 * `.env.production` and the like — which holds the secrets and switches no
 * agent should be handed, so it is edited in place.
 */
const ENV_FILE = /^\.env(\..+)?$/;

export const isEditablePath = (path: string): boolean =>
  ENV_FILE.test(path.split("/").at(-1) ?? "");
