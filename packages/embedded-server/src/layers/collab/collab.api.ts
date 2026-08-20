/**
 * The collaboration HTTP surface.
 *
 * Grouped by what a page asks for rather than by table: `/collab/home` is the
 * projects list with its counts, `/collab/projects/:id` is a project with its
 * work beside it, `/collab/projects/:id/board` is that work dealt into columns,
 * and `/collab/mine` is one person's slice of all of it. Each is a single round
 * trip because each is a single screen — a page that had to stitch four
 * responses together could show four different moments at once.
 *
 * Writes stay at the level of the row they touch, and each returns the thing it
 * changed: a card comes back from a move, a project comes back from a list
 * edit, so a client re-renders from the answer rather than re-asking.
 */
import * as Schema from "effect/Schema";
import {
  NoRepoSelected,
  NotFound,
  Ok,
  StorageError,
} from "@byconvo/core/shared";
import {
  CollabBoardColumn,
  CollabBookmark,
  CollabIdParam,
  CollabMine,
  CollabNote,
  CollabProject,
  CollabProjectDetail,
  CollabProjectListParams,
  CollabProjectSummary,
  CollabTodo,
  NewCollabBookmark,
  NewCollabList,
  NewCollabNote,
  NewCollabProject,
  NewCollabTodo,
  UpdateCollabList,
  UpdateCollabNote,
  UpdateCollabProject,
  UpdateCollabTodo,
  ViewerQuery,
} from "@byconvo/core/collab";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [NoRepoSelected, NotFound, StorageError] as const;

/**
 * Un-starring names what it points at rather than the row's own id: a client
 * holding a starred project has the project, not the bookmark, and looking the
 * bookmark up first would be a round trip spent to learn something the toggle
 * already knows.
 */
const BookmarkTargetParams = Schema.Struct({
  kind: Schema.String,
  targetId: Schema.String,
});

export class CollabApi extends HttpApiGroup.make("collab")
  .add(
    HttpApiEndpoint.get("home", "/collab/home", {
      success: Schema.Array(CollabProjectSummary),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("mine", "/collab/mine", {
      query: ViewerQuery,
      success: CollabMine,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("createProject", "/collab/projects", {
      payload: NewCollabProject,
      success: CollabProject,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("project", "/collab/projects/:id", {
      params: CollabIdParam,
      success: CollabProjectDetail,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("updateProject", "/collab/projects/:id", {
      params: CollabIdParam,
      payload: UpdateCollabProject,
      success: CollabProject,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("removeProject", "/collab/projects/:id", {
      params: CollabIdParam,
      success: Ok,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("board", "/collab/projects/:id/board", {
      params: CollabIdParam,
      success: Schema.Array(CollabBoardColumn),
      error: errors,
    })
  )
  // Lists — the to-do lists a project reads down and the columns its board
  // reads across. Each returns the project, whose `lists` is the whole answer.
  .add(
    HttpApiEndpoint.post("addList", "/collab/projects/:id/lists", {
      params: CollabIdParam,
      payload: NewCollabList,
      success: CollabProject,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")(
      "updateList",
      "/collab/projects/:id/lists/:listId",
      {
        params: CollabProjectListParams,
        payload: UpdateCollabList,
        success: CollabProject,
        error: errors,
      }
    )
  )
  .add(
    HttpApiEndpoint.make("DELETE")(
      "removeList",
      "/collab/projects/:id/lists/:listId",
      {
        params: CollabProjectListParams,
        success: CollabProject,
        error: errors,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("createTodo", "/collab/projects/:id/todos", {
      params: CollabIdParam,
      payload: NewCollabTodo,
      success: CollabTodo,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("updateTodo", "/collab/todos/:id", {
      params: CollabIdParam,
      payload: UpdateCollabTodo,
      success: CollabTodo,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("removeTodo", "/collab/todos/:id", {
      params: CollabIdParam,
      success: Ok,
      error: errors,
    })
  )
  // Notes. A note is a doc — id, title, markdown, last written — so these are
  // the doc endpoints under another name, with a project to hang off.
  .add(
    HttpApiEndpoint.get("notes", "/collab/notes", {
      success: Schema.Array(CollabNote),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("createNote", "/collab/notes", {
      payload: NewCollabNote,
      success: CollabNote,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("note", "/collab/notes/:id", {
      params: CollabIdParam,
      success: CollabNote,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PUT")("updateNote", "/collab/notes/:id", {
      params: CollabIdParam,
      payload: UpdateCollabNote,
      success: CollabNote,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("removeNote", "/collab/notes/:id", {
      params: CollabIdParam,
      success: Ok,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("addBookmark", "/collab/bookmarks", {
      payload: NewCollabBookmark,
      success: CollabBookmark,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")(
      "removeBookmark",
      "/collab/bookmarks/:kind/:targetId",
      {
        params: BookmarkTargetParams,
        success: Ok,
        error: errors,
      }
    )
  ) {}
