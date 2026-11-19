# Action2MCP

**Automated OpenAI Custom GPT Action (`OpenAPI 3.0/3.1` JSON & YAML) to Cloudflare Workers Remote MCP & `SKILL.md` Compiler.**

OpenAI retires Custom GPTs on **December 11, 2026** (FedRAMP/approved Enterprise extended to Feb 11, 2027). OpenAI's Plugin migrator moves instructions and reference files, **but drops 100% of Custom Actions**. Action2MCP deterministically compiles those OpenAPI schemas into a working Remote MCP server in seconds.

## Features
- **Free Live Compiler (`POST /api/preview` & Web UI):** Parses OpenAPI 3.0/3.1 JSON or YAML, resolves local `$ref` pointers, converts path/query/header/`requestBody` schemas into MCP `tools/list` JSON Schema, maps `x-openai-isConsequential` to `destructiveHint` / `readOnlyHint`, flags 100k-char payload risks, and generates portable `SKILL.md` frontmatter.
- **$5 Deployable Cloudflare Worker ZIP Bundle:** Generates standalone `worker.js` (JSON-RPC 2.0 `initialize`, `ping`, `tools/list`, `tools/call` + Bearer/API-key auth forwarding), `wrangler.toml`, `package.json`, `.github/workflows/deploy.yml`, `SKILL.md`, and `SETUP_CHATGPT_PLUGIN.md`.
- **$15 Hosted Remote MCP Bridge (`/mcp/h/:token`):** Multi-tenant hosted Remote MCP endpoint signed via HMAC-SHA256 + deployable ZIP bundle.
- **Remote MCP Server (`POST /mcp`):** Exposes `convert_openapi_to_mcp` cleanly (`server.json` included).
- **Custom GPT Sniper (`scripts/gpt_action_sniper.py`):** Queries GitHub Code Search for public Custom GPT OpenAPI schemas containing `x-openai-isConsequential` or `chatgpt.com/g/g-` + `openapi`, test-compiles them via `/api/preview`, and drafts proof-first outreach emails.

## Local Development & Tests

```bash
node --test test_worker.mjs
python scripts/test_sniper.py
```

## Required GitHub Actions / Cloudflare Secrets
- `CF_API_TOKEN` & `CF_ACCOUNT_ID`
- `STRIPE_SECRET_KEY`
- `KUROX_SIGNING_SECRET`
- `SMTP_USER` & `SMTP_PASS` (optional, for automated sniper email delivery)
