CREATE TABLE tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK (type IN ('device', 'access', 'software')),
  requester   TEXT NOT NULL,
  item        TEXT NOT NULL,
  reason      TEXT NOT NULL,
  priority    TEXT CHECK (priority IN ('P1', 'P2', 'P3')),
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'assigned', 'in_progress', 'done', 'rejected')),
  assignee    TEXT,
  created_at  TEXT NOT NULL,
  assigned_at TEXT,
  started_at  TEXT,
  closed_at   TEXT,
  approved_by TEXT  -- NULL = no human has approved yet
);

CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_tickets_closed_at ON tickets (closed_at);
