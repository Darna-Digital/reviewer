/**
 * Laravel's string-addressed references, followed without a language server.
 *
 * Most of what a Laravel app points at is named by a string: `view('users.index')`
 * is a Blade file, `config('app.name')` a key in `config/app.php`,
 * `__('auth.failed')` a line in a translation file, `<x-forms.input>` a
 * component. No PHP language server follows these — to intelephense they are
 * strings — and they are exactly the references a reviewer wants to check: does
 * the view this controller renders exist, what does that config key hold. This
 * is the part of "Laravel works" that ruby-lsp-rails is for Rails, done here by
 * convention because the conventions are fixed and few.
 *
 * Two halves, both pure apart from the injected file reads: finding the
 * reference under the cursor, and turning it into the files Laravel would load.
 * A reference that resolves to nothing is not an answer, so the caller falls
 * through to the language server and an ordinary PHP symbol still works.
 */
import type { Position, Range } from "@reviewer/core/language";

export type LaravelReferenceKind =
  | "view"
  | "config"
  | "env"
  | "translation"
  | "component"
  | "livewire"
  | "inertia";

export interface LaravelReference {
  readonly kind: LaravelReferenceKind;
  /** The name as written: `users.index`, `APP_KEY`, `forms.input`. */
  readonly name: string;
  /** The span the name occupies, which is what the UI underlines. */
  readonly range: Range;
}

/** A file and the line in it a reference lands on. */
export interface LaravelTarget {
  readonly absolute: string;
  readonly line: number;
}

/**
 * What precedes a string literal for it to name each kind of thing, matched
 * against the text before the opening quote. Each pattern ends at the quote, so
 * `config('a')` qualifies and `$config['a']` does not.
 *
 * Views are named by many callers — helpers, the facade, a mailable's builder
 * methods, Blade's directives — and some take the view as a later argument:
 * `@includeWhen($cond, 'view')`, `Route::view('/uri', 'view')`, the array of
 * `@includeFirst`. Those patterns allow the earlier argument and no more.
 */
const STRING_CALLERS: ReadonlyArray<{
  readonly kind: LaravelReferenceKind;
  readonly before: RegExp;
}> = [
  {
    kind: "view",
    before:
      /(?:\bview|View::(?:make|exists|first)|->(?:view|markdown|text)|@(?:include|includeIf|extends|each|component))\(\s*$/,
  },
  { kind: "view", before: /@include(?:When|Unless)\([^,]+,\s*$/ },
  {
    kind: "view",
    before: /@includeFirst\(\s*\[\s*(?:['"][^'"]*['"]\s*,\s*)*$/,
  },
  { kind: "view", before: /Route::view\(\s*['"][^'"]*['"]\s*,\s*$/ },
  {
    kind: "config",
    before:
      /(?:\bconfig(?:\(\)->(?:get|string|integer|float|boolean|array))?|Config::(?:get|has|string|integer|float|boolean|array))\(\s*$/,
  },
  { kind: "env", before: /\benv\(\s*$/ },
  {
    kind: "translation",
    before:
      /(?:\b__|\btrans|\btrans_choice|Lang::(?:get|has|choice)|@lang|@choice)\(\s*$/,
  },
  { kind: "inertia", before: /(?:Inertia::render|\binertia)\(\s*$/ },
  { kind: "inertia", before: /Route::inertia\(\s*['"][^'"]*['"]\s*,\s*$/ },
];

/** A quoted literal on a line: the span of its contents, quotes excluded. */
interface Literal {
  readonly start: number;
  readonly end: number;
  readonly quote: number;
}

/**
 * The single- and double-quoted literals on a line. Escapes are skipped so a
 * `\'` does not end a string early; a literal left open at the end of the line
 * is dropped, since a reference never spans lines.
 */
const literalsOn = (line: string): ReadonlyArray<Literal> => {
  const found: Array<Literal> = [];
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (char !== "'" && char !== '"') {
      index += 1;
      continue;
    }
    let cursor = index + 1;
    while (cursor < line.length && line[cursor] !== char) {
      cursor += line[cursor] === "\\" ? 2 : 1;
    }
    if (cursor >= line.length) break;
    found.push({ start: index + 1, end: cursor, quote: index });
    index = cursor + 1;
  }
  return found;
};

const rangeOn = (line: number, start: number, end: number): Range => ({
  start: { line, character: start },
  end: { line, character: end },
});

/**
 * A Blade component or Livewire tag under the cursor: `<x-alert`,
 * `<x-forms.input`, `<livewire:counter`. Only the tag name links — the
 * attributes after it belong to whatever the component is.
 */
const tagAt = (
  line: string,
  lineNumber: number,
  character: number
): LaravelReference | null => {
  const tag = /<(x-|livewire:)([\w.\-:]+)/g;
  for (const match of line.matchAll(tag)) {
    const start = match.index + 1;
    const end = start + match[1].length + match[2].length;
    if (character < start || character > end) continue;
    const kind = match[1] === "x-" ? "component" : "livewire";
    // `<x-slot>` and `<x-dynamic-component>` are Blade's own, not a file.
    if (kind === "component" && /^(slot|dynamic-component)\b/.test(match[2]))
      return null;
    return {
      kind,
      name: match[2],
      range: rangeOn(lineNumber, start, end),
    };
  }
  return null;
};

/**
 * The Laravel reference at `position`, or null when the cursor is not on one.
 * Component tags are only looked for in Blade, where they mean something.
 */
export const laravelReferenceAt = (
  text: string,
  position: Position,
  options: { readonly blade: boolean }
): LaravelReference | null => {
  const line = text.split("\n")[position.line];
  if (line === undefined) return null;

  if (options.blade) {
    const tag = tagAt(line, position.line, position.character);
    if (tag !== null) return tag;
  }

  const literal = literalsOn(line).find(
    (candidate) =>
      position.character >= candidate.start &&
      position.character <= candidate.end
  );
  if (literal === undefined) return null;
  const name = line.slice(literal.start, literal.end);
  if (name.trim().length === 0) return null;

  const before = line.slice(0, literal.quote);
  const caller = STRING_CALLERS.find(({ before: pattern }) =>
    pattern.test(before)
  );
  if (caller === undefined) return null;
  return {
    kind: caller.kind,
    name,
    range: rangeOn(position.line, literal.start, literal.end),
  };
};

export interface LaravelFiles {
  readonly exists: (absolute: string) => boolean;
  readonly readText: (absolute: string) => string | null;
}

/** `alert-box` → `AlertBox`, as Laravel maps a tag name to a class. */
const studly = (kebab: string): string =>
  kebab
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

/**
 * The line a dotted key is defined on in a PHP array file — `'connections'`,
 * then `'mysql'` below it, then `'host'` below that. Each segment is looked for
 * after the previous one, which is how nesting reads in a config file; the
 * deepest segment found wins, so a key that is computed rather than written
 * still lands on its parent.
 */
const keyLine = (text: string, segments: ReadonlyArray<string>): number => {
  const lines = text.split("\n");
  let from = 0;
  let found = 0;
  for (const segment of segments) {
    const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(String.raw`(['"])${escaped}\1\s*=>`);
    const at = lines.findIndex(
      (line, index) => index >= from && pattern.test(line)
    );
    if (at === -1) break;
    found = at;
    from = at + 1;
  }
  return found;
};

/** The first line matching `pattern`, or the top of the file. */
const lineMatching = (text: string, pattern: RegExp): number =>
  Math.max(
    0,
    text.split("\n").findIndex((line) => pattern.test(line))
  );

/**
 * The app's default locale, as `config/app.php` writes it — usually
 * `env('APP_LOCALE', 'en')`, sometimes a bare string — and English when it
 * cannot be read, which is Laravel's own default.
 */
const defaultLocale = (app: string, files: LaravelFiles): string => {
  const config = files.readText(`${app}/config/app.php`) ?? "";
  const match =
    /['"]locale['"]\s*=>\s*(?:env\(\s*['"][^'"]+['"]\s*,\s*)?['"]([\w-]+)['"]/.exec(
      config
    );
  return match?.[1] ?? "en";
};

const firstExisting = (
  candidates: ReadonlyArray<string>,
  files: LaravelFiles
): string | null => candidates.find((path) => files.exists(path)) ?? null;

const viewFiles = (app: string, name: string): ReadonlyArray<string> => {
  const path = name.replaceAll(".", "/");
  return [
    `${app}/resources/views/${path}.blade.php`,
    `${app}/resources/views/${path}.php`,
  ];
};

/**
 * Where `reference` is defined in the app rooted at `app`, best match first.
 * Empty when Laravel would not find it either — a namespaced view from a
 * package, a key nobody wrote — so the caller can fall through.
 */
export const laravelTargets = (
  app: string,
  reference: LaravelReference,
  files: LaravelFiles
): ReadonlyArray<LaravelTarget> => {
  const at = (absolute: string | null, line = 0): Array<LaravelTarget> =>
    absolute === null ? [] : [{ absolute, line }];

  switch (reference.kind) {
    case "view": {
      // `mail::message` and friends live in a package's own views.
      if (reference.name.includes("::")) return [];
      return at(firstExisting(viewFiles(app, reference.name), files));
    }

    case "config": {
      const [file, ...keys] = reference.name.split(".");
      const absolute = `${app}/config/${file}.php`;
      if (!files.exists(absolute)) return [];
      return at(absolute, keyLine(files.readText(absolute) ?? "", keys));
    }

    case "env": {
      // The real `.env` is what the app reads; the example is what a fresh
      // checkout has, and says what the variable is for.
      const escaped = reference.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(String.raw`^\s*(?:export\s+)?${escaped}\s*=`);
      for (const candidate of [`${app}/.env`, `${app}/.env.example`]) {
        const text = files.readText(candidate);
        if (text === null) continue;
        const line = text.split("\n").findIndex((entry) => pattern.test(entry));
        if (line !== -1) return at(candidate, line);
      }
      return [];
    }

    case "translation": {
      const locale = defaultLocale(app, files);
      const roots = [`${app}/lang`, `${app}/resources/lang`];
      // `auth.failed` is a key in `lang/en/auth.php`; a sentence is a key in
      // `lang/en.json`. Laravel tries the JSON file first for anything, but a
      // dotted word is almost always the former.
      const keyed = /^[\w-]+(\.[\w-]+)+$/.test(reference.name);
      if (keyed) {
        const [group, ...keys] = reference.name.split(".");
        const absolute = firstExisting(
          roots.map((root) => `${root}/${locale}/${group}.php`),
          files
        );
        if (absolute !== null)
          return at(absolute, keyLine(files.readText(absolute) ?? "", keys));
      }
      const json = firstExisting(
        roots.map((root) => `${root}/${locale}.json`),
        files
      );
      if (json === null) return [];
      const quoted = JSON.stringify(reference.name).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      return at(
        json,
        lineMatching(
          files.readText(json) ?? "",
          new RegExp(`^\\s*${quoted}\\s*:`)
        )
      );
    }

    case "component": {
      if (reference.name.includes("::")) return [];
      const segments = reference.name.split(".");
      const path = segments.join("/");
      const last = segments[segments.length - 1];
      // A class component is the class, which then names its view; an
      // anonymous one is just the view, possibly a directory with an index.
      const classFile = `${app}/app/View/Components/${segments.map(studly).join("/")}.php`;
      return at(
        firstExisting(
          [
            classFile,
            `${app}/resources/views/components/${path}.blade.php`,
            `${app}/resources/views/components/${path}/index.blade.php`,
            `${app}/resources/views/components/${path}/${last}.blade.php`,
          ],
          files
        )
      );
    }

    case "livewire": {
      const segments = reference.name.split(".").map(studly).join("/");
      return at(
        firstExisting(
          [
            `${app}/app/Livewire/${segments}.php`,
            `${app}/app/Http/Livewire/${segments}.php`,
          ],
          files
        )
      );
    }

    case "inertia": {
      // Breeze and the older starter kits use `Pages`; the current ones use
      // `pages`. On a case-insensitive disk both answer, which is harmless.
      const candidates: Array<string> = [];
      for (const directory of ["pages", "Pages"]) {
        for (const extension of [".vue", ".tsx", ".jsx", ".svelte"]) {
          candidates.push(
            `${app}/resources/js/${directory}/${reference.name}${extension}`
          );
        }
      }
      return at(firstExisting(candidates, files));
    }
  }
};

/**
 * The Laravel app a file belongs to: the nearest directory at or above it
 * holding `artisan`, without leaving the repository. A monorepo keeps its app
 * in a package, so the repository root is not assumed to be it; a repository
 * with no app answers null and nothing here applies.
 */
export const laravelAppRoot = (
  root: string,
  absoluteFile: string,
  exists: (absolute: string) => boolean
): string | null => {
  const top = root.replace(/\/+$/, "");
  let directory = absoluteFile.slice(0, absoluteFile.lastIndexOf("/"));
  while (directory.length >= top.length && directory.startsWith(top)) {
    if (exists(`${directory}/artisan`)) return directory;
    const parent = directory.slice(0, directory.lastIndexOf("/"));
    if (parent === directory) break;
    directory = parent;
  }
  return null;
};
