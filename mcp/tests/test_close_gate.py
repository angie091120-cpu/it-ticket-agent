"""close_ticket must never close an unapproved ticket, and the agent has no way to approve."""

import asyncio

import httpx
import pytest

from ticket_mcp import tools
from ticket_mcp.client import TicketApi
from ticket_mcp.server import server


def test_unapproved_ticket_is_not_closed_and_no_write_is_sent(api, worker):
    ticket = worker.add(status="in_progress")
    result = tools.close_ticket(api, ticket["id"], "已更換螢幕")

    assert result["result"] == "pending human approval"
    assert result["approve_url"] == f"https://tickets.test/tickets#ticket-{ticket['id']}"
    assert worker.tickets[ticket["id"]]["status"] == "in_progress"
    assert worker.writes() == []


def test_fresh_ticket_stays_new_when_closing_without_approval(api, worker):
    ticket = worker.add()
    result = tools.close_ticket(api, ticket["id"], "x")

    assert result["result"] == "pending human approval"
    assert worker.tickets[ticket["id"]]["status"] == "new"
    assert worker.tickets[ticket["id"]]["approved_by"] is None
    assert worker.writes() == []


def test_api_409_is_reported_as_pending_not_as_closed(worker):
    # Stale read: the GET says approved, but the API refuses the PATCH.
    ticket = worker.add(status="in_progress")

    def stale_handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json=ticket | {"approved_by": "某主管"})
        return worker.handler(request)

    api = TicketApi("https://tickets.test", transport=httpx.MockTransport(stale_handler))
    result = tools.close_ticket(api, ticket["id"], "已更換螢幕")

    assert result["result"] == "pending human approval"
    assert worker.tickets[ticket["id"]]["status"] == "in_progress"


def test_approved_ticket_is_closed(api, worker):
    ticket = worker.add(status="in_progress", approved_by="部門主管")
    result = tools.close_ticket(api, ticket["id"], "已更換螢幕")

    assert result["result"] == "closed"
    assert result["approved_by"] == "部門主管"
    assert worker.tickets[ticket["id"]]["status"] == "done"
    assert worker.writes() == [("PATCH", f"/api/tickets/{ticket['id']}")]


def test_closed_ticket_is_left_alone(api, worker):
    ticket = worker.add(status="rejected", approved_by="部門主管")
    assert tools.close_ticket(api, ticket["id"], "x")["result"] == "already closed"
    assert worker.writes() == []


def test_client_refuses_the_approve_endpoint(api, worker):
    ticket = worker.add()
    with pytest.raises(PermissionError):
        api._request("POST", f"/api/tickets/{ticket['id']}/approve", json={"approver": "agent"})
    assert worker.requests == []


def test_server_exposes_exactly_four_tools_and_none_approve():
    names = sorted(t.name for t in asyncio.run(server.list_tools()))
    assert names == ["close_ticket", "create_ticket", "list_tickets", "triage_ticket"]
    assert not any("approve" in n or "reject" in n for n in names)
