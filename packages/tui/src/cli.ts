import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from '@reviewer/core/themes';

export const USAGE = `Usage: reviewer-tui [path] [options]

Options:
  --against <ref>   review the branch against <ref> (its merge base)
  --commit <sha>    review one commit
  --theme <name>    any theme in Reviewer's catalog (default: ${DEFAULT_DARK_THEME})
  --light           use the light default theme
  --themes          list the themes
  -h, --help        show this help`;

export interface CliOptions {
  /** Any path inside the repository. */
  path: string;
  against?: string;
  commit?: string;
  themeName: string;
  listThemes: boolean;
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
    themeName:
      values.theme ?? (values.light ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME),
    listThemes: values.themes ?? false,
    help: values.help ?? false,
  };
}
