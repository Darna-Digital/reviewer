/**
 * The TypeScript program behind the IDE features — one `ts.LanguageService` per
 * tsconfig, kept warm across requests.
 *
 * Building a program for a real repository costs seconds, so the cost is paid
 * once and reused: the service is incremental, and re-answering after an edit
 * only re-checks what changed. That is the whole reason this provider runs the
 * compiler in-process instead of shelling out to a language server — the
 * program outlives the request.
 *
 * Freshness comes from file versions. An unsaved editor buffer is held as an
 * overlay that shadows the file on disk; everything else is versioned by its
 * mtime and size, re-stat'd at most every {@link STAT_TTL_MS} so a burst of
 * hover requests does not walk the tree repeatedly.
 */
import { statSync } from "node:fs";
import { dirname } from "node:path";
import type * as TS from "typescript";
import { loadTypeScript, type TypeScriptModule } from "./ts-module.ts";

/** How long a file's disk version is trusted before it is re-stat'd. */
const STAT_TTL_MS = 500;
/** Live projects kept in memory; the least recently used is disposed first. */
const MAX_PROJECTS = 4;
/** How many links of a solution tsconfig chain are followed before giving up. */
const MAX_REFERENCE_DEPTH = 8;

export interface TsProject {
  readonly ts: TypeScriptModule;
  readonly service: TS.LanguageService;
  /** The tsconfig backing this project, or null for an inferred one. */
  readonly configPath: string | null;
  /**
   * Make `absolute` part of the project and set the buffer to analyse:
   * `contents` for an unsaved editor buffer, null to follow the file on disk.
   */
  readonly openFile: (absolute: string, contents: string | null) => void;
  /** Current text of a file as the project sees it, null when unreadable. */
  readonly textOf: (absolute: string) => string | null;
  readonly dispose: () => void;
}

interface CachedProject {
  readonly project: TsProject;
  /** Paths and mtimes of the tsconfigs the project was built from. */
  readonly configSignature: string;
  usedAt: number;
}

const projects = new Map<string, CachedProject>();
/** Monotonic clock for LRU ordering; wall-clock jumps must not reorder it. */
let tick = 0;

const mtimeOf = (path: string): number => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return -1;
  }
};

/** Editor-style compiler options: never emit, and check what is open. */
const forEditor = (
  ts: TypeScriptModule,
  options: TS.CompilerOptions
): TS.CompilerOptions => ({
  ...options,
  noEmit: true,
  // Emit-related settings are meaningless here and some of them conflict with
  // `noEmit`, which would surface as configuration errors nobody can act on.
  composite: false,
  declaration: false,
  declarationMap: false,
  incremental: false,
  tsBuildInfoFile: undefined,
  allowNonTsExtensions: true,
  // A repository being reviewed is rarely fully installed; checking every
  // dependency's .d.ts would report errors the project itself never sees.
  skipLibCheck: options.skipLibCheck ?? true,
  suppressOutputPathCheck: true,
});

/** Defaults for a file with no tsconfig above it — a best-effort single file. */
const inferredOptions = (ts: TypeScriptModule): TS.CompilerOptions => ({
  allowJs: true,
  checkJs: false,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: false,
  target: ts.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
});

interface ParsedProject {
  readonly configPath: string | null;
  readonly options: TS.CompilerOptions;
  readonly rootFileNames: ReadonlyArray<string>;
  readonly currentDirectory: string;
  /** Every tsconfig read on the way here, for cache invalidation. */
  readonly configPaths: ReadonlyArray<string>;
}

/** A tsconfig and what it parsed to, while the owning project is picked. */
interface Candidate {
  readonly configPath: string;
  readonly parsed: TS.ParsedCommandLine;
}

const parseConfig = (
  ts: TypeScriptModule,
  configPath: string
): TS.ParsedCommandLine => {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(
    config.config ?? {},
    ts.sys,
    dirname(configPath),
    undefined,
    configPath
  );
};

/** Comparable form of a path, matching the compiler's own case sensitivity. */
const pathKey = (ts: TypeScriptModule, path: string): string => {
  const resolved = ts.sys.resolvePath(path);
  return ts.sys.useCaseSensitiveFileNames ? resolved : resolved.toLowerCase();
};

const covers = (
  ts: TypeScriptModule,
  parsed: TS.ParsedCommandLine,
  fileKey: string
): boolean => parsed.fileNames.some((name) => pathKey(ts, name) === fileKey);

/** How much of their directory path two files share, in characters. */
const sharedDirectoryLength = (a: string, b: string): number => {
  let shared = 0;
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index++) {
    if (a[index] !== b[index]) break;
    if (a[index] === "/") shared = index;
  }
  return shared;
};

/**
 * The referenced project that owns `absoluteFile`, searched breadth-first from
 * a tsconfig that does not own it itself.
 *
 * A solution-style tsconfig — `files: []` plus `references` — carries no
 * options worth checking against: `jsx`, `lib` and `target` live in the
 * projects it points at. Stopping at the nearest config the way a naive lookup
 * does reports "Cannot use JSX unless the '--jsx' flag is provided" on every
 * tag of every component, which is why tsserver resolves the owning project
 * and why this does too.
 *
 * A file no referenced project lists — excluded from every `include`, or an
 * unsaved buffer with nothing on disk yet — falls back to the project whose
 * files sit closest to it in the tree. That beats the solution root at the one
 * job left, which is supplying options.
 */
const followReferences = (
  ts: TypeScriptModule,
  entry: Candidate,
  absoluteFile: string
): {
  readonly candidate: Candidate;
  readonly visited: ReadonlyArray<string>;
} => {
  const fileKey = pathKey(ts, absoluteFile);
  const visited = [entry.configPath];
  const seen = new Set([pathKey(ts, entry.configPath)]);
  let frontier = [entry];
  let nearest: { candidate: Candidate; closeness: number } | null = null;

  for (
    let depth = 0;
    depth < MAX_REFERENCE_DEPTH && frontier.length > 0;
    depth++
  ) {
    const next: Array<Candidate> = [];
    for (const current of frontier) {
      for (const reference of current.parsed.projectReferences ?? []) {
        const referencedPath = ts.resolveProjectReferencePath(reference);
        const key = pathKey(ts, referencedPath);
        if (seen.has(key)) continue;
        seen.add(key);
        if (!ts.sys.fileExists(referencedPath)) continue;
        visited.push(referencedPath);
        const candidate = {
          configPath: referencedPath,
          parsed: parseConfig(ts, referencedPath),
        };
        if (covers(ts, candidate.parsed, fileKey))
          return { candidate, visited };
        next.push(candidate);
        if (candidate.parsed.fileNames.length === 0) continue;
        const closeness = Math.max(
          ...candidate.parsed.fileNames.map((name) =>
            sharedDirectoryLength(pathKey(ts, name), fileKey)
          )
        );
        if (nearest === null || closeness > nearest.closeness)
          nearest = { candidate, closeness };
      }
    }
    frontier = next;
  }
  return { candidate: nearest?.candidate ?? entry, visited };
};

const parseProject = (
  ts: TypeScriptModule,
  root: string,
  absoluteFile: string
): ParsedProject => {
  const configPath = ts.findConfigFile(
    dirname(absoluteFile),
    ts.sys.fileExists,
    "tsconfig.json"
  );
  if (configPath === undefined) {
    return {
      configPath: null,
      options: inferredOptions(ts),
      rootFileNames: [absoluteFile],
      currentDirectory: root,
      configPaths: [],
    };
  }
  const nearest: Candidate = {
    configPath,
    parsed: parseConfig(ts, configPath),
  };
  const { candidate, visited } = covers(
    ts,
    nearest.parsed,
    pathKey(ts, absoluteFile)
  )
    ? { candidate: nearest, visited: [configPath] }
    : followReferences(ts, nearest, absoluteFile);

  return {
    configPath: candidate.configPath,
    options: forEditor(ts, candidate.parsed.options),
    // A project the file is not a root of still answers for it: `openFile`
    // adds it below.
    rootFileNames: candidate.parsed.fileNames,
    currentDirectory: dirname(candidate.configPath),
    configPaths: visited,
  };
};

const createProject = (
  ts: TypeScriptModule,
  parsed: ParsedProject
): TsProject => {
  const rootFileNames = new Set(parsed.rootFileNames);
  const overlays = new Map<string, { text: string; version: number }>();
  const diskVersions = new Map<
    string,
    { version: string; checkedAt: number }
  >();

  const diskVersion = (fileName: string): string => {
    const cached = diskVersions.get(fileName);
    const now = Date.now();
    if (cached !== undefined && now - cached.checkedAt < STAT_TTL_MS)
      return cached.version;
    let version = "0";
    try {
      const stat = statSync(fileName);
      version = `${stat.mtimeMs}:${stat.size}`;
    } catch {
      version = "missing";
    }
    diskVersions.set(fileName, { version, checkedAt: now });
    return version;
  };

  const readText = (fileName: string): string | null => {
    const overlay = overlays.get(fileName);
    if (overlay !== undefined) return overlay.text;
    return ts.sys.readFile(fileName) ?? null;
  };

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => [...rootFileNames],
    getScriptVersion: (fileName) => {
      const overlay = overlays.get(fileName);
      return overlay !== undefined
        ? `overlay:${overlay.version}`
        : diskVersion(fileName);
    },
    getScriptSnapshot: (fileName) => {
      const text = readText(fileName);
      return text === null ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => parsed.currentDirectory,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (fileName) =>
      overlays.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) => readText(fileName) ?? undefined,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getNewLine: () => ts.sys.newLine,
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  return {
    ts,
    service,
    configPath: parsed.configPath,
    openFile: (absolute, contents) => {
      rootFileNames.add(absolute);
      if (contents === null) {
        overlays.delete(absolute);
        // Force a re-read: the buffer that was displacing the file is gone.
        diskVersions.delete(absolute);
        return;
      }
      const existing = overlays.get(absolute);
      if (existing !== undefined && existing.text === contents) return;
      overlays.set(absolute, {
        text: contents,
        version: (existing?.version ?? 0) + 1,
      });
    },
    textOf: (absolute) => {
      const snapshot = service
        .getProgram()
        ?.getSourceFile(absolute)
        ?.getFullText();
      return snapshot ?? readText(absolute);
    },
    dispose: () => service.dispose(),
  };
};

const evictOldest = () => {
  if (projects.size <= MAX_PROJECTS) return;
  let oldestKey: string | null = null;
  let oldestUsedAt = Number.POSITIVE_INFINITY;
  for (const [key, entry] of projects) {
    if (entry.usedAt < oldestUsedAt) {
      oldestUsedAt = entry.usedAt;
      oldestKey = key;
    }
  }
  if (oldestKey === null) return;
  projects.get(oldestKey)?.project.dispose();
  projects.delete(oldestKey);
};

/**
 * The project owning `absoluteFile`, built on first use and reused afterwards.
 * Returns null when the repository has no TypeScript installed.
 */
export const projectFor = (
  root: string,
  absoluteFile: string
): TsProject | null => {
  const { module: ts } = loadTypeScript(dirname(absoluteFile));
  if (ts === null) return null;

  const parsed = parseProject(ts, root, absoluteFile);
  const key = parsed.configPath ?? `${root} inferred`;
  const configSignature = parsed.configPaths
    .map((path) => `${path}:${mtimeOf(path)}`)
    .join("|");

  const cached = projects.get(key);
  if (cached !== undefined) {
    // A rewritten tsconfig changes the file set and the options; only a fresh
    // program reflects that, so drop the stale one. The whole chain counts: a
    // reference retargeted in the solution root moves the project too.
    if (cached.configSignature === configSignature) {
      cached.usedAt = ++tick;
      return cached.project;
    }
    cached.project.dispose();
    projects.delete(key);
  }

  const project = createProject(ts, parsed);
  projects.set(key, { project, configSignature, usedAt: ++tick });
  evictOldest();
  return project;
};

/** Test seam — disposes every cached project. */
export const resetProjects = (): void => {
  for (const entry of projects.values()) entry.project.dispose();
  projects.clear();
};
