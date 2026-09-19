/**
 * Showing a project path in the operating system's file manager. The server
 * does the revealing — it is the process that knows where the project sits on
 * disk — so from here it is one call, and a failure is a toast.
 */
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";
import { errorReason } from "@/lib/errors";
import { withoutTrailingSlash } from "../functions/file-actions.functions";

export async function revealPath(path: string): Promise<void> {
  const { error } = await fetchClient.POST("/api/file/reveal", {
    body: { path: withoutTrailingSlash(path) },
  });
  if (error) toast.error(errorReason(error, `Could not reveal ${path}`));
}
