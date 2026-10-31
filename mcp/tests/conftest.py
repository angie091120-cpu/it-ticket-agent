"""A fake of the Worker API on httpx.MockTransport, with the same approval rule (409 without approved_by)."""

from __future__ import annotations

import json
import re

import httpx
import pytest

from ticket_mcp.client import TicketApi


class FakeWorker:
    def __init__(self):
        self.tickets: dict[int, dict] = {}
        self.requests: list[tuple[str, str]] = []
        self.next_id = 1

    def add(self, **fields) -> dict:
        ticket = {
            "id": self.next_id, "type": "device", "requester": "測試", "item": "螢幕", "reason": "測試",
            "priority": None, "status": "new", "assignee": None, "approved_by": None,
        } | fields
        self.tickets[ticket["id"]] = ticket
        self.next_id += 1
        return ticket

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append((request.method, request.url.path))
        match = re.fullmatch(r"/api/tickets(?:/(\d+))?", request.url.path)
        if not match:
            return httpx.Response(404, json={"error": "no such endpoint"})
        tid = int(match.group(1)) if match.group(1) else None
        if tid is None and request.method == "POST":
            return httpx.Response(201, json=self.add(**json.loads(request.content)))
        if tid is None:
            return httpx.Response(200, json=list(self.tickets.values()))
        ticket = self.tickets.get(tid)
        if ticket is None:
            return httpx.Response(404, json={"error": "ticket not found"})
        if request.method == "GET":
            return httpx.Response(200, json=ticket)
        body = json.loads(request.content)
        if body.get("status") in ("done", "rejected") and not ticket["approved_by"]:
            return httpx.Response(409, json={"error": "approval required: a human must approve before this ticket can be closed"})
        ticket.update(body)
        return httpx.Response(200, json=ticket)

    def writes(self) -> list[tuple[str, str]]:
        return [r for r in self.requests if r[0] != "GET"]


@pytest.fixture
def worker() -> FakeWorker:
    return FakeWorker()


@pytest.fixture
def api(worker: FakeWorker) -> TicketApi:
    return TicketApi("https://tickets.test", transport=httpx.MockTransport(worker.handler))
