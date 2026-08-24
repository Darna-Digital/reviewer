import { vi } from "vitest";
import { EMPTY_HISTORY } from "./file-actions.functions";
import type {
  FileActionsDependencies,
  FileHistory,
} from "../interfaces/file-actions.interfaces";

export const createFileActionsDependenciesMock = (
  overrides?: Partial<FileActionsDependencies["sideEffects"]>,
  data?: Partial<FileActionsDependencies["data"]>
): FileActionsDependencies => ({
  data: { pendingFolders: [], history: EMPTY_HISTORY, ...data },
  sideEffects: {
    create: vi.fn(async () => undefined),
    move: vi.fn(async () => undefined),
    copy: vi.fn(async () => undefined),
    upload: vi.fn(async () => undefined),
    // The real trash numbers its slots; the double keeps that shape, so the
    // steps that undo a delete are the ones the app would really run.
    trash: vi.fn(async (path: string) => `.byconvo/trash/1/${path}`),
    reveal: vi.fn(async () => undefined),
    rememberFolder: vi.fn(),
    openFile: vi.fn(),
    record: vi.fn(),
    notify: vi.fn(),
    notifyError: vi.fn(),
    confirm: vi.fn(() => Promise.resolve(true)),
    refresh: vi.fn(),
    ...overrides,
  },
});

/**
 * The same dependencies over a history that recorded changes are written into,
 * so a test can undo what it just did. `deps()` is read again after each change
 * because the functions close over the history they were built with — which is
 * what the hook does when its state moves on.
 */
export const createFileActionsHistoryMock = (
  overrides?: Partial<FileActionsDependencies["sideEffects"]>
) => {
  let history: FileHistory = EMPTY_HISTORY;
  const base = createFileActionsDependenciesMock({
    record: (next) => void (history = next),
    ...overrides,
  });
  return {
    sideEffects: base.sideEffects,
    deps: (): FileActionsDependencies => ({
      data: { ...base.data, history },
      sideEffects: base.sideEffects,
    }),
    read: () => history,
  };
};
