import { vi } from "vitest";
import type { FileActionsDependencies } from "../interfaces/file-actions.interfaces";

export const createFileActionsDependenciesMock = (
  overrides?: Partial<FileActionsDependencies["sideEffects"]>,
  pendingFolders: ReadonlyArray<string> = []
): FileActionsDependencies => ({
  data: { pendingFolders },
  sideEffects: {
    create: vi.fn(async () => undefined),
    rememberFolder: vi.fn(),
    openFile: vi.fn(),
    notifyError: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  },
});
