// How the TUI is counted (see reviewer.sh/privacy): its update check goes
// to reviewer.sh, and the first check of each local day carries a few flags
// the TUI works out here, from a record of the periods it was last counted
// in — never an id. Later checks that day, and every check with counting
// off, carry nothing, and reviewer.sh writes nothing for them.
//
// The record is `usage.json` in the install's home, beside the releases, so
// upgrades and reinstalls keep it. A day is claimed by creating
// `usage/<day>.lock` exclusively before the check, so of several TUIs open
// at once only one counts it; the claim is dropped if the check fails, for
// the next one to try.
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export interface UsageRecord {
  /** The last local day, ISO week and month counted. */
  day?: string;
  week?: string;
  month?: string;
  /** The month of the first counted day. */
  since?: string;
}

/** Turned off for this machine, whatever the TUI's own setting says. */
export function usageOffByEnvironment(
  env: Record<string, string | undefined> = process.env,
): string | null {
  for (const name of ['REVIEWER_DISABLE_ANALYTICS', 'DO_NOT_TRACK']) {
    const value = env[name];
    if (value && value !== '0' && value.toLowerCase() !== 'false') return name;
  }
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `now`'s local day, ISO week and month. */
export function periods(now: Date): {
  day: string;
  week: string;
  month: string;
} {
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  // The ISO week is the one holding this week's Thursday, in that Thursday's year.
  const thursday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 3 - ((now.getDay() + 6) % 7),
  );
  const firstDay = new Date(thursday.getFullYear(), 0, 1);
  // Rounded to whole days, since a summer-time change makes one 23 or 25 hours.
  const days = Math.round(
    (thursday.getTime() - firstDay.getTime()) / 86_400_000,
  );
  const week = 1 + Math.floor(days / 7);
  return {
    day: `${month}-${pad(now.getDate())}`,
    week: `${thursday.getFullYear()}-W${pad(week)}`,
    month,
  };
}

/**
 * The flags the day's first check carries, and the record to keep once it
 * has gone through — or null when today is counted already.
 * `existingInstall` is an install from before counting began: it has a
 * first day to be counted on, but it is not new.
 */
export function usageFlags(
  record: UsageRecord,
  now: Date,
  os: string,
  existingInstall: boolean,
): { query: URLSearchParams; next: UsageRecord } | null {
  const { day, week, month } = periods(now);
  if (record.day === day) return null;
  const since = record.since ?? month;
  const query = new URLSearchParams({
    d: '1',
    day,
    w: record.week === week ? '0' : '1',
    m: record.month === month ? '0' : '1',
    new: record.since || existingInstall ? '0' : '1',
    since,
    os,
  });
  return { query, next: { day, week, month, since } };
}

export interface UsageClaim {
  query: URLSearchParams;
  /** The check went through: keep the record. */
  commit: () => void;
  /** It did not: let the next check count the day. */
  release: () => void;
}

/** Today's claim on this install's count, or null when it is not ours to send. */
export function claimUsageDay(
  home: string,
  now = new Date(),
): UsageClaim | null {
  const file = join(home, 'usage.json');
  let record: UsageRecord = {};
  try {
    record = JSON.parse(readFileSync(file, 'utf8')) as UsageRecord;
  } catch {
    // no record yet
  }
  const flags = usageFlags(
    record,
    now,
    process.platform === 'darwin' ? 'darwin' : 'linux',
    upgradedInstall(home),
  );
  if (!flags) return null;

  const locks = join(home, 'usage');
  const lock = join(locks, `${flags.next.day}.lock`);
  try {
    mkdirSync(locks, { recursive: true });
    closeSync(openSync(lock, 'wx'));
  } catch {
    // another TUI has today, or the home is not writable
    return null;
  }
  return {
    query: flags.query,
    commit() {
      try {
        writeFileSync(file, JSON.stringify(flags.next));
        for (const name of readdirSync(locks)) {
          if (name !== `${flags.next.day}.lock`) rmSync(join(locks, name));
        }
      } catch {
        // counted; the record is only how tomorrow's flags are worked out
      }
    },
    release() {
      rmSync(lock, { force: true });
    },
  };
}

/** Upgraded from a release before this one: the installer keeps the last. */
function upgradedInstall(home: string): boolean {
  try {
    return readdirSync(join(home, 'releases')).length > 1;
  } catch {
    return false;
  }
}
