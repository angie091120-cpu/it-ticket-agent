"""Thin HTTP client for the Worker's REST API. The MCP server never touches D1 directly."""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_API_URL = "http://localhost:8787"


class ApiError(Exception):
    def __init__(self, status: int, body: dict[str, Any]):
        super().__init__(f"HTTP {status}: {body.get('error', body)}")
        self.status = status
        self.body = body


class TicketApi:
    """Has no approve method on purpose: approval belongs to a human on the web page."""

    def __init__(self, base_url: str | None = None, transport: httpx.BaseTransport | None = None):
        self.base_url = (base_url or os.environ.get("TICKET_API_URL") or DEFAULT_API_URL).rstrip("/")
        self._http = httpx.Client(base_url=self.base_url, timeout=15.0, transport=transport)

    def _request(self, method: str, path: str, json: dict[str, Any] | None = None, params: dict[str, str] | None = None) -> Any:
        if path.rstrip("/").endswith("/approve"):
            raise PermissionError("the agent is not allowed to approve tickets")
        res = self._http.request(method, path, json=json, params=params)
        body = res.json()
        if res.status_code >= 400:
            raise ApiError(res.status_code, body)
        return body

    def list(self, status: str | None = None) -> list[dict[str, Any]]:
        return self._request("GET", "/api/tickets", params={"status": status} if status else None)

    def get(self, ticket_id: int) -> dict[str, Any]:
        return self._request("GET", f"/api/tickets/{ticket_id}")

    def create(self, fields: dict[str, str]) -> dict[str, Any]:
        return self._request("POST", "/api/tickets", json=fields)

    def patch(self, ticket_id: int, fields: dict[str, str]) -> dict[str, Any]:
        return self._request("PATCH", f"/api/tickets/{ticket_id}", json=fields)

    def approve_url(self, ticket_id: int) -> str:
        return f"{self.base_url}/tickets#ticket-{ticket_id}"
