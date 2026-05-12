---
name: agent-browser
description: Use when the user needs browser automation for websites, web apps, screenshots, form filling, scraping, QA, exploratory testing, Electron apps, or Slack automation.
---

# agent-browser

Browser automation CLI for AI agents. In WeClaws, browser automation is remote-only: the only supported runtime paths are `agent-browser -p browserless` and explicit remote `--cdp` connections, so the real browser runs in a remote backend instead of inside the nested sandbox or on the host.

## Loading Skills

**You must run `agent-browser skills get <name>` before running any agent-browser commands.**
This file does not contain command syntax, flags, or workflows. That content is served
by the CLI and changes between versions. Guessing at commands without loading the skill
will produce incorrect or outdated invocations.

```bash
agent-browser skills get core --full      # Required before core browser automation
agent-browser skills get <name> --full    # Include references and templates
```

## Available Skills

- **core** — Core browser automation
- **dogfood** — Exploratory testing and QA
- **electron** — Electron desktop app automation
- **slack** — Slack workspace automation
- **vercel-sandbox** — Browser automation in Vercel Sandbox
- **agentcore** — Browser automation on AWS Bedrock AgentCore

## WeClaws Runtime Path

Primary path in the default Compose deployment:

```bash
export BROWSERLESS_API_URL="http://browserless:3000"
export BROWSERLESS_API_KEY="your-browserless-token"
agent-browser -p browserless open https://example.com
```

Alternative supported path for direct CDP debugging:

```bash
agent-browser --cdp "ws://browserless:3000/chromium?token=your-browserless-token" open https://example.com
```

## Browserless Direct

Use Browserless directly only when the task is a one-shot remote browser job and does not need `agent-browser`'s interactive workflow.

- Prefer `agent-browser -p browserless` for multi-step page interaction, refs/snapshots, form filling, QA, and exploratory debugging.
- Prefer direct Browserless HTTP or WebSocket/CDP usage when the task is closer to backend browser execution, such as a single screenshot, PDF, scrape, or attach/connect flow.
- Treat Browserless as the remote browser backend and `agent-browser` as the default operator-facing workflow on top of that backend.
- If the task starts as a one-shot Browserless job but turns into iterative page interaction, switch back to `agent-browser -p browserless`.

Decision guide:

| Task shape | Preferred path |
| --- | --- |
| Open page, inspect DOM, click/type repeatedly, use refs | `agent-browser -p browserless` |
| QA, dogfooding, screenshots with follow-up interaction | `agent-browser -p browserless` |
| Single remote attach/debug session with an explicit endpoint | `agent-browser --cdp ...` |
| One-shot backend screenshot/PDF/scrape job with no interactive loop | Browserless direct |

## Remote-Only Rules

- Always connect to a remote browser backend via `-p browserless` or an explicit remote `--cdp` endpoint.
- Never launch a local browser inside `sandbox-runtime`, inside the nested sandbox, or on the host for WeClaws browser automation flows.
- Never treat missing Browserless/CDP connectivity as a reason to fall back to local browser startup or local browser installation.
- If `BROWSERLESS_API_URL`, `BROWSERLESS_API_KEY`, or the remote CDP endpoint is missing or broken, stop and report the browser task as blocked.

Notes:

- `sandbox-runtime` keeps the `agent-browser` client and file outputs.
- `browserless` or another remote CDP backend owns the real browser process in every supported path.
- WeClaws does not support local browser launch or local browser install as a fallback; use Browserless or direct remote CDP only.
- Screenshots, downloads, PDFs, and extracted files still land in the bot-accessible filesystem inside the sandbox workspace.

## Why agent-browser

- Fast native Rust CLI, not a Node.js wrapper
- Works with any AI agent
- Chrome/Chromium via CDP with no Playwright or Puppeteer dependency
- Accessibility-tree snapshots with element refs for reliable interaction
- Sessions, authentication vault, state persistence, video recording
- Specialized skills for Electron apps, Slack, exploratory testing, and cloud providers
