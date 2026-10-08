/** The Mac app's preferences domain. */
const MAC_APP = 'com.byconvo.reviewer.macos';

/** A value the Mac app keeps in its defaults, or `null` off macOS or when unset. */
export function readMacDefault(key: string): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    const result = Bun.spawnSync(['defaults', 'read', MAC_APP, key], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
    return result.exitCode === 0 ? result.stdout.toString().trim() : null;
  } catch {
    return null;
  }
}
