import type { Scheme } from './terminalTheme';

const POLL_MS = 3000;

/** The OS light/dark setting, or `null` where there is no way to ask. */
export async function readSystemScheme(): Promise<Scheme | null> {
  if (process.platform === 'darwin') {
    const out = await run(['defaults', 'read', '-g', 'AppleInterfaceStyle']);
    return out?.trim() === 'Dark' ? 'dark' : 'light';
  }
  if (process.platform === 'linux') {
    const out = await run([
      'gsettings',
      'get',
      'org.gnome.desktop.interface',
      'color-scheme',
    ]);
    if (out === null) return null;
    return out.includes('dark') ? 'dark' : 'light';
  }
  return null;
}

/** Calls `onChange` whenever the OS flips between light and dark. */
export function watchSystemScheme(
  onChange: (scheme: Scheme) => void,
): () => void {
  let last: Scheme | null = null;
  let stopped = false;
  const check = async () => {
    const scheme = await readSystemScheme();
    if (stopped || scheme === null || scheme === last) return;
    last = scheme;
    onChange(scheme);
  };
  void check();
  const timer = setInterval(() => void check(), POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** stdout of a short command, or `null` when it fails (macOS exits 1 in light mode). */
async function run(cmd: string[]): Promise<string | null> {
  try {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'ignore' });
    const [out, code] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    return code === 0 ? out : process.platform === 'darwin' ? '' : null;
  } catch {
    return null;
  }
}
