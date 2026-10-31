import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import funnelSql from '../sql/funnel.sql';
import { generateTickets, toSeedSql } from '../scripts/seed-data.mjs';

const SELF = (exports as unknown as { default: Fetcher }).default;
const BASE = 'https://tickets.test';
const NOW = new Date();
NOW.setUTCMinutes(0, 0, 0);
const tickets = generateTickets({ now: NOW });

async function seed() {
  const statements = toSeedSql(tickets).trim().split('\n');
  await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
}

// Runs each block of sql/funnel.sql straight against D1, independent of src/stats.ts.
async function runFunnelFile() {
  const out: Record<string, unknown[]> = {};
  for (const block of funnelSql.split(/^-- name: /m).slice(1)) {
    const [name, ...rest] = block.split('\n');
    out[name.trim()] = (await env.DB.prepare(rest.join('\n').trim()).all()).results;
  }
  return out;
}

beforeAll(seed);

describe('seed data', () => {
  it('has 200 rows covering every status, and re-seeding does not double them', async () => {
    await seed();
    const { results } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').all<{ status: string; n: number }>();
    expect(results.reduce((sum: number, r) => sum + r.n, 0)).toBe(200);
    expect(results.map((r) => r.status).sort()).toEqual(['assigned', 'done', 'in_progress', 'new', 'rejected']);
  });

  it('only closes tickets that a human approved', () => {
    for (const t of tickets) if (t.status === 'done' || t.status === 'rejected') expect(t.approved_by).not.toBeNull();
  });
});

describe('funnel', () => {
  it('/api/stats returns exactly what sql/funnel.sql returns', async () => {
    const res = await SELF.fetch(`${BASE}/api/stats`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(await runFunnelFile());
  });

  it('stage counts and backlog match a plain count over the seed rows', async () => {
    const stats = (await (await SELF.fetch(`${BASE}/api/stats`)).json()) as any;
    const count = (f: (t: any) => boolean) => tickets.filter(f).length;
    expect(stats.stage_counts).toEqual([
      { stage: 'created', tickets: 200 },
      { stage: 'assigned', tickets: count((t) => t.assigned_at) },
      { stage: 'in_progress', tickets: count((t) => t.started_at) },
      { stage: 'done', tickets: count((t) => t.status === 'done') },
      { stage: 'rejected', tickets: count((t) => t.status === 'rejected') },
    ]);
    const open = (type: string) => count((t) => t.type === type && ['new', 'assigned', 'in_progress'].includes(t.status));
    for (const row of stats.backlog_by_type) expect(row.open_total).toBe(open(row.type));
    expect(stats.median_hours.map((m: any) => m.stage)).toEqual(['new_to_assigned', 'assigned_to_in_progress', 'in_progress_to_done']);
    expect(stats.weekly_done).toHaveLength(8);
    expect(stats.weekly_done.reduce((s: number, w: any) => s + w.done, 0)).toBeGreaterThan(0);
  });

  it('/stats page shows the same numbers as the SQL', async () => {
    const html = await (await SELF.fetch(`${BASE}/stats`)).text();
    const shown = (key: string) => html.match(new RegExp(`data-stat="${key}">(?:<strong>)?([^<]+)<`))?.[1];
    const sql = (await runFunnelFile()) as Record<string, any[]>;

    for (const s of sql.stage_counts) expect(shown(`stage_counts.${s.stage}`)).toBe(String(s.tickets));
    for (const m of sql.median_hours) expect(shown(`median_hours.${m.stage}`)).toBe(String(m.median_hours));
    for (const b of sql.backlog_by_type) {
      for (const col of ['new_count', 'assigned_count', 'in_progress_count', 'open_total']) {
        expect(shown(`backlog_by_type.${b.type}.${col}`)).toBe(String(b[col]));
      }
    }
    for (const w of sql.weekly_done) expect(shown(`weekly_done.${w.week_start}`)).toBe(String(w.done));
  });
});
