import type { Ticket } from './tickets';
import type { Stats } from './stats';

const REPO_URL = 'https://github.com/angie091120-cpu/it-ticket-agent';

const TYPE_LABEL: Record<string, string> = { device: '設備', access: '權限', software: '軟體' };
const STATUS_LABEL: Record<string, string> = {
  new: '待分派',
  assigned: '已分派',
  in_progress: '處理中',
  done: '已結案',
  rejected: '已駁回',
};
const STAGE_LABEL: Record<string, string> = {
  created: '建單',
  assigned: '分派',
  in_progress: '開始處理',
  done: '結案',
  rejected: '駁回',
  new_to_assigned: '建單 → 分派',
  assigned_to_in_progress: '分派 → 開始處理',
  in_progress_to_done: '開始處理 → 結案',
};

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root {
  --bg: #f6f7f9; --surface: #ffffff; --text: #1d2330; --muted: #5d6677; --line: #dde1e8;
  --accent: #2f5bd3; --accent-text: #ffffff; --ok: #1f7a4d; --warn: #9a5b00; --bar: #c9d6f5;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12151b; --surface: #1b2029; --text: #e6e9ef; --muted: #9aa3b2; --line: #2c3340;
    --accent: #7c9cf0; --accent-text: #0f1420; --ok: #5cc28c; --warn: #e0a548; --bar: #33456f;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", "Noto Sans TC", "PingFang TC", sans-serif; }
header { background: var(--surface); border-bottom: 1px solid var(--line); }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 16px; }
nav { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; min-height: 56px; }
nav strong { margin-right: auto; }
nav a { color: var(--muted); text-decoration: none; }
nav a[aria-current] { color: var(--text); font-weight: 600; }
main { padding: 24px 0 48px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 32px 0 12px; }
.lead { color: var(--muted); margin: 0 0 24px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px; }
label { display: block; font-weight: 600; margin: 16px 0 6px; }
label:first-child { margin-top: 0; }
input, select, textarea { width: 100%; font: inherit; color: inherit; background: var(--bg);
  border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
textarea { min-height: 96px; resize: vertical; }
button { font: inherit; border: 0; border-radius: 8px; padding: 10px 18px; cursor: pointer;
  background: var(--accent); color: var(--accent-text); font-weight: 600; }
button:disabled { opacity: .5; cursor: default; }
button.small { padding: 4px 12px; font-size: .9rem; }
.form { max-width: 560px; }
.form button { margin-top: 20px; width: 100%; }
#result { margin-top: 16px; min-height: 1.6em; }
.muted { color: var(--muted); }
.ok { color: var(--ok); font-weight: 600; }
.warn { color: var(--warn); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.chips a { padding: 4px 12px; border: 1px solid var(--line); border-radius: 999px;
  color: var(--text); text-decoration: none; font-size: .9rem; background: var(--surface); }
.chips a[aria-current] { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.approver { display: flex; gap: 8px; align-items: center; max-width: 420px; margin-bottom: 16px; }
.approver label { margin: 0; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; background: var(--surface);
  border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: .85rem; color: var(--muted); font-weight: 600; white-space: nowrap; }
table.tickets td[data-label] { white-space: nowrap; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:target { outline: 2px solid var(--accent); outline-offset: -2px; }
.item { font-weight: 600; }
.reason { color: var(--muted); font-size: .9rem; overflow-wrap: anywhere; }
@media (max-width: 640px) {
  table.tickets, table.tickets tbody, table.tickets tr, table.tickets td { display: block; width: 100%; }
  table.tickets thead { display: none; }
  table.tickets tr { border-bottom: 1px solid var(--line); padding: 8px 0; }
  table.tickets td { border: 0; padding: 4px 12px; }
  table.tickets td[data-label]::before { content: attr(data-label) "："; color: var(--muted); font-size: .85rem; }
}
.bars { display: grid; gap: 8px; }
.bar-row { display: grid; grid-template-columns: 6.5em 1fr 3.5em; gap: 8px; align-items: center; }
.bar { height: 22px; background: var(--bar); border-radius: 4px; min-width: 2px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.kpi .value { font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.kpi .label { color: var(--muted); font-size: .9rem; }
.weeks { display: flex; align-items: flex-end; gap: 6px; height: 160px; padding-top: 8px; }
.week { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
.week .col { width: 100%; background: var(--bar); border-radius: 4px 4px 0 0; }
.week .n { font-size: .85rem; font-variant-numeric: tabular-nums; }
.week .d { font-size: .75rem; color: var(--muted); white-space: nowrap; }
.table-scroll { overflow-x: auto; }
`;

function layout(title: string, current: string, body: string, script = ''): string {
  const link = (href: string, label: string) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}｜IT 工單 Agent</title>
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap"><nav>
<strong>IT 工單 Agent</strong>
${link('/', '申請')}${link('/tickets', '工單列表')}${link('/stats', '漏斗數字')}
<a href="${REPO_URL}">GitHub</a>
</nav></div></header>
<main><div class="wrap">${body}</div></main>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

export function formPage(): string {
  const body = `
<h1>IT 申請</h1>
<p class="lead">設備、權限、軟體安裝都從這裡送單。送出後由 Agent 分類、排優先序，結案前需要主管在工單列表核准。</p>
<form class="card form" id="ticket-form">
  <label for="type">類型</label>
  <select id="type" name="type" required>
    <option value="device">設備（螢幕、筆電、周邊）</option>
    <option value="access">權限（系統帳號、資料夾）</option>
    <option value="software">軟體安裝</option>
  </select>
  <label for="requester">申請人</label>
  <input id="requester" name="requester" maxlength="100" required autocomplete="name">
  <label for="item">申請項目</label>
  <input id="item" name="item" maxlength="200" required placeholder="例如：27 吋外接螢幕">
  <label for="reason">原因</label>
  <textarea id="reason" name="reason" maxlength="1000" required placeholder="例如：原本的螢幕閃爍，影響看圖面"></textarea>
  <button type="submit">送出申請</button>
  <p id="result" role="status"></p>
</form>`;
  const script = `
document.getElementById('ticket-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target, out = document.getElementById('result'), btn = form.querySelector('button');
  btn.disabled = true; out.className = 'muted'; out.textContent = '送出中…';
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.status);
    out.className = 'ok';
    out.textContent = '已建立工單 #' + data.id + '，可到工單列表查看。';
    form.reset();
  } catch (err) {
    out.className = 'warn'; out.textContent = '送出失敗：' + err.message;
  } finally { btn.disabled = false; }
});`;
  return layout('申請', '/', body, script);
}

export function listPage(tickets: Ticket[], filter?: string): string {
  const chip = (status: string | undefined, label: string) =>
    `<a href="/tickets${status ? `?status=${status}` : ''}"${status === filter ? ' aria-current="page"' : ''}>${label}</a>`;
  const rows = tickets
    .map((t) => {
      const closed = t.status === 'done' || t.status === 'rejected';
      const approval = t.approved_by
        ? `<span class="ok">✓ ${esc(t.approved_by)}</span>`
        : closed
          ? '<span class="muted">—</span>'
          : `<button class="small approve" data-id="${t.id}">核准</button>`;
      return `<tr id="ticket-${t.id}">
<td data-label="編號">#${t.id}</td>
<td data-label="類型">${esc(TYPE_LABEL[t.type] ?? t.type)}</td>
<td><div class="item">${esc(t.item)}</div><div class="reason">${esc(t.reason)}</div></td>
<td data-label="申請人">${esc(t.requester)}</td>
<td data-label="優先序">${esc(t.priority ?? '—')}</td>
<td data-label="狀態">${esc(STATUS_LABEL[t.status] ?? t.status)}</td>
<td data-label="處理人">${esc(t.assignee ?? '—')}</td>
<td data-label="核准" class="approval">${approval}</td>
</tr>`;
    })
    .join('');
  const body = `
<h1>工單列表</h1>
<p class="lead">Agent 可以建單、分派、結案，但不能核准。按下「核准」後，Agent 才能把工單結案。</p>
<div class="chips">${chip(undefined, '全部')}${Object.entries(STATUS_LABEL)
    .map(([s, label]) => chip(s, label))
    .join('')}</div>
<div class="approver"><label for="approver">核准人</label><input id="approver" maxlength="100" placeholder="你的名字"></div>
<p id="notice" class="warn" role="status"></p>
${
  tickets.length
    ? `<table class="tickets"><thead><tr><th>編號</th><th>類型</th><th>項目與原因</th><th>申請人</th><th>優先序</th><th>狀態</th><th>處理人</th><th>核准</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p class="muted">沒有符合的工單。</p>'
}`;
  const script = `
const approverInput = document.getElementById('approver'), notice = document.getElementById('notice');
try { approverInput.value = localStorage.getItem('approver') || ''; } catch {}
document.querySelectorAll('button.approve').forEach((btn) => btn.addEventListener('click', async () => {
  const approver = approverInput.value.trim();
  if (!approver) { notice.textContent = '請先填核准人。'; approverInput.focus(); return; }
  try { localStorage.setItem('approver', approver); } catch {}
  btn.disabled = true; notice.textContent = '';
  try {
    const res = await fetch('/api/tickets/' + btn.dataset.id + '/approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approver }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.status);
    const span = document.createElement('span');
    span.className = 'ok'; span.textContent = '✓ ' + data.approved_by;
    btn.replaceWith(span);
  } catch (err) {
    btn.disabled = false; notice.textContent = '核准失敗：' + err.message;
  }
}));`;
  return layout('工單列表', '/tickets', body, script);
}

export function statsPage(stats: Stats): string {
  const stages = stats.stage_counts ?? [];
  const created = Number(stages.find((s) => s.stage === 'created')?.tickets ?? 0) || 1;
  const stageBars = stages
    .map(
      (s) => `<div class="bar-row"><span>${esc(STAGE_LABEL[String(s.stage)] ?? s.stage)}</span>
<div class="bar" style="width:${((Number(s.tickets) / created) * 100).toFixed(1)}%"></div>
<span class="num" data-stat="stage_counts.${esc(s.stage)}">${esc(s.tickets)}</span></div>`,
    )
    .join('');

  const medians = (stats.median_hours ?? [])
    .map(
      (m) => `<div class="card kpi"><div class="value"><span data-stat="median_hours.${esc(m.stage)}">${esc(m.median_hours)}</span> 小時</div>
<div class="label">${esc(STAGE_LABEL[String(m.stage)] ?? m.stage)}（${esc(m.samples)} 筆）</div></div>`,
    )
    .join('');

  const backlog = (stats.backlog_by_type ?? [])
    .map(
      (b) => `<tr><td>${esc(TYPE_LABEL[String(b.type)] ?? b.type)}</td>
<td class="num" data-stat="backlog_by_type.${esc(b.type)}.new_count">${esc(b.new_count)}</td>
<td class="num" data-stat="backlog_by_type.${esc(b.type)}.assigned_count">${esc(b.assigned_count)}</td>
<td class="num" data-stat="backlog_by_type.${esc(b.type)}.in_progress_count">${esc(b.in_progress_count)}</td>
<td class="num" data-stat="backlog_by_type.${esc(b.type)}.open_total"><strong>${esc(b.open_total)}</strong></td></tr>`,
    )
    .join('');

  const weeks = stats.weekly_done ?? [];
  const maxWeek = Math.max(1, ...weeks.map((w) => Number(w.done)));
  const weekCols = weeks
    .map(
      (w) => `<div class="week"><span class="n" data-stat="weekly_done.${esc(w.week_start)}">${esc(w.done)}</span>
<div class="col" style="height:${((Number(w.done) / maxWeek) * 100).toFixed(1)}%"></div>
<span class="d">${esc(String(w.week_start).slice(5))}</span></div>`,
    )
    .join('');

  const body = `
<h1>工單漏斗</h1>
<p class="lead">四組數字都由 <code>sql/funnel.sql</code> 直接查出，跟 repo 裡的 SQL 是同一份。</p>
<h2>各階段筆數</h2>
<div class="card bars">${stageBars}</div>
<h2>各階段中位停留時間</h2>
<div class="kpis">${medians || '<p class="muted">資料不足。</p>'}</div>
<h2>依類型的積壓（未結案）</h2>
<div class="table-scroll"><table><thead><tr><th>類型</th><th class="num">待分派</th><th class="num">已分派</th><th class="num">處理中</th><th class="num">合計</th></tr></thead>
<tbody>${backlog || '<tr><td colspan="5" class="muted">沒有積壓。</td></tr>'}</tbody></table></div>
<h2>近 8 週每週結案量</h2>
<div class="card">${weekCols ? `<div class="weeks">${weekCols}</div>` : '<p class="muted">近 8 週沒有結案。</p>'}
<p class="muted" style="margin:8px 0 0;font-size:.85rem">橫軸是每週一的日期。</p></div>`;
  return layout('漏斗數字', '/stats', body);
}
