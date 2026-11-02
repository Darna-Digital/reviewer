import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase } from "../db/database.ts";
import {
  createWorkspace,
  deleteWorkspace,
  findWorkspace,
  listWorkspaces,
  markWorkspaceOpened,
  updateWorkspace,
} from "./saved-workspaces.ts";

const API = "/home/dev/api";
const WEB = "/home/dev/web";
const DOCS = "/home/dev/docs";

beforeEach(() => openDatabase(":memory:"));
afterEach(closeDatabase);

describe("saved workspaces", () => {
  it("keeps the roots in the order they were given", () => {
    const created = createWorkspace("Darna", [WEB, API]);
    expect(findWorkspace(created.id)?.roots).toEqual([WEB, API]);
    expect(created.openedAt).toBeNull();
  });

  it("replaces the roots as a whole and renames", () => {
    const { id } = createWorkspace("Darna", [API, WEB]);
    const updated = updateWorkspace(id, {
      name: "Darna 2",
      roots: [DOCS, API],
    });
    expect(updated?.name).toBe("Darna 2");
    expect(updated?.roots).toEqual([DOCS, API]);
  });

  it("answers undefined for a workspace that is not there", () => {
    expect(updateWorkspace("missing", { name: "x" })).toBeUndefined();
    expect(deleteWorkspace("missing")).toBe(false);
  });

  it("deletes a workspace together with its roots", () => {
    const { id } = createWorkspace("Darna", [API, WEB]);
    expect(deleteWorkspace(id)).toBe(true);
    expect(findWorkspace(id)).toBeUndefined();
    expect(createWorkspace("Again", [API]).roots).toEqual([API]);
  });

  it("lists the most recently opened first, never-opened after", () => {
    const never = createWorkspace("Never", [DOCS]);
    const opened = createWorkspace("Opened", [API]);
    markWorkspaceOpened(opened.id);
    expect(listWorkspaces().map((workspace) => workspace.id)).toEqual([
      opened.id,
      never.id,
    ]);
  });
});
