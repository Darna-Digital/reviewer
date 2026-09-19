import { describe, expect, it } from "vitest";
import { isEditablePath } from "./editable-path";

describe("isEditablePath", () => {
  it("edits the .env files, wherever they sit", () => {
    expect(isEditablePath(".env")).toBe(true);
    expect(isEditablePath(".env.local")).toBe(true);
    expect(isEditablePath("apps/web/.env.production")).toBe(true);
  });

  it("reads everything else", () => {
    expect(isEditablePath("src/index.ts")).toBe(false);
    expect(isEditablePath("env.ts")).toBe(false);
    expect(isEditablePath(".envrc")).toBe(false);
    expect(isEditablePath("src/config/env")).toBe(false);
  });
});
