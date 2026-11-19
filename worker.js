/**
 * Action2MCP — Automated Custom GPT Action to Cloudflare Remote MCP & SKILL.md Compiler
 * Zero-Cold-Start Cloudflare Edge Worker
 * Dec 11, 2026 Custom GPT Retirement Rescue: OpenAPI 3.0/3.1 JSON/YAML -> Remote MCP + SKILL.md + ZIP
 */

import {
  compileOpenApiToMcp,
  buildDeployableBundle,
  executeCompiledToolCall,
  getDec11Countdown,
} from "./compiler.js";
import { createZipArchive } from "./zip_builder.js";
import { fetchRemoteSchemaText, resolveSchemaFromParams } from "./schema_fetch.js";
import {
  CDP_FACILITATOR_URL,
  CDP_SOLANA_FEE_PAYER,
  hasCdpCredentials,
  createCdpRequestHeaders,
} from "./cdp_auth.js";
import {
  ACTION2MCP_PLANS,
  resolvePlanTier,
  cleanSecret,
  hasSigningSecretConfigured,
  escapeHtml,
  signToken,
  verifyToken,
  createStripeCheckoutSession,
  verifyStripeSessionAndMint,
} from "./stripe_billing.js";

const MERCHANT_BASE = "0x80E0Ae84679b7f11bE171DaADd492FBECf628cd6";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MERCHANT_SOLANA_OWNER = "9wuMysgXwNhtQeqJgGByAiMYc4EjzZ5wUSmnjrrt3ffh";
const MERCHANT_SOLANA_ATA = "DD3A7jaXFeHcif9eYj6Vhomuxypat5Yxi8ow6wxz27yL";
const SOLANA_FEE_PAYER = "CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww";
const PAYAI_FACILITATOR = "https://facilitator.payai.network";

const SAMPLE_CUSTOM_GPT_SCHEMA = `{
  "openapi": "3.1.0",
  "info": {
    "title": "Acme CRM Custom GPT Action",
    "version": "1.0.0",
    "description": "Search leads and create CRM follow-up tasks from ChatGPT."
  },
  "servers": [
    { "url": "https://api.acme-crm.example.com" }
  ],
  "components": {
    "securitySchemes": {
      "bearerAuth": { "type": "http", "scheme": "bearer" }
    }
  },
  "paths": {
    "/v1/leads": {
      "get": {
        "operationId": "searchLeads",
        "summary": "Search CRM leads by domain or status",
        "x-openai-isConsequential": false,
        "parameters": [
          { "name": "domain", "in": "query", "required": true, "schema": { "type": "string" } },
          { "name": "limit", "in": "query", "schema": { "type": "integer", "default": 10 } }
        ]
      }
    },
    "/v1/tasks": {
      "post": {
        "operationId": "createFollowUpTask",
        "summary": "Create a follow-up CRM task for a lead",
        "x-openai-isConsequential": true,
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["lead_id", "title"],
                "properties": {
                  "lead_id": { "type": "string" },
                  "title": { "type": "string" },
                  "due_date": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-API-Key, PAYMENT-SIGNATURE, X-PAYMENT, X-X402-Facilitator, Mcp-Session-Id, MCP-Protocol-Version, X-Upstream-Auth",
    "Access-Control-Expose-Headers":
      "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Required, X-Payment-Response, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
  };
}

function buildBazaarExtension(routePath, plan) {
  return {
    bazaar: {
      discoverable: true,
      info: {
        input: {
          type: "http",
          method: "POST",
          bodyType: "json",
          body: {
            tier: plan.id,
            schema_url: "https://raw.githubusercontent.com/julien040/anyquery/main/other/llm/openapi.yaml",
          },
        },
        output: {
          type: "json",
          example: {
            paid: true,
            sku: plan.sku,
            tool_count: 3,
            download_zip_url: "https://action2mcp.ak10082247.workers.dev/api/download?token=dl_v1...",
          },
        },
      },
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          input: {
            type: "object",
            properties: {
              tier: { type: "string", enum: ["bundle", "hosted"], default: plan.id },
              schema: { type: "string", description: "OpenAPI 3.0/3.1 JSON or YAML spec text" },
              schema_url: { type: "string", format: "uri", description: "Public HTTPS OpenAPI spec URL" },
            },
          },
          output: {
            type: "object",
            properties: {
              paid: { type: "boolean" },
              tool_count: { type: "integer" },
              download_zip_url: { type: "string" },
            },
          },
        },
      },
      routePath,
    },
  };
}

function getRequestedFacilitator(req, parsedPayment = null) {
  const url = new URL(req.url);
  const raw =
    req.headers.get("x-x402-facilitator") ||
    req.headers.get("x-facilitator") ||
    url.searchParams.get("facilitator") ||
    parsedPayment?.accepted?.extra?.facilitator ||
    parsedPayment?.extensions?.facilitator ||
    "";
  return String(raw).trim().toLowerCase();
}

function selectX402Facilitator(req, parsedPayment, isSolana, env) {
  const cdpReady = hasCdpCredentials(env);
  const payaiUrl = cleanSecret(env?.PAYAI_FACILITATOR) || PAYAI_FACILITATOR;
  const reqFac = getRequestedFacilitator(req, parsedPayment);
  const solPayer = parsedPayment?.accepted?.extra?.feePayer;

  if (reqFac === "payai") {
    return { kind: "payai", url: payaiUrl, solanaFeePayer: SOLANA_FEE_PAYER };
  }
  if (reqFac === "cdp" || reqFac === "coinbase") {
    if (!cdpReady) throw new Error("Coinbase CDP facilitator requested but CDP credentials are not configured.");
    return { kind: "cdp", url: CDP_FACILITATOR_URL, solanaFeePayer: CDP_SOLANA_FEE_PAYER };
  }
  if (isSolana) {
    if (cdpReady && solPayer === CDP_SOLANA_FEE_PAYER) {
      return { kind: "cdp", url: CDP_FACILITATOR_URL, solanaFeePayer: CDP_SOLANA_FEE_PAYER };
    }
    return { kind: "payai", url: payaiUrl, solanaFeePayer: SOLANA_FEE_PAYER };
  }
  if (cdpReady) {
    return { kind: "cdp", url: CDP_FACILITATOR_URL, solanaFeePayer: CDP_SOLANA_FEE_PAYER };
  }
  return { kind: "payai", url: payaiUrl, solanaFeePayer: SOLANA_FEE_PAYER };
}

function buildX402ChallengePayload(req, routePath, plan, details = null, env = null) {
  const url = new URL(req.url);
  const resourceUrl = `${url.origin}${routePath}`;
  const reqFac = getRequestedFacilitator(req, null);
  const useCdpSolana = (reqFac === "cdp" || reqFac === "coinbase") && hasCdpCredentials(env);
  const challengeObj = {
    x402Version: 2,
    error: details || `Payment required: ${plan.priceDisplay}`,
    resource: {
      url: resourceUrl,
      description: plan.description,
      mimeType: "application/json",
    },
    extensions: buildBazaarExtension(routePath, plan),
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: String(plan.amountMicro),
        asset: BASE_USDC,
        payTo: MERCHANT_BASE,
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2" },
      },
      {
        scheme: "exact",
        network: SOLANA_NETWORK,
        amount: String(plan.amountMicro),
        asset: SOLANA_USDC_MINT,
        payTo: MERCHANT_SOLANA_OWNER,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin (Solana)",
          version: "2",
          feePayer: useCdpSolana ? CDP_SOLANA_FEE_PAYER : SOLANA_FEE_PAYER,
          recipientAta: MERCHANT_SOLANA_ATA,
        },
      },
    ],
  };
  return {
    challengeObj,
    b64: btoa(JSON.stringify(challengeObj)),
    resourceUrl,
  };
}

function x402Response(req, routePath, plan, details = null, env = null) {
  const { challengeObj, b64 } = buildX402ChallengePayload(req, routePath, plan, details, env);
  return new Response(JSON.stringify(challengeObj, null, 2), {
    status: 402,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "PAYMENT-REQUIRED": b64,
      "X-Payment-Required": b64,
      "X-402-Version": "2",
    },
  });
}

async function verifyX402Payment(req, routePath, rawPaymentHeader, plan, env) {
  let payloadStr = String(rawPaymentHeader || "").trim();
  if (!payloadStr.startsWith("{")) {
    try {
      payloadStr = atob(payloadStr);
    } catch {
      throw new Error("Payment header must be valid Base64-encoded JSON.");
    }
  }
  const parsed = JSON.parse(payloadStr);
  const amt = parsed.accepted?.amount;
  if (amt !== undefined && BigInt(String(amt)) < BigInt(plan.amountMicro)) {
    throw new Error(`Insufficient USDC amount: expected ${plan.amountMicro} atomic units.`);
  }
  const url = new URL(req.url);
  const resourceUrl = `${url.origin}${routePath}`;
  const isSolana = (parsed.accepted?.network || "").toString().startsWith("solana") || Boolean(parsed.payload?.transaction);
  const selected = selectX402Facilitator(req, parsed, isSolana, env);

  const requirements = isSolana
    ? {
        scheme: "exact",
        network: SOLANA_NETWORK,
        amount: String(plan.amountMicro),
        asset: SOLANA_USDC_MINT,
        payTo: MERCHANT_SOLANA_OWNER,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin (Solana)",
          version: "2",
          feePayer: selected.solanaFeePayer,
          recipientAta: MERCHANT_SOLANA_ATA,
        },
      }
    : {
        scheme: "exact",
        network: "eip155:8453",
        amount: String(plan.amountMicro),
        asset: BASE_USDC,
        payTo: MERCHANT_BASE,
        maxTimeoutSeconds: 300,
        extra: { name: "USD Coin", version: "2" },
      };

  const relayBody = {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      resource: { url: resourceUrl, description: plan.description, mimeType: "application/json" },
      accepted: requirements,
      payload: parsed.payload || parsed,
      extensions: buildBazaarExtension(routePath, plan),
    },
    paymentRequirements: requirements,
  };

  const headers =
    selected.kind === "cdp"
      ? await createCdpRequestHeaders(env, "POST", "/verify")
      : { "Content-Type": "application/json" };

  const verifyRes = await fetch(`${selected.url}/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify(relayBody),
    signal: AbortSignal.timeout(15000),
  });
  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || verifyData.isValid !== true) {
    throw new Error(
      verifyData.invalidReason || verifyData.reason || verifyData.error || `${selected.kind.toUpperCase()} verify rejected (HTTP ${verifyRes.status})`,
    );
  }
  return { relayBody, isSolana, facilitator: selected.url, facilitatorKind: selected.kind, resourceUrl, plan };
}

async function settleX402Payment(prep, env) {
  const headers =
    prep.facilitatorKind === "cdp"
      ? await createCdpRequestHeaders(env, "POST", "/settle")
      : { "Content-Type": "application/json" };

  const settleRes = await fetch(`${prep.facilitator}/settle`, {
    method: "POST",
    headers,
    body: JSON.stringify(prep.relayBody),
    signal: AbortSignal.timeout(30000),
  });
  const settleData = await settleRes.json().catch(() => ({}));
  if (!settleRes.ok || settleData.success !== true || !settleData.transaction) {
    throw new Error(
      settleData.errorReason || settleData.error || settleData.message || `${prep.facilitatorKind.toUpperCase()} settlement failed (HTTP ${settleRes.status})`,
    );
  }
  return {
    success: true,
    payer: settleData.payer || "verified_buyer",
    transaction: settleData.transaction,
    amount: String(prep.plan.amountMicro),
    network: prep.isSolana ? SOLANA_NETWORK : "eip155:8453",
    facilitator: prep.facilitatorKind,
    resource: prep.resourceUrl,
  };
}

function renderLandingHtml(origin) {
  const countdown = getDec11Countdown();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action2MCP — Convert Retiring OpenAI Custom GPT Actions to Remote MCP Before Dec 11</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090b10; color: #f8fafc; margin: 0 auto; max-width: 1080px; padding: 1.5rem 1rem 4rem; line-height: 1.55; }
    .banner { background: linear-gradient(90deg, #7c2d12, #991b1b); border: 1px solid #f87171; border-radius: 10px; padding: 0.8rem 1.1rem; margin-bottom: 1.4rem; font-weight: 600; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; }
    h1 { color: #38bdf8; margin: 0; font-size: 2.1rem; }
    .sub { color: #cbd5e1; margin: 0.45rem 0 1.25rem; font-size: 1.02rem; }
    .grid { display: grid; grid-template-columns: 1.25fr 0.95fr; gap: 1.25rem; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #131722; border: 1px solid #242d42; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; color: #94a3b8; margin: 0.6rem 0 0.25rem; font-weight: 600; }
    textarea, input, select { width: 100%; box-sizing: border-box; background: #070a12; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; padding: 0.65rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
    textarea { min-height: 240px; resize: vertical; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .btn { display: inline-block; padding: 0.7rem 1.05rem; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; border: 1px solid #334155; background: #1e293b; color: #fff; text-decoration: none; text-align: center; }
    .btn-cyan { background: #0284c7; border-color: #38bdf8; }
    .btn-green { background: #059669; border-color: #10b981; }
    .btn-amber { background: #d97706; border-color: #fbbf24; }
    .cta-stack { display: flex; flex-direction: column; gap: 0.55rem; margin-top: 0.9rem; }
    pre { background: #05070c; border: 1px solid #232a3b; border-radius: 8px; padding: 0.85rem; overflow-x: auto; font-size: 0.8rem; color: #34d399; max-height: 360px; }
    .tier { background: #0b101b; border: 1px solid #232d42; border-radius: 10px; padding: 1rem; margin-bottom: 0.85rem; }
    .price { font-size: 1.45rem; font-weight: 800; color: #34d399; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="banner">
    <span>OPENAI CUSTOM GPT RETIREMENT: <strong>${countdown.days_remaining} DAYS LEFT</strong> (Dec 11, 2026)</span>
    <span style="font-size:0.88rem;color:#fee2e2;">OpenAI's built-in Plugin migrator drops 100% of Custom Actions. Convert OpenAPI -&gt; Remote MCP in 3 seconds.</span>
  </div>

  <h1>Action2MCP</h1>
  <p class="sub">Paste your Custom GPT OpenAPI 3.0/3.1 JSON or YAML Action schema below to preview valid ChatGPT Plugin MCP <code>tools/list</code> definitions &amp; portable <code>SKILL.md</code> free, then export a deployable Cloudflare Worker or instant hosted MCP URL.</p>

  <div class="grid">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>1. Paste Custom GPT OpenAPI JSON / YAML</strong>
        <button class="btn" style="padding:0.35rem 0.7rem;font-size:0.78rem;" onclick="loadExample()">Load Example Schema</button>
      </div>
      <label for="schemaText">OpenAPI Action Schema (JSON or YAML)</label>
      <textarea id="schemaText" placeholder='{"openapi":"3.1.0","servers":[{"url":"https://api.yourdomain.com"}],"paths":{...}}'></textarea>

      <div class="row">
        <div>
          <label for="authType">Upstream Auth Mode</label>
          <select id="authType">
            <option value="auto">Auto-detect from OpenAPI securitySchemes</option>
            <option value="none">None (Public API)</option>
            <option value="bearer">Bearer Token (UPSTREAM_BEARER_TOKEN)</option>
            <option value="api_key_header">API Key Header (UPSTREAM_API_KEY)</option>
          </select>
        </div>
        <div>
          <label for="schemaUrl">Or Public Schema URL (optional, for $15 Hosted Bridge)</label>
          <input id="schemaUrl" type="url" placeholder="https://raw.githubusercontent.com/.../openapi.yaml" />
        </div>
      </div>

      <label for="instructions">GPT Instructions (optional — included in SKILL.md)</label>
      <input id="instructions" type="text" placeholder="You are a CRM assistant that searches leads and creates follow-up tasks..." />

      <div class="cta-stack">
        <button class="btn btn-cyan" onclick="runPreview()">Preview MCP tools/list &amp; SKILL.md (Free Instant Check)</button>
      </div>
    </div>

    <div>
      <div class="card">
        <strong>2. Export Your Working Remote MCP Server</strong>
        <div class="tier" style="margin-top:0.75rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Deployable Worker Bundle</strong>
            <span class="price">$5</span>
          </div>
          <p style="font-size:0.86rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Instant <code>.zip</code> containing standalone Cloudflare Worker (<code>worker.js</code>), <code>wrangler.toml</code>, <code>deploy.yml</code>, <code>SKILL.md</code> &amp; ChatGPT Plugin Setup Guide. Runs free on your Cloudflare account.</p>
          <div class="cta-stack">
            <button class="btn btn-green" onclick="checkoutStripe('bundle')">Buy Bundle ($5 Card / Stripe)</button>
            <button class="btn" onclick="inspectX402('bundle')">Pay $5.00 USDC (Base / Solana x402)</button>
          </div>
        </div>

        <div class="tier">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Hosted Rescue Bridge + Bundle</strong>
            <span class="price">$15</span>
          </div>
          <p style="font-size:0.86rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Includes everything in the $5 Bundle PLUS an instant multi-tenant hosted <code>/mcp/h/...</code> URL to paste straight into ChatGPT Plugins + priority async support.</p>
          <div class="cta-stack">
            <button class="btn btn-amber" onclick="checkoutStripe('hosted')">Buy Hosted Rescue ($15 Card / Stripe)</button>
            <button class="btn" onclick="inspectX402('hosted')">Pay $15.00 USDC (Base / Solana x402)</button>
          </div>
        </div>
      </div>

      <div class="card" style="font-size:0.84rem;color:#94a3b8;">
        <strong>Agent / CLI Endpoints:</strong><br>
        &bull; Free Compiler API: <code>POST ${escapeHtml(origin)}/api/preview</code><br>
        &bull; Remote MCP Tool (<code>convert_openapi_to_mcp</code>): <code>POST ${escapeHtml(origin)}/mcp</code><br>
        &bull; <a href="/server.json">server.json</a> &bull; <a href="/openapi.json">openapi.json</a> &bull; <a href="/skill.md">skill.md</a>
      </div>
    </div>
  </div>

  <div class="card">
    <strong>Live Compiler Output (MCP <code>tools/list</code>, Audit Warnings &amp; <code>SKILL.md</code>)</strong>
    <pre id="previewOut">Paste an OpenAPI schema or click "Load Example Schema" + "Preview MCP tools/list &amp; SKILL.md" above...</pre>
  </div>

  <script>
    const SAMPLE = ${JSON.stringify(SAMPLE_CUSTOM_GPT_SCHEMA)};
    function loadExample() {
      document.getElementById("schemaText").value = SAMPLE;
    }
    function persistDraft() {
      try {
        localStorage.setItem("a2m_draft", JSON.stringify({
          schema: document.getElementById("schemaText").value,
          schema_url: document.getElementById("schemaUrl").value,
          instructions: document.getElementById("instructions").value,
          auth_type: document.getElementById("authType").value
        }));
      } catch {}
    }
    async function runPreview() {
      persistDraft();
      const out = document.getElementById("previewOut");
      out.textContent = "Compiling OpenAPI -> MCP + SKILL.md...";
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema: document.getElementById("schemaText").value,
            schema_url: document.getElementById("schemaUrl").value,
            instructions: document.getElementById("instructions").value,
            auth_type: document.getElementById("authType").value
          })
        });
        out.textContent = JSON.stringify(await res.json(), null, 2);
      } catch (e) {
        out.textContent = "Error: " + e.message;
      }
    }
    function checkoutStripe(tier) {
      persistDraft();
      const su = document.getElementById("schemaUrl").value.trim();
      let url = "/api/checkout?tier=" + encodeURIComponent(tier);
      if (su) url += "&spec_url=" + encodeURIComponent(su);
      window.location.href = url;
    }
    async function inspectX402(tier) {
      persistDraft();
      const out = document.getElementById("previewOut");
      const su = document.getElementById("schemaUrl").value.trim();
      const st = document.getElementById("schemaText").value.trim();
      const res = await fetch("/api/buy?tier=" + encodeURIComponent(tier), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          schema_url: su || undefined,
          schema: st || (su ? undefined : SAMPLE)
        })
      });
      out.textContent = "HTTP " + res.status + " x402 V2 Challenge (" + tier + "):\\n\\n" + JSON.stringify(await res.json(), null, 2);
    }
    (function initFromQuery() {
      try {
        const sp = new URLSearchParams(window.location.search).get("spec_url") || "";
        if (sp) {
          document.getElementById("schemaUrl").value = sp;
          runPreview();
        }
      } catch {}
    })();
  </script>
</body>
</html>`;
}

function renderFulfillmentConsoleHtml(fulfillment, origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action2MCP Payment Confirmed — Compile &amp; Download Bundle</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090b10; color: #f8fafc; max-width: 860px; margin: 0 auto; padding: 2rem 1rem; line-height: 1.55; }
    .card { background: #131722; border: 1px solid #242d42; border-radius: 12px; padding: 1.3rem; margin: 1rem 0; }
    textarea, input { width: 100%; box-sizing: border-box; background: #070a12; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; padding: 0.6rem; font-family: ui-monospace, monospace; font-size: 0.84rem; margin: 0.35rem 0 0.75rem; }
    textarea { min-height: 180px; }
    .btn { display: inline-block; padding: 0.65rem 1.05rem; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; border: 0; background: #059669; color: #fff; text-decoration: none; }
    .btn-blue { background: #2563eb; }
    code, pre { background: #05070c; border: 1px solid #232a3b; border-radius: 8px; padding: 0.7rem; display: block; color: #34d399; word-break: break-all; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Payment Confirmed — ${escapeHtml(fulfillment.product_name)}</h1>
  <p style="color:#94a3b8;">Session: <code>${escapeHtml(fulfillment.session_id)}</code> &bull; Tier: <strong>${escapeHtml(fulfillment.tier)}</strong></p>

  <div class="card">
    <h3>1. Download Your Compiled Cloudflare Worker + SKILL.md ZIP</h3>
    ${fulfillment.specUrl ? `<p style="color:#34d399;font-size:0.88rem;">Pre-loaded OpenAPI schema URL: <code>${escapeHtml(fulfillment.specUrl)}</code></p>` : `<p style="color:#cbd5e1;font-size:0.9rem;">If you pasted an OpenAPI schema before checkout, it is auto-loaded below. Click Download to compile &amp; fetch your <code>.zip</code> archive.</p>`}
    <textarea id="schemaInput"></textarea>
    <input id="instInput" type="text" placeholder="Optional GPT instructions for SKILL.md" />
    <button class="btn" onclick="downloadCustomZip()">Download Compiled Cloudflare MCP ZIP</button>
    <a class="btn btn-blue" style="margin-left:0.5rem;" href="${escapeHtml(fulfillment.download_zip_url)}">${fulfillment.specUrl ? "Direct Download Compiled ZIP" : "Quick Starter Template ZIP"}</a>
  </div>

  ${
    fulfillment.management_token
      ? `<div class="card">
          <h3>2. $15 Hosted Remote MCP Bridge &amp; Management Token</h3>
          <p style="color:#cbd5e1;font-size:0.9rem;">Your HMAC Management Token:</p>
          <code>${escapeHtml(fulfillment.management_token)}</code>
          ${fulfillment.hosted_bridge_url ? `<p>Hosted MCP URL (paste in ChatGPT Plugins):</p><code>${escapeHtml(fulfillment.hosted_bridge_url)}</code>` : ""}
          <p style="color:#94a3b8;font-size:0.86rem;">Paste a public OpenAPI schema URL or schema JSON below to mint your live ChatGPT <code>/mcp/h/...</code> URL instantly:</p>
          <input id="bridgeUrlInput" type="url" placeholder="https://raw.githubusercontent.com/.../openapi.yaml (recommended)" />
          <button class="btn btn-blue" onclick="registerBridge()">Generate Hosted MCP Server URL</button>
          <pre id="bridgeOut" style="display:none;margin-top:0.75rem;"></pre>
        </div>`
      : ""
  }

  <script>
    const DL_TOKEN = ${JSON.stringify(fulfillment.download_token)};
    const MGMT_TOKEN = ${JSON.stringify(fulfillment.management_token || "")};
    const PRESET_SPEC_URL = ${JSON.stringify(fulfillment.specUrl || "")};
    let SAVED_AUTH_TYPE = "auto";
    try {
      const saved = JSON.parse(localStorage.getItem("a2m_draft") || "{}");
      if (saved.schema) document.getElementById("schemaInput").value = saved.schema;
      if (saved.instructions) document.getElementById("instInput").value = saved.instructions;
      if (saved.auth_type) SAVED_AUTH_TYPE = saved.auth_type;
      if (document.getElementById("bridgeUrlInput")) {
        document.getElementById("bridgeUrlInput").value = saved.schema_url || PRESET_SPEC_URL || "";
      }
    } catch {}

    async function downloadCustomZip() {
      const schema = document.getElementById("schemaInput").value.trim();
      if (!schema) {
        window.location.href = "/api/download?token=" + encodeURIComponent(DL_TOKEN) + "&format=zip";
        return;
      }
      const res = await fetch("/api/download?token=" + encodeURIComponent(DL_TOKEN) + "&format=zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, instructions: document.getElementById("instInput").value, auth_type: SAVED_AUTH_TYPE })
      });
      if (!res.ok) { alert("Compile failed: " + await res.text()); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "action2mcp-worker-bundle.zip";
      a.click();
    }

    async function registerBridge() {
      const out = document.getElementById("bridgeOut");
      out.style.display = "block";
      out.textContent = "Minting signed Hosted MCP URL...";
      const schemaUrl = document.getElementById("bridgeUrlInput").value.trim();
      const schemaText = document.getElementById("schemaInput").value.trim();
      const res = await fetch("/api/hosted/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + MGMT_TOKEN },
        body: JSON.stringify({ schema_url: schemaUrl || undefined, schema: schemaUrl ? undefined : schemaText })
      });
      out.textContent = JSON.stringify(await res.json(), null, 2);
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = corsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (path === "/" || path === "/index.html") {
      return new Response(renderLandingHtml(url.origin), {
        status: 200,
        headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/health" || path === "/ping") {
      return new Response(
        JSON.stringify(
          {
            status: "ok",
            service: "action2mcp",
            version: "1.0.0",
            dec11_countdown: getDec11Countdown(),
            merchant_base: MERCHANT_BASE,
            merchant_solana_ata: MERCHANT_SOLANA_ATA,
            cdp_bazaar_enabled: hasCdpCredentials(env),
            facilitators: hasCdpCredentials(env) ? ["coinbase-cdp", "payai"] : ["payai"],
            plans: ACTION2MCP_PLANS,
          },
          null,
          2,
        ),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (path === "/server.json") {
      return new Response(
        JSON.stringify(
          {
            $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
            name: "io.github.ak10082247-max/action2mcp",
            title: "Action2MCP Custom GPT Action to Remote MCP Compiler",
            description: "Compile retiring OpenAI Custom GPT Actions into Cloudflare Remote MCP & SKILL.md ($5/$15).",
            version: "1.0.0",
            websiteUrl: "https://action2mcp.ak10082247.workers.dev",
            repository: { url: "https://github.com/ak10082247-max/action2mcp", source: "github" },
            remotes: [{ type: "streamable-http", url: `${url.origin}/mcp` }],
          },
          null,
          2,
        ),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (path === "/.well-known/x402.json") {
      return new Response(
        JSON.stringify(
          {
            x402Version: 2,
            name: "Action2MCP",
            merchantAddressBase: MERCHANT_BASE,
            merchantAddressSolana: MERCHANT_SOLANA_ATA,
            facilitator: hasCdpCredentials(env)
              ? CDP_FACILITATOR_URL
              : cleanSecret(env?.PAYAI_FACILITATOR) || PAYAI_FACILITATOR,
            facilitators: hasCdpCredentials(env)
              ? [CDP_FACILITATOR_URL, cleanSecret(env?.PAYAI_FACILITATOR) || PAYAI_FACILITATOR]
              : [cleanSecret(env?.PAYAI_FACILITATOR) || PAYAI_FACILITATOR],
            cdpSolanaFeePayer: CDP_SOLANA_FEE_PAYER,
            payaiSolanaFeePayer: SOLANA_FEE_PAYER,
            endpoints: [
              {
                path: "/api/buy?tier=bundle",
                name: ACTION2MCP_PLANS.bundle.name,
                priceUsdc: (ACTION2MCP_PLANS.bundle.amountMicro / 1e6).toFixed(2),
                amountMicro: ACTION2MCP_PLANS.bundle.amountMicro,
              },
              {
                path: "/api/buy?tier=hosted",
                name: ACTION2MCP_PLANS.hosted.name,
                priceUsdc: (ACTION2MCP_PLANS.hosted.amountMicro / 1e6).toFixed(2),
                amountMicro: ACTION2MCP_PLANS.hosted.amountMicro,
              },
            ],
          },
          null,
          2,
        ),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (path === "/.well-known/agent-card.json") {
      return new Response(
        JSON.stringify(
          {
            name: "Action2MCP",
            description: "OpenAI Custom GPT Action to Remote MCP & SKILL.md Rescue Compiler before Dec 11, 2026.",
            protocol: "x402-v2",
            mcpEndpoint: `${url.origin}/mcp`,
            capabilities: ["openapi_to_mcp", "skill_md_export", "cloudflare_worker_bundle"],
          },
          null,
          2,
        ),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (path === "/skill.md") {
      return new Response(
        `---
name: action2mcp
description: Compile retiring OpenAI Custom GPT Actions (OpenAPI 3.0/3.1 JSON or YAML) into Cloudflare Remote MCP Servers and SKILL.md bundles before Dec 11, 2026.
---
# Action2MCP

- Free preview: \`POST ${url.origin}/api/preview\`
- Remote MCP endpoint: \`POST ${url.origin}/mcp\` (tool: \`convert_openapi_to_mcp\`)
- $5 Bundle Checkout: \`${url.origin}/api/checkout?tier=bundle\` or \`POST ${url.origin}/api/buy?tier=bundle\` (USDC)
- $15 Hosted Rescue Bridge: \`${url.origin}/api/checkout?tier=hosted\` or \`POST ${url.origin}/api/buy?tier=hosted\` (USDC)
`,
        { status: 200, headers: { ...cors, "Content-Type": "text/markdown; charset=utf-8" } },
      );
    }

    if (path === "/openapi.json") {
      return new Response(
        JSON.stringify(
          {
            openapi: "3.1.0",
            info: { title: "Action2MCP API", version: "1.0.0" },
            servers: [{ url: url.origin }],
            paths: {
              "/api/preview": { post: { summary: "Compile OpenAPI JSON/YAML into MCP tools/list & SKILL.md preview" } },
              "/api/checkout": { post: { summary: "Create Stripe Checkout session for $5 bundle or $15 hosted rescue" } },
              "/api/buy": { post: { summary: "Purchase $5 bundle or $15 hosted rescue via Base/Solana USDC x402 V2" } },
              "/api/download": { get: { summary: "Download compiled Cloudflare Worker ZIP or JSON bundle" } },
            },
          },
          null,
          2,
        ),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // 1. FREE COMPILER PREVIEW: POST /api/preview
    // -----------------------------------------------------------------------
    if (path === "/api/preview") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "POST required" }), {
          status: 405,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      let body = {};
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON request body." }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      try {
        const { schemaText } = await resolveSchemaFromParams(body);
        if (!schemaText) {
          return new Response(JSON.stringify({ ok: false, error: "Provide 'schema' (OpenAPI JSON/YAML) or 'schema_url'." }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const compiled = compileOpenApiToMcp({
          schemaText,
          instructions: body.instructions || "",
          authType: body.auth_type || "auto",
          authHeaderName: body.auth_header || "",
        });
        return new Response(
          JSON.stringify(
            {
              ok: true,
              title: compiled.title,
              openapi_version: compiled.openapi_version,
              base_url: compiled.base_url,
              auth: compiled.auth,
              tool_count: compiled.tool_count,
              consequential_count: compiled.consequential_count,
              schema_chars: compiled.schema_chars,
              dec11_countdown: compiled.dec11_countdown,
              warnings: compiled.warnings,
              tools: compiled.mcp_tools,
              skill_md: compiled.skill_md,
            },
            null,
            2,
          ),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: err.httpStatus || 422,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // -----------------------------------------------------------------------
    // 2. STRIPE CHECKOUT: GET|POST /api/checkout?tier=bundle|hosted
    // -----------------------------------------------------------------------
    if (path === "/api/checkout") {
      if (req.method !== "GET" && req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      let bodyParams = {};
      if (req.method === "POST") {
        try {
          bodyParams = await req.json();
        } catch {
          bodyParams = {};
        }
      }
      const tierKey = url.searchParams.get("tier") || bodyParams.tier || "bundle";
      const plan = resolvePlanTier(tierKey);
      if (!plan) {
        return new Response(JSON.stringify({ error: "invalid_tier", available: Object.keys(ACTION2MCP_PLANS) }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const specUrl = String(url.searchParams.get("spec_url") || bodyParams.spec_url || bodyParams.schema_url || "").trim().slice(0, 450);

      try {
        const session = await createStripeCheckoutSession(
          {
            successUrl: `${url.origin}/api/download?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${url.origin}/?canceled=1`,
            lineItems: [
              {
                price_data: {
                  currency: "usd",
                  unit_amount: plan.amountCents,
                  product_data: { name: plan.name, description: plan.description },
                },
                quantity: 1,
              },
            ],
            metadata: {
              tier: plan.id,
              sku: plan.sku,
              ...(specUrl ? { spec_url: specUrl } : {}),
            },
          },
          env,
        );
        if (req.method === "POST" || url.searchParams.get("format") === "json") {
          return new Response(
            JSON.stringify({ id: session.id, url: session.url, tier: plan.id, sku: plan.sku, amount_cents: plan.amountCents }, null, 2),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        return new Response(null, { status: 303, headers: { ...cors, Location: session.url } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, charged: false }), {
          status: err.httpStatus || 502,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // -----------------------------------------------------------------------
    // 3. X402 V2 CRYPTO PURCHASE: POST /api/buy?tier=bundle|hosted
    // -----------------------------------------------------------------------
    if (path === "/api/buy" || path === "/api/checkout/x402") {
      if (req.method !== "POST" && req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed", charged: false }), {
          status: 405,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      let bodyParams = {};
      if (req.method === "POST") {
        try {
          bodyParams = await req.json();
        } catch {
          bodyParams = {};
        }
      }
      const tierKey = url.searchParams.get("tier") || bodyParams.tier || "bundle";
      const plan = resolvePlanTier(tierKey);
      if (!plan) {
        return new Response(JSON.stringify({ error: "invalid_tier", available: Object.keys(ACTION2MCP_PLANS), charged: false }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const routeKey = `${path}?tier=${plan.id}`;
      const paymentHdr = req.headers.get("PAYMENT-SIGNATURE") || req.headers.get("X-PAYMENT") || req.headers.get("payment-signature");
      if (!paymentHdr) {
        return x402Response(req, routeKey, plan, null, env);
      }

      if (!hasSigningSecretConfigured(env)) {
        return new Response(
          JSON.stringify({ error: "signing_secret_not_configured", charged: false }, null, 2),
          { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      let paymentPrep;
      try {
        paymentPrep = await verifyX402Payment(req, routeKey, paymentHdr, plan, env);
      } catch (err) {
        return x402Response(req, routeKey, plan, `Payment validation rejected: ${err.message}`, env);
      }

      // Pre-compile buyer's OpenAPI schema BEFORE settling so invalid schemas never charge
      let compiled;
      let files;
      let specUrlUsed = "";
      try {
        const resolved = await resolveSchemaFromParams(bodyParams);
        specUrlUsed = resolved.schemaUrl;
        const schemaToCompile = resolved.schemaText || SAMPLE_CUSTOM_GPT_SCHEMA;
        compiled = compileOpenApiToMcp({
          schemaText: schemaToCompile,
          instructions: bodyParams.instructions || "",
          authType: bodyParams.auth_type || "auto",
          authHeaderName: bodyParams.auth_header || "",
        });
        files = buildDeployableBundle(compiled);
      } catch (compileErr) {
        return new Response(
          JSON.stringify({ error: `OpenAPI compile failed before settlement: ${compileErr.message}`, charged: false }, null, 2),
          { status: compileErr.httpStatus || 422, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      let receipt;
      try {
        receipt = await settleX402Payment(paymentPrep, env);
      } catch (settleErr) {
        return new Response(JSON.stringify({ error: "settlement_failed", charged: false, message: settleErr.message }), {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const dlToken = await signToken(
        {
          typ: "a2m_download",
          sid: receipt.transaction,
          sku: plan.sku,
          tier: plan.id,
          ...(specUrlUsed ? { specUrl: specUrlUsed } : {}),
          iat: now,
          exp: now + 30 * 24 * 60 * 60,
        },
        env.KUROX_SIGNING_SECRET,
        "dl_v1",
      );

      let managementToken = null;
      let hostedBridgeUrl = null;
      if (plan.id === "hosted") {
        managementToken = await signToken(
          { typ: "a2m_hosted_mgmt", sid: receipt.transaction, sku: plan.sku, tier: plan.id, iat: now, exp: now + plan.ttlSeconds },
          env.KUROX_SIGNING_SECRET,
          "a2m_mgmt_v1",
        );
        if (specUrlUsed) {
          const bridgeTok = await signToken(
            { typ: "a2m_bridge", sid: receipt.transaction, specUrl: specUrlUsed, iat: now, exp: now + plan.ttlSeconds },
            env.KUROX_SIGNING_SECRET,
            "a2m_bridge_v1",
          );
          hostedBridgeUrl = `${url.origin}/mcp/h/${encodeURIComponent(bridgeTok)}`;
        }
      }

      const b64Receipt = btoa(JSON.stringify(receipt));
      return new Response(
        JSON.stringify(
          {
            status: "fulfilled",
            paid: true,
            tier: plan.id,
            sku: plan.sku,
            tx_hash: receipt.transaction,
            network: receipt.network,
            payer: receipt.payer,
            download_token: dlToken,
            download_zip_url: `${url.origin}/api/download?token=${encodeURIComponent(dlToken)}&format=zip`,
            management_token: managementToken,
            hosted_bridge_url: hostedBridgeUrl,
            tool_count: compiled.tool_count,
            files,
          },
          null,
          2,
        ),
        {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "PAYMENT-RESPONSE": b64Receipt,
            "X-Payment-Response": b64Receipt,
          },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 4. PAID FULFILLMENT & ZIP DOWNLOAD: GET|POST /api/download
    // -----------------------------------------------------------------------
    if (path === "/api/download") {
      const sessionId = url.searchParams.get("session_id") || "";
      const token = url.searchParams.get("token") || "";
      const reqFormat = (url.searchParams.get("format") || "").toLowerCase();

      let fulfillment;
      if (sessionId) {
        try {
          fulfillment = await verifyStripeSessionAndMint(sessionId, url.origin, env);
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message, paid: false }), {
            status: err.httpStatus || 500,
            headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      } else if (token) {
        if (!hasSigningSecretConfigured(env)) {
          return new Response(JSON.stringify({ error: "signing_secret_not_configured" }), {
            status: 503,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const payload = await verifyToken(token, env.KUROX_SIGNING_SECRET, "dl_v1");
        if (!payload || payload.typ !== "a2m_download") {
          return new Response(JSON.stringify({ error: "invalid_or_expired_download_token" }), {
            status: 403,
            headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
        const plan = resolvePlanTier(payload.tier) || ACTION2MCP_PLANS.bundle;
        fulfillment = {
          paid: true,
          session_id: payload.sid,
          tier: plan.id,
          sku: plan.sku,
          product_name: plan.name,
          download_token: token,
          specUrl: payload.specUrl || "",
          download_zip_url: `${url.origin}/api/download?token=${encodeURIComponent(token)}&format=zip`,
        };
      } else {
        return new Response(JSON.stringify({ error: "Missing session_id or token" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      if (sessionId && reqFormat !== "zip" && reqFormat !== "json" && req.method === "GET") {
        return new Response(renderFulfillmentConsoleHtml(fulfillment, url.origin), {
          status: 200,
          headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }

      let bodyParams = {};
      if (req.method === "POST") {
        try {
          bodyParams = await req.json();
        } catch {
          bodyParams = {};
        }
      }

      try {
        const { schemaText } = await resolveSchemaFromParams({
          schema: bodyParams.schema,
          schema_url: bodyParams.schema_url || url.searchParams.get("spec_url") || fulfillment.specUrl,
        });
        const compiled = compileOpenApiToMcp({
          schemaText: schemaText || SAMPLE_CUSTOM_GPT_SCHEMA,
          instructions: bodyParams.instructions || "",
          authType: bodyParams.auth_type || "auto",
          authHeaderName: bodyParams.auth_header || "",
        });
        const files = buildDeployableBundle(compiled);

        if (reqFormat === "zip" || req.method === "POST") {
          if (reqFormat === "json") {
            return new Response(JSON.stringify({ ok: true, fulfillment, compiled, files }, null, 2), {
              status: 200,
              headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
            });
          }
          const zipBytes = createZipArchive(files);
          return new Response(zipBytes, {
            status: 200,
            headers: {
              ...cors,
              "Content-Type": "application/zip",
              "Content-Disposition": 'attachment; filename="action2mcp-worker-bundle.zip"',
              "Content-Length": String(zipBytes.byteLength),
              "Cache-Control": "no-store",
            },
          });
        }

        return new Response(JSON.stringify({ ok: true, fulfillment, compiled, files }, null, 2), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: err.httpStatus || 422,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // -----------------------------------------------------------------------
    // 5. $15 HOSTED MULTI-TENANT BRIDGE REGISTRATION & MCP ENDPOINT
    // -----------------------------------------------------------------------
    if (path === "/api/hosted/register") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!hasSigningSecretConfigured(env)) {
        return new Response(JSON.stringify({ error: "signing_secret_not_configured" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const authHdr = req.headers.get("Authorization") || "";
      const mgmtTok = authHdr.startsWith("Bearer ") ? authHdr.slice(7).trim() : "";
      const payload = await verifyToken(mgmtTok, env.KUROX_SIGNING_SECRET, "a2m_mgmt_v1");
      if (!payload || payload.tier !== "hosted") {
        return new Response(JSON.stringify({ error: "Valid $15 Hosted Management Token required" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      let body = {};
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const specUrl = String(body.schema_url || body.spec_url || "").trim();
      const rawSchema = String(body.schema || "").trim();
      try {
        const schemaText = specUrl ? await fetchRemoteSchemaText(specUrl) : rawSchema;
        if (!schemaText) {
          return new Response(JSON.stringify({ error: "Provide schema_url or schema" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        const compiled = compileOpenApiToMcp({
          schemaText,
          authType: body.auth_type || "auto",
          authHeaderName: body.auth_header || "",
        });

        const now = Math.floor(Date.now() / 1000);
        let bridgePayload;
        if (specUrl) {
          bridgePayload = { typ: "a2m_bridge", specUrl, authType: compiled.auth.authType, authHeader: compiled.auth.headerName, iat: now, exp: now + 365 * 86400 };
        } else if (schemaText.length <= 12000) {
          bridgePayload = { typ: "a2m_bridge", schema: schemaText, authType: compiled.auth.authType, authHeader: compiled.auth.headerName, iat: now, exp: now + 365 * 86400 };
        } else {
          return new Response(JSON.stringify({ error: "Inline schema exceeds 12KB stateless token size; provide a public schema_url or deploy via the $5 Worker ZIP." }), {
            status: 413,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        const bridgeToken = await signToken(bridgePayload, env.KUROX_SIGNING_SECRET, "a2m_bridge_v1");
        return new Response(
          JSON.stringify(
            {
              ok: true,
              hosted_mcp_url: `${url.origin}/mcp/h/${encodeURIComponent(bridgeToken)}`,
              tool_count: compiled.tool_count,
              tools: compiled.mcp_tools.map((t) => t.name),
            },
            null,
            2,
          ),
          { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: err.httpStatus || 422, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    if (path.startsWith("/mcp/h/")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "MCP requires POST JSON-RPC 2.0" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!hasSigningSecretConfigured(env)) {
        return new Response(JSON.stringify({ error: "signing_secret_not_configured" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const bridgeTok = decodeURIComponent(path.slice("/mcp/h/".length));
      const verified = await verifyToken(bridgeTok, env.KUROX_SIGNING_SECRET, "a2m_bridge_v1");
      if (!verified || verified.typ !== "a2m_bridge") {
        return new Response(JSON.stringify({ error: "Invalid or expired Hosted MCP Bridge token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
      let rpc;
      try {
        rpc = await req.json();
      } catch {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), { status: 400, headers: cors });
      }

      const mcpHdrs = { ...cors, "Content-Type": "application/json", "MCP-Protocol-Version": "2025-03-26" };
      const { method, id, params } = rpc;
      if (method === "ping") return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: {} }), { status: 200, headers: mcpHdrs });
      if (method === "notifications/initialized") return new Response(null, { status: 204, headers: cors });

      let compiled;
      try {
        const schemaText = verified.schema || (await fetchRemoteSchemaText(verified.specUrl));
        compiled = compileOpenApiToMcp({ schemaText, authType: verified.authType || "auto", authHeaderName: verified.authHeader || "" });
      } catch (err) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: `Hosted schema compile failed: ${err.message}` } }), { status: 502, headers: mcpHdrs });
      }

      if (method === "initialize") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { protocolVersion: "2025-03-26", serverInfo: { name: compiled.title, version: "1.0.0" }, capabilities: { tools: { listChanged: false } } },
          }),
          { status: 200, headers: mcpHdrs },
        );
      }
      if (method === "tools/list") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: compiled.mcp_tools } }), { status: 200, headers: mcpHdrs });
      }
      if (method === "tools/call") {
        try {
          const authOverride = req.headers.get("X-Upstream-Auth") || req.headers.get("Authorization") || "";
          const out = await executeCompiledToolCall(compiled, params?.name, params?.arguments || {}, env, authOverride);
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: false } }),
            { status: 200, headers: mcpHdrs },
          );
        } catch (err) {
          if (err.rpcCode === -32601) {
            return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: err.message } }), { status: 200, headers: mcpHdrs });
          }
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }], isError: true } }),
            { status: 200, headers: mcpHdrs },
          );
        }
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }), { status: 200, headers: mcpHdrs });
    }

    // -----------------------------------------------------------------------
    // 6. ACTION2MCP REMOTE MCP SERVER: POST /mcp (convert_openapi_to_mcp)
    // -----------------------------------------------------------------------
    if (path === "/mcp") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "MCP requires POST JSON-RPC 2.0" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
      }
      let rpc;
      try {
        rpc = await req.json();
      } catch {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), { status: 400, headers: cors });
      }

      const mcpHdrs = { ...cors, "Content-Type": "application/json", "MCP-Protocol-Version": "2025-03-26" };
      const { method, id, params } = rpc;
      if (method === "initialize") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { protocolVersion: "2025-03-26", serverInfo: { name: "action2mcp", version: "1.0.0" }, capabilities: { tools: { listChanged: false } } },
          }),
          { status: 200, headers: mcpHdrs },
        );
      }
      if (method === "ping") return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: {} }), { status: 200, headers: mcpHdrs });
      if (method === "notifications/initialized") return new Response(null, { status: 204, headers: cors });

      if (method === "tools/list") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              tools: [
                {
                  name: "convert_openapi_to_mcp",
                  description:
                    "Compile an OpenAI Custom GPT OpenAPI 3.0/3.1 JSON or YAML Action schema into MCP tools/list definitions, SKILL.md, and Cloudflare Worker migration code before the Dec 11, 2026 retirement.",
                  inputSchema: {
                    type: "object",
                    properties: {
                      schema: { type: "string", description: "Raw OpenAPI 3.0/3.1 JSON or YAML string" },
                      schema_url: { type: "string", description: "Optional public URL to openapi.json or openapi.yaml" },
                      instructions: { type: "string", description: "Optional Custom GPT system instructions for SKILL.md" },
                      auth_type: { type: "string", enum: ["auto", "none", "bearer", "api_key_header"], default: "auto" },
                    },
                  },
                },
              ],
            },
          }),
          { status: 200, headers: mcpHdrs },
        );
      }

      if (method === "tools/call") {
        if (params?.name !== "convert_openapi_to_mcp") {
          return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `Tool '${params?.name}' not found` } }), { status: 200, headers: mcpHdrs });
        }
        try {
          const args = params?.arguments || {};
          const { schemaText } = await resolveSchemaFromParams(args);
          if (!schemaText) throw new Error("Provide 'schema' or 'schema_url'.");
          const compiled = compileOpenApiToMcp({
            schemaText,
            instructions: args.instructions || "",
            authType: args.auth_type || "auto",
          });
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        title: compiled.title,
                        tool_count: compiled.tool_count,
                        consequential_count: compiled.consequential_count,
                        warnings: compiled.warnings,
                        dec11_countdown: compiled.dec11_countdown,
                        tools: compiled.mcp_tools,
                        skill_md: compiled.skill_md,
                        bundle_checkout_url: `${url.origin}/api/checkout?tier=bundle`,
                        hosted_checkout_url: `${url.origin}/api/checkout?tier=hosted`,
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: false,
              },
            }),
            { status: 200, headers: mcpHdrs },
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }], isError: true } }),
            { status: 200, headers: mcpHdrs },
          );
        }
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }), { status: 200, headers: mcpHdrs });
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
