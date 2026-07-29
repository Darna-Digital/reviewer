import {
  Conflict,
  Forbidden,
  InvalidInput,
  NotFound,
  StorageError,
  Unauthorized,
} from "@byconvo/core/shared"

/**
 * Every workspace endpoint can fail these six ways, so they are declared once
 * and shared. Listing them on the API is what puts them in the generated
 * OpenAPI document — and therefore in the SPA's typed client, where the UI can
 * tell "you are signed out" apart from "that name is taken".
 */
export const workspaceErrors = [
  Unauthorized,
  Forbidden,
  NotFound,
  Conflict,
  InvalidInput,
  StorageError,
] as const
