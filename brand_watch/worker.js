/**
 * BrandWatch: B2B Unverified-Rumor, AI-Fake & TikTok Caution Watch Portal
 * Live multi-source rumor extraction + TikTok oEmbed inspector + Caution Watch Queue + B2B Contact & Stripe Checkout.
 */

import {
  MERCHANT_BASE,
  MERCHANT_SOLANA_ATA,
  buildCorsHeaders,
  jsonResp,
  htmlResp,
  escapeHtml,
  constantTimeEqual,
  sha256Hex,
  handleStripeCheckoutRoute,
  handleGenericX402BuyRoute,
  handleRescueDownloadRoute,
  incrementFunnelCounter,
} from "../edge_helpers.js";
import { cleanSecret, hasSigningSecretConfigured } from "../stripe_billing.js";
import {
  resolveTikTokOembed,
  loadQueueEntries,
  runBrandRumorScan,
  buildBrandWatchDossier,
} from "./scanner.js";

export const BRAND_WATCH_PLANS = {
  audit: {
    id: "audit",
    sku: "brandwatch-audit-v1",
    name: "B2B Brand Rumor & Flagged-Video Dossier Pack — $49",
    description:
      "Downloadable B2B BrandWatch Evidence ZIP tailored to your brand or executive: Fact-Check records, rumor press logs, resolved TikTok oEmbed snapshots, CSV evidence sheet, and takedown escalation brief.",
    amountCents: 4900,
    amountMicro: 49000000,
    originalCents: 14900,
    originalDisplay: "$149",
    priceDisplay: "$49 USD / USDC",
    tier: "audit_49",
  },
  retainer: {
    id: "retainer",
    sku: "brandwatch-retainer-v1",
    name: "Priority Weekly B2B Brand & Caution Watch Setup — $199",
    description:
      "Full custom rumor/impersonation keyword watch setup, priority async triage with our engineering team, plus full downloadable Evidence Dossier ZIP.",
    amountCents: 19900,
    amountMicro: 199000000,
    originalCents: 39900,
    originalDisplay: "$399",
    priceDisplay: "$199 USD / USDC",
    tier: "retainer_199",
  },
};

const MAX_KV_LIST = 150;

async function appendKvIndexItem(kv, indexKey, itemKeyPrefix, id, payload) {
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") return false;
  await kv.put(`${itemKeyPrefix}${id}`, JSON.stringify(payload), { expirationTtl: 180 * 86400 });
  let ids = [];
  try {
    const cur = await kv.get(indexKey);
    const parsed = cur ? JSON.parse(cur) : [];
    if (Array.isArray(parsed)) ids = parsed;
  } catch {
    ids = [];
  }
  const next = [id, ...ids.filter((x) => x !== id)].slice(0, MAX_KV_LIST);
  await kv.put(indexKey, JSON.stringify(next));
  return true;
}

function isAuthorizedAdmin(req, env) {
  const auth = String(req.headers.get("Authorization") || "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const supplied = auth.slice(7).trim();
  if (!supplied) return false;
  const ingestTok = cleanSecret(env?.DASHBOARD_INGEST_TOKEN);
  const signingSec = cleanSecret(env?.KUROX_SIGNING_SECRET);
  if (ingestTok && constantTimeEqual(supplied, ingestTok)) return true;
  if (signingSec && constantTimeEqual(supplied, signingSec)) return true;
  return false;
}

function renderLanding(origin, contactEmail) {
  const bookmarkletHref = `javascript:(function(){var u=location.href;if(!/tiktok\\.com/i.test(u)){alert('Open a TikTok video page first.');return;}window.open('${origin}/?inspect='+encodeURIComponent(u)+'#caution-inspector','_blank');})();`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>BrandWatch — B2B Caution-Tagged Video, AI-Fake &amp; Rumor Intelligence</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#070a10; color:#f1f5f9; max-width:1160px; margin:0 auto; padding:1.5rem 1rem 4rem; line-height:1.55; }
    a { color:#38bdf8; }
    header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem; border-bottom:1px solid #1e293b; padding-bottom:1rem; margin-bottom:1.3rem; }
    h1 { margin:0; font-size:1.85rem; color:#f8fafc; letter-spacing:-0.02em; }
    .badge { display:inline-block; background:#1e293b; border:1px solid #334155; color:#fbbf24; font-size:0.75rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:999px; }
    .notice { background:#0f172a; border:1px solid #334155; border-left:4px solid #f59e0b; border-radius:8px; padding:0.85rem 1rem; font-size:0.86rem; color:#cbd5e1; margin-bottom:1.25rem; }
    .grid { display:grid; grid-template-columns:1.3fr 0.95fr; gap:1.25rem; align-items:start; }
    @media(max-width:900px){ .grid{ grid-template-columns:1fr; } }
    .card { background:#111827; border:1px solid #1f2937; border-radius:12px; padding:1.2rem; margin-bottom:1rem; }
    .row { display:flex; gap:0.6rem; flex-wrap:wrap; }
    input, textarea, select { width:100%; background:#060911; color:#f8fafc; border:1px solid #334155; border-radius:8px; padding:0.68rem 0.8rem; font-size:0.9rem; margin:0.35rem 0 0.75rem; font-family:inherit; }
    label { display:block; font-size:0.8rem; font-weight:600; color:#94a3b8; }
    .btn { display:inline-block; padding:0.7rem 1.05rem; border-radius:8px; font-weight:700; cursor:pointer; border:0; color:#fff; background:#0284c7; text-align:center; font-size:0.9rem; text-decoration:none; }
    .btn:hover { opacity:0.92; }
    .btn-amber { background:#d97706; }
    .btn-green { background:#059669; }
    .btn-ghost { background:#1e293b; color:#e2e8f0; border:1px solid #334155; }
    .chip { background:#1e293b; border:1px solid #334155; color:#cbd5e1; padding:0.28rem 0.65rem; border-radius:999px; font-size:0.78rem; cursor:pointer; }
    .feed-item { background:#0b1120; border:1px solid #1e293b; border-radius:10px; padding:0.95rem; margin-top:0.75rem; }
    .pill { display:inline-block; font-size:0.72rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:6px; margin-right:0.35rem; }
    .pill-warn { background:#451a03; color:#fbbf24; border:1px solid #92400e; }
    .pill-blue { background:#0c4a6e; color:#7dd3fc; border:1px solid #075985; }
    .pill-red { background:#450a0a; color:#fca5a5; border:1px solid #991b1b; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0.6rem; margin:0.9rem 0; }
    @media(max-width:640px){ .stats{ grid-template-columns:repeat(2,1fr); } }
    .stat { background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:0.65rem; text-align:center; }
    .stat strong { display:block; font-size:1.25rem; color:#38bdf8; }
    .stat span { font-size:0.74rem; color:#94a3b8; }
  </style>
</head>
<body>
  <header>
    <div>
      <span class="badge">B2B BRAND &amp; PUBLIC-FIGURE PROTECTION</span>
      <h1>BrandWatch — Unverified Video &amp; Rumor Radar</h1>
    </div>
    <div class="row">
      <a class="btn btn-amber" href="#b2b-contact">B2B Contact / Request Takedown Watch</a>
    </div>
  </header>

  <div class="notice">
    <strong>Honest Extraction Scope:</strong> TikTok hides its in-app <em>"Caution: Video flagged for unverified content"</em> UI banner from public oEmbed and Search APIs (and we never bypass platform anti-bot gates). Instead, BrandWatch extracts verifiable intelligence in real time by uniting:
    <strong>(1)</strong> Google Fact Check Explorer debunk feeds, <strong>(2)</strong> Breaking rumor/deepfake press tracking, <strong>(3)</strong> Indexed TikTok URLs resolved live via official TikTok oEmbed + risk-cue scoring, and <strong>(4)</strong> A live Caution Watch URL Queue + Bookmarklet for flagged clips spotted in the wild.
  </div>

  <div class="grid">
    <div>
      <div class="card">
        <strong>1. Live Brand / Figure Unverified-Rumor &amp; TikTok Extractor</strong>
        <div class="row" style="margin-top:0.6rem;">
          <input id="queryInput" type="text" placeholder="Enter brand, athlete, exec, or keyword (e.g. Anthony Joshua, maskedtruth, deepfake)" style="flex:1;margin:0;" />
          <button class="btn" onclick="runScan()">Scan Live Feeds</button>
        </div>
        <div class="row" style="margin-top:0.55rem;">
          <span class="chip" onclick="quickScan('tiktok')">tiktok (global)</span>
          <span class="chip" onclick="quickScan('Anthony Joshua')">Anthony Joshua</span>
          <span class="chip" onclick="quickScan('deepfake')">deepfake</span>
          <span class="chip" onclick="quickScan('crypto scam')">crypto scam</span>
        </div>

        <div class="stats" id="statsBar">
          <div class="stat"><strong id="stWatch">-</strong><span>Caution Watch Queue</span></div>
          <div class="stat"><strong id="stFc">-</strong><span>Fact-Check Debunks</span></div>
          <div class="stat"><strong id="stNews">-</strong><span>Rumor Press Signals</span></div>
          <div class="stat"><strong id="stTk">-</strong><span>TikTok oEmbeds</span></div>
        </div>

        <div id="feedOut" style="font-size:0.88rem;color:#94a3b8;">Loading live extraction feed...</div>
      </div>

      <div class="card" id="caution-inspector">
        <strong>2. Extract &amp; Log a TikTok Video Carrying a Caution Banner</strong>
        <p style="font-size:0.84rem;color:#cbd5e1;margin:0.35rem 0 0.7rem;">Spotted a video with <em>"Caution: Video flagged for unverified content"</em> in TikTok? Paste its link below (or drag the 1-click bookmarklet: <a href="${escapeHtml(bookmarkletHref)}" style="font-weight:700;color:#fbbf24;">+ Log Caution Clip</a> to your browser bookmarks bar). We resolve creator metadata via official TikTok oEmbed, cross-check Fact Checks, and save it to the Caution Watch Feed.</p>
        <label for="tkUrl">TikTok Video URL</label>
        <input id="tkUrl" type="url" placeholder="https://www.tiktok.com/@maskedtruthmt/video/..." />
        <div class="row">
          <div style="flex:1;min-width:180px;">
            <label for="tkTag">Brand / Subject Mentioned</label>
            <input id="tkTag" type="text" placeholder="e.g. Anthony Joshua or Acme Corp" />
          </div>
          <div style="flex:1;min-width:180px;">
            <label for="tkCat">Observed TikTok Flag</label>
            <select id="tkCat">
              <option value="Caution: Video flagged for unverified content">Caution: Unverified Content</option>
              <option value="Warning: Risky activity / harm disclaimer">Warning: Risky Activity / Harm</option>
              <option value="AI-generated / synthetic impersonation">AI-Generated / Impersonation</option>
            </select>
          </div>
        </div>
        <div class="row">
          <button class="btn" onclick="inspectClip()">Resolve oEmbed Preview</button>
          <button class="btn btn-amber" onclick="submitCautionClip()">Log to Caution Watch Queue</button>
        </div>
        <div id="inspectOut" style="margin-top:0.8rem;"></div>
      </div>
    </div>

    <div>
      <div class="card" id="b2b-contact">
        <strong>3. For Brands, Agencies &amp; Talent — B2B Contact</strong>
        <p style="font-size:0.84rem;color:#cbd5e1;margin:0.35rem 0 0.8rem;">Need continuous monitoring for unverified TikTok rumors, deepfakes, or executive impersonation, or bulk extraction/takedown evidence? Send your details directly below.</p>
        <form id="b2bForm" onsubmit="submitB2B(event)">
          <label for="bCompany">Company / Brand / Talent Name *</label>
          <input id="bCompany" required placeholder="e.g. Apex PR / Management" />
          <label for="bName">Your Name &amp; Role</label>
          <input id="bName" placeholder="e.g. Sarah Lee, Head of Comms" />
          <label for="bEmail">Work Email *</label>
          <input id="bEmail" type="email" required placeholder="sarah@company.com" />
          <label for="bKeywords">Brands / People / Handles to Monitor *</label>
          <input id="bKeywords" required placeholder="e.g. Anthony Joshua, @brandname" />
          <label for="bRefUrl">Flagged TikTok / Rumor URL (optional)</label>
          <input id="bRefUrl" placeholder="https://www.tiktok.com/@..." />
          <label for="bPlan">Inquiry Type</label>
          <select id="bPlan">
            <option value="Custom B2B Rumor & Caution Watch Inquiry">Custom B2B Rumor &amp; Caution Watch Inquiry</option>
            <option value="Emergency Takedown & Evidence Dossier ($49)">Emergency Takedown &amp; Evidence Dossier ($49)</option>
            <option value="Weekly BrandWatch Retainer ($199)">Weekly BrandWatch Retainer ($199)</option>
          </select>
          <label for="bNotes">Context / SLA Requirements</label>
          <textarea id="bNotes" rows="3" placeholder="Tell us what unverified videos or rumors are circulating..."></textarea>
          <button class="btn btn-green" type="submit" style="width:100%;">Send B2B Inquiry Directly</button>
        </form>
        <div id="b2bStatus" style="margin-top:0.8rem;font-size:0.86rem;"></div>
        <div style="margin-top:0.75rem;font-size:0.82rem;color:#94a3b8;">
          Direct Email Fallback: <a href="mailto:${escapeHtml(contactEmail)}?subject=B2B%20BrandWatch%20Inquiry">${escapeHtml(contactEmail)}</a>
        </div>
      </div>

      <div class="card">
        <strong>Instant Self-Serve B2B Evidence Packs (Stripe)</strong>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Brand Caution &amp; Rumor Dossier (.zip)</strong>
            <span style="color:#34d399;font-weight:800;font-size:1.15rem;">$49</span>
          </div>
          <p style="font-size:0.82rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Instant compiled CSV + JSON + takedown brief for your scanned brand/figure.</p>
          <button class="btn btn-green" style="width:100%;" onclick="buyPlan('audit')">Checkout Dossier ($49 via Stripe)</button>
        </div>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Priority B2B Watch Onboarding</strong>
            <span style="color:#fbbf24;font-weight:800;font-size:1.15rem;">$199</span>
          </div>
          <p style="font-size:0.82rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Custom keyword watch setup, priority triage, plus downloadable dossier bundle.</p>
          <button class="btn btn-amber" style="width:100%;" onclick="buyPlan('retainer')">Order Priority Setup ($199 via Stripe)</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    document.addEventListener("click", function(ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest("[data-esc-url]") : null;
      if (!btn) return;
      ev.preventDefault();
      escalateToB2B(btn.getAttribute("data-esc-url") || "", btn.getAttribute("data-esc-label") || "");
    });
    function escalateToB2B(url, label) {
      if (url) document.getElementById("bRefUrl").value = url;
      if (label && !document.getElementById("bKeywords").value.trim()) document.getElementById("bKeywords").value = label;
      document.getElementById("b2b-contact").scrollIntoView({ behavior: "smooth" });
    }
    function quickScan(q) {
      document.getElementById("queryInput").value = q;
      runScan();
    }
    async function runScan() {
      const q = document.getElementById("queryInput").value.trim() || "tiktok";
      const out = document.getElementById("feedOut");
      out.textContent = "Scanning Google Fact Check, News Rumors, urlscan + TikTok oEmbed & Caution Watch Queue...";
      try {
        const res = await fetch("/api/scan?q=" + encodeURIComponent(q));
        const d = await res.json();
        document.getElementById("stWatch").textContent = d.counts?.caution_watchlist ?? 0;
        document.getElementById("stFc").textContent = d.counts?.fact_checks ?? 0;
        document.getElementById("stNews").textContent = d.counts?.news_rumors ?? 0;
        document.getElementById("stTk").textContent = d.counts?.tiktok_oembeds ?? 0;

        let html = "";
        for (const w of d.caution_watchlist || []) {
          html += '<div class="feed-item"><span class="pill pill-red">' + esc(w.cautionLabel) + '</span><span class="pill pill-blue">' + esc(w.brandTag || "Caution Queue") + '</span><div style="margin-top:0.35rem;"><strong>' + esc(w.handle || w.authorName || "Creator") + '</strong>: ' + esc(w.title) + '</div><div style="margin-top:0.4rem;"><a href="' + esc(w.url) + '" target="_blank" rel="noopener">Open TikTok</a> | <a href="#b2b-contact" data-esc-url="' + esc(w.url) + '" data-esc-label="' + esc(w.brandTag || w.handle) + '">Escalate to B2B</a></div></div>';
        }
        for (const t of d.tiktok_clips || []) {
          const cues = (t.captionRisk?.matchedCues || []).join(", ") || "indexed public clip";
          html += '<div class="feed-item"><span class="pill pill-warn">TikTok oEmbed (' + esc(t.captionRisk?.riskTier || "low") + ' risk)</span><span class="pill pill-blue">' + esc(t.handle || t.authorName) + '</span><div style="margin-top:0.35rem;">' + esc(t.title || "(No caption)") + '</div><div style="font-size:0.78rem;color:#94a3b8;margin-top:0.25rem;">Signals: ' + esc(cues) + '</div><div style="margin-top:0.4rem;"><a href="' + esc(t.url) + '" target="_blank" rel="noopener">Open Clip</a> | <a href="#b2b-contact" data-esc-url="' + esc(t.url) + '" data-esc-label="' + esc(t.handle || q) + '">Escalate to B2B</a></div></div>';
        }
        for (const fc of d.fact_checks || []) {
          html += '<div class="feed-item"><span class="pill pill-red">' + esc(fc.verdict) + '</span><span class="pill pill-blue">' + esc(fc.publisher) + '</span><div style="margin-top:0.35rem;"><strong>' + esc(fc.claimText) + '</strong></div><div style="font-size:0.82rem;color:#cbd5e1;margin-top:0.2rem;">' + esc(fc.reviewTitle) + '</div><div style="margin-top:0.4rem;"><a href="' + esc(fc.reviewUrl) + '" target="_blank" rel="noopener">Read Fact-Check</a> | <a href="#b2b-contact" data-esc-url="' + esc(fc.linkedTikTokUrl || fc.reviewUrl) + '" data-esc-label="' + esc(q) + '">Escalate to B2B</a></div></div>';
        }
        for (const n of d.news_rumors || []) {
          html += '<div class="feed-item"><span class="pill pill-warn">Rumor Press</span><span class="pill pill-blue">' + esc(n.source) + '</span><div style="margin-top:0.35rem;">' + esc(n.title) + '</div><div style="margin-top:0.4rem;"><a href="' + esc(n.url) + '" target="_blank" rel="noopener">Source Link</a> | <a href="#b2b-contact" data-esc-url="' + esc(n.url) + '" data-esc-label="' + esc(q) + '">Escalate to B2B</a></div></div>';
        }
        out.innerHTML = html || '<div class="feed-item">No matching signals found yet. Paste a flagged TikTok URL below or submit a B2B watch request.</div>';
      } catch (e) {
        out.textContent = "Scan error: " + e.message;
      }
    }
    async function inspectClip() {
      const url = document.getElementById("tkUrl").value.trim();
      const box = document.getElementById("inspectOut");
      if (!url) { box.textContent = "Enter a TikTok URL first."; return; }
      box.textContent = "Resolving official TikTok oEmbed & cross-checking claims...";
      try {
        const res = await fetch("/api/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { box.textContent = "Error: " + (d.error || res.status); return; }
        const c = d.clip;
        box.innerHTML = '<div class="feed-item"><strong>' + esc(c.handle || c.authorName) + '</strong>: ' + esc(c.title) + '<div style="font-size:0.8rem;color:#fbbf24;margin-top:0.25rem;">Caption Risk: ' + esc(c.captionRisk?.riskTier) + ' (' + esc(c.captionRisk?.riskScore) + '/100)</div>' + (c.playerUrl ? '<div style="margin-top:0.5rem;"><a href="' + esc(c.playerUrl) + '" target="_blank" rel="noopener">Open Official TikTok Embed Player</a></div>' : '') + '</div>';
      } catch (e) {
        box.textContent = "Inspect failed: " + e.message;
      }
    }
    async function submitCautionClip() {
      const url = document.getElementById("tkUrl").value.trim();
      const brandTag = document.getElementById("tkTag").value.trim();
      const cautionLabel = document.getElementById("tkCat").value;
      const box = document.getElementById("inspectOut");
      if (!url) { box.textContent = "Enter a TikTok URL first."; return; }
      box.textContent = "Verifying via TikTok oEmbed and saving to Caution Watch Queue...";
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, brandTag, cautionLabel })
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { box.textContent = "Submit failed: " + (d.error || res.status); return; }
        box.innerHTML = '<div class="feed-item" style="border-color:#059669;">Saved verified Caution entry <code>' + esc(d.entry?.id) + '</code> for <strong>' + esc(d.entry?.handle || d.entry?.authorName) + '</strong>.</div>';
        runScan();
      } catch (e) {
        box.textContent = "Submit error: " + e.message;
      }
    }
    async function submitB2B(ev) {
      ev.preventDefault();
      const st = document.getElementById("b2bStatus");
      st.textContent = "Submitting B2B inquiry...";
      const payload = {
        company: document.getElementById("bCompany").value.trim(),
        contact_name: document.getElementById("bName").value.trim(),
        email: document.getElementById("bEmail").value.trim(),
        keywords: document.getElementById("bKeywords").value.trim(),
        reference_url: document.getElementById("bRefUrl").value.trim(),
        plan: document.getElementById("bPlan").value,
        notes: document.getElementById("bNotes").value.trim(),
      };
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { st.style.color = "#fca5a5"; st.textContent = "Error: " + (d.error || res.status); return; }
        const mailSubj = encodeURIComponent("[BrandWatch B2B " + d.lead_id + "] " + payload.company);
        const mailBody = encodeURIComponent("Lead ID: " + d.lead_id + "\\nCompany: " + payload.company + "\\nKeywords: " + payload.keywords + "\\nRef URL: " + payload.reference_url + "\\nNotes: " + payload.notes);
        st.style.color = "#34d399";
        st.innerHTML = 'Inquiry recorded (Ref: <code>' + esc(d.lead_id) + '</code>). Want an instant email thread too? <a href="mailto:${escapeHtml(contactEmail)}?subject=' + mailSubj + '&body=' + mailBody + '">Click here to send directly to ${escapeHtml(contactEmail)}</a>.';
      } catch (e) {
        st.style.color = "#fca5a5";
        st.textContent = "Network error: " + e.message;
      }
    }
    function buyPlan(tier) {
      const q = document.getElementById("bKeywords").value.trim() || document.getElementById("queryInput").value.trim() || "BrandWatch";
      window.location.href = "/api/checkout?tier=" + encodeURIComponent(tier) + "&domain=" + encodeURIComponent(q);
    }
    (function init() {
      const qs = new URLSearchParams(window.location.search);
      const insp = qs.get("inspect");
      if (insp) {
        document.getElementById("tkUrl").value = insp;
        inspectClip();
      }
      runScan();
    })();
  </script>
</body>
</html>`;
}

async function buildPackForTarget(targetBrand, tier, bodyParams = {}, env = null) {
  const scan = await runBrandRumorScan(targetBrand, fetch, env?.FUNNEL_KV || null);
  return buildBrandWatchDossier(targetBrand, tier, scan, bodyParams.notes || "");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = buildCorsHeaders(req);
    const contactEmail = env?.B2B_CONTACT_EMAIL || "armkhan18@gmail.com";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path === "/" || path === "/index.html") {
      return htmlResp(renderLanding(url.origin, contactEmail), 200, cors);
    }

    if (path === "/health" || path === "/ping") {
      return jsonResp(
        {
          status: "ok",
          service: "brand-watch",
          merchant_base: MERCHANT_BASE,
          merchant_solana_ata: MERCHANT_SOLANA_ATA,
          b2b_contact_email: contactEmail,
          has_kv: Boolean(env?.FUNNEL_KV),
          has_stripe: Boolean(cleanSecret(env?.STRIPE_SECRET_KEY) && hasSigningSecretConfigured(env)),
          plans: BRAND_WATCH_PLANS,
        },
        200,
        cors,
      );
    }

    if (path === "/api/scan") {
      if (req.method !== "GET" && req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405, cors);
      let q = url.searchParams.get("q") || url.searchParams.get("brand") || "";
      if (req.method === "POST") {
        try {
          const body = await req.json();
          q = body.q || body.query || body.brand || q;
        } catch {
          return jsonResp({ error: "Invalid JSON body" }, 400, cors);
        }
      }
      const res = await runBrandRumorScan(q, fetch, env?.FUNNEL_KV || null);
      if (q && !q.toLowerCase().startsWith("test.")) {
        await incrementFunnelCounter(env, "brand_watch", "scans");
      }
      return jsonResp(res, 200, cors);
    }

    if (path === "/api/feed") {
      const queue = await loadQueueEntries(env?.FUNNEL_KV || null, 25);
      return jsonResp({ ok: true, count: queue.length, caution_watchlist: queue }, 200, cors);
    }

    if (path === "/api/inspect") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      try {
        const clip = await resolveTikTokOembed(body?.url, fetch);
        const related = await runBrandRumorScan(clip.handle || clip.authorName || "", fetch, null);
        return jsonResp({ ok: true, clip, fact_checks: related.fact_checks.slice(0, 4), news_rumors: related.news_rumors.slice(0, 4) }, 200, cors);
      } catch (err) {
        return jsonResp({ ok: false, error: err.message }, err.httpStatus || 502, cors);
      }
    }

    if (path === "/api/report") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      try {
        const clip = await resolveTikTokOembed(body?.url, fetch);
        const id = (await sha256Hex(clip.url)).slice(0, 16);
        const entry = {
          id,
          sourceType: "app_caution_submission",
          url: clip.url,
          videoId: clip.videoId,
          playerUrl: clip.playerUrl,
          authorName: clip.authorName,
          handle: clip.handle,
          authorUrl: clip.authorUrl,
          title: clip.title,
          thumbnailUrl: clip.thumbnailUrl,
          brandTag: String(body?.brandTag || "").trim().slice(0, 120) || clip.handle || "TikTok Watch",
          cautionLabel: String(body?.cautionLabel || "Caution: Video flagged for unverified content").trim().slice(0, 120),
          captionRisk: clip.captionRisk,
          submittedAt: new Date().toISOString(),
        };
        const stored = await appendKvIndexItem(env?.FUNNEL_KV, "bw:queue:index", "bw:queue:item:", id, entry);
        await incrementFunnelCounter(env, "brand_watch", "caution_reports");
        return jsonResp({ ok: true, persisted: stored, entry }, 201, cors);
      } catch (err) {
        return jsonResp({ ok: false, error: err.message }, err.httpStatus || 422, cors);
      }
    }

    if (path === "/api/contact") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      const company = String(body?.company || "").trim().slice(0, 140);
      const email = String(body?.email || "").trim().toLowerCase().slice(0, 140);
      const keywords = String(body?.keywords || "").trim().slice(0, 280);
      if (!company || !keywords || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return jsonResp({ ok: false, error: "Valid company, work email, and monitoring keywords are required." }, 400, cors);
      }
      const leadId = `BW-${(await sha256Hex(`${company}:${email}:${Date.now()}`)).slice(0, 8).toUpperCase()}`;
      const record = {
        lead_id: leadId,
        company,
        contact_name: String(body?.contact_name || "").trim().slice(0, 120),
        email,
        keywords,
        reference_url: String(body?.reference_url || "").trim().slice(0, 300),
        plan: String(body?.plan || "Custom B2B Inquiry").trim().slice(0, 140),
        notes: String(body?.notes || "").trim().slice(0, 1200),
        created_at: new Date().toISOString(),
      };
      const persisted = await appendKvIndexItem(env?.FUNNEL_KV, "bw:leads:index", "bw:lead:item:", leadId, record);
      await incrementFunnelCounter(env, "brand_watch", "b2b_leads");

      const webhookUrl = cleanSecret(env?.B2B_WEBHOOK_URL);
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "brand_watch_b2b_lead", ...record }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => {});
      }

      return jsonResp(
        {
          ok: true,
          lead_id: leadId,
          persisted,
          contact_email: contactEmail,
          message: "B2B inquiry recorded. Our team will respond via email.",
        },
        201,
        cors,
      );
    }

    if (path === "/api/leads") {
      if (req.method !== "GET") return jsonResp({ error: "Method not allowed" }, 405, cors);
      if (!isAuthorizedAdmin(req, env)) return jsonResp({ error: "Unauthorized" }, 401, cors);
      const kv = env?.FUNNEL_KV;
      if (!kv) return jsonResp({ ok: true, count: 0, leads: [] }, 200, cors);
      try {
        const rawIdx = await kv.get("bw:leads:index");
        const ids = rawIdx ? JSON.parse(rawIdx) : [];
        const leads = (
          await Promise.all(
            (Array.isArray(ids) ? ids : []).slice(0, 50).map(async (id) => {
              const raw = await kv.get(`bw:lead:item:${id}`);
              return raw ? JSON.parse(raw) : null;
            }),
          )
        ).filter(Boolean);
        return jsonResp({ ok: true, count: leads.length, leads }, 200, cors);
      } catch {
        return jsonResp({ ok: false, error: "Failed to read leads" }, 500, cors);
      }
    }

    if (path === "/api/checkout") {
      return await handleStripeCheckoutRoute({
        req,
        url,
        env,
        cors,
        plansMap: BRAND_WATCH_PLANS,
        defaultTier: "audit",
        targetParamKeys: ["domain", "brand", "q", "target"],
      });
    }

    if (path === "/api/buy") {
      return await handleGenericX402BuyRoute({
        req,
        url,
        env,
        cors,
        plansMap: BRAND_WATCH_PLANS,
        defaultTier: "audit",
        buildPackFn: (target, tier, bp) => buildPackForTarget(target, tier, bp, env),
        targetParamKeys: ["domain", "brand", "q", "target"],
      });
    }

    if (path === "/api/download") {
      return await handleRescueDownloadRoute({
        req,
        url,
        env,
        cors,
        plansMap: BRAND_WATCH_PLANS,
        defaultTier: "audit",
        tokenPrefix: "bw_v1",
        zipFilename: "brand-watch-dossier.zip",
        serviceTitle: "BrandWatch B2B Evidence Dossier",
        buildPackFn: (target, tier, bp) => buildPackForTarget(target, tier, bp, env),
      });
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
