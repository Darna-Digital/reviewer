import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_LIGHT_THEME } from '@reviewer/core/themes';

export const USAGE = `Usage: reviewer [path] [options]

Options:
  --against <ref>   review the branch against <ref> (its merge base)
  --commit <sha>    review one commit
  --theme <name>    this run only: \`terminal\` or any theme in Reviewer's catalog
                    (saved default: the terminal's own colours; ⌘, or ⌃T changes it)
  --light           this run only: the light default theme
  --no-server       do not start the Reviewer server when it is not running
  --themes          list the themes
  -h, --help        show this help`;

export interface CliOptions {
  /** Any path inside the repository. */
  path: string;
  against?: string;
  commit?: string;
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
      theme: { type: 'string' },
      light: { type: 'boolean' },
      themes: { type: 'boolean' },
      'no-server': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  // Under `pnpm tui` the process starts in the workspace root; INIT_CWD is
  // where it was run from. Only trusted when a package script launched us.
  const invokedFrom = env['npm_lifecycle_event'] ? env['INIT_CWD'] : undefined;
  return {
    path: resolve(positionals[0] ?? invokedFrom ?? '.'),
    against: values.against,
    commit: values.commit,
    themeName: values.theme ?? (values.light ? DEFAULT_LIGHT_THEME : undefined),
    listThemes: values.themes ?? false,
    startServer: !values['no-server'],
    help: values.help ?? false,
  };
}
