import { describe, expect, it } from "vitest";
import {
  parsePhpstanOutput,
  parsePhpstanScope,
  phpstanCovers,
  phpstanFor,
  toPhpstanDiagnostic,
} from "./phpstan.ts";

describe("parsePhpstanOutput", () => {
  it("reads PHPStan's documented JSON, after anything printed before it", () => {
    const output = `Note: Using configuration file phpstan.neon.
{"totals":{"errors":0,"file_errors":1},"files":{"/app/a.php":{"errors":1,"messages":[{"message":"Function nope not found.","line":3,"ignorable":true,"tip":"Learn more at https://phpstan.org","identifier":"function.notFound"}]}},"errors":[]}`;
    expect(parsePhpstanOutput(output)).toEqual([
      {
        line: 3,
        message: "Function nope not found.",
        identifier: "function.notFound",
        tip: "Learn more at https://phpstan.org",
      },
    ]);
  });

  it("reads the shape it switches to under an AI agent's environment", () => {
    const output = `{"tool":"phpstan","result":"failed","errors":1,"error_details":{"/app/a.php":[{"line":1,"message":"Oops.","identifier":"x.y"}]}}`;
    expect(parsePhpstanOutput(output)).toEqual([
      { line: 1, message: "Oops.", identifier: "x.y", tip: null },
    ]);
  });

  it("answers nothing for output that is not a report", () => {
    expect(parsePhpstanOutput("")).toEqual([]);
    expect(parsePhpstanOutput("PHP Fatal error: {oops")).toEqual([]);
  });
});

describe("toPhpstanDiagnostic", () => {
  it("covers the line's code and keeps a tip that says something", () => {
    const diagnostic = toPhpstanDiagnostic(
      {
        line: 2,
        message: "Cannot access property $name on App\\Models\\User|null.",
        identifier: "property.nonObject",
        tip: "Use ?-> instead.",
      },
      "<?php\n    $user->name;   \n"
    );
    expect(diagnostic.range).toEqual({
      start: { line: 1, character: 4 },
      end: { line: 1, character: 16 },
    });
    expect(diagnostic.source).toBe("phpstan");
    expect(diagnostic.code).toBe("property.nonObject");
    expect(diagnostic.message).toContain("Use ?-> instead.");
  });

  it("drops a tip that only points at the docs", () => {
    expect(
      toPhpstanDiagnostic(
        { line: 1, message: "M.", identifier: null, tip: "Learn more at x" },
        "<?php"
      ).message
    ).toBe("M.");
  });
});

describe("phpstanFor", () => {
  it("needs both the binary and a config the app wrote", () => {
    const binary = "/app/vendor/bin/phpstan";
    expect(
      phpstanFor("/app", (p) => p === binary || p === "/app/phpstan.neon.dist")
    ).toBe(binary);
    expect(phpstanFor("/app", (p) => p === binary)).toBeNull();
    expect(phpstanFor("/app", (p) => p === "/app/phpstan.neon")).toBeNull();
  });
});

describe("phpstanCovers", () => {
  const scope = parsePhpstanScope(
    `Note: Using configuration file phpstan.neon.
{"paths":["/app/app","/app/bootstrap/app.php","routes"],"excludePaths":{"analyse":["/app/app/Legacy","/app/app/*/Generated/*.php"],"analyseAndScan":[]},"level":"max"}`,
    "/app"
  );

  it("analyses only what the app's own config analyses", () => {
    expect(scope).not.toBeNull();
    if (scope === null) return;
    expect(phpstanCovers(scope, "/app/app/Models/User.php")).toBe(true);
    expect(phpstanCovers(scope, "/app/bootstrap/app.php")).toBe(true);
    // A relative path is the app's.
    expect(phpstanCovers(scope, "/app/routes/web.php")).toBe(true);
    // Tests a project does not analyse stay unanalysed.
    expect(phpstanCovers(scope, "/app/tests/Feature/AvatarTest.php")).toBe(
      false
    );
    expect(phpstanCovers(scope, "/app/application/x.php")).toBe(false);
  });

  it("leaves out excluded directories and globs", () => {
    if (scope === null) return;
    expect(phpstanCovers(scope, "/app/app/Legacy/Old.php")).toBe(false);
    expect(phpstanCovers(scope, "/app/app/Api/Generated/Client.php")).toBe(
      false
    );
    expect(phpstanCovers(scope, "/app/app/Api/Client.php")).toBe(true);
  });

  it("reads the plain-list excludes of older configs", () => {
    const old = parsePhpstanScope(
      '{"paths":["/app/src"],"excludePaths":["/app/src/vendor"]}',
      "/app"
    );
    expect(old?.excludes).toEqual(["/app/src/vendor"]);
  });

  it("answers null for output that is not parameters", () => {
    expect(
      parsePhpstanScope('Command "dump-parameters" is not defined.', "/app")
    ).toBeNull();
  });
});
