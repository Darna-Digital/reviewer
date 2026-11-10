// The usage counts kept past Analytics Engine's three months: once a day the
// Worker's cron asks the Analytics Engine SQL API for the last few days,
// summed, and writes them into D1 in place of what it wrote for those days
// before. Days are the app's local days (blob2), which go on taking points
// until the last time zone has left them, so each day is summed again on
// three runs — late points are taken in, and a rerun replaces rather than
// adds.
//
// Daily, weekly and monthly installs, new installs, and retention by install
// month, all from the one table:
//   SELECT day, SUM(dau) FROM daily_usage WHERE app = 'mac' GROUP BY day
//   SELECT substr(day, 1, 7) AS month, since, SUM(mau_firsts)
//   FROM daily_usage GROUP BY month, since
export const ROLLUP_DAYS = 3;
const DATASET = "reviewer_usage";

export interface RollupEnv {
  USAGE_DB?: D1Database;
  /** The account the dataset is in, and a token to read it with. */
  CF_ACCOUNT_ID?: string;
  ANALYTICS_API_TOKEN?: string;
}

interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement;
}

interface D1Database {
  prepare: (sql: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<unknown>;
}

interface Row {
  day: string;
  app: string;
  version: string;
  os: string;
  country: string;
  since: string;
  dau: number;
  wau_firsts: number;
  mau_firsts: number;
  new_installs: number;
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS daily_usage (
  day TEXT NOT NULL,
  app TEXT NOT NULL,
  version TEXT NOT NULL,
  os TEXT NOT NULL,
  country TEXT NOT NULL,
  since TEXT NOT NULL,
  dau INTEGER NOT NULL,
  wau_firsts INTEGER NOT NULL,
  mau_firsts INTEGER NOT NULL,
  new_installs INTEGER NOT NULL,
  PRIMARY KEY (day, app, version, os, country, since)
)`;

/** The days before `now`'s, oldest first, that the next run sums again. */
export function rollupDays(now: Date, count = ROLLUP_DAYS): string[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(now.getTime() - (count - i) * 86_400_000)
      .toISOString()
      .slice(0, 10)
  );
}

/**
 * Analytics Engine samples rows at volume, each standing for
 * `_sample_interval` of them, so every count is a sum of it.
 */
export function rollupQuery(days: string[]): string {
  return `SELECT blob2 AS day, blob1 AS app, blob3 AS version, blob4 AS os,
  blob5 AS country, blob6 AS since,
  SUM(_sample_interval) AS dau,
  SUM(_sample_interval * double1) AS wau_firsts,
  SUM(_sample_interval * double2) AS mau_firsts,
  SUM(_sample_interval * double3) AS new_installs
FROM ${DATASET}
WHERE timestamp > NOW() - INTERVAL '${days.length + 2}' DAY
  AND blob2 IN (${days.map((day) => `'${day}'`).join(", ")})
GROUP BY day, app, version, os, country, since
FORMAT JSON`;
}

export async function rollUpUsage(
  env: RollupEnv,
  now = new Date()
): Promise<void> {
  const {
    USAGE_DB: db,
    CF_ACCOUNT_ID: account,
    ANALYTICS_API_TOKEN: token,
  } = env;
  if (!db || !account || !token) {
    console.warn(
      "usage rollup skipped: USAGE_DB, CF_ACCOUNT_ID or ANALYTICS_API_TOKEN is not set"
    );
    return;
  }
  const days = rollupDays(now);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: rollupQuery(days),
    }
  );
  if (!response.ok)
    throw new Error(
      `Analytics Engine answered ${response.status}: ${await response.text()}`
    );
  const { data } = (await response.json()) as { data: Row[] };

  const insert = db.prepare(
    `INSERT INTO daily_usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // One batch is one transaction: the days are replaced whole or not at all.
  await db.batch([
    db.prepare(SCHEMA),
    db
      .prepare(
        `DELETE FROM daily_usage WHERE day IN (${days.map(() => "?").join(", ")})`
      )
      .bind(...days),
    ...data.map((row) =>
      insert.bind(
        row.day,
        row.app,
        row.version,
        row.os,
        row.country,
        row.since,
        Math.round(Number(row.dau)),
        Math.round(Number(row.wau_firsts)),
        Math.round(Number(row.mau_firsts)),
        Math.round(Number(row.new_installs))
      )
    ),
  ]);
}
