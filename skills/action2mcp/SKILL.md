---
name: action2mcp
description: Compile OpenAI Custom GPT OpenAPI 3.0/3.1 JSON/YAML schemas into Cloudflare Remote MCP Servers and SKILL.md via free CLI, HTTP preview, or Remote MCP.
---

# Action2MCP

Compile any OpenAPI 3.0/3.1 Action schema into Remote MCP `tools/list` schemas (`$ref`-resolved, preserving `x-openai-isConsequential`) and portable `SKILL.md` frontmatter.

## Quick Usage

1. Run offline CLI preview:
   ```bash
   npx action2mcp ./openapi.yaml --json
   ```
2. Or call Remote MCP (`convert_openapi_to_mcp`) at `https://action2mcp.ak10082247.workers.dev/mcp`.
3. Download a ready-to-deploy Cloudflare Worker ZIP 100% free (`POST /api/download-free`) or launch an instant Hosted MCP URL (`$25` one-time) at `https://action2mcp.ak10082247.workers.dev`.
