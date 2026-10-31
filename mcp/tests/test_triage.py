from ticket_mcp import tools
from ticket_mcp.rules import triage


def test_access_is_always_p1():
    assert triage({"type": "access", "item": "VPN 帳號", "reason": "出差要用"}).priority == "P1"


def test_device_priority_follows_reason_keywords():
    assert triage({"type": "device", "item": "筆電", "reason": "原本的筆電無法開機"}).priority == "P1"
    assert triage({"type": "device", "item": "螢幕", "reason": "螢幕畫面閃爍"}).priority == "P2"
    assert triage({"type": "device", "item": "滑鼠", "reason": "想換一個好握的"}).priority == "P3"


def test_triage_writes_priority_assignee_and_moves_new_to_assigned(api, worker):
    ticket = worker.add(type="software", item="PDF 編輯軟體", reason="原版本過期無法開啟檔案")
    result = tools.triage_ticket(api, ticket["id"])

    assert result["priority"] == "P2"
    assert result["assignee"] == "軟體組"
    stored = worker.tickets[ticket["id"]]
    assert (stored["priority"], stored["assignee"], stored["status"]) == ("P2", "軟體組", "assigned")
    assert worker.writes() == [("PATCH", f"/api/tickets/{ticket['id']}")]


def test_list_is_trimmed_and_capped(api, worker):
    for _ in range(60):
        worker.add(reason="很長的原因" * 50)
    result = tools.list_tickets(api)
    assert (result["total"], result["shown"], len(result["tickets"])) == (60, 50, 50)
    assert "reason" not in result["tickets"][0]


def test_create_returns_the_new_id(api, worker):
    result = tools.create_ticket(api, "device", "測試人", "外接螢幕", "雙螢幕對照圖面")
    assert result["id"] == 1
    assert worker.tickets[1]["status"] == "new"
