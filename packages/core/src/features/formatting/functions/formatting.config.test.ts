import { describe, expect, it } from "vitest";
import {
  declaresPrettierConfig,
  formatterDetail,
  isPrettierConfigFile,
  pickConfigPath,
} from "./formatting.config.ts";

describe("isPrettierConfigFile", () => {
  it("recognises the names Prettier reads", () => {
    expect(isPrettierConfigFile(".prettierrc")).toBe(true);
    expect(isPrettierConfigFile("prettier.config.js")).toBe(true);
  });

  it("does not claim files that merely mention prettier", () => {
    expect(isPrettierConfigFile(".prettierignore")).toBe(false);
    expect(isPrettierConfigFile("prettier.md")).toBe(false);
  });
});

describe("pickConfigPath", () => {
  it("has nothing to say about a project without configuration", () => {
    expect(pickConfigPath([])).toBeNull();
  });

  it("prefers the shallowest file", () => {
    expect(
      pickConfigPath(["packages/spa/prettier.config.js", ".prettierrc"])
    ).toBe(".prettierrc");
  });

  it("breaks a tie on Prettier's own precedence", () => {
    expect(pickConfigPath(["prettier.config.js", ".prettierrc"])).toBe(
      ".prettierrc"
    );
  });

  it("reads a package.json key only when no dedicated file answers", () => {
    expect(pickConfigPath(["package.json", ".prettierrc"])).toBe(".prettierrc");
    expect(pickConfigPath(["package.json"])).toBe("package.json");
  });

  it("breaks a remaining tie on the path, so the answer is stable", () => {
    expect(
      pickConfigPath(["b/prettier.config.js", "a/prettier.config.js"])
    ).toBe("a/prettier.config.js");
  });
});

describe("declaresPrettierConfig", () => {
  it("finds the package.json key", () => {
    expect(declaresPrettierConfig('{"prettier":{"semi":false}}')).toBe(true);
  });

  it("ignores a package that only depends on prettier", () => {
    expect(declaresPrettierConfig('{"devDependencies":{"prettier":"3"}}')).toBe(
      false
    );
  });

  it("treats unreadable JSON as no configuration", () => {
    expect(declaresPrettierConfig("{ not json")).toBe(false);
  });
});

describe("formatterDetail", () => {
  it("says what is missing when Prettier is not installed", () => {
    expect(formatterDetail({ version: null, configPath: null })).toContain(
      "not installed"
    );
  });

  it("names the configuration file that was found", () => {
    expect(
      formatterDetail({ version: "3.9.6", configPath: "prettier.config.js" })
    ).toBe("Prettier v3.9.6 · prettier.config.js");
  });

  it("says the defaults apply when there is no configuration", () => {
    expect(formatterDetail({ version: "3.9.6", configPath: null })).toContain(
      "defaults"
    );
  });
});
