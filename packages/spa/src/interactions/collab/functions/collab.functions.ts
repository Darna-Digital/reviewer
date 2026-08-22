import { isBookmarked, sortedLists } from "@byconvo/core/collab";
import type {
  CollabDependencies,
  CollabFunctions,
} from "../interfaces/collab.interfaces";

export function createCollabFunctions(d: CollabDependencies): CollabFunctions {
  const createProject: CollabFunctions["createProject"] = async (
    name,
    purpose
  ) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return null;
    return d.sideEffects.createProject(trimmed, purpose.trim());
  };

  const createTodo: CollabFunctions["createTodo"] = async (
    projectId,
    title,
    listId
  ) => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return null;
    return d.sideEffects.createTodo(projectId, trimmed, listId);
  };

  const setDone: CollabFunctions["setDone"] = (todo, done, lists) => {
    const ordered = sortedLists(lists);
    // Whichever end of the board the tick means, said as a column as well as
    // as a flag. A project with one list has both ends in the same place,
    // which is the right answer there too.
    const listId = (done ? ordered.at(-1) : ordered[0])?.id ?? todo.listId;
    return d.sideEffects.updateTodo(todo.id, { done, listId });
  };

  const moveTodo: CollabFunctions["moveTodo"] = (todo, listId, order) =>
    d.sideEffects.updateTodo(todo.id, { listId, order });

  const renameTodo: CollabFunctions["renameTodo"] = async (todo, title) => {
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed === todo.title) return null;
    return d.sideEffects.updateTodo(todo.id, { title: trimmed });
  };

  const removeTodo: CollabFunctions["removeTodo"] = (id) =>
    d.sideEffects.removeTodo(id);

  const addList: CollabFunctions["addList"] = async (projectId, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return null;
    return d.sideEffects.addList(projectId, trimmed);
  };

  const createNote: CollabFunctions["createNote"] = (title, projectId) =>
    d.sideEffects.createNote(title.trim(), projectId);

  const saveNote: CollabFunctions["saveNote"] = (id, content) =>
    d.sideEffects.saveNote(id, content);

  const removeNote: CollabFunctions["removeNote"] = (id) =>
    d.sideEffects.removeNote(id);

  const toggleBookmark: CollabFunctions["toggleBookmark"] = async (
    bookmarks,
    kind,
    targetId,
    label
  ) => {
    if (isBookmarked(bookmarks, kind, targetId)) {
      await d.sideEffects.removeBookmark(kind, targetId);
      return false;
    }
    await d.sideEffects.addBookmark(kind, targetId, label);
    return true;
  };

  return {
    createProject,
    createTodo,
    setDone,
    moveTodo,
    renameTodo,
    removeTodo,
    addList,
    createNote,
    saveNote,
    removeNote,
    toggleBookmark,
  };
}
