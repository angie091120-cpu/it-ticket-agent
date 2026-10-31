// Deterministic fake tickets. Names come from faker; nothing here is a real person or company.
import { fakerZH_TW as faker } from '@faker-js/faker';

const HOUR = 3600 * 1000;

const CATALOG = {
  device: {
    weight: 0.4,
    items: ['27 吋外接螢幕', '筆記型電腦', '無線鍵盤滑鼠組', '降噪耳機', 'USB-C 擴充座', '網路攝影機', '印表機碳粉匣'],
    reasons: ['原本的設備故障無法開機', '螢幕畫面閃爍', '新進同仁到職需要', '專案需要雙螢幕對照圖面', '設備老舊，開檔速度很慢', '遠端會議收音不清楚'],
  },
  access: {
    weight: 0.3,
    items: ['VPN 帳號', '部門共用資料夾權限', '報表系統唯讀權限', '採購系統簽核權限', '測試環境資料庫唯讀帳號', '會議室預約系統管理權限'],
    reasons: ['調任新部門需要存取', '跨部門專案要查資料', '代理主管簽核期間需要', '出差期間要從外部連線', '新進同仁到職需要', '稽核作業需要查詢歷史紀錄'],
  },
  software: {
    weight: 0.3,
    items: ['Python 3.12 開發環境', 'Visual Studio Code', 'PDF 編輯軟體', '統計分析軟體', '繪圖軟體', '視訊會議軟體外掛'],
    reasons: ['資料分析工作需要', '要編輯外部廠商寄來的文件', '專案改用新工具', '原版本過期無法開啟檔案', '教育訓練課程指定使用'],
  },
};

const DEPARTMENTS = ['製造部', '品保部', '財務部', '人資部', '業務部', '研發部', '採購部'];

function pickType() {
  const r = faker.number.float({ min: 0, max: 1 });
  if (r < CATALOG.device.weight) return 'device';
  if (r < CATALOG.device.weight + CATALOG.access.weight) return 'access';
  return 'software';
}

// Rough log-normal-ish delay in hours.
function delay(minH, maxH) {
  const r = faker.number.float({ min: 0, max: 1 });
  return (minH + (maxH - minH) * r * r) * HOUR;
}

const iso = (ms) => new Date(ms).toISOString();

/**
 * @param {{ count?: number, now?: Date, seed?: number }} opts
 * Timestamps fall in the 8 weeks before `now`. Same seed + same `now` gives the same rows.
 */
export function generateTickets({ count = 200, now = new Date(), seed = 42 } = {}) {
  faker.seed(seed);
  const nowMs = now.getTime();
  const staff = Array.from({ length: 5 }, () => faker.person.fullName());
  const managers = Array.from({ length: 4 }, () => faker.person.fullName());
  const tickets = [];

  for (let id = 1; id <= count; id++) {
    const type = pickType();
    const { items, reasons } = CATALOG[type];
    const createdMs = nowMs - faker.number.float({ min: 0.05, max: 56 }) * 24 * HOUR;
    // About a third of tickets get stuck somewhere (waiting on stock, a vendor, a sign-off).
    const stall = faker.number.float({ min: 0, max: 1 }) < 0.35 ? faker.number.float({ min: 4, max: 14 }) : 1;
    const assignedMs = createdMs + delay(0.2, type === 'access' ? 8 : 30) * stall;
    const startedMs = assignedMs + delay(0.5, 48) * stall;
    const workMs = delay(1, type === 'device' ? 160 : 72) * stall;
    const closedMs = startedMs + workMs;
    const rejected = faker.number.float({ min: 0, max: 1 }) < 0.08;
    // Some finished work still waits for a human to approve.
    const approvalLagMs = delay(0, 36);

    const t = {
      id,
      type,
      requester: `${faker.person.fullName()}（${faker.helpers.arrayElement(DEPARTMENTS)}）`,
      item: faker.helpers.arrayElement(items),
      reason: faker.helpers.arrayElement(reasons),
      priority: null,
      status: 'new',
      assignee: null,
      created_at: iso(createdMs),
      assigned_at: null,
      started_at: null,
      closed_at: null,
      approved_by: null,
    };

    if (assignedMs < nowMs) {
      t.status = 'assigned';
      t.assigned_at = iso(assignedMs);
      t.assignee = faker.helpers.arrayElement(staff);
      t.priority = type === 'access' ? 'P1' : faker.helpers.arrayElement(['P2', 'P2', 'P3']);
      if (rejected) {
        t.status = 'rejected';
        t.approved_by = faker.helpers.arrayElement(managers);
        t.closed_at = iso(Math.min(nowMs, assignedMs + delay(0.5, 24)));
      } else if (startedMs < nowMs) {
        t.status = 'in_progress';
        t.started_at = iso(startedMs);
        if (closedMs < nowMs) t.approved_by = faker.helpers.arrayElement(managers);
        if (closedMs + approvalLagMs < nowMs) {
          t.status = 'done';
          t.closed_at = iso(closedMs + approvalLagMs);
        }
      }
    }
    tickets.push(t);
  }
  return tickets;
}

export const COLUMNS = [
  'id', 'type', 'requester', 'item', 'reason', 'priority', 'status', 'assignee',
  'created_at', 'assigned_at', 'started_at', 'closed_at', 'approved_by',
];

const sqlValue = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// Full reset: running it twice leaves exactly `tickets.length` rows.
export function toSeedSql(tickets) {
  const lines = ['DELETE FROM tickets;'];
  for (const t of tickets) {
    lines.push(`INSERT INTO tickets (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((c) => sqlValue(t[c])).join(', ')});`);
  }
  return lines.join('\n') + '\n';
}
