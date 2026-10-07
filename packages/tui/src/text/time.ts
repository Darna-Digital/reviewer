const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNITS = {
  m: 'minute',
  h: 'hour',
  d: 'day',
  mo: 'month',
  y: 'year',
} as const;

/** Compact relative time: `now`, `5m`, `3h`, `2d`, `4mo`, `2y`. */
export function ago(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < 365 * DAY) return `${Math.floor(elapsed / (30 * DAY))}mo`;
  return `${Math.floor(elapsed / (365 * DAY))}y`;
}

/** Spelled-out relative time: `3 hours ago`. */
export function agoLong(iso: string, now = Date.now()): string {
  const short = ago(iso, now);
  if (short === '' || short === 'now') return short && 'just now';
  const match = /^(\d+)(m|h|d|mo|y)$/.exec(short);
  if (!match) return short;
  const count = Number(match[1]);
  const unit = UNITS[match[2] as keyof typeof UNITS];
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}
