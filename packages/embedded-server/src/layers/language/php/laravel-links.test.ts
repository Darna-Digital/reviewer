import { describe, expect, it } from "vitest";
import {
  laravelAppRoot,
  laravelReferenceAt,
  laravelTargets,
  type LaravelFiles,
} from "./laravel-links.ts";

const APP = "/repo/backend";

/** A disk holding exactly `files`. */
const disk = (files: Readonly<Record<string, string>>): LaravelFiles => ({
  exists: (path) => path in files,
  readText: (path) => files[path] ?? null,
});

/** The reference under the `|` in `line`. */
const at = (line: string, blade = false) => {
  const character = line.indexOf("|");
  return laravelReferenceAt(
    line.replace("|", ""),
    { line: 0, character },
    { blade }
  );
};

describe("laravelReferenceAt", () => {
  it("reads the kind of thing a string names from its caller", () => {
    expect(at("return view('users.in|dex');")).toMatchObject({
      kind: "view",
      name: "users.index",
      range: { start: { character: 13 }, end: { character: 24 } },
    });
    expect(at("$name = config('app.na|me');")?.kind).toBe("config");
    expect(at("Config::string('app.na|me')")?.kind).toBe("config");
    expect(at("'key' => env('APP_|KEY'),")?.kind).toBe("env");
    expect(at("{{ __('auth.fa|iled') }}", true)?.kind).toBe("translation");
    expect(at("return Inertia::render('Users/In|dex');")?.kind).toBe("inertia");
  });

  it("follows Blade directives, including a view passed second", () => {
    expect(at("@include('partials.n|av')", true)?.name).toBe("partials.nav");
    expect(at("@extends('layouts.a|pp')", true)?.kind).toBe("view");
    expect(at("@includeWhen($admin, 'admin.ba|r')", true)?.name).toBe(
      "admin.bar"
    );
    expect(at("@includeFirst(['custom.admin', 'ad|min'])", true)?.name).toBe(
      "admin"
    );
    expect(at("Route::view('/welcome', 'wel|come');")?.name).toBe("welcome");
  });

  it("leaves strings that are not references alone", () => {
    expect(at("$config['app.na|me']")).toBeNull();
    expect(at("echo 'users.in|dex';")).toBeNull();
    expect(at("return vi|ew('users.index');")).toBeNull();
  });

  it("finds component and Livewire tags, in Blade only", () => {
    expect(at('<x-forms.in|put type="text" />', true)).toMatchObject({
      kind: "component",
      name: "forms.input",
    });
    expect(at("<livewire:cou|nter />", true)?.kind).toBe("livewire");
    expect(at('<x-sl|ot name="title">', true)).toBeNull();
    expect(at('<x-forms.in|put type="text" />', false)).toBeNull();
  });
});

describe("laravelTargets", () => {
  const ref = (
    kind: Parameters<typeof laravelTargets>[1]["kind"],
    name: string
  ) => ({
    kind,
    name,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
  });

  it("maps a view name to its Blade file", () => {
    const files = disk({
      [`${APP}/resources/views/users/index.blade.php`]: "",
    });
    expect(laravelTargets(APP, ref("view", "users.index"), files)).toEqual([
      { absolute: `${APP}/resources/views/users/index.blade.php`, line: 0 },
    ]);
    expect(laravelTargets(APP, ref("view", "mail::message"), files)).toEqual(
      []
    );
  });

  it("lands on the nested key a config name ends with", () => {
    const files = disk({
      [`${APP}/config/database.php`]: [
        "<?php",
        "return [",
        "    'default' => env('DB_CONNECTION', 'sqlite'),",
        "    'connections' => [",
        "        'mysql' => [",
        "            'host' => env('DB_HOST', '127.0.0.1'),",
      ].join("\n"),
    });
    expect(
      laravelTargets(
        APP,
        ref("config", "database.connections.mysql.host"),
        files
      )
    ).toEqual([{ absolute: `${APP}/config/database.php`, line: 5 }]);
    // A file with no such key still opens, at the top.
    expect(
      laravelTargets(APP, ref("config", "database.nope"), files)[0]?.line
    ).toBe(0);
  });

  it("finds an environment variable in .env, then in the example", () => {
    const files = disk({
      [`${APP}/.env`]: "APP_NAME=Laravel\nAPP_KEY=base64:x\n",
      [`${APP}/.env.example`]: "APP_NAME=Laravel\nAWS_BUCKET=\n",
    });
    expect(laravelTargets(APP, ref("env", "APP_KEY"), files)).toEqual([
      { absolute: `${APP}/.env`, line: 1 },
    ]);
    expect(laravelTargets(APP, ref("env", "AWS_BUCKET"), files)).toEqual([
      { absolute: `${APP}/.env.example`, line: 1 },
    ]);
  });

  it("reads keyed translations from the default locale's group file", () => {
    const files = disk({
      [`${APP}/config/app.php`]: "'locale' => env('APP_LOCALE', 'lt'),",
      [`${APP}/lang/lt/auth.php`]:
        "<?php\nreturn [\n    'failed' => 'Neteisingi',\n];",
      [`${APP}/lang/lt.json`]: '{\n  "Welcome back": "Sveiki"\n}',
    });
    expect(
      laravelTargets(APP, ref("translation", "auth.failed"), files)
    ).toEqual([{ absolute: `${APP}/lang/lt/auth.php`, line: 2 }]);
    expect(
      laravelTargets(APP, ref("translation", "Welcome back"), files)
    ).toEqual([{ absolute: `${APP}/lang/lt.json`, line: 1 }]);
  });

  it("prefers a class component, then an anonymous one", () => {
    const anonymous = `${APP}/resources/views/components/forms/input.blade.php`;
    const klass = `${APP}/app/View/Components/Forms/TextInput.php`;
    expect(
      laravelTargets(
        APP,
        ref("component", "forms.input"),
        disk({ [anonymous]: "" })
      )
    ).toEqual([{ absolute: anonymous, line: 0 }]);
    expect(
      laravelTargets(
        APP,
        ref("component", "forms.text-input"),
        disk({ [klass]: "" })
      )
    ).toEqual([{ absolute: klass, line: 0 }]);
  });

  it("finds an Inertia page whichever starter kit named the directory", () => {
    const page = `${APP}/resources/js/pages/Users/Index.tsx`;
    expect(
      laravelTargets(APP, ref("inertia", "Users/Index"), disk({ [page]: "" }))
    ).toEqual([{ absolute: page, line: 0 }]);
  });
});

describe("laravelAppRoot", () => {
  it("finds the app a monorepo keeps in a package", () => {
    const exists = (path: string) => path === `${APP}/artisan`;
    expect(laravelAppRoot("/repo", `${APP}/app/Models/User.php`, exists)).toBe(
      APP
    );
    expect(
      laravelAppRoot("/repo", "/repo/web/src/index.php", exists)
    ).toBeNull();
  });

  it("does not look above the repository", () => {
    expect(
      laravelAppRoot(
        "/repo/backend/app",
        `${APP}/app/User.php`,
        (path) => path === `${APP}/artisan`
      )
    ).toBeNull();
  });
});
