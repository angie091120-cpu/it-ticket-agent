import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { MAX_TICKETS } from '../src/tickets';
import { DEMO_TICKETS } from '../scripts/demo-tickets.mjs';

const SELF = (exports as unknown as { default: Fetcher }).default;
const BASE = 'https://tickets.test';
const TICKET = { type: 'device', requester: '測試用申請人', item: '滑鼠', reason: '原本的壞了' };

const post = (path: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  SELF.fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

const count = () => env.DB.prepare('SELECT COUNT(*) AS n FROM tickets').first<number>('n');

beforeEach(async () => {
  await env.DB.exec('DELETE FROM tickets');
});

describe('public demo safety', () => {
  it('rejects writes that are not JSON with 415', async () => {
    expect((await post('/api/tickets', TICKET, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post('/api/tickets', TICKET, { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect(await count()).toBe(0);
  });

  it('refuses approvals posted from another site', async () => {
    const t = (await (await post('/api/tickets', TICKET)).json()) as { id: number };
    const res = await post(`/api/tickets/${t.id}/approve`, { approver: '路人' }, {
      'content-type': 'application/json',
      origin: 'https://evil.example',
    });
    expect(res.status).toBe(403);
    const same = await post(`/api/tickets/${t.id}/approve`, { approver: '部門主管' }, {
      'content-type': 'application/json',
      origin: BASE,
    });
    expect(same.status).toBe(200);
  });

  it(`stops creating tickets at ${MAX_TICKETS}`, async () => {
    const insert = env.DB.prepare(
      "INSERT INTO tickets (type, requester, item, reason, created_at) VALUES ('device', 'x', 'x', 'x', '2026-01-01T00:00:00Z')",
    );
    await env.DB.batch(Array.from({ length: MAX_TICKETS }, () => insert));
    const res = await post('/api/tickets', TICKET);
    expect(res.status).toBe(429);
    expect(await count()).toBe(MAX_TICKETS);
  });

  it('the daily cron wipes visitor edits and restores the seed', async () => {
    await post('/api/tickets', TICKET);
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController(), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await count()).toBe(200 + DEMO_TICKETS.length);
    const leftover = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets WHERE requester = '測試用申請人'").first<number>('n');
    expect(leftover).toBe(0);
  });

  it('sends basic security headers', async () => {
    const res = await SELF.fetch(`${BASE}/tickets`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});
