import funnelSql from '../sql/funnel.sql';

export type Stats = Record<string, Record<string, unknown>[]>;

// Splits sql/funnel.sql on its "-- name: <key>" markers.
export function parseFunnelSql(text: string): { name: string; sql: string }[] {
  return text
    .split(/^-- name: /m)
    .slice(1)
    .map((block) => {
      const newline = block.indexOf('\n');
      const name = block.slice(0, newline).trim();
      const sql = block
        .slice(newline + 1)
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
        .replace(/;$/, '');
      return { name, sql };
    });
}

export const FUNNEL_QUERIES = parseFunnelSql(funnelSql);

export async function getStats(db: D1Database): Promise<Stats> {
  const results = await db.batch(FUNNEL_QUERIES.map((q) => db.prepare(q.sql)));
  const stats: Stats = {};
  FUNNEL_QUERIES.forEach((q, i) => {
    stats[q.name] = results[i].results as Record<string, unknown>[];
  });
  return stats;
}
