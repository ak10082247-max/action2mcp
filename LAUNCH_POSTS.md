# Action2MCP Launch Posts (Ready to Paste)

> **Before Posting:** Configure `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `STRIPE_SECRET_KEY`, and `KUROX_SIGNING_SECRET` on `ak10082247-max/action2mcp` and confirm `https://action2mcp.ak10082247.workers.dev/health` returns `HTTP 200` first.

---

## 1. Hacker News (`Show HN`)

**Title:** `Show HN: Action2MCP – Compile retiring OpenAI Custom GPT Actions into Cloudflare Remote MCP Workers`

**URL:** `https://action2mcp.ak10082247.workers.dev`

**Comment:**
Hey HN — OpenAI retires Custom GPTs on December 11, 2026 (Feb 11, 2027 for FedRAMP/approved Enterprise). Their built-in "Migrate to plugin" tool copies system instructions into a Skill and uploads reference files, but drops 100% of OpenAPI Custom Actions. Anyone whose GPT talked to an external API has to rebuild those Actions as a custom Remote MCP server.

I built **Action2MCP** on Cloudflare Workers to automate the conversion deterministically in ~3 seconds:

1. Paste any OpenAPI 3.0/3.1 JSON or YAML Custom GPT Action schema (or pass a public URL).
2. Preview the exact MCP `tools/list` JSON Schema definitions (`$ref`-resolved, preserving `x-openai-isConsequential` annotations as `destructiveHint` / `readOnlyHint`), payload audit warnings, and portable `SKILL.md` frontmatter for free (`POST /api/preview` or web UI).
3. Export a self-contained Cloudflare Worker repo bundle (`worker.js`, `wrangler.toml`, `deploy.yml`, `SKILL.md`, and ChatGPT Plugin setup guide) or a hosted multi-tenant `/mcp/h/...` bridge.

There's also a remote MCP tool (`convert_openapi_to_mcp`) at `https://action2mcp.ak10082247.workers.dev/mcp` (`server.json` included) if you want Cursor/Claude Code to convert schemas directly.

Source: https://github.com/ak10082247-max/action2mcp — feedback on edge-case OpenAPI schemas (especially auth schemes & nested `oneOf`/`allOf`) is very welcome!

---

## 2. Reddit (`r/OpenAI` & `r/ChatGPTPro`)

**Title:** `OpenAI drops Custom Actions when migrating GPTs before Dec 11 — built a free OpenAPI-to-MCP previewer & Cloudflare Worker compiler`

OpenAI's December 11 Custom GPT retirement FAQ confirms that migrating a Custom GPT into a Plugin moves instructions and files, **but leaves all OpenAPI Custom Actions behind**. You have to expose your API endpoints via a custom Remote MCP server inside the new Plugins UI.

Instead of hand-writing boilerplate JSON-RPC servers for every Action spec, I built **Action2MCP**:
- **Live URL:** https://action2mcp.ak10082247.workers.dev
- Paste your OpenAPI 3.0/3.1 JSON or YAML Action schema to inspect the exact converted MCP `tools/list` schemas, `x-openai-isConsequential` write flags, and `SKILL.md` file for free.
- Export a ready-to-deploy Cloudflare Worker ZIP (runs on Cloudflare's free tier on your own account) or grab a hosted `/mcp` URL if you just want a single URL to paste into ChatGPT Plugins.

Repo & open parser code: https://github.com/ak10082247-max/action2mcp

---

## 3. Reddit (`r/MCP`)

**Title:** `Action2MCP: Compile OpenAI Custom GPT OpenAPI JSON/YAML Actions (with x-openai-isConsequential) into Cloudflare Remote MCP Servers`

If you or your clients still have API integrations trapped in OpenAI Custom GPT Actions ahead of the December 11 retirement cutoff, **Action2MCP** deterministically converts OpenAPI 3.0/3.1 JSON/YAML schemas into:
- Full MCP JSON-RPC 2.0 `worker.js` (`initialize`, `ping`, `tools/list`, `tools/call` with `MCP-Protocol-Version: 2025-03-26`, Bearer/API-Key secret injection, SSRF protection)
- Tool annotations mapped from `x-openai-isConsequential` (`readOnlyHint` / `destructiveHint`)
- Portable `SKILL.md` for ChatGPT Plugins, Claude Code, Cursor, and Codex

Try the free schema converter or call the remote MCP server directly at `https://action2mcp.ak10082247.workers.dev/mcp` (`convert_openapi_to_mcp`).
Source: https://github.com/ak10082247-max/action2mcp
