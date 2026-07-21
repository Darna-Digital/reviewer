import type { CommitFileChange, GitFileStatus } from "@byconvo/core/repo"
import type { CommitDetailsDependencies } from "../interfaces/commit-details.interfaces"

export const createCommitDetailsDependenciesMock =
  (): CommitDetailsDependencies => ({
    data: {},
    sideEffects: {},
  })

export const fakeFileChange = (
  path: string,
  status: GitFileStatus = "modified",
  oldPath: string | null = null
): CommitFileChange => ({ path, status, oldPath })
