/**
 * Action2MCP Deterministic OpenAPI-to-MCP & SKILL.md Compiler
 * Converts retiring OpenAI Custom GPT OpenAPI 3.0/3.1 schemas into:
 *  - Verified MCP tools/list definitions + x-openai-isConsequential annotations
 *  - Portable SKILL.md (ChatGPT Plugins, Claude Code, Cursor, Codex)
 *  - Standalone zero-cold-start Cloudflare Worker Remote MCP Server repo bundle
 */

import { parseJsonOrYaml } from "./yaml_parser.js";

const DEC11_RETIREMENT_UTC = Date.UTC(2026, 11, 11, 23, 59, 59);
const HTTP_METHODS = ["get", "post", "put", "delete", "patch"];

export function getDec11Countdown(nowMs = Date.now()) {
  const diffMs = Math.max(0, DEC11_RETIREMENT_UTC - nowMs);
  return {
    retirement_date: "2026-12-11",
    days_remaining: Math.ceil(diffMs / 86400000),
    retired: nowMs > DEC11_RETIREMENT_UTC,
  };
}

function sanitizeToolName(rawName, seen) {
  let base = String(rawName || "call_endpoint")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) base = "api_action";
  if (base.length > 56) base = base.slice(0, 56).replace(/_+$/, "");
  let candidate = base;
  let suffix = 2;
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  seen.add(candidate);
  return candidate;
}

function resolveRefPointer(doc, refStr) {
  if (typeof refStr !== "string" || !refStr.startsWith("#/")) return null;
  const parts = refStr
    .slice(2)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur = doc;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return null;
    cur = cur[part];
  }
  return cur;
}

function resolveSchemaNode(doc, node, visited = new Set()) {
  if (!node || typeof node !== "object") return { type: "string" };
  if (Array.isArray(node)) return node.map((item) => resolveSchemaNode(doc, item, visited));

  if (typeof node.$ref === "string") {
    if (visited.has(node.$ref)) return { type: "object", description: `Circular ref ${node.$ref}` };
    const nextVisited = new Set(visited);
    nextVisited.add(node.$ref);
    const target = resolveRefPointer(doc, node.$ref);
    if (!target) return { type: "object" };
    return resolveSchemaNode(doc, target, nextVisited);
  }

  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "nullable" || k === "example" || k === "examples" || k === "xml") continue;
    if (k === "properties" && v && typeof v === "object") {
      const cleanProps = {};
      for (const [pk, pv] of Object.entries(v)) {
        cleanProps[pk] = resolveSchemaNode(doc, pv, visited);
      }
      out.properties = cleanProps;
    } else if (k === "items" && v && typeof v === "object") {
      out.items = resolveSchemaNode(doc, v, visited);
    } else if ((k === "allOf" || k === "anyOf" || k === "oneOf") && Array.isArray(v)) {
      out[k] = v.map((sub) => resolveSchemaNode(doc, sub, visited));
    } else {
      out[k] = v;
    }
  }
  if (!out.type && out.properties) out.type = "object";
  return out;
}

function detectAuthFromSpec(spec, overrideType = "", overrideHeaderName = "") {
  const cleanedOverride = String(overrideType || "").trim().toLowerCase();
  if (cleanedOverride && cleanedOverride !== "auto") {
    return {
      authType: cleanedOverride,
      headerName: cleanedOverride === "api_key_header" ? (overrideHeaderName || "X-API-Key") : "Authorization",
    };
  }
  const schemes = spec?.components?.securitySchemes || {};
  for (const scheme of Object.values(schemes)) {
    if (!scheme || typeof scheme !== "object") continue;
    const t = String(scheme.type || "").toLowerCase();
    if (t === "http" && String(scheme.scheme || "").toLowerCase() === "bearer") {
      return { authType: "bearer", headerName: "Authorization" };
    }
    if (t === "oauth2") {
      return { authType: "bearer", headerName: "Authorization" };
    }
    if (t === "apikey" && String(scheme.in || "header").toLowerCase() === "header") {
      return { authType: "api_key_header", headerName: scheme.name || "X-API-Key" };
    }
  }
  return { authType: "none", headerName: "Authorization" };
}

function buildOperationInputSchema(doc, op, pathLevelParams = []) {
  const properties = {};
  const required = new Set();
  const paramMeta = { path: [], query: [], header: [], hasBody: false };

  const combinedParams = [...(Array.isArray(pathLevelParams) ? pathLevelParams : []), ...(Array.isArray(op.parameters) ? op.parameters : [])];
  for (const rawParam of combinedParams) {
    const param = rawParam?.$ref ? resolveRefPointer(doc, rawParam.$ref) : rawParam;
    if (!param || !param.name) continue;
    const loc = String(param.in || "query").toLowerCase();
    if (loc === "cookie") continue;
    const schema = resolveSchemaNode(doc, param.schema || { type: "string" });
    if (param.description && !schema.description) schema.description = param.description;
    properties[param.name] = schema;
    if (param.required || loc === "path") required.add(param.name);
    if (loc === "path") paramMeta.path.push(param.name);
    else if (loc === "header") paramMeta.header.push(param.name);
    else paramMeta.query.push(param.name);
  }

  if (op.requestBody) {
    const rb = op.requestBody.$ref ? resolveRefPointer(doc, op.requestBody.$ref) : op.requestBody;
    const content = rb?.content || {};
    const jsonContent = content["application/json"] || content["application/x-www-form-urlencoded"] || Object.values(content)[0];
    if (jsonContent?.schema) {
      const resolvedBody = resolveSchemaNode(doc, jsonContent.schema);
      paramMeta.hasBody = true;
      if (resolvedBody.type === "object" && resolvedBody.properties) {
        for (const [bpName, bpSchema] of Object.entries(resolvedBody.properties)) {
          const safeKey = bpName in properties ? `body_${bpName}` : bpName;
          properties[safeKey] = bpSchema;
        }
        if (Array.isArray(resolvedBody.required)) {
          for (const rk of resolvedBody.required) required.add(rk);
        }
      } else {
        properties.body = resolvedBody;
        if (rb?.required) required.add("body");
      }
    }
  }

  return {
    inputSchema: {
      type: "object",
      properties,
      ...(required.size > 0 ? { required: Array.from(required) } : {}),
    },
    paramMeta,
  };
}

/**
 * Compile raw OpenAPI schema + instructions into MCP tools, SKILL.md, and audit report.
 */
export function compileOpenApiToMcp({ schemaText, instructions = "", authType = "auto", authHeaderName = "" }) {
  const rawLen = String(schemaText || "").length;
  const spec = parseJsonOrYaml(schemaText);

  const openapiVer = String(spec.openapi || spec.swagger || "");
  if (!openapiVer) {
    throw new Error("Missing 'openapi' version field (expected OpenAPI 3.0.x or 3.1.x Custom GPT Action schema).");
  }
  const paths = spec.paths;
  if (!paths || typeof paths !== "object" || Object.keys(paths).length === 0) {
    throw new Error("OpenAPI schema contains no 'paths' endpoints to convert.");
  }

  const serverUrlRaw = String(spec.servers?.[0]?.url || "").trim().replace(/\/+$/, "");
  const auth = detectAuthFromSpec(spec, authType, authHeaderName);
  const title = String(spec.info?.title || "Migrated Custom GPT Actions").trim();
  const description = String(spec.info?.description || instructions || `Remote MCP server compiled from ${title}.`).trim();
  const seenNames = new Set();

  const mcpTools = [];
  const compiledRoutes = [];
  const warnings = [];
  let consequentialCount = 0;

  for (const [pathTemplate, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const pathParams = pathItem.parameters || [];

    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== "object") continue;

      const defaultId = `${method}_${pathTemplate.replace(/\{([^}]+)\}/g, "by_$1")}`;
      const toolName = sanitizeToolName(op.operationId || defaultId, seenNames);
      const isConsequentialExplicit = op["x-openai-isConsequential"];
      if (isConsequentialExplicit === true) consequentialCount += 1;

      const isReadOnly = method === "get" && isConsequentialExplicit !== true;
      const isDestructive = isConsequentialExplicit === true || method === "delete";

      const { inputSchema, paramMeta } = buildOperationInputSchema(spec, op, pathParams);
      const toolDesc = String(op.summary || op.description || `${method.toUpperCase()} ${pathTemplate}`).trim().slice(0, 500);

      mcpTools.push({
        name: toolName,
        description: toolDesc,
        inputSchema,
        annotations: {
          readOnlyHint: isReadOnly,
          destructiveHint: isDestructive,
          idempotentHint: method === "get" || method === "put",
          openWorldHint: true,
        },
      });

      compiledRoutes.push({
        name: toolName,
        method: method.toUpperCase(),
        path: pathTemplate,
        consequential: Boolean(isConsequentialExplicit === true),
        paramMeta,
        requiredParams: inputSchema.required || [],
      });
    }
  }

  if (compiledRoutes.length === 0) {
    throw new Error("No GET/POST/PUT/DELETE/PATCH operations found in OpenAPI 'paths'.");
  }

  if (!serverUrlRaw) {
    warnings.push("Missing servers[0].url — placeholder 'https://api.example.com' inserted; set your upstream origin in wrangler.toml before deploy.");
  } else if (!serverUrlRaw.startsWith("https://")) {
    warnings.push(`Upstream server '${serverUrlRaw}' is not HTTPS; OpenAI Plugins and Cloudflare Remote MCP require HTTPS endpoints.`);
  }
  if (rawLen > 80000) {
    warnings.push(`Schema size is ${rawLen.toLocaleString()} chars (approaching OpenAI's legacy 100k Action ceiling). MCP splits schemas per-tool and removes this limit.`);
  }
  if (consequentialCount > 0) {
    warnings.push(`${consequentialCount} operation(s) carry 'x-openai-isConsequential: true' and were mapped to MCP destructiveHint=true confirmation annotations.`);
  }

  const baseUrl = serverUrlRaw || "https://api.example.com";
  const countdown = getDec11Countdown();
  const skillMd = generateSkillMd({ title, description, instructions, baseUrl, auth, compiledRoutes });

  return {
    ok: true,
    title,
    openapi_version: openapiVer,
    base_url: baseUrl,
    auth,
    tool_count: mcpTools.length,
    consequential_count: consequentialCount,
    schema_chars: rawLen,
    dec11_countdown: countdown,
    warnings,
    mcp_tools: mcpTools,
    compiled_routes: compiledRoutes,
    skill_md: skillMd,
  };
}

export function generateSkillMd({ title, description, instructions, baseUrl, auth, compiledRoutes }) {
  const safeSlug = String(title || "migrated-gpt-mcp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "migrated-gpt-mcp";

  const shortDesc = String(description || "Migrated OpenAI Custom GPT Actions compiled to Remote MCP")
    .replace(/[\r\n]+/g, " ")
    .replace(/"/g, "'")
    .slice(0, 220);

  const authNote =
    auth.authType === "none"
      ? "None (public upstream API)"
      : auth.authType === "bearer"
        ? "Bearer Token (`UPSTREAM_BEARER_TOKEN` secret in Cloudflare Worker)"
        : `API Key Header \`${auth.headerName}\` (\`UPSTREAM_API_KEY\` secret in Cloudflare Worker)`;

  const toolLines = compiledRoutes
    .map((r) => `- \`${r.name}\` (\`${r.method} ${r.path}\`${r.consequential ? " — consequential write op" : ""})`)
    .join("\n");

  const instSection = instructions?.trim()
    ? `\n## Original GPT Instructions\n\n${instructions.trim()}\n`
    : "";

  return `---
name: ${safeSlug}
description: "${shortDesc}"
---

# ${title} — Remote MCP Skill

Converted from an OpenAI Custom GPT OpenAPI Action schema for ChatGPT Plugins, Claude Code, Cursor, and Codex before the December 11, 2026 Custom GPT retirement.

- **Upstream API Origin:** \`${baseUrl}\`
- **Upstream Auth:** ${authNote}
${instSection}
## Available MCP Tools (${compiledRoutes.length})

${toolLines}

## ChatGPT Plugin Setup

1. Deploy the compiled Cloudflare Worker and copy its \`/mcp\` URL.
2. Open ChatGPT → **Plugins** → **Add custom MCP server** and paste \`https://<your-worker>.workers.dev/mcp\`.
`;
}

export function generateStandaloneWorkerJs(compiled) {
  const specJson = JSON.stringify({
    title: compiled.title,
    baseUrl: compiled.base_url,
    auth: compiled.auth,
    tools: compiled.mcp_tools,
    routes: compiled.compiled_routes,
  }, null, 2);

  return `/**
 * Standalone Remote MCP Server compiled by Action2MCP (Dec 11 Custom GPT Rescue)
 * Server: ${compiled.title.replace(/\*\//g, "")}
 * Tools: ${compiled.tool_count}
 */

const COMPILED_CONFIG = ${specJson};

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, X-API-Key",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  };
}

function isBlockedHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0" ||
    h.endsWith(".local") || h.endsWith(".internal") || h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.");
}

async function invokeCompiledTool(route, args, env) {
  const origin = (env.UPSTREAM_BASE_URL || COMPILED_CONFIG.baseUrl || "").replace(/\\/+$/, "");
  const parsedOrigin = new URL(origin);
  if (isBlockedHost(parsedOrigin.hostname)) {
    throw new Error("Blocked private or loopback upstream host.");
  }

  let targetPath = route.path;
  const usedKeys = new Set();
  for (const pName of route.paramMeta?.path || []) {
    if (args[pName] === undefined) throw new Error(\`Missing required path parameter '\${pName}'\`);
    targetPath = targetPath.replace(\`{\${pName}}\`, encodeURIComponent(String(args[pName])));
    usedKeys.add(pName);
  }

  const targetUrl = new URL(\`\${origin}\${targetPath.startsWith("/") ? targetPath : "/" + targetPath}\`);
  for (const qName of route.paramMeta?.query || []) {
    if (args[qName] !== undefined && args[qName] !== null) {
      targetUrl.searchParams.set(qName, typeof args[qName] === "object" ? JSON.stringify(args[qName]) : String(args[qName]));
      usedKeys.add(qName);
    }
  }

  const headers = { "User-Agent": "Action2MCP-RemoteWorker/1.0", Accept: "application/json" };
  for (const hName of route.paramMeta?.header || []) {
    if (args[hName] !== undefined) {
      headers[hName] = String(args[hName]);
      usedKeys.add(hName);
    }
  }

  const authType = COMPILED_CONFIG.auth?.authType || "none";
  if (authType === "bearer" && env.UPSTREAM_BEARER_TOKEN) {
    headers["Authorization"] = \`Bearer \${env.UPSTREAM_BEARER_TOKEN}\`;
  } else if (authType === "api_key_header" && env.UPSTREAM_API_KEY) {
    headers[COMPILED_CONFIG.auth.headerName || "X-API-Key"] = env.UPSTREAM_API_KEY;
  }

  let bodyStr;
  if (route.method !== "GET" && route.method !== "HEAD") {
    let bodyPayload = {};
    if (args.body !== undefined) {
      bodyPayload = args.body;
    } else {
      for (const [k, v] of Object.entries(args || {})) {
        if (!usedKeys.has(k)) bodyPayload[k] = v;
      }
    }
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(bodyPayload);
  }

  const res = await fetch(targetUrl.toString(), {
    method: route.method,
    headers,
    ...(bodyStr !== undefined ? { body: bodyStr } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(\`Upstream HTTP \${res.status}: \${text.slice(0, 400)}\`);
  }
  try { return JSON.parse(text); } catch { return { text }; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        server: COMPILED_CONFIG.title,
        mcp_endpoint: \`\${url.origin}/mcp\`,
        tools_count: COMPILED_CONFIG.tools.length
      }, null, 2), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname !== "/mcp") {
      return new Response(JSON.stringify({ error: "Not found. Connect ChatGPT Plugins to /mcp" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "MCP requires POST JSON-RPC 2.0" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const rpc = await req.json().catch(() => null);
    if (!rpc) return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), { status: 400, headers: cors });

    const { method, id, params } = rpc;
    const mcpHdrs = { ...cors, "Content-Type": "application/json", "MCP-Protocol-Version": "2025-03-26" };

    if (method === "initialize") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0", id,
        result: { protocolVersion: "2025-03-26", serverInfo: { name: COMPILED_CONFIG.title, version: "1.0.0" }, capabilities: { tools: { listChanged: false } } }
      }), { status: 200, headers: mcpHdrs });
    }
    if (method === "ping") return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: {} }), { status: 200, headers: mcpHdrs });
    if (method === "notifications/initialized") return new Response(null, { status: 204, headers: cors });
    if (method === "tools/list") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: COMPILED_CONFIG.tools } }), { status: 200, headers: mcpHdrs });
    }
    if (method === "tools/call") {
      const route = COMPILED_CONFIG.routes.find((r) => r.name === params?.name);
      if (!route) return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: \`Tool '\${params?.name}' not found\` } }), { status: 200, headers: mcpHdrs });
      try {
        const result = await invokeCompiledTool(route, params?.arguments || {}, env || {});
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: false }
        }), { status: 200, headers: mcpHdrs });
      } catch (err) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id,
          result: { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }], isError: true }
        }), { status: 200, headers: mcpHdrs });
      }
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }), { status: 200, headers: mcpHdrs });
  }
};
`;
}

export function buildDeployableBundle(compiled) {
  const safeSlug = String(compiled.title || "custom-gpt-mcp")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "custom-gpt-mcp";

  const wranglerToml = `name = "${safeSlug}-mcp"
main = "worker.js"
compatibility_date = "2024-11-11"
workers_dev = true

[vars]
UPSTREAM_BASE_URL = "${compiled.base_url}"
`;

  const packageJson = JSON.stringify({
    name: `${safeSlug}-mcp`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      deploy: "wrangler deploy",
      dev: "wrangler dev",
    },
    devDependencies: {
      wrangler: "^3.84.0",
    },
  }, null, 2);

  const deployYml = `name: Deploy Migrated MCP Worker
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CF_API_TOKEN }}
          accountId: \${{ secrets.CF_ACCOUNT_ID }}
`;

  const secretCmd =
    compiled.auth.authType === "bearer"
      ? "npx wrangler secret put UPSTREAM_BEARER_TOKEN"
      : compiled.auth.authType === "api_key_header"
        ? "npx wrangler secret put UPSTREAM_API_KEY"
        : "# No upstream API secret required for authType=none";

  const setupGuide = `# Deploy Your Migrated Custom GPT Remote MCP Server (60 Seconds)

OpenAI retires Custom GPTs on **December 11, 2026**, and its automated Plugin migration drops all OpenAPI Custom Actions.
This compiled bundle recreates all **${compiled.tool_count}** endpoints as a standalone **Cloudflare Workers Remote MCP Server** (free tier eligible, zero cold start).

## 1. Deploy to Your Cloudflare Account

\`\`\`bash
npm install
npx wrangler login
${secretCmd}
npx wrangler deploy
\`\`\`

Wrangler outputs your live URL: \`https://${safeSlug}-mcp.<your-subdomain>.workers.dev\`.

## 2. Connect to ChatGPT Plugins

1. In ChatGPT, migrate your Custom GPT to a **Plugin** (or open **Plugins → Create**).
2. Add your generated \`SKILL.md\` content to the Plugin's **Skills** tab.
3. Under **Connected MCP servers → Add custom MCP server**, enter:
   - **URL:** \`https://${safeSlug}-mcp.<your-subdomain>.workers.dev/mcp\`
4. Test any of your ${compiled.tool_count} converted tools:
${compiled.compiled_routes.map((r) => `   - \`${r.name}\` (\`${r.method} ${r.path}\`)`).join("\n")}
`;

  return {
    "worker.js": generateStandaloneWorkerJs(compiled),
    "wrangler.toml": wranglerToml,
    "package.json": packageJson,
    ".github/workflows/deploy.yml": deployYml,
    "SKILL.md": compiled.skill_md,
    "SETUP_CHATGPT_PLUGIN.md": setupGuide,
    "mcp-tools.json": JSON.stringify({ tools: compiled.mcp_tools }, null, 2),
  };
}

/**
 * Execute an OpenAPI-derived MCP tool call directly (powers hosted multi-tenant /mcp/h/... bridge).
 */
export async function executeCompiledToolCall(compiled, toolName, toolArgs = {}, env = {}, authOverride = "") {
  const route = compiled.compiled_routes.find((r) => r.name === toolName);
  if (!route) {
    throw Object.assign(new Error(`Tool '${toolName}' not found`), { rpcCode: -32601 });
  }
  const origin = String(compiled.base_url || "").replace(/\/+$/, "");
  const parsedOrigin = new URL(origin);
  const host = parsedOrigin.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
    throw new Error("Blocked private or loopback upstream host.");
  }

  let targetPath = route.path;
  const usedKeys = new Set();
  for (const pName of route.paramMeta?.path || []) {
    if (toolArgs[pName] === undefined) throw new Error(`Missing required path parameter '${pName}'`);
    targetPath = targetPath.replace(`{${pName}}`, encodeURIComponent(String(toolArgs[pName])));
    usedKeys.add(pName);
  }

  const targetUrl = new URL(`${origin}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`);
  for (const qName of route.paramMeta?.query || []) {
    if (toolArgs[qName] !== undefined && toolArgs[qName] !== null) {
      targetUrl.searchParams.set(qName, typeof toolArgs[qName] === "object" ? JSON.stringify(toolArgs[qName]) : String(toolArgs[qName]));
      usedKeys.add(qName);
    }
  }

  const headers = { "User-Agent": "Action2MCP-HostedBridge/1.0", Accept: "application/json" };
  for (const hName of route.paramMeta?.header || []) {
    if (toolArgs[hName] !== undefined) {
      headers[hName] = String(toolArgs[hName]);
      usedKeys.add(hName);
    }
  }
  if (authOverride) {
    if (compiled.auth?.authType === "api_key_header") {
      headers[compiled.auth.headerName || "X-API-Key"] = authOverride;
    } else {
      headers["Authorization"] = authOverride.startsWith("Bearer ") ? authOverride : `Bearer ${authOverride}`;
    }
  }

  let bodyStr;
  if (route.method !== "GET" && route.method !== "HEAD") {
    let payload = {};
    if (toolArgs.body !== undefined) payload = toolArgs.body;
    else {
      for (const [k, v] of Object.entries(toolArgs || {})) {
        if (!usedKeys.has(k)) payload[k] = v;
      }
    }
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(payload);
  }

  const res = await fetch(targetUrl.toString(), {
    method: route.method,
    headers,
    ...(bodyStr !== undefined ? { body: bodyStr } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}: ${txt.slice(0, 400)}`);
  try { return JSON.parse(txt); } catch { return { text: txt }; }
}
