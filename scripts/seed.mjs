// npm run seed            -> local D1 (wrangler dev)
// npm run seed -- --remote -> the deployed D1
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateTickets, toSeedSql } from './seed-data.mjs';
import { DEMO_TICKETS } from './demo-tickets.mjs';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
const wrangler = (...args) =>
  execFileSync('npx', ['wrangler', 'd1', ...args, 'it-ticket-agent', target], {
    stdio: 'inherit',
    env: { ...process.env, CI: '1' }, // skip the interactive "apply migrations?" prompt
  });

// Anchor to the current hour so a re-run within the hour writes identical rows.
const now = new Date();
now.setUTCMinutes(0, 0, 0);
const tickets = [...generateTickets({ now }), ...DEMO_TICKETS];

mkdirSync('.seed', { recursive: true });
writeFileSync('.seed/seed.sql', toSeedSql(tickets));

wrangler('migrations', 'apply');
execFileSync('npx', ['wrangler', 'd1', 'execute', 'it-ticket-agent', target, '--file', '.seed/seed.sql', '--yes'], {
  stdio: 'inherit',
});
console.log(`seeded ${tickets.length} tickets (${target.slice(2)})`);
