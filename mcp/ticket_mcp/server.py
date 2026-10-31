"""MCP server over stdio.

Run:         python -m ticket_mcp.server
List tools:  python -m ticket_mcp.server --list-tools
API target:  TICKET_API_URL (defaults to http://localhost:8787, i.e. npm run dev)
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any, Literal

from mcp.server.mcpserver import MCPServer

from . import tools
from .client import TicketApi

server = MCPServer(
    "it-ticket-agent",
    instructions=(
        "IT ticket tools. You may create, triage and close tickets. You cannot approve or reject: "
        "if close_ticket says 'pending human approval', give the user the approve_url and wait."
    ),
)
api = TicketApi()

Status = Literal["new", "assigned", "in_progress", "done", "rejected"]
TicketType = Literal["device", "access", "software"]


@server.tool()
def list_tickets(status: Status | None = None) -> dict[str, Any]:
    """List tickets, newest first (at most 50, with a total count). Optionally filter by status."""
    return tools.list_tickets(api, status)


@server.tool()
def create_ticket(type: TicketType, requester: str, item: str, reason: str) -> dict[str, Any]:
    """File a new IT request (device, access or software). Returns the new ticket id."""
    return tools.create_ticket(api, type, requester, item, reason)


@server.tool()
def triage_ticket(id: int) -> dict[str, Any]:
    """Apply the triage rules: set priority and assignee, and move a new ticket to assigned."""
    return tools.triage_ticket(api, id)


@server.tool()
def close_ticket(id: int, resolution: str) -> dict[str, Any]:
    """Close a ticket as done. Only works after a human approved it on the web page;
    otherwise returns 'pending human approval' with the approve link."""
    return tools.close_ticket(api, id, resolution)


def main() -> None:
    if "--list-tools" in sys.argv:
        for tool in asyncio.run(server.list_tools()):
            print(tool.name)
        return
    server.run("stdio")


if __name__ == "__main__":
    main()
