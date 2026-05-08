---
name: agent-browser
description: Use when the user needs browser automation for websites, web apps, screenshots, form filling, scraping, QA, exploratory testing, Electron apps, or Slack automation.
---

# agent-browser

Browser automation CLI for AI agents. In WeClaws, the supported runtime path is `agent-browser -p browserless` so the actual browser runs in the Compose `browserless` sidecar instead of inside the nested sandbox.

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

Fallback path for direct CDP debugging:

```bash
agent-browser --cdp "ws://browserless:3000/chromium?token=your-browserless-token" open https://example.com
```

Notes:

- `sandbox-runtime` keeps the `agent-browser` client and file outputs.
- `browserless` owns the real browser process in the supported remote path.
- WeClaws does not support launching a local browser inside `sandbox-runtime`; use Browserless or direct CDP to the remote browser backend.
- Screenshots, downloads, PDFs, and extracted files still land in the bot-accessible filesystem inside the sandbox workspace.

## Why agent-browser

- Fast native Rust CLI, not a Node.js wrapper
- Works with any AI agent
- Chrome/Chromium via CDP with no Playwright or Puppeteer dependency
- Accessibility-tree snapshots with element refs for reliable interaction
- Sessions, authentication vault, state persistence, video recording
- Specialized skills for Electron apps, Slack, exploratory testing, and cloud providers
