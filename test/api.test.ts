import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

const SELF = (exports as unknown as { default: Fetcher }).default;
const BASE = 'https://tickets.test';

async function api(path: string, method = 'GET', body?: unknown) {
  const res = await SELF.fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

const newTicket = (over: Record<string, unknown> = {}) =>
  api('/api/tickets', 'POST', {
    type: 'device',
    requester: '測試用申請人',
    item: '27 吋外接螢幕',
    reason: '原本的螢幕閃爍',
    ...over,
  });

beforeEach(async () => {
  await env.DB.exec('DELETE FROM tickets');
});

describe('POST /api/tickets', () => {
  it('creates a ticket with status new and no approval', async () => {
    const { status, json } = await newTicket();
    expect(status).toBe(201);
    expect(json).toMatchObject({ type: 'device', status: 'new', approved_by: null, priority: null });
    expect(json.id).toBeTypeOf('number');
    expect(Date.parse(json.created_at)).not.toBeNaN();
  });

  it('rejects an unknown type and missing fields with 400', async () => {
    expect((await newTicket({ type: 'coffee' })).status).toBe(400);
    expect((await newTicket({ reason: '   ' })).status).toBe(400);
    expect((await newTicket({ item: 'x'.repeat(201) })).status).toBe(400);
  });
});

describe('GET /api/tickets', () => {
  it('lists tickets as an array and filters by status', async () => {
    const a = (await newTicket()).json;
    await newTicket({ type: 'access', item: 'VPN 帳號' });
    await api(`/api/tickets/${a.id}`, 'PATCH', { assignee: '值班工程師', status: 'assigned' });

    const all = await api('/api/tickets');
    expect(all.status).toBe(200);
    expect(Array.isArray(all.json)).toBe(true);
    expect(all.json).toHaveLength(2);

    const assigned = await api('/api/tickets?status=assigned');
    expect(assigned.json.map((t: any) => t.id)).toEqual([a.id]);
    expect((await api('/api/tickets?status=lost')).status).toBe(400);
  });

  it('gets one ticket by id and 404s for a missing one', async () => {
    const { json } = await newTicket();
    expect((await api(`/api/tickets/${json.id}`)).json.item).toBe('27 吋外接螢幕');
    expect((await api('/api/tickets/999999')).status).toBe(404);
    expect((await api('/api/tickets/abc')).status).toBe(404);
  });
});

describe('PATCH /api/tickets/:id', () => {
  it('updates priority, assignee and status, stamping assigned_at and started_at', async () => {
    const { json } = await newTicket();
    const assigned = await api(`/api/tickets/${json.id}`, 'PATCH', { priority: 'P2', assignee: '值班工程師', status: 'assigned' });
    expect(assigned.status).toBe(200);
    expect(assigned.json).toMatchObject({ priority: 'P2', assignee: '值班工程師', status: 'assigned' });
    expect(assigned.json.assigned_at).not.toBeNull();

    const started = await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'in_progress' });
    expect(started.json.started_at).not.toBeNull();
    expect(started.json.assigned_at).toBe(assigned.json.assigned_at);
  });

  it('returns 409 when closing as done without approval, and leaves the ticket unchanged', async () => {
    const { json } = await newTicket();
    const res = await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'done' });
    expect(res.status).toBe(409);
    expect(res.json.error).toMatch(/approval required/);
    expect(res.json.approve_url).toContain(`/tickets#ticket-${json.id}`);

    const after = (await api(`/api/tickets/${json.id}`)).json;
    expect(after.status).toBe('new');
    expect(after.closed_at).toBeNull();
  });

  it('returns 409 when rejecting without approval', async () => {
    const { json } = await newTicket();
    expect((await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'rejected' })).status).toBe(409);
  });

  it('closes as done once a human has approved', async () => {
    const { json } = await newTicket();
    const approved = await api(`/api/tickets/${json.id}/approve`, 'POST', { approver: '部門主管' });
    expect(approved.status).toBe(200);
    expect(approved.json.approved_by).toBe('部門主管');

    const done = await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'done' });
    expect(done.status).toBe(200);
    expect(done.json.status).toBe('done');
    expect(done.json.closed_at).not.toBeNull();
  });

  it('does not let a closed ticket change again', async () => {
    const { json } = await newTicket();
    await api(`/api/tickets/${json.id}/approve`, 'POST', { approver: '部門主管' });
    await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'done' });
    expect((await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'in_progress' })).status).toBe(409);
  });

  it('rejects invalid values with 400', async () => {
    const { json } = await newTicket();
    expect((await api(`/api/tickets/${json.id}`, 'PATCH', { priority: 'P0' })).status).toBe(400);
    expect((await api(`/api/tickets/${json.id}`, 'PATCH', { status: 'archived' })).status).toBe(400);
    expect((await api(`/api/tickets/${json.id}`, 'PATCH', {})).status).toBe(400);
  });
});

describe('POST /api/tickets/:id/approve', () => {
  it('needs an approver name and keeps the first approver', async () => {
    const { json } = await newTicket();
    expect((await api(`/api/tickets/${json.id}/approve`, 'POST', {})).status).toBe(400);
    await api(`/api/tickets/${json.id}/approve`, 'POST', { approver: '甲主管' });
    const again = await api(`/api/tickets/${json.id}/approve`, 'POST', { approver: '乙主管' });
    expect(again.json.approved_by).toBe('甲主管');
  });
});

describe('pages', () => {
  it('escapes user text on the ticket list', async () => {
    await newTicket({ item: '<script>alert(1)</script>' });
    const html = await (await SELF.fetch(`${BASE}/tickets`)).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('class="small approve"');
  });
});
