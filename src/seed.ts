import { COLUMNS, generateTickets } from '../scripts/seed-data.mjs';
import { DEMO_TICKETS } from '../scripts/demo-tickets.mjs';

// Wipes the table and writes fresh seed rows dated relative to `now`, plus the pinned demo tickets.
// Runs from the daily cron so the public demo never keeps strangers' edits for long.
export async function reseed(db: D1Database, now = new Date()): Promise<number> {
  const anchor = new Date(now);
  anchor.setUTCMinutes(0, 0, 0);
  const rows: Record<string, unknown>[] = [...generateTickets({ now: anchor }), ...DEMO_TICKETS];
  const insert = db.prepare(
    `INSERT INTO tickets (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`,
  );
  await db.batch([db.prepare('DELETE FROM tickets'), ...rows.map((r) => insert.bind(...COLUMNS.map((c: string) => r[c] ?? null)))]);
  return rows.length;
}
