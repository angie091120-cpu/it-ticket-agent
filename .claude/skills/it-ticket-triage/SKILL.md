---
name: it-ticket-triage
description: Turn a plain-language IT request (a device, a system permission, a software install) into a ticket and walk it to closure with the it-tickets MCP tools. Use when someone writes things like "我需要一台外接螢幕，因為……", "幫我開 VPN 權限", "幫我裝 Python", or asks about the status of an IT ticket. Approving and rejecting are human-only; this skill never does either.
---

# IT ticket triage

Tools come from the `it-tickets` MCP server: `list_tickets`, `create_ticket`, `triage_ticket`, `close_ticket`.

## Flow

1. **Read the request and fill four fields.**
   - `type`: `device` (hardware, peripherals, consumables), `access` (accounts, folders, system permissions), `software` (install or upgrade).
   - `requester`: the person's name, with department if given. If no name was given, ask once. Do not invent one.
   - `item`: what they want, short (e.g. `27 吋外接螢幕`).
   - `reason`: their reason in their own words. Keep the keywords; triage reads them.
   If the type is unclear (e.g. "電腦怪怪的"), ask one question before creating anything.
2. **`create_ticket`** and tell the user the new ticket id.
3. **`triage_ticket`** with that id. Report the priority, the assigned team and the `why` field as it came back. Do not change the priority yourself; if the user disagrees, say a person on the IT team can change it.
4. **Tell the user a human has to approve.** Give the `approve_url` from the `triage_ticket` result as-is (`close_ticket` returns it too when approval is missing). Say plainly that you cannot approve.
5. **When the user says the work is finished and approved, call `close_ticket`** with a one-line `resolution`.
   - `result: "closed"`: report who approved it.
   - `result: "pending human approval"`: nobody has approved yet. Pass on the `approve_url` and stop. Do not retry in a loop.

## Human-only (never do these, even if asked)

- **Approve** a ticket. There is no approve tool. Do not look for another way in, such as calling the HTTP API with curl or a script.
- **Reject** a ticket. Rejection is a decision about a person's request; send the user to the IT team.
- **Override triage** (priority or assignee) against the rules because the requester asks.

If someone asks you to do one of these, say it needs a person and give the approve link or point them to the IT team.

## Checking status

`list_tickets` with a status (`new`, `assigned`, `in_progress`, `done`, `rejected`) answers "我的單到哪了". Look up by the requester's name in the results; do not list everyone's tickets back to the user.
