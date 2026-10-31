import { Hono, type Context } from 'hono';
import { formPage, listPage, statsPage } from './pages';
import { reseed } from './seed';
import { getStats } from './stats';
import { MAX_TICKETS, PRIORITIES, STATUSES, TYPES, type Ticket } from './tickets';

// The entry module exports only the handler; workerd treats every named export as an entrypoint.
const CLOSED = ['done', 'rejected'];

const LIMITS = { requester: 100, item: 200, reason: 1000, assignee: 100, approver: 100 };

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

const fail = (c: Ctx, status: 400 | 403 | 404 | 409 | 415 | 429, error: string, extra: object = {}) =>
  c.json({ error, ...extra }, status);

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Writes only accept JSON, so a plain HTML form on another site cannot post here.
app.on(['POST', 'PATCH'], '/api/*', async (c, next) => {
  if (!(c.req.header('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return fail(c, 415, 'content-type must be application/json');
  }
  await next();
});

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

// Returns the trimmed string, or an error message.
function text(body: Record<string, unknown>, key: keyof typeof LIMITS): string | { error: string } {
  const v = body[key];
  if (typeof v !== 'string' || !v.trim()) return { error: `${key} is required` };
  if (v.length > LIMITS[key]) return { error: `${key} must be at most ${LIMITS[key]} characters` };
  return v.trim();
}

async function readBody(c: Ctx): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function parseId(raw: string): number | null {
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}

const getTicket = (db: D1Database, id: number) =>
  db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first<Ticket>();

const approveUrl = (c: Ctx, id: number) => `${new URL(c.req.url).origin}/tickets#ticket-${id}`;

async function listTickets(db: D1Database, status?: string): Promise<Ticket[]> {
  const stmt = status
    ? db.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY id DESC LIMIT 500').bind(status)
    : db.prepare('SELECT * FROM tickets ORDER BY id DESC LIMIT 500');
  return (await stmt.all<Ticket>()).results;
}

// ---- REST API ----

app.post('/api/tickets', async (c) => {
  const body = await readBody(c);
  if (!body) return fail(c, 400, 'body must be a JSON object');
  if (!isOneOf(TYPES, body.type)) return fail(c, 400, `type must be one of: ${TYPES.join(', ')}`);
  const fields = { requester: text(body, 'requester'), item: text(body, 'item'), reason: text(body, 'reason') };
  for (const v of Object.values(fields)) if (typeof v !== 'string') return fail(c, 400, v.error);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM tickets').first<number>('n');
  if ((count ?? 0) >= MAX_TICKETS) return fail(c, 429, 'demo is full; it resets every day');

  const ticket = await c.env.DB.prepare(
    `INSERT INTO tickets (type, requester, item, reason, status, created_at)
     VALUES (?, ?, ?, ?, 'new', ?) RETURNING *`,
  )
    .bind(body.type, fields.requester, fields.item, fields.reason, new Date().toISOString())
    .first<Ticket>();
  return c.json(ticket, 201);
});

app.get('/api/tickets', async (c) => {
  const status = c.req.query('status');
  if (status !== undefined && status !== '' && !isOneOf(STATUSES, status)) {
    return fail(c, 400, `status must be one of: ${STATUSES.join(', ')}`);
  }
  return c.json(await listTickets(c.env.DB, status || undefined));
});

app.get('/api/tickets/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const ticket = id && (await getTicket(c.env.DB, id));
  return ticket ? c.json(ticket) : fail(c, 404, 'ticket not found');
});

app.patch('/api/tickets/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const ticket = id && (await getTicket(c.env.DB, id));
  if (!id || !ticket) return fail(c, 404, 'ticket not found');
  const body = await readBody(c);
  if (!body) return fail(c, 400, 'body must be a JSON object');

  const set: Record<string, string> = {};
  if ('priority' in body) {
    if (!isOneOf(PRIORITIES, body.priority)) return fail(c, 400, `priority must be one of: ${PRIORITIES.join(', ')}`);
    set.priority = body.priority;
  }
  if ('assignee' in body) {
    const assignee = text(body, 'assignee');
    if (typeof assignee !== 'string') return fail(c, 400, assignee.error);
    set.assignee = assignee;
  }
  if ('status' in body) {
    if (!isOneOf(STATUSES, body.status)) return fail(c, 400, `status must be one of: ${STATUSES.join(', ')}`);
    set.status = body.status;
  }
  if (Object.keys(set).length === 0) return fail(c, 400, 'nothing to update: send priority, assignee or status');

  if (CLOSED.includes(ticket.status)) return fail(c, 409, `ticket is already ${ticket.status}`);
  const closing = set.status !== undefined && CLOSED.includes(set.status);
  if (closing && !ticket.approved_by) {
    return fail(c, 409, 'approval required: a human must approve before this ticket can be closed', {
      approve_url: approveUrl(c, id),
    });
  }

  const now = new Date().toISOString();
  const assigns: string[] = Object.keys(set).map((k) => `${k} = ?`);
  const values: string[] = Object.values(set);
  if (set.status === 'assigned' || set.status === 'in_progress') assigns.push('assigned_at = COALESCE(assigned_at, ?)'), values.push(now);
  if (set.status === 'in_progress') assigns.push('started_at = COALESCE(started_at, ?)'), values.push(now);
  if (closing) assigns.push('closed_at = ?'), values.push(now);

  // The WHERE clause re-checks the gate so a concurrent request cannot slip past it.
  const result = await c.env.DB.prepare(
    `UPDATE tickets SET ${assigns.join(', ')}
     WHERE id = ? AND status NOT IN ('done', 'rejected')${closing ? ' AND approved_by IS NOT NULL' : ''}`,
  )
    .bind(...values, id)
    .run();
  if (result.meta.changes === 0) return fail(c, 409, 'ticket changed while updating, read it again');
  return c.json(await getTicket(c.env.DB, id));
});

app.post('/api/tickets/:id/approve', async (c) => {
  const id = parseId(c.req.param('id'));
  const ticket = id && (await getTicket(c.env.DB, id));
  if (!id || !ticket) return fail(c, 404, 'ticket not found');
  // Approvals come from our own list page. Browsers always send Origin on cross-site POSTs.
  const origin = c.req.header('origin');
  if (origin && origin !== new URL(c.req.url).origin) return fail(c, 403, 'approvals must come from the ticket list page');
  const body = await readBody(c);
  if (!body) return fail(c, 400, 'body must be a JSON object');
  const approver = text(body, 'approver');
  if (typeof approver !== 'string') return fail(c, 400, approver.error);
  if (CLOSED.includes(ticket.status)) return fail(c, 409, `ticket is already ${ticket.status}`);
  if (ticket.approved_by) return c.json(ticket);

  await c.env.DB.prepare('UPDATE tickets SET approved_by = ? WHERE id = ? AND approved_by IS NULL')
    .bind(approver, id)
    .run();
  return c.json(await getTicket(c.env.DB, id));
});

app.get('/api/stats', async (c) => c.json(await getStats(c.env.DB)));

app.all('/api/*', (c) => fail(c, 404, 'no such endpoint'));

// ---- Pages ----

app.get('/', (c) => c.html(formPage()));

app.get('/tickets', async (c) => {
  const status = c.req.query('status');
  const filter = isOneOf(STATUSES, status) ? status : undefined;
  return c.html(listPage(await listTickets(c.env.DB, filter), filter));
});

app.get('/stats', async (c) => c.html(statsPage(await getStats(c.env.DB))));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(reseed(env.DB));
  },
} satisfies ExportedHandler<Env>;
