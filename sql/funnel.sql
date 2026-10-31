-- Ticket funnel: four queries for the /stats page.
-- Each block starts with "-- name: <key>"; the Worker splits on that marker
-- and runs the blocks as-is, so this file is the single source of truth.
-- Run by hand: npx wrangler d1 execute it-ticket-agent --local --file sql/funnel.sql

-- name: stage_counts
-- How many tickets reached each stage.
SELECT 'created' AS stage, COUNT(*) AS tickets FROM tickets
UNION ALL
SELECT 'assigned', COUNT(*) FROM tickets WHERE assigned_at IS NOT NULL
UNION ALL
SELECT 'in_progress', COUNT(*) FROM tickets WHERE started_at IS NOT NULL
UNION ALL
SELECT 'done', COUNT(*) FROM tickets WHERE status = 'done'
UNION ALL
SELECT 'rejected', COUNT(*) FROM tickets WHERE status = 'rejected';

-- name: median_hours
-- Median time spent in each stage, in hours.
WITH durations AS (
  SELECT 1 AS ord, 'new_to_assigned' AS stage,
         (julianday(assigned_at) - julianday(created_at)) * 24 AS hours
  FROM tickets WHERE assigned_at IS NOT NULL
  UNION ALL
  SELECT 2, 'assigned_to_in_progress',
         (julianday(started_at) - julianday(assigned_at)) * 24
  FROM tickets WHERE started_at IS NOT NULL AND assigned_at IS NOT NULL
  UNION ALL
  SELECT 3, 'in_progress_to_done',
         (julianday(closed_at) - julianday(started_at)) * 24
  FROM tickets WHERE status = 'done' AND started_at IS NOT NULL
),
ranked AS (
  SELECT ord, stage, hours,
         ROW_NUMBER() OVER (PARTITION BY stage ORDER BY hours) AS rn,
         COUNT(*) OVER (PARTITION BY stage) AS n
  FROM durations
)
SELECT stage, ROUND(AVG(hours), 1) AS median_hours, MAX(n) AS samples
FROM ranked
WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY ord, stage
ORDER BY ord;

-- name: backlog_by_type
-- Open tickets per type, split by where they are stuck.
SELECT type,
       SUM(status = 'new')         AS new_count,
       SUM(status = 'assigned')    AS assigned_count,
       SUM(status = 'in_progress') AS in_progress_count,
       COUNT(*)                    AS open_total
FROM tickets
WHERE status IN ('new', 'assigned', 'in_progress')
GROUP BY type
ORDER BY open_total DESC, type;

-- name: weekly_done
-- Tickets closed as done per week (Monday start), current week plus the 7 before it.
-- Weeks with no closures still show up with 0.
WITH RECURSIVE weeks(week_start, n) AS (
  SELECT date('now', '-6 days', 'weekday 1', '-49 days'), 1
  UNION ALL
  SELECT date(week_start, '+7 days'), n + 1 FROM weeks WHERE n < 8
)
SELECT w.week_start,
       COUNT(t.id) AS done
FROM weeks w
LEFT JOIN tickets t
  ON t.status = 'done'
 AND date(t.closed_at, '-6 days', 'weekday 1') = w.week_start
GROUP BY w.week_start
ORDER BY w.week_start;
