import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimUsageDay,
  periods,
  usageFlags,
  usageOffByEnvironment,
} from './usage';

// Summer time starts in Vilnius on 2026-03-29, which puts a 23-hour day
// between New Year and the weeks after it.
process.env.TZ = 'Europe/Vilnius';

const at = (day: string, hour = 12) =>
  new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

describe('periods', () => {
  test.each([
    ['2026-01-01', '2026-W01'], // a Thursday: week 1 of its own year
    ['2027-01-01', '2026-W53'], // a Friday: the last week of the year before
    ['2024-12-30', '2025-W01'], // a Monday: week 1 of the year after
    ['2026-03-30', '2026-W14'], // the Monday after summer time starts
    ['2026-04-02', '2026-W14'],
    ['2026-04-05', '2026-W14'], // Sunday ends the week
  ])('%s is in %s', (day, week) => {
    expect(periods(at(day)).week).toBe(week);
  });

  test('a day is the local one, not UTC', () => {
    // 00:30 in Vilnius is still the day before in UTC
    expect(periods(at('2026-11-05', 0)).day).toBe('2026-11-05');
  });
});

describe('usageFlags', () => {
  const now = at('2026-11-05'); // a Thursday in 2026-W45

  test('a fresh install is new on its first day', () => {
    expect(
      Object.fromEntries(usageFlags({}, now, 'linux', false)!.query),
    ).toEqual({
      d: '1',
      day: '2026-11-05',
      w: '1',
      m: '1',
      new: '1',
      since: '2026-11',
      os: 'linux',
    });
  });

  test('an install upgraded from before counting is not new', () => {
    const { query } = usageFlags({}, now, 'linux', true)!;
    expect(query.get('new')).toBe('0');
    expect(query.get('m')).toBe('1');
  });

  test('a later day keeps the install month and flags only new periods', () => {
    const record = {
      day: '2026-11-03',
      week: '2026-W45',
      month: '2026-11',
      since: '2026-09',
    };
    const flags = usageFlags(record, now, 'darwin', false)!;
    expect(flags.query.get('w')).toBe('0');
    expect(flags.query.get('m')).toBe('0');
    expect(flags.query.get('new')).toBe('0');
    expect(flags.query.get('since')).toBe('2026-09');
    expect(flags.next).toEqual({
      day: '2026-11-05',
      week: '2026-W45',
      month: '2026-11',
      since: '2026-09',
    });
  });

  test('a week can start again inside a month', () => {
    const record = { day: '2026-11-01', week: '2026-W44', month: '2026-11' };
    const { query } = usageFlags(record, now, 'linux', false)!;
    expect([query.get('w'), query.get('m')]).toEqual(['1', '0']);
  });

  test('today counted already sends nothing', () => {
    expect(usageFlags({ day: '2026-11-05' }, now, 'linux', false)).toBeNull();
  });
});

describe('claimUsageDay', () => {
  const home = () => {
    const dir = mkdtempSync(join(tmpdir(), 'reviewer-usage-'));
    mkdirSync(join(dir, 'releases', '0.0.42'), { recursive: true });
    return dir;
  };
  const now = at('2026-11-05');

  test('only one of two TUIs open at once counts the day', () => {
    const dir = home();
    const first = claimUsageDay(dir, now);
    expect(first?.query.get('d')).toBe('1');
    expect(claimUsageDay(dir, now)).toBeNull();
    first!.commit();
    expect(claimUsageDay(dir, now)).toBeNull();
    expect(JSON.parse(readFileSync(join(dir, 'usage.json'), 'utf8')).day).toBe(
      '2026-11-05',
    );
  });

  test('a failed check leaves the day for the next one', () => {
    const dir = home();
    claimUsageDay(dir, now)!.release();
    expect(claimUsageDay(dir, now)?.query.get('d')).toBe('1');
  });

  test('the next day counts again, with the week and month remembered', () => {
    const dir = home();
    claimUsageDay(dir, now)!.commit();
    const next = claimUsageDay(dir, at('2026-11-06'));
    expect(next?.query.get('w')).toBe('0');
    expect(next?.query.get('new')).toBe('0');
  });
});

describe('usageOffByEnvironment', () => {
  test.each([
    [{}, null],
    [{ DO_NOT_TRACK: '1' }, 'DO_NOT_TRACK'],
    [{ DO_NOT_TRACK: '0' }, null],
    [{ REVIEWER_DISABLE_ANALYTICS: 'true' }, 'REVIEWER_DISABLE_ANALYTICS'],
    [{ REVIEWER_DISABLE_ANALYTICS: 'false' }, null],
  ])('%p turns it off: %p', (env, expected) => {
    expect(usageOffByEnvironment(env)).toBe(expected);
  });
});
