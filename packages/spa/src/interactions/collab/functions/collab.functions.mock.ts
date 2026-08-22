/**
 * The side effects, recorded rather than performed — so a test can assert what
 * a rule decided to send, which is the whole of what these rules do.
 */
import type {
  CollabBookmark,
  CollabNote,
  CollabProject,
  CollabTodo,
} from "@byconvo/core/collab";
import type { CollabDependencies } from "../interfaces/collab.interfaces";

export interface CollabCalls {
  readonly createProject: Array<[string, string]>;
  readonly createTodo: Array<[string, string, string]>;
  readonly updateTodo: Array<[string, Record<string, unknown>]>;
  readonly removeTodo: Array<string>;
  readonly addList: Array<[string, string]>;
  readonly createNote: Array<[string, string]>;
  readonly saveNote: Array<[string, string]>;
  readonly removeNote: Array<string>;
  readonly addBookmark: Array<[string, string, string]>;
  readonly removeBookmark: Array<[string, string]>;
}

export const mockProject = (
  over: Partial<CollabProject> = {}
): CollabProject => ({
  id: "p1",
  name: "Redesign",
  purpose: "",
  color: "#f97316",
  lists: [
    { id: "todo", name: "To do", order: 0, color: "#8b5cf6" },
    { id: "doing", name: "In progress", order: 1, color: "#f59e0b" },
    { id: "done", name: "Done", order: 2, color: "#22c55e" },
  ],
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

export const mockTodo = (over: Partial<CollabTodo> = {}): CollabTodo => ({
  id: "t1",
  projectId: "p1",
  listId: "todo",
  title: "Sketch the layout",
  notes: "",
  assignee: "",
  done: false,
  dueOn: "",
  order: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

export const mockNote = (over: Partial<CollabNote> = {}): CollabNote => ({
  id: "n1",
  projectId: "",
  title: "Scratch",
  content: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

export const mockBookmark = (
  over: Partial<CollabBookmark> = {}
): CollabBookmark => ({
  id: "b1",
  kind: "project",
  targetId: "p1",
  label: "Redesign",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

export function createMockCollabDependencies(): {
  readonly deps: CollabDependencies;
  readonly calls: CollabCalls;
} {
  const calls: CollabCalls = {
    createProject: [],
    createTodo: [],
    updateTodo: [],
    removeTodo: [],
    addList: [],
    createNote: [],
    saveNote: [],
    removeNote: [],
    addBookmark: [],
    removeBookmark: [],
  };

  const deps: CollabDependencies = {
    data: {},
    sideEffects: {
      createProject: async (name, purpose) => {
        calls.createProject.push([name, purpose]);
        return mockProject({ name, purpose });
      },
      createTodo: async (projectId, title, listId) => {
        calls.createTodo.push([projectId, title, listId]);
        return mockTodo({ projectId, title, listId });
      },
      updateTodo: async (id, patch) => {
        calls.updateTodo.push([id, patch]);
        return mockTodo({ id, ...patch });
      },
      removeTodo: async (id) => {
        calls.removeTodo.push(id);
      },
      addList: async (projectId, name) => {
        calls.addList.push([projectId, name]);
        return mockProject({ id: projectId });
      },
      createNote: async (title, projectId) => {
        calls.createNote.push([title, projectId]);
        return mockNote({ title, projectId });
      },
      saveNote: async (id, content) => {
        calls.saveNote.push([id, content]);
        return mockNote({ id, content });
      },
      removeNote: async (id) => {
        calls.removeNote.push(id);
      },
      addBookmark: async (kind, targetId, label) => {
        calls.addBookmark.push([kind, targetId, label]);
        return mockBookmark({ kind, targetId, label });
      },
      removeBookmark: async (kind, targetId) => {
        calls.removeBookmark.push([kind, targetId]);
      },
    },
  };

  return { deps, calls };
}
