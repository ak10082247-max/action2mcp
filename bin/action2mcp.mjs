#!/usr/bin/env node
/**
 * Action2MCP CLI — Free OpenAPI 3.0/3.1 -> MCP tools/list & SKILL.md previewer.
 * Usage:
 *   npx action2mcp ./openapi.yaml
 *   npx action2mcp https://raw.githubusercontent.com/julien040/anyquery/main/other/llm/openapi.yaml --json
 */
import fs from "node:fs";
import path from "node:path";
import { compileOpenApiToMcp } from "../compiler.js";

const HOST = "https://action2mcp.ak10082247.workers.dev";

function printUsage() {
  console.log(`Action2MCP CLI — Custom GPT Action (OpenAPI 3.0/3.1) -> Remote MCP Compiler (Dec 11, 2026 Rescue)

Usage:
  npx action2mcp <schema-file-or-url> [--json] [--auth auto|none|bearer|api_key_header]

Examples:
  npx action2mcp ./openapi.yaml
  npx action2mcp https://raw.githubusercontent.com/julien040/anyquery/main/other/llm/openapi.yaml --json

Web Compiler & $5 Worker Bundle / $15 Hosted MCP Bridge:
  ${HOST}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  let target = "";
  let asJson = false;
  let authType = "auto";
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--json") asJson = true;
    else if (a === "--auth" && args[i + 1]) {
      authType = args[++i];
    } else if (!a.startsWith("-")) {
      target = a;
    }
  }

  if (!target) {
    printUsage();
    process.exit(1);
  }

  let schemaText = "";
  const isUrl = /^https?:\/\//i.test(target);
  if (isUrl) {
    const res = await fetch(target, { headers: { Accept: "application/json,text/yaml,text/plain,*/*" } });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${target} (HTTP ${res.status})`);
    }
    schemaText = await res.text();
  } else {
    schemaText = fs.readFileSync(path.resolve(process.cwd(), target), "utf8");
  }

  const compiled = compileOpenApiToMcp({ schemaText, authType });
  if (asJson) {
    console.log(JSON.stringify({
      title: compiled.title,
      openapi_version: compiled.openapi_version,
      base_url: compiled.base_url,
      tool_count: compiled.tool_count,
      consequential_count: compiled.consequential_count,
      warnings: compiled.warnings,
      tools: compiled.mcp_tools,
      skill_md: compiled.skill_md,
      bundle_checkout_url: isUrl ? `${HOST}/api/checkout?tier=bundle&spec_url=${encodeURIComponent(target)}` : `${HOST}/api/checkout?tier=bundle`,
      hosted_checkout_url: isUrl ? `${HOST}/api/checkout?tier=hosted&spec_url=${encodeURIComponent(target)}` : `${HOST}/api/checkout?tier=hosted`,
    }, null, 2));
    return;
  }

  console.log(`\nAction2MCP Compiled Preview — ${compiled.title} (OpenAPI ${compiled.openapi_version})`);
  console.log(`Base Origin: ${compiled.base_url} | Auth: ${compiled.auth.authType} | Days until Dec 11 shutdown: ${compiled.dec11_countdown.days_remaining}`);
  console.log(`Converted Tools (${compiled.tool_count}, Consequential=${compiled.consequential_count}):`);
  for (const t of compiled.mcp_tools) {
    const tag = t.annotations?.destructiveHint ? " [x-openai-isConsequential -> destructiveHint]" : "";
    console.log(`  - ${t.name}${tag}: ${t.description || ""}`);
  }
  if (compiled.warnings.length > 0) {
    console.log(`\nWarnings:`);
    for (const w of compiled.warnings) console.log(`  ! ${w}`);
  }
  console.log(`\nExport ready-to-deploy Cloudflare Worker + SKILL.md ZIP ($5) or Hosted /mcp Bridge ($15):`);
  if (isUrl) {
    console.log(`  Live Preview: ${HOST}/?spec_url=${encodeURIComponent(target)}`);
    console.log(`  $5 Bundle:    ${HOST}/api/checkout?tier=bundle&spec_url=${encodeURIComponent(target)}`);
    console.log(`  $15 Hosted:   ${HOST}/api/checkout?tier=hosted&spec_url=${encodeURIComponent(target)}`);
  } else {
    console.log(`  Web UI:       ${HOST}`);
    console.log(`  $5 Bundle:    ${HOST}/api/checkout?tier=bundle`);
    console.log(`  $15 Hosted:   ${HOST}/api/checkout?tier=hosted`);
  }
  console.log(`  Remote MCP:   ${HOST}/mcp (tool: convert_openapi_to_mcp)\n`);
}

main().catch((err) => {
  console.error(`Action2MCP Error: ${err.message}`);
  process.exit(1);
});
