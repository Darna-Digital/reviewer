import { vi } from "vitest";
import type { WorkspaceInfo } from "@byconvo/core/workspace";
import type { WorkspaceDependencies } from "../interfaces/workspace.interfaces";

/** A project holding a backend and a frontend, opened on the backend. */
export const multiRepoWorkspace: WorkspaceInfo = {
  project: "/work",
  repos: [
    { name: "backend", path: "/work/backend", branch: "main" },
    { name: "frontend", path: "/work/frontend", branch: "main" },
  ],
  current: "/work/backend",
  currentRoot: "/work/backend",
  recents: ["/work"],
  home: "/home/ada",
  device: "Ada's MacBook Pro",
};

export const createWorkspaceDependenciesMock = (
  overrides?: Partial<WorkspaceDependencies["sideEffects"]>
): WorkspaceDependencies => ({
  data: {},
  sideEffects: {
    setProject: vi.fn(async () => multiRepoWorkspace),
    setRepo: vi.fn(async () => ({
      ...multiRepoWorkspace,
      current: "/work/frontend",
    })),
    cacheWorkspace: vi.fn(),
    refreshRepo: vi.fn(async () => {}),
    settle: vi.fn(async () => {}),
    invalidateAll: vi.fn(async () => {}),
    notifyError: vi.fn(),
    ...overrides,
  },
});
