/**
 * Play A: SiteRescue — Local Business Dead Booking Link & SSL Cliff Rescue Worker
 */

import {
  MERCHANT_BASE,
  MERCHANT_SOLANA_ATA,
  buildCorsHeaders,
  jsonResp,
  htmlResp,
  escapeHtml,
  handleStripeCheckoutRoute,
  handleGenericX402BuyRoute,
  handleRescueDownloadRoute,
  incrementFunnelCounter,
} from "../edge_helpers.js";
import { analyzeLocalBusinessSite, buildSiteRecoveryBundle } from "./diagnostics.js";

export const SITE_RESCUE_PLANS = {
  pack: {
    id: "pack",
    sku: "siterescue-pack-v1",
    name: "Custom Site Recovery Pack — $10 Deal (was $49)",
    description:
      "Limited-time $10 Deal (normally $49): Instant downloadable Site Recovery ZIP tailored to your business domain: broken-link audit CSV, ready-to-paste Apache .htaccess & Nginx 301 redirects, valid Google LocalBusiness JSON-LD, SSL renewal guide, and 3-step IT handoff sheet.",
    amountCents: 1000,
    amountMicro: 10000000,
    originalCents: 4900,
    originalDisplay: "$49",
    priceDisplay: "$10 USD / USDC (was $49)",
    tier: "pack_10",
  },
  priority: {
    id: "priority",
    sku: "siterescue-priority-v1",
    name: "Priority Async Site Recovery + Custom Patch Kit — $29 Deal (was $149)",
    description:
      "Limited-time $29 Deal (normally $149): Instant downloadable Site Recovery Pack ZIP PLUS priority async email review and custom host/redirect troubleshooting for clinics, law firms, and agencies.",
    amountCents: 2900,
    amountMicro: 29000000,
    originalCents: 14900,
    originalDisplay: "$149",
    priceDisplay: "$29 USD / USDC (was $149)",
    tier: "priority_29",
  },
  dfy: {
    id: "dfy",
    sku: "siterescue-dfy-v1",
    name: "Done-For-You Complete Site/App Recovery Fix — $99 Deal (was $249)",
    description:
      "Limited-time $99 Deal (normally $249): Instant Site Recovery Pack ZIP PLUS complete async implementation/PR fix for broken links, SSL/redirect rules, security headers, viewport, and LocalBusiness schema.",
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
  <title>SiteRescue — Instant Broken Booking Link, Redirect &amp; SSL Recovery Pack</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#090b10; color:#f8fafc; max-width:1060px; margin:0 auto; padding:1.6rem 1rem 4rem; line-height:1.55; }
    h1 { color:#38bdf8; margin:0 0 0.4rem; font-size:2rem; }
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
  <h1>SiteRescue — Booking Link &amp; SSL Recovery Pack</h1>
  <p class="sub">Stop losing high-value client appointments to <code>404 Not Found</code> booking links, missing HTTPS redirects, or expiring SSL certificates. Run a live edge diagnostic on your domain and download a ready-to-forward IT Recovery Pack in 60 seconds.</p>

  <div class="grid">
    <div class="card">
      <strong>1. Run Live Business Website Check (Free)</strong>
      <label for="domainInput" style="display:block;font-size:0.85rem;color:#94a3b8;margin-top:0.6rem;">Business Website Domain</label>
      <input id="domainInput" type="text" placeholder="clinicname.co.uk" />
      <button class="btn" onclick="runLiveScan()">Check Booking Links, Redirects &amp; Schema Now</button>
      <div id="issueBanner" style="margin-top:0.85rem;font-size:0.9rem;color:#fbbf24;"></div>
    </div>

    <div class="card">
      <strong>2. Instant Automated Site Recovery Pack</strong>
      <div class="tier" style="margin-top:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Custom Site Recovery Pack (.zip)</strong>
          <span class="price"><span style="text-decoration:line-through;color:#94a3b8;font-size:0.95rem;margin-right:0.35rem;">$49</span>$10 Deal</span>
        </div>
        <p style="font-size:0.85rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Includes full broken-link CSV audit, tailored Apache <code>.htaccess</code> &amp; Nginx 301 redirects, pre-filled Google <code>LocalBusiness</code> JSON-LD, SSL renewal guide, and 3-step plain-English IT handoff sheet.</p>
        <button class="btn btn-green" onclick="buyStripe('pack')">Download Recovery Pack ($10 Deal — was $49)</button>
      </div>

      <div class="tier">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Priority Async Recovery</strong>
          <span class="price" style="color:#fbbf24;"><span style="text-decoration:line-through;color:#94a3b8;font-size:0.95rem;margin-right:0.35rem;">$149</span>$29 Deal</span>
        </div>
        <p style="font-size:0.85rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Instant Custom Recovery Pack ZIP PLUS priority async email fix verification for your web host or developer.</p>
        <button class="btn btn-amber" onclick="buyStripe('priority')">Get Priority Async Recovery ($29 Deal — was $149)</button>
      </div>

      <div class="tier" style="margin-bottom:0;border-color:#4f46e5;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Done-For-You Complete Fix / PR</strong>
          <span class="price" style="color:#a78bfa;"><span style="text-decoration:line-through;color:#94a3b8;font-size:0.95rem;margin-right:0.35rem;">$249</span>$99 Deal</span>
        </div>
        <p style="font-size:0.85rem;color:#cbd5e1;margin:0.4rem 0 0.7rem;">Zero hassle: we deliver the complete patch, server/CDN rules, or GitHub fix PR directly for your website or app.</p>
        <button class="btn" style="background:#6d28d9;" onclick="buyStripe('dfy')">Order Done-For-You Fix ($99 Deal — was $249)</button>
      </div>
    </div>
  </div>

  <div class="card">
    <strong>Live Domain Diagnostic Result</strong>
    <pre id="scanOut">Enter your domain above or open with ?domain=yourdomain.com to run a live check...</pre>
  </div>

  <script>
    const qs = new URLSearchParams(window.location.search);
    const hintSsl = qs.get("ssl_days");
    const hintBroken = qs.get("broken");
    async function runLiveScan() {
      const dom = document.getElementById("domainInput").value.trim();
      const out = document.getElementById("scanOut");
      const ban = document.getElementById("issueBanner");
      if (!dom) { out.textContent = "Please enter a domain (e.g. myclinic.co.uk)"; return; }
      out.textContent = "Auditing " + dom + " (HTTPS, booking links, LocalBusiness schema)...";
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: dom, ssl_days_remaining: hintSsl, broken_url: hintBroken })
        });
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
        if (data.issues && data.issues.length) {
          ban.textContent = "Detected " + data.issues.length + " urgent issue(s): " + data.issues[0];
        } else {
          ban.textContent = "Live check complete — ready to generate hardening & redirect bundle.";
        }
      } catch (e) {
        out.textContent = "Scan error: " + e.message;
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
        runLiveScan();
      }
    })();
  </script>
</body>
</html>`;
}

async function buildPackForTarget(targetDomain, tier, bodyParams = {}) {
  let diag;
  try {
    diag = await analyzeLocalBusinessSite(targetDomain, fetch, {
      ssl_days_remaining: bodyParams.ssl_days_remaining,
      brokenUrl: bodyParams.broken_url,
    });
  } catch (err) {
    if (err.httpStatus === 400 || err.httpStatus === 403) throw err;
    diag = { domain: targetDomain, business_name: targetDomain, broken_links: [], https_redirect_ok: false, has_localbusiness_schema: false, missing_viewport: false, insecure_http_assets: [], issues: [err.message] };
  }
  return { domain: diag.domain, diagnostic: diag, files: buildSiteRecoveryBundle(diag, tier) };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = buildCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path === "/" || path === "/index.html") return htmlResp(renderLanding(url.origin), 200, cors);

    if (path === "/health" || path === "/ping") {
      return jsonResp({ status: "ok", service: "site-rescue", merchant_base: MERCHANT_BASE, merchant_solana_ata: MERCHANT_SOLANA_ATA, plans: SITE_RESCUE_PLANS }, 200, cors);
    }

    if (path === "/api/scan") {
      if (req.method !== "POST" && req.method !== "GET") return jsonResp({ error: "Method not allowed" }, 405, cors);
      let body = {};
      if (req.method === "POST") {
        try { body = await req.json(); } catch { return jsonResp({ error: "Invalid JSON" }, 400, cors); }
      } else {
        body = { domain: url.searchParams.get("domain") || "", ssl_days_remaining: url.searchParams.get("ssl_days"), broken_url: url.searchParams.get("broken") };
      }
      try {
        const res = await analyzeLocalBusinessSite(body.domain || body.url || "", fetch, {
          ssl_days_remaining: body.ssl_days_remaining,
          brokenUrl: body.broken_url,
        });
        if (!String(body.domain || body.url || "").trim().toLowerCase().startsWith("test.")) {
          await incrementFunnelCounter(env, "play_a_local", "free_previews_or_zips");
        }
        return jsonResp({ ok: true, ...res }, 200, cors);
      } catch (err) {
        return jsonResp({ ok: false, error: err.message }, err.httpStatus || 422, cors);
      }
    }

    if (path === "/api/checkout") {
      return await handleStripeCheckoutRoute({ req, url, env, cors, plansMap: SITE_RESCUE_PLANS, defaultTier: "pack", targetParamKeys: ["domain", "target", "url"] });
    }

    if (path === "/api/buy") {
      return await handleGenericX402BuyRoute({
        req, url, env, cors, plansMap: SITE_RESCUE_PLANS, defaultTier: "pack",
        buildPackFn: buildPackForTarget,
        targetParamKeys: ["domain", "target", "url"],
      });
    }

    if (path === "/api/download") {
      return await handleRescueDownloadRoute({
        req, url, env, cors, plansMap: SITE_RESCUE_PLANS, defaultTier: "pack",
        tokenPrefix: "sr_v1", zipFilename: "site-recovery-pack.zip", serviceTitle: "SiteRescue Recovery Pack",
        buildPackFn: buildPackForTarget,
      });
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
