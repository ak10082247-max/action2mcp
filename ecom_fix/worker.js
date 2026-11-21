/**
 * Play B: StoreFix — Shopify & WooCommerce Google Shopping & Revenue-Leak Rescue Worker
 */

import {
  MERCHANT_BASE,
  MERCHANT_SOLANA_ATA,
  buildCorsHeaders,
  jsonResp,
  htmlResp,
  handleStripeCheckoutRoute,
  handleGenericX402BuyRoute,
  handleRescueDownloadRoute,
  incrementFunnelCounter,
} from "../edge_helpers.js";
import { analyzeEcommerceStore, buildStoreFixBundle } from "./diagnostics.js";

export const ECOM_FIX_PLANS = {
  fix_pack: {
    id: "fix_pack",
    sku: "ecomfix-bundle-v1",
    name: "Store Fix Bundle — $10 Deal (was $49)",
    description:
      "Limited-time $10 Deal (normally $49): Instant store-tailored ZIP containing valid Google Merchant Product JSON-LD (Liquid/WooCommerce), ready-to-import Shopify url-redirects.csv, revenue-leak audit CSV, and March 2027 ScriptTag checklist.",
    amountCents: 1000,
    amountMicro: 10000000,
    originalCents: 4900,
    originalDisplay: "$49",
    priceDisplay: "$10 USD / USDC (was $49)",
    tier: "fix_pack_10",
  },
  pro_kit: {
    id: "pro_kit",
    sku: "ecomfix-pro-v1",
    name: "Store Fix Kit Pro — $25 Deal (was $79)",
    description:
      "Limited-time $25 Deal (normally $79): Full Store Fix Bundle ZIP PLUS exported catalog Product JSON-LD diagnostic manifest and priority async implementation notes.",
    amountCents: 2500,
    amountMicro: 25000000,
    originalCents: 7900,
    originalDisplay: "$79",
    priceDisplay: "$25 USD / USDC (was $79)",
    tier: "pro_kit_25",
  },
  dfy: {
    id: "dfy",
    sku: "ecomfix-dfy-v1",
    name: "Done-For-You Complete Store + 500px Merchant Fix — $99 Deal (was $249)",
    description:
      "Limited-time $99 Deal (normally $249): Full automated Store Fix Bundle ZIP PLUS white-glove async Liquid schema installation, 301 redirect setup, and Jan 31, 2027 500x500px Google Merchant image batch processing.",
    amountCents: 9900,
    amountMicro: 99000000,
    originalCents: 24900,
    originalDisplay: "$249",
    priceDisplay: "$99 USD / USDC (was $249)",
    tier: "dfy_99",
  },
};

function renderLanding(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>StoreFix — Shopify &amp; WooCommerce Google Shopping &amp; Revenue-Leak Fix Kit</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#090b10; color:#f8fafc; max-width:1060px; margin:0 auto; padding:1.6rem 1rem 4rem; line-height:1.55; }
    h1 { color:#34d399; margin:0 0 0.4rem; font-size:2rem; }
    .sub { color:#cbd5e1; margin-bottom:1.3rem; }
    .grid { display:grid; grid-template-columns:1.15fr 0.95fr; gap:1.25rem; }
    @media(max-width:860px){ .grid{ grid-template-columns:1fr; } }
    .card { background:#131722; border:1px solid #242d42; border-radius:12px; padding:1.25rem; margin-bottom:1rem; }
    input { width:100%; box-sizing:border-box; background:#070a12; color:#f8fafc; border:1px solid #334155; border-radius:8px; padding:0.7rem; font-family:ui-monospace,monospace; margin:0.4rem 0 0.9rem; }
    .btn { display:inline-block; padding:0.72rem 1.05rem; border-radius:8px; font-weight:700; cursor:pointer; border:0; color:#fff; background:#0284c7; text-align:center; width:100%; box-sizing:border-box; margin-top:0.45rem; font-size:0.94rem; }
    .btn-green { background:#059669; }
    .btn-amber { background:#d97706; }
    .tier { background:#0b101b; border:1px solid #232a3b; border-radius:10px; padding:1rem; margin-bottom:0.85rem; }
    .price { font-size:1.45rem; font-weight:800; color:#34d399; }
    pre { background:#05070c; border:1px solid #232a3b; border-radius:8px; padding:0.9rem; color:#34d399; overflow:auto; max-height:360px; font-size:0.82rem; }
  </style>
</head>
<body>
  <h1>StoreFix — Google Shopping &amp; Store Revenue-Leak Kit</h1>
  <p class="sub">Fix disqualified Google Merchant <code>Product</code> JSON-LD, broken storefront links (<code>404</code>), and legacy Shopify <code>ScriptTags</code> ahead of the March 1, 2027 kill date. Audit any Shopify or WooCommerce storefront live and download a pre-built Fix Bundle in seconds.</p>

  <div class="grid">
    <div class="card">
      <strong>1. Run Live Store Audit (Free)</strong>
      <label for="domainInput" style="display:block;font-size:0.85rem;color:#94a3b8;margin-top:0.6rem;">Store Domain</label>
      <input id="domainInput" type="text" placeholder="yourstore.com" />
      <button class="btn" onclick="runAudit()">Audit Google Shopping Schema &amp; Links Now</button>
      <div id="issueBanner" style="margin-top:0.85rem;font-size:0.9rem;color:#fbbf24;"></div>
    </div>

    <div class="card">
      <strong>2. Instant Store Fix Kit Download</strong>
      <div class="tier" style="margin-top:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Store Fix Bundle (.zip)</strong>
          <span class="price"><span style="text-decoration:line-through;color:#94a3b8;font-size:0.95rem;margin-right:0.35rem;">$49</span>$10 Deal</span>
        </div>
        <p style="font-size:0.85rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Includes store-tailored Shopify <code>product-schema.liquid</code> (or WooCommerce PHP snippet), ready-to-import <code>shopify-url-redirects.csv</code>, Jan 31 2027 <code>500&times;500px</code> image audit CSV + offline <code>1500&times;1500px</code> auto-padder HTML tool, and ScriptTag migration steps.</p>
        <button class="btn btn-green" onclick="buyStripe('fix_pack')">Download Store Fix Bundle ($10 Deal — was $49)</button>
      </div>

      <div class="tier">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Store Fix Kit Pro</strong>
          <span class="price" style="color:#fbbf24;"><span style="text-decoration:line-through;color:#94a3b8;font-size:0.95rem;margin-right:0.35rem;">$79</span>$25 Deal</span>
        </div>
        <p style="font-size:0.85rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Everything in the Store Fix Bundle PLUS full diagnostic JSON manifest and priority async implementation check.</p>
        <button class="btn btn-amber" onclick="buyStripe('pro_kit')">Get Store Fix Kit Pro ($25 Deal — was $79)</button>
      </div>

      <div class="tier" style="margin-bottom:0;border-color:#4f46e5;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Done-For-You Complete Store Fix</strong>
          <span class="price" style="color:#a78bfa;"><span style="text-decoration:line-through;color:#94a3b8;font-size:0.95rem;margin-right:0.35rem;">$249</span>$99 Deal</span>
        </div>
        <p style="font-size:0.85rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Zero tech work: we patch your theme Product JSON-LD, import 301 redirects, and resize/upload undersized Google Merchant photos for you asynchronously.</p>
        <button class="btn" style="background:#6d28d9;" onclick="buyStripe('dfy')">Order Done-For-You Fix ($99 Deal — was $249)</button>
      </div>
    </div>
  </div>

  <div class="card">
    <strong>Live Store Audit Result</strong>
    <pre id="auditOut">Enter your store domain or open with ?domain=yourstore.com to run a live check...</pre>
  </div>

  <script>
    const qs = new URLSearchParams(window.location.search);
    async function runAudit() {
      const dom = document.getElementById("domainInput").value.trim();
      const out = document.getElementById("auditOut");
      const ban = document.getElementById("issueBanner");
      if (!dom) { out.textContent = "Please enter a store domain"; return; }
      out.textContent = "Auditing " + dom + " (Shopify/Woo inventory API, Product JSON-LD, nav links, ScriptTags)...";
      try {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: dom })
        });
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
        if (data.issues && data.issues.length) {
          ban.textContent = "Detected " + data.issues.length + " revenue-leak issue(s): " + data.issues[0];
        } else {
          ban.textContent = "Live check complete on platform=" + (data.platform || "ecom") + " — Fix Bundle ready.";
        }
      } catch (e) {
        out.textContent = "Audit error: " + e.message;
      }
    }
    function buyStripe(tier) {
      const dom = document.getElementById("domainInput").value.trim();
      let u = "/api/checkout?tier=" + encodeURIComponent(tier);
      if (dom) u += "&domain=" + encodeURIComponent(dom);
      window.location.href = u;
    }
    (function init() {
      const d = qs.get("domain");
      if (d) {
        document.getElementById("domainInput").value = d;
        runAudit();
      }
    })();
  </script>
</body>
</html>`;
}

async function buildPackForStore(targetDomain, tier) {
  let diag;
  try {
    diag = await analyzeEcommerceStore(targetDomain, fetch);
  } catch (err) {
    if (err.httpStatus === 400 || err.httpStatus === 403) throw err;
    diag = { domain: targetDomain, platform: "shopify", store_name: targetDomain, currency: "USD", schema_issues: [], undersized_images: [], broken_links: [], deprecated_script_tags: [], issues: [err.message] };
  }
  return { domain: diag.domain, diagnostic: diag, files: buildStoreFixBundle(diag, tier) };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = buildCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path === "/" || path === "/index.html") return htmlResp(renderLanding(url.origin), 200, cors);

    if (path === "/health" || path === "/ping") {
      return jsonResp({ status: "ok", service: "ecom-fix", merchant_base: MERCHANT_BASE, merchant_solana_ata: MERCHANT_SOLANA_ATA, plans: ECOM_FIX_PLANS }, 200, cors);
    }

    if (path === "/api/audit") {
      if (req.method !== "POST" && req.method !== "GET") return jsonResp({ error: "Method not allowed" }, 405, cors);
      let body = {};
      if (req.method === "POST") {
        try { body = await req.json(); } catch { return jsonResp({ error: "Invalid JSON" }, 400, cors); }
      } else {
        body = { domain: url.searchParams.get("domain") || "" };
      }
      try {
        const res = await analyzeEcommerceStore(body.domain || body.url || "", fetch);
        if (!String(body.domain || body.url || "").trim().toLowerCase().startsWith("test.")) {
          await incrementFunnelCounter(env, "play_b_ecom", "free_previews_or_zips");
        }
        return jsonResp({ ok: true, ...res }, 200, cors);
      } catch (err) {
        return jsonResp({ ok: false, error: err.message }, err.httpStatus || 422, cors);
      }
    }

    if (path === "/api/checkout") {
      return await handleStripeCheckoutRoute({ req, url, env, cors, plansMap: ECOM_FIX_PLANS, defaultTier: "fix_pack", targetParamKeys: ["domain", "store", "url"] });
    }

    if (path === "/api/buy") {
      return await handleGenericX402BuyRoute({
        req, url, env, cors, plansMap: ECOM_FIX_PLANS, defaultTier: "fix_pack",
        buildPackFn: buildPackForStore,
        targetParamKeys: ["domain", "store", "url"],
      });
    }

    if (path === "/api/download") {
      return await handleRescueDownloadRoute({
        req, url, env, cors, plansMap: ECOM_FIX_PLANS, defaultTier: "fix_pack",
        tokenPrefix: "ef_v1", zipFilename: "store-fix-kit.zip", serviceTitle: "StoreFix Revenue-Leak Kit",
        buildPackFn: buildPackForStore,
      });
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
