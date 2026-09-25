#!/usr/bin/env node
// Talks to the API server Reviewer embeds, on behalf of any coding agent.
//
// Every Reviewer window runs a server of its own, and each server holds one
// repository: the first window is on the default port (41811), a window opened
// with "Open in new window" on a free port the system handed it. So the server
// to talk to is found, not assumed — the one whose open project is the git
// repository this script runs in. Candidates are an explicit REVIEWER_URL /
// REVIEWER_PORT, then the default port, then every port a local `node`
// process listens on (lsof), each asked for its /api/workspace.
//
// No dependencies beyond Node 18+ (global fetch), so the skill works wherever
// it is copied to. Everything is printed as JSON on stdout; failures go to
// stderr with a non-zero exit and say what the user has to do.
//
//   node reviewer.mjs server                 the server holding this repo
//   node reviewer.mjs list [--all]           its local review comments
//   node reviewer.mjs resolve <id> [<id>…]   delete (= resolve) comments
//
// `--repo <path>` targets another repository than the working directory's.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const DEFAULT_PORT = 41811;
const PROBE_TIMEOUT_MS = 1500;

function fail(message) {
  process.stderr.write(`reviewer: ${message}\n`);
  process.exit(1);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") flags.all = true;
    else if (arg === "--repo") flags.repo = argv[++i];
    else positional.push(arg);
  }
  return { command: positional[0], args: positional.slice(1), flags };
}

// Paths are compared resolved, so a symlinked checkout (or macOS's /private
// prefix on /tmp) still matches what the server reports.
function canonical(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function repositoryRoot(from) {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: from,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return canonical(root);
  } catch {
    fail(`${from} is not inside a git repository`);
  }
}

// Ports local node processes listen on — where Reviewer's servers run when
// they are not on the default port. lsof is absent or finds nothing on some
// systems; the explicit and default candidates still apply then.
function nodeListeningPorts() {
  try {
    const output = execFileSync(
      "lsof",
      ["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-c", "node", "-Fn"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return output
      .split("\n")
      .filter((line) => line.startsWith("n"))
      .map((line) => Number(line.slice(line.lastIndexOf(":") + 1)))
      .filter((port) => Number.isInteger(port) && port > 0);
  } catch {
    return [];
  }
}

function candidateBaseUrls() {
  const urls = [];
  if (process.env.REVIEWER_URL) urls.push(process.env.REVIEWER_URL.replace(/\/+$/, ""));
  const ports = [];
  if (process.env.REVIEWER_PORT) ports.push(Number(process.env.REVIEWER_PORT));
  ports.push(DEFAULT_PORT, ...nodeListeningPorts());
  for (const port of ports) urls.push(`http://127.0.0.1:${port}`);
  return [...new Set(urls)];
}

// A Reviewer server answers /api/workspace with its open project and recents;
// anything else on the port (another dev server) is skipped.
async function describe(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/workspace`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    const info = await response.json();
    if (!info || !("project" in info) || !Array.isArray(info.recents)) return undefined;
    return { url: baseUrl, project: info.project, branch: info.branch };
  } catch {
    return undefined;
  }
}

async function findServer(repo) {
  const servers = (await Promise.all(candidateBaseUrls().map(describe))).filter(Boolean);
  const match = servers.find((server) => server.project && canonical(server.project) === repo);
  if (match) return match;
  if (servers.length === 0) {
    fail(
      "no Reviewer server is running — open Reviewer (or run `pnpm dev` in the reviewer repository) and try again"
    );
  }
  const open = servers.map((server) => `  ${server.url} → ${server.project ?? "(no project)"}`).join("\n");
  // Switching a server's project would switch the window the user is looking
  // at, so the script never does it — it asks the user to open the repo.
  fail(`no Reviewer window has ${repo} open. Open it in Reviewer and try again. Running servers:\n${open}`);
}

async function request(server, method, path) {
  const response = await fetch(`${server.url}/api${path}`, { method });
  const text = await response.text();
  if (!response.ok) fail(`${method} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : undefined;
}

const { command, args, flags } = parseArgs(process.argv.slice(2));
const repo = repositoryRoot(flags.repo ?? process.cwd());

switch (command) {
  case "server": {
    print(await findServer(repo));
    break;
  }
  case "list": {
    const server = await findServer(repo);
    const comments = await request(server, "GET", "/comments");
    // GitHub comments are read live from the pull request; they cannot be
    // resolved here, so they are only shown on request.
    print(flags.all ? comments : comments.filter((comment) => comment.source === "local"));
    break;
  }
  case "resolve": {
    if (args.length === 0) fail("resolve needs at least one comment id");
    const server = await findServer(repo);
    const resolved = [];
    for (const id of args) {
      await request(server, "DELETE", `/comments/${encodeURIComponent(id)}`);
      resolved.push(id);
    }
    print({ resolved });
    break;
  }
  default:
    fail("usage: reviewer.mjs <server | list [--all] | resolve <id>…> [--repo <path>]");
}
