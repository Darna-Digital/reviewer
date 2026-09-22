/**
 * What a `docker-desktop` dev command runs. Docker Desktop is an app, not a
 * process of the repository's, so the server composes the shell for it: open
 * the app in the background, wait for the engine to answer, then stay up for
 * as long as it does — so the row reads "Running" exactly while Docker is,
 * and exits when Docker is quit from outside. Stopping the row quits the app
 * through AppleScript, which is how Docker Desktop shuts its engine down
 * cleanly; killing the waiting shell alone would leave Docker running.
 *
 * "Start all" starts the Docker command first, but the app takes a while to
 * bring its engine up, and holding the request open until it has would
 * outlast the client's patience. So the other commands start at once,
 * wrapped so they wait for the engine themselves — their output says so
 * while they do.
 */
import { execFile } from "node:child_process";
import * as Effect from "effect/Effect";

const engineIsUp = "docker info >/dev/null 2>&1";

const waitForEngine = (waiting: string) =>
  `if ! ${engineIsUp}; then printf '${waiting}'; until ${engineIsUp}; do printf '.'; sleep 1; done; printf '\\n'; fi`;

export const dockerDesktopScript = [
  `if ! command -v docker >/dev/null 2>&1; then echo 'The docker command was not found — is Docker Desktop installed?'; exit 1; fi`,
  `if ! open -g -a Docker; then echo 'Docker Desktop could not be opened.'; exit 1; fi`,
  waitForEngine("Starting Docker Desktop"),
  `echo 'Docker Desktop is running.'`,
  `while ${engineIsUp}; do sleep 5; done`,
  `echo 'Docker Desktop has stopped.'`,
].join("\n");

/**
 * A shell command that first waits for the Docker engine. Without the
 * docker CLI there is nothing to wait for, so the command simply runs.
 */
export const afterDockerDesktop = (command: string): string =>
  [
    `if command -v docker >/dev/null 2>&1; then ${waitForEngine("Waiting for Docker Desktop")}; fi`,
    command,
  ].join("\n");

/** Quitting an app that is not running is nothing to report. */
export const quitDockerDesktop: Effect.Effect<void> = Effect.promise(
  () =>
    new Promise<void>((resolve) => {
      execFile("osascript", ["-e", 'quit app "Docker"'], () => resolve());
    })
);
