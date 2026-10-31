"""Tool logic, kept apart from the MCP wiring so tests can call it with a fake HTTP transport."""

from __future__ import annotations

from typing import Any

from .client import ApiError, TicketApi
from .rules import triage

CLOSED = ("done", "rejected")
LIST_FIELDS = ("id", "type", "requester", "item", "priority", "status", "assignee", "approved_by", "created_at")
LIST_MAX = 50


def list_tickets(api: TicketApi, status: str | None = None) -> dict[str, Any]:
    """Newest first, trimmed to the fields an agent needs so the result fits in context."""
    tickets = api.list(status)
    return {
        "total": len(tickets),
        "shown": min(len(tickets), LIST_MAX),
        "tickets": [{k: t.get(k) for k in LIST_FIELDS} for t in tickets[:LIST_MAX]],
    }


def create_ticket(api: TicketApi, type: str, requester: str, item: str, reason: str) -> dict[str, Any]:
    ticket = api.create({"type": type, "requester": requester, "item": item, "reason": reason})
    return {"id": ticket["id"], "status": ticket["status"], "ticket": ticket}


def triage_ticket(api: TicketApi, id: int) -> dict[str, Any]:
    ticket = api.get(id)
    if ticket["status"] in CLOSED:
        return {"id": id, "result": "already closed", "status": ticket["status"]}
    t = triage(ticket)
    fields = {"priority": t.priority, "assignee": t.assignee}
    if ticket["status"] == "new":
        fields["status"] = "assigned"
    updated = api.patch(id, fields)
    return {
        "id": id,
        "priority": t.priority,
        "assignee": t.assignee,
        "why": t.why,
        "approve_url": api.approve_url(id),
        "ticket": updated,
    }


def close_ticket(api: TicketApi, id: int, resolution: str) -> dict[str, Any]:
    """Closes as done only when a human has already approved. Never approves on its own."""
    ticket = api.get(id)
    if ticket["status"] in CLOSED:
        return {"id": id, "result": "already closed", "status": ticket["status"]}
    if not ticket.get("approved_by"):
        return _pending(api, id)
    try:
        updated = api.patch(id, {"status": "done"})
    except ApiError as err:
        # The API re-checks approval; trust it over what we read a moment ago.
        if err.status == 409 and "approval" in str(err.body.get("error", "")):
            return _pending(api, id)
        raise
    return {"id": id, "result": "closed", "approved_by": updated["approved_by"], "resolution": resolution, "ticket": updated}


def _pending(api: TicketApi, id: int) -> dict[str, Any]:
    return {
        "id": id,
        "result": "pending human approval",
        "approve_url": api.approve_url(id),
        "message": "這張單還沒有人核准。請主管打開連結按「核准」，之後再呼叫 close_ticket。",
    }
