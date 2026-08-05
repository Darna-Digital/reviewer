/**
 * API errors come back as the server's tagged error body (`{ _tag, reason }`),
 * a thrown `Error`, or a bare string. Pull the human-readable part out of any
 * of them so the UI can show what actually went wrong instead of a generic
 * "could not load".
 */
export const errorReason = (error: unknown, fallback: string): string => {
  if (typeof error === "string" && error.trim().length > 0) return error;
  const shaped = error as { reason?: unknown; message?: unknown } | null;
  if (typeof shaped?.reason === "string" && shaped.reason.length > 0)
    return shaped.reason;
  if (typeof shaped?.message === "string" && shaped.message.length > 0)
    return shaped.message;
  return fallback;
};
