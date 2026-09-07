import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPrettier } from "./prettier-setup.ts";

const VERSION = "9.9.9-planted";

/** A Prettier install `directory` resolves to, reporting a version of its own. */
const plantPrettier = (directory: string) => {
  const packageDir = join(directory, "node_modules", "prettier");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "prettier", version: VERSION, main: "index.js" })
  );
  writeFileSync(join(packageDir, "index.js"), "module.exports = {}\n");
};

const write = (root: string, path: string, contents: string) => {
  const full = join(root, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, contents);
};

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reviewer-prettier-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("detectPrettier", () => {
  it("reports a project that does not use Prettier", () => {
    const setup = detectPrettier(root);
    expect(setup.available).toBe(false);
    expect(setup.version).toBeNull();
    expect(setup.configPath).toBeNull();
  });

  it("finds a configuration file at the root", () => {
    write(root, ".prettierrc", "{}");
    plantPrettier(root);
    const setup = detectPrettier(root);
    expect(setup).toMatchObject({
      available: true,
      version: VERSION,
      configPath: ".prettierrc",
    });
  });

  /**
   * The root of a monorepo declares no dependencies at all, so the version has
   * to come from the package that holds the configuration.
   */
  it("finds a package's own configuration and the Prettier beside it", () => {
    write(root, "packages/web/prettier.config.js", "export default {}");
    plantPrettier(join(root, "packages", "web"));
    const setup = detectPrettier(root);
    expect(setup).toMatchObject({
      available: true,
      version: VERSION,
      configPath: "packages/web/prettier.config.js",
    });
  });

  it("reads the package.json key when nothing else configures Prettier", () => {
    write(root, "package.json", JSON.stringify({ prettier: { semi: false } }));
    plantPrettier(root);
    expect(detectPrettier(root).configPath).toBe("package.json");
  });

  it("ignores a dependency that merely installs Prettier", () => {
    write(
      root,
      "package.json",
      JSON.stringify({ devDependencies: { prettier: "3" } })
    );
    plantPrettier(root);
    const setup = detectPrettier(root);
    expect(setup.available).toBe(true);
    expect(setup.configPath).toBeNull();
    expect(setup.detail).toContain("defaults");
  });

  it("does not mistake a dependency's own configuration for the project's", () => {
    write(root, "node_modules/some-package/.prettierrc", "{}");
    expect(detectPrettier(root).configPath).toBeNull();
  });

  it("stops before configuration buried deeper than a package", () => {
    write(root, "a/b/c/d/.prettierrc", "{}");
    expect(detectPrettier(root).configPath).toBeNull();
  });
});
