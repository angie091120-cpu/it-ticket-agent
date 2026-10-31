"""Triage rules: plain, readable keyword rules so a reviewer can see why a ticket got its priority.

Priorities: P1 = someone cannot work, P2 = degraded or has a deadline, P3 = nice to have.
"""

from __future__ import annotations

from dataclasses import dataclass

TEAMS = {"device": "設備組", "access": "帳號權限組", "software": "軟體組"}

# (keywords, priority, why) checked in order; first match wins.
DEVICE_RULES = [
    (("無法開機", "故障", "壞了", "壞掉", "不能用"), "P1", "設備故障，申請人目前無法工作"),
    (("到職", "新進"), "P2", "新人到職，有固定到職日"),
    (("閃爍", "很慢", "老舊", "收音"), "P2", "設備還能用但影響效率"),
]
SOFTWARE_RULES = [
    (("過期", "無法開啟", "打不開"), "P2", "現有軟體已經不能用"),
    (("到職", "新進", "課程"), "P2", "有固定日期要用"),
]


@dataclass(frozen=True)
class Triage:
    priority: str
    assignee: str
    why: str


def _match(text: str, rules) -> tuple[str, str] | None:
    for keywords, priority, why in rules:
        hit = next((k for k in keywords if k in text), None)
        if hit:
            return priority, f"{why}（關鍵字「{hit}」）"
    return None


def triage(ticket: dict) -> Triage:
    kind = ticket["type"]
    text = f"{ticket.get('item', '')} {ticket.get('reason', '')}"
    team = TEAMS.get(kind, "IT 服務台")

    if kind == "access":
        return Triage("P1", team, "權限類一律 P1：沒有權限就無法工作，且需要盡早留下核准紀錄")
    rules = DEVICE_RULES if kind == "device" else SOFTWARE_RULES
    hit = _match(text, rules)
    if hit:
        return Triage(hit[0], team, hit[1])
    return Triage("P3", team, "沒有命中急件關鍵字，排一般佇列")
