import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_LIGHT_THEME } from '@reviewer/themes';

export const USAGE = `Usage: reviewer [path…] [options]
       reviewer upgrade [version]

  Several paths open their repositories side by side, as one workspace.
  \`upgrade\` installs the latest release, or the version given, over this one.

Options:
  -w, --workspace <name>  open a saved workspace (the Mac app's too)
  --workspaces      list the saved workspaces
  --against <ref>   review the branch against <ref> (its merge base)
  --commit <sha>    review one commit
  --pr <number>     review a GitHub pull request
  --theme <name>    this run only: \`terminal\` or any theme in Reviewer's catalog
                    (saved default: the terminal's own colours; ⌘, or ⌃T changes it)
  --light           this run only: the light default theme
  --no-server       do not start the Reviewer server when it is not running
  --themes          list the themes
  -v, --version     print the version
  -h, --help        show this help`;

export interface CliOptions {
  /** Any path inside each repository; one, unless several were given. */
  paths: string[];
  workspace?: string;
  listWorkspaces: boolean;
  /** `reviewer upgrade [version]`: `''` for the latest. */
  upgrade?: string;
  version: boolean;
  against?: string;
  commit?: string;
  pr?: string;
  /** Set only when asked for; otherwise the saved settings decide. */
  themeName?: string;
  listThemes: boolean;
  startServer: boolean;
  help: boolean;
}

export function parseCli(argv: string[], env = process.env): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      against: { type: 'string' },
      commit: { type: 'string' },
      pr: { type: 'string' },
      theme: { type: 'string' },
      light: { type: 'boolean' },
      themes: { type: 'boolean' },
      workspace: { type: 'string', short: 'w' },
      workspaces: { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      'no-server': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const upgrading = positionals[0] === 'upgrade';
  const paths = upgrading ? [] : positionals;
  // Under `pnpm tui` the process starts in the workspace root; INIT_CWD is
  // where it was run from. Only trusted when a package script launched us.
  const invokedFrom = env['npm_lifecycle_event'] ? env['INIT_CWD'] : undefined;
  return {
    paths: (paths.length > 0 ? paths : [invokedFrom ?? '.']).map((path) =>
      resolve(path),
    ),
    upgrade: upgrading ? (positionals[1] ?? '') : undefined,
    version: values.version ?? false,
    workspace: values.workspace,
    listWorkspaces: values.workspaces ?? false,
    against: values.against,
    commit: values.commit,
    pr: values.pr?.replace(/^#/, ''),
    themeName: values.theme ?? (values.light ? DEFAULT_LIGHT_THEME : undefined),
    listThemes: values.themes ?? false,
    startServer: !values['no-server'],
    help: values.help ?? false,
  };
}
