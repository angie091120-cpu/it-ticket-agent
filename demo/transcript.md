# Demo 對話紀錄

一段真實的 Claude Code 對話：從一句自然語言申請，到被核准閘門擋下，再到真人核准後結案。工具呼叫和回傳都是原樣輸出，沒有改寫。

**怎麼跑的**

- Claude Code 2.1，在本 repo 根目錄以 `claude -p` 跑三輪，第 2、3 輪用 `--resume` 接同一個 session。
- 只開放 `it-tickets` MCP 的四個工具和 Skill；Bash、檔案讀寫、網路工具都關掉，所以 agent 只能透過 MCP 動工單。
- 為了讓紀錄只反映這個 repo 的設定，執行時關掉了本機的個人設定與 CLAUDE.md（`--setting-sources project`、`CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`）。
- 省略了 Claude Code 載入工具定義的內部呼叫（ToolSearch）。
- MCP 伺服器的 `TICKET_API_URL` 指向部署在 workers.dev 的 demo（repo 的 `.mcp.json` 預設是本機）；工單 #201 建於 2026-10-31。

## 第 1 輪

**使用者：** 我需要一台 27 吋外接螢幕，因為現在這台一直閃爍，看圖面很吃力。我是製造部的呂曉嘯。

**工具呼叫：** `Skill`

```json
{
  "skill": "it-ticket-triage"
}
```

<details><summary>工具回傳</summary>

```text
Launching skill: it-ticket-triage
```

</details>

**工具呼叫：** `create_ticket`

```json
{
  "type": "device",
  "requester": "呂曉嘯（製造部）",
  "item": "27 吋外接螢幕",
  "reason": "現在這台一直閃爍，看圖面很吃力"
}
```

<details><summary>工具回傳</summary>

```json
{
  "id": 201,
  "status": "new",
  "ticket": {
    "id": 201,
    "type": "device",
    "requester": "呂曉嘯（製造部）",
    "item": "27 吋外接螢幕",
    "reason": "現在這台一直閃爍，看圖面很吃力",
    "priority": null,
    "status": "new",
    "assignee": null,
    "created_at": "2026-10-31T15:45:28.618Z",
    "assigned_at": null,
    "started_at": null,
    "closed_at": null,
    "approved_by": null
  }
}
```

</details>

**工具呼叫：** `triage_ticket`

```json
{
  "id": 201
}
```

<details><summary>工具回傳</summary>

```json
{
  "id": 201,
  "priority": "P2",
  "assignee": "設備組",
  "why": "設備還能用但影響效率（關鍵字「閃爍」）",
  "approve_url": "https://it-ticket-agent.angie091120.workers.dev/tickets#ticket-201",
  "ticket": {
    "id": 201,
    "type": "device",
    "requester": "呂曉嘯（製造部）",
    "item": "27 吋外接螢幕",
    "reason": "現在這台一直閃爍，看圖面很吃力",
    "priority": "P2",
    "status": "assigned",
    "assignee": "設備組",
    "created_at": "2026-10-31T15:45:28.618Z",
    "assigned_at": "2026-10-31T15:45:31.318Z",
    "started_at": null,
    "closed_at": null,
    "approved_by": null
  }
}
```

</details>

**Agent：**

> 呂曉嘯您好，您的螢幕申請已經開單，單號是 **#201**。
>
> - **申請內容**：27 吋外接螢幕
> - **優先級**：P2
> - **負責單位**：設備組
> - **判斷依據**：您描述的「閃爍」代表螢幕還能用，但影響工作效率，所以分到 P2。
>
> 設備組要處理這張單，必須先由一位 IT 人員核准。我不能核准，也不能退件。核准連結：
> https://it-ticket-agent.angie091120.workers.dev/tickets#ticket-201
>
> 如果您覺得 P2 太低，例如閃爍已經嚴重到沒辦法看圖，可以請 IT 團隊的人員幫您調整優先級，我不能自己改。新螢幕裝好、單也核准後跟我說一聲，我就幫您結案。

## 第 2 輪

**使用者：** 螢幕已經裝好了，幫我結案。

**工具呼叫：** `close_ticket`

```json
{
  "id": 201,
  "resolution": "已安裝新的 27 吋外接螢幕，取代閃爍的舊螢幕"
}
```

<details><summary>工具回傳</summary>

```json
{
  "id": 201,
  "result": "pending human approval",
  "approve_url": "https://it-ticket-agent.angie091120.workers.dev/tickets#ticket-201",
  "message": "這張單還沒有人核准。請主管打開連結按「核准」，之後再呼叫 close_ticket。"
}
```

</details>

**Agent：**

> #201 還不能結案，因為目前還沒有人核准這張單。
>
> 請 IT 人員或您的主管打開這個連結，按「核准」：
> https://it-ticket-agent.angie091120.workers.dev/tickets#ticket-201
>
> 核准之後跟我說一聲，我會再幫您結案。我不能代為核准。

**（第 2 輪和第 3 輪之間，一位真人打開核准連結，在「核准人」填名字、按下 #201 的「核准」。Agent 沒有參與這一步。）**

## 第 3 輪

**使用者：** 主管剛剛在網頁上核准了，請幫我結案。

**工具呼叫：** `close_ticket`

```json
{
  "id": 201,
  "resolution": "已安裝新的 27 吋外接螢幕，取代閃爍的舊螢幕"
}
```

<details><summary>工具回傳</summary>

```json
{
  "id": 201,
  "result": "closed",
  "approved_by": "設備組主管",
  "resolution": "已安裝新的 27 吋外接螢幕，取代閃爍的舊螢幕",
  "ticket": {
    "id": 201,
    "type": "device",
    "requester": "呂曉嘯（製造部）",
    "item": "27 吋外接螢幕",
    "reason": "現在這台一直閃爍，看圖面很吃力",
    "priority": "P2",
    "status": "done",
    "assignee": "設備組",
    "created_at": "2026-10-31T15:45:28.618Z",
    "assigned_at": "2026-10-31T15:45:31.318Z",
    "started_at": null,
    "closed_at": "2026-10-31T15:47:25.049Z",
    "approved_by": "設備組主管"
  }
}
```

</details>

**Agent：**

> #201 已經結案了，核准的是**設備組主管**。
>
> - **處理結果**：已安裝新的 27 吋外接螢幕，取代閃爍的舊螢幕
> - **結案時間**：2026-10-31 15:47（UTC）
>
> 希望新螢幕看圖面輕鬆多了。之後有其他 IT 需求，再跟我說就好。
