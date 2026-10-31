export const TYPES = ['device', 'access', 'software'] as const;
export const STATUSES = ['new', 'assigned', 'in_progress', 'done', 'rejected'] as const;
export const PRIORITIES = ['P1', 'P2', 'P3'] as const;

// The public demo has no login; this caps how much anyone can add before the daily reseed.
export const MAX_TICKETS = 500;

export interface Ticket {
  id: number;
  type: (typeof TYPES)[number];
  requester: string;
  item: string;
  reason: string;
  priority: (typeof PRIORITIES)[number] | null;
  status: (typeof STATUSES)[number];
  assignee: string | null;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  approved_by: string | null;
}
