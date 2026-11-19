---
name: action2mcp
description: Compile retiring OpenAI Custom GPT Actions (OpenAPI 3.0/3.1 JSON or YAML) into deployable Cloudflare Remote MCP Workers and portable SKILL.md bundles before Dec 11, 2026.
metadata:
  homepage: https://action2mcp.ak10082247.workers.dev
  mcp_url: https://action2mcp.ak10082247.workers.dev/mcp
---

# Action2MCP — OpenAPI Action to Remote MCP & SKILL.md Compiler

OpenAI retires Custom GPTs on **December 11, 2026** (FedRAMP/Enterprise Feb 11, 2027), and its built-in Plugin migrator drops Custom Actions. Use Action2MCP to deterministically compile any OpenAPI 3.0/3.1 JSON or YAML Action schema into a Streamable HTTP Remote MCP Server (`tools/list`, `tools/call`, `x-openai-isConsequential` -> `destructiveHint`) and portable `SKILL.md`.

## Free Tools (No API Key Required)

- **Remote MCP Server:** `POST https://action2mcp.ak10082247.workers.dev/mcp` (tool: `convert_openapi_to_mcp`)
- **HTTP Preview API:** `POST https://action2mcp.ak10082247.workers.dev/api/preview` (`{"schema": "..."}` or `{"schema_url": "https://..."}`)
- **Free Worker ZIP Download:** `POST https://action2mcp.ak10082247.workers.dev/api/download-free` (`{"schema": "..."}` or `{"schema_url": "https://..."}`)
- **Zero-Dep CLI:** `npx action2mcp <schema-file-or-url> [--json]`

## Instant Hosted Remote MCP URL

- **Instant Hosted `/mcp/h/<token>` URL (`$10` deal, was `$25`):** `https://action2mcp.ak10082247.workers.dev/api/checkout?tier=hosted` (Stripe) or `POST https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted` ($10 USDC)
