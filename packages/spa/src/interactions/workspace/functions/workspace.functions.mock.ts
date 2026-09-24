import { vi } from "vitest";
import type { WorkspaceInfo } from "@reviewer/core/workspace";
import type { WorkspaceDependencies } from "../interfaces/workspace.interfaces";

export const openWorkspace: WorkspaceInfo = {
  project: "/work/backend",
  branch: "main",
  recents: ["/work/backend"],
  home: "/home/ada",
};

export const createWorkspaceDependenciesMock = (
  overrides?: Partial<WorkspaceDependencies["sideEffects"]>
): WorkspaceDependencies => ({
  data: {},
  sideEffects: {
    setProject: vi.fn(async () => openWorkspace),
    cacheWorkspace: vi.fn(),
    refreshRepo: vi.fn(async () => {}),
    settle: vi.fn(async () => {}),
    invalidateAll: vi.fn(async () => {}),
    notifyError: vi.fn(),
    ...overrides,
  },
});
