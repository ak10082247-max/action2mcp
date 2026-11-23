/**
 * CautionWatch: Strict "Caution: Video flagged for unverified content" Poller Portal
 * Displays ONLY verified Caution-unverified TikTok clips + Businesses & Individuals Live Alert Intake.
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
  extractUnverifiedCautionRecord,
  resolveTikTokOembed,
  loadCautionFeedEntries,
  runCautionOnlyScan,
  buildCautionDossier,
} from "./scanner.js";

export const BRAND_WATCH_PLANS = {
  audit: {
    id: "audit",
    sku: "cautionwatch-dossier-v1",
    name: "Caution-Flagged Video Evidence Dossier (.zip) — $49",
    description:
      "Instant Evidence ZIP of archived Caution-flagged TikTok videos matching your business or name (saved caption, @handle, thumbnail & voice-to-text fallback if deleted).",
    amountCents: 4900,
    amountMicro: 49000000,
    originalCents: 14900,
    originalDisplay: "$149",
    priceDisplay: "$49 USD / USDC",
    tier: "audit_49",
  },
  retainer: {
    id: "retainer",
    sku: "cautionwatch-alerts-v1",
    name: "Priority Live Caution-Video Alert Feed Setup — $199",
    description:
      "Dedicated automated polling for your business, brand, or personal name across high-risk TikTok keywords + instant live email/webhook alerts on Caution matches.",
    amountCents: 19900,
    amountMicro: 199000000,
    originalCents: 39900,
    originalDisplay: "$399",
    priceDisplay: "$199 USD / USDC",
    tier: "retainer_199",
  },
};

const MAX_KV_LIST = 200;

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
  const bookmarkletHref = `javascript:(function(){var u=location.href;if(!/tiktok\\.com/i.test(u)){alert('Open a TikTok video showing the Caution unverified banner first.');return;}window.open('${origin}/?log='+encodeURIComponent(u)+'#log-caution','_blank');})();`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>CautionWatch — Verified Unverified-Content TikTok Feed &amp; Live Alerts</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#070a10; color:#f1f5f9; max-width:1160px; margin:0 auto; padding:1.5rem 1rem 4rem; line-height:1.55; }
    a { color:#38bdf8; }
    header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem; border-bottom:1px solid #1e293b; padding-bottom:1rem; margin-bottom:1.2rem; }
    h1 { margin:0.2rem 0 0; font-size:1.8rem; color:#f8fafc; }
    .badge { display:inline-block; background:#451a03; border:1px solid #d97706; color:#fbbf24; font-size:0.75rem; font-weight:700; padding:0.22rem 0.65rem; border-radius:999px; }
    .notice { background:#0f172a; border:1px solid #334155; border-left:4px solid #f59e0b; border-radius:8px; padding:0.85rem 1rem; font-size:0.85rem; color:#cbd5e1; margin-bottom:1.2rem; }
    .grid { display:grid; grid-template-columns:1.35fr 0.95fr; gap:1.25rem; align-items:start; }
    @media(max-width:900px){ .grid{ grid-template-columns:1fr; } }
    .card { background:#111827; border:1px solid #1f2937; border-radius:12px; padding:1.2rem; margin-bottom:1rem; }
    .row { display:flex; gap:0.6rem; flex-wrap:wrap; }
    input, textarea, select { width:100%; background:#060911; color:#f8fafc; border:1px solid #334155; border-radius:8px; padding:0.68rem 0.8rem; font-size:0.9rem; margin:0.35rem 0 0.75rem; font-family:inherit; }
    label { display:block; font-size:0.8rem; font-weight:600; color:#94a3b8; }
    .btn { display:inline-block; padding:0.7rem 1.05rem; border-radius:8px; font-weight:700; cursor:pointer; border:0; color:#fff; background:#0284c7; text-align:center; font-size:0.9rem; text-decoration:none; }
    .btn-amber { background:#d97706; }
    .btn-green { background:#059669; }
    .feed-item { background:#0b1120; border:1px solid #1e293b; border-radius:10px; padding:0.95rem; margin-top:0.75rem; }
    .caution-bar { background:#1f2937; border:1px solid #4b5563; border-radius:8px; padding:0.45rem 0.7rem; font-size:0.8rem; font-weight:700; color:#f8fafc; margin-bottom:0.55rem; display:flex; align-items:center; gap:0.45rem; }
    .pill { display:inline-block; font-size:0.72rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:6px; margin-right:0.35rem; background:#0c4a6e; color:#7dd3fc; border:1px solid #075985; }
    .embed-box { margin-top:0.6rem; border-radius:8px; overflow:hidden; border:1px solid #1e293b; background:#05070c; }
    .fallback-box { margin-top:0.55rem; background:#05070c; border:1px dashed #334155; border-radius:8px; padding:0.65rem; font-size:0.8rem; color:#cbd5e1; }
  </style>
</head>
<body>
  <header>
    <div>
      <span class="badge">STRICT FILTER: "Caution: Video flagged for unverified content" ONLY</span>
      <h1>CautionWatch — Live Flagged TikTok Tracker &amp; Alert Portal</h1>
    </div>
    <div>
      <a class="btn btn-amber" href="#alert-contact">Request Live Alerts (Businesses &amp; Individuals)</a>
    </div>
  </header>

  <div class="notice">
    <strong>Zero-Noise Strict Policy:</strong> This site indexes and displays <strong>only</strong> TikTok videos verified to carry the official <code>"Caution: Video flagged for unverified content"</code> label (extracted via raw scraper <code>warnInfo</code> / <code>labelTop</code> / <code>contentDesc</code> fields or direct verified operator submissions). All unflagged videos, general news, and unrelated posts are excluded. Official TikTok embeds load directly from TikTok, with saved caption/thumbnail/transcript fallback records kept in case the creator deletes the post.
  </div>

  <div class="grid">
    <div>
      <div class="card">
        <strong>Verified "Caution: Unverified Content" Video Feed (<span id="countBadge">0</span>)</strong>
        <div class="row" style="margin-top:0.6rem;">
          <input id="queryInput" type="text" placeholder="Filter Caution videos by business, personal name, @handle, hashtag, or transcript..." style="flex:1;margin:0;" />
          <button class="btn" onclick="loadCautionFeed()">Filter Flagged Videos</button>
          <button class="btn" style="background:#334155;" onclick="document.getElementById('queryInput').value='';loadCautionFeed();">Show All</button>
        </div>
        <div id="feedOut" style="margin-top:0.6rem;font-size:0.88rem;color:#94a3b8;">Loading verified Caution-tagged TikTok feed...</div>
      </div>

      <div class="card" id="log-caution">
        <strong>Submit Verified "Caution: Video flagged for unverified content" Clip</strong>
        <p style="font-size:0.83rem;color:#cbd5e1;margin:0.35rem 0 0.7rem;">Spotted a video carrying the grey Caution banner in TikTok? Paste its link below (or drag the 1-click bookmarklet <a href="${escapeHtml(bookmarkletHref)}" style="color:#fbbf24;font-weight:700;">+ Add Caution Video</a> to your browser bookmarks bar). We verify via official TikTok oEmbed and archive it strictly under the Caution label.</p>
        <label for="tkUrl">TikTok Video URL</label>
        <input id="tkUrl" type="url" placeholder="https://www.tiktok.com/@maskedtruthmt/video/..." />
        <label for="tkBrand">Subject / Brand / Name Mentioned (optional)</label>
        <input id="tkBrand" type="text" placeholder="e.g. Anthony Joshua or Acme Brand" />
        <label for="tkVoice">Observed Caption / Audio Summary (preserved if creator deletes clip)</label>
        <input id="tkVoice" type="text" placeholder="Optional transcript or context note" />
        <button class="btn btn-amber" onclick="submitCautionVideo()">Verify oEmbed &amp; Add Caution Video</button>
        <div id="logStatus" style="margin-top:0.7rem;font-size:0.85rem;"></div>
      </div>
    </div>

    <div>
      <div class="card" id="alert-contact">
        <strong>Contact for Live Alerts (Businesses &amp; Individuals)</strong>
        <p style="font-size:0.84rem;color:#cbd5e1;margin:0.35rem 0 0.8rem;">Want instant email or webhook alerts the moment a <code>Caution: Video flagged for unverified content</code> video mentions your company, brand, @handle, or personal name? Submit your watchlist below.</p>
        <form id="contactForm" onsubmit="submitContact(event)">
          <label for="cAccountType">I am a *</label>
          <select id="cAccountType">
            <option value="Business / Brand / Agency">Business / Brand / PR / Legal Team</option>
            <option value="Individual / Creator / Public Figure">Individual / Creator / Public Figure</option>
          </select>
          <label for="cName">Business or Personal Name *</label>
          <input id="cName" required placeholder="e.g. Matchroom PR or John Smith" />
          <label for="cEmail">Email for Live Alerts *</label>
          <input id="cEmail" type="email" required placeholder="alerts@company.com or you@gmail.com" />
          <label for="cKeywords">Exact Names, Brand Terms &amp; @Handles to Poll *</label>
          <input id="cKeywords" required placeholder="e.g. Anthony Joshua, @yourbrand, Product Name" />
          <label for="cRefUrl">Existing Flagged TikTok URL (optional)</label>
          <input id="cRefUrl" placeholder="https://www.tiktok.com/@.../video/..." />
          <label for="cPlan">Alert Preference</label>
          <select id="cPlan">
            <option value="Live Caution Alert Subscription Inquiry">Live Caution Alert Subscription (Email / Webhook)</option>
            <option value="Archived Caution Evidence Dossier ($49)">Archived Caution Evidence Dossier Pack ($49)</option>
            <option value="Managed Custom Polling & Live Alert Setup ($199)">Priority Managed Poller + Live Alerts ($199)</option>
          </select>
          <label for="cNotes">Webhook URL (Make.com / Slack) or Notes</label>
          <textarea id="cNotes" rows="3" placeholder="Optional webhook URL, escalation contact, or extra keywords..."></textarea>
          <button class="btn btn-green" type="submit" style="width:100%;">Request Live Caution Alerts / Contact Me</button>
        </form>
        <div id="contactStatus" style="margin-top:0.8rem;font-size:0.86rem;"></div>
        <div style="margin-top:0.75rem;font-size:0.82rem;color:#94a3b8;">
          Direct Contact: <a href="mailto:${escapeHtml(contactEmail)}?subject=CautionWatch%20Live%20Alert%20Inquiry">${escapeHtml(contactEmail)}</a>
        </div>
      </div>

      <div class="card">
        <strong>Instant Paid Dossiers &amp; Alert Setup (Stripe)</strong>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Caution-Flagged Evidence Dossier (.zip)</strong>
            <span style="color:#34d399;font-weight:800;">$49</span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Archived CSV + JSON fallback records (saved caption, @handle, thumbnail &amp; transcript) for your watched keywords.</p>
          <button class="btn btn-green" style="width:100%;" onclick="buyPlan('audit')">Download Dossier Pack ($49)</button>
        </div>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Priority Live Polling &amp; Webhook Setup</strong>
            <span style="color:#fbbf24;font-weight:800;">$199</span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Custom keyword polling + live email/Make.com webhook alert wiring + dossier ZIP.</p>
          <button class="btn btn-amber" style="width:100%;" onclick="buyPlan('retainer')">Order Live Alert Setup ($199)</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    document.addEventListener("click", function(ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest("[data-alert-url]") : null;
      if (!btn) return;
      ev.preventDefault();
      document.getElementById("cRefUrl").value = btn.getAttribute("data-alert-url") || "";
      const kw = btn.getAttribute("data-alert-kw") || "";
      if (kw && !document.getElementById("cKeywords").value.trim()) document.getElementById("cKeywords").value = kw;
      document.getElementById("alert-contact").scrollIntoView({ behavior: "smooth" });
    });
    async function loadCautionFeed() {
      const q = document.getElementById("queryInput").value.trim();
      const out = document.getElementById("feedOut");
      out.textContent = "Loading strict Caution-flagged TikTok videos...";
      try {
        const res = await fetch("/api/scan" + (q ? "?q=" + encodeURIComponent(q) : ""));
        const d = await res.json();
        document.getElementById("countBadge").textContent = String(d.matched_count ?? 0);
        const list = d.caution_videos || [];
        if (!list.length) {
          out.innerHTML = '<div class="feed-item">No verified <code>Caution: Video flagged for unverified content</code> videos matched right now (' + Number(d.total_stored_caution_videos || 0) + ' total archived). Poll via <code>scripts/poll_tiktok_caution.py</code> (Apify/EnsembleData) or submit an observed Caution clip below, or subscribe on the right to receive live alerts automatically.</div>';
          return;
        }
        out.innerHTML = list.map((v) => {
          const iframeHtml = v.playerUrl
            ? '<div class="embed-box"><iframe src="' + esc(v.playerUrl) + '" style="width:100%;height:390px;border:0;" allow="fullscreen" loading="lazy" title="TikTok Embed"></iframe></div>'
            : "";
          const tagsHtml = (v.hashtags || []).slice(0, 6).map((h) => '<span class="pill">#' + esc(h) + '</span>').join("");
          return '<div class="feed-item">' +
            '<div class="caution-bar">&#9888; ' + esc(v.cautionText || "Caution: Video flagged for unverified content") + '</div>' +
            '<div><span class="pill">' + esc(v.authorUsername || v.authorName) + '</span><span class="pill">Matched: ' + esc(v.matchedField || "warnInfo") + '</span>' + tagsHtml + '</div>' +
            '<div style="margin-top:0.45rem;font-size:0.88rem;">' + esc(v.description || "(No caption saved)") + '</div>' +
            iframeHtml +
            '<div class="fallback-box"><strong>Saved Fallback Record</strong> (preserved if creator deletes clip): Video ID <code>' + esc(v.videoId) + '</code> | Creator <code>' + esc(v.authorUsername) + '</code>' +
            (v.voiceToText ? ' | Transcript: ' + esc(v.voiceToText.slice(0, 220)) : '') +
            '<div style="margin-top:0.4rem;"><a href="' + esc(v.url) + '" target="_blank" rel="noopener">Open Original TikTok</a> | <a href="#alert-contact" data-alert-url="' + esc(v.url) + '" data-alert-kw="' + esc(v.brandTag || v.authorUsername) + '">Get Live Alerts / Escalate</a></div></div></div>';
        }).join("");
      } catch (e) {
        out.textContent = "Failed to load feed: " + e.message;
      }
    }
    async function submitCautionVideo() {
      const url = document.getElementById("tkUrl").value.trim();
      const brandTag = document.getElementById("tkBrand").value.trim();
      const voiceToText = document.getElementById("tkVoice").value.trim();
      const st = document.getElementById("logStatus");
      if (!url) { st.textContent = "Paste a TikTok video URL first."; return; }
      st.textContent = "Verifying via official TikTok oEmbed and archiving Caution record...";
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            brandTag,
            voiceToText,
            cautionLabel: "Caution: Video flagged for unverified content"
          })
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { st.style.color = "#fca5a5"; st.textContent = "Error: " + (d.error || res.status); return; }
        st.style.color = "#34d399";
        st.innerHTML = 'Verified &amp; archived Caution clip <code>' + esc(d.entry?.videoId) + '</code> by <strong>' + esc(d.entry?.authorUsername) + '</strong>.';
        loadCautionFeed();
      } catch (e) {
        st.style.color = "#fca5a5";
        st.textContent = "Submit failed: " + e.message;
      }
    }
    async function submitContact(ev) {
      ev.preventDefault();
      const st = document.getElementById("contactStatus");
      st.textContent = "Saving your live alert request...";
      const payload = {
        account_type: document.getElementById("cAccountType").value,
        company: document.getElementById("cName").value.trim(),
        email: document.getElementById("cEmail").value.trim(),
        keywords: document.getElementById("cKeywords").value.trim(),
        reference_url: document.getElementById("cRefUrl").value.trim(),
        plan: document.getElementById("cPlan").value,
        notes: document.getElementById("cNotes").value.trim(),
      };
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { st.style.color = "#fca5a5"; st.textContent = "Error: " + (d.error || res.status); return; }
        const subj = encodeURIComponent("[CautionWatch Live Alert " + d.lead_id + "] " + payload.company);
        const body = encodeURIComponent("Ref: " + d.lead_id + "\\nType: " + payload.account_type + "\\nName: " + payload.company + "\\nKeywords: " + payload.keywords + "\\nRef URL: " + payload.reference_url + "\\nNotes: " + payload.notes);
        st.style.color = "#34d399";
        st.innerHTML = 'Live alert contact saved (Ref: <code>' + esc(d.lead_id) + '</code>). Active keywords are now eligible for Caution-tag polling. <a href="mailto:${escapeHtml(contactEmail)}?subject=' + subj + '&body=' + body + '">Also open direct email to ${escapeHtml(contactEmail)}</a>.';
      } catch (e) {
        st.style.color = "#fca5a5";
        st.textContent = "Network error: " + e.message;
      }
    }
    function buyPlan(tier) {
      const q = document.getElementById("cKeywords").value.trim() || document.getElementById("queryInput").value.trim() || "CautionWatch";
      window.location.href = "/api/checkout?tier=" + encodeURIComponent(tier) + "&domain=" + encodeURIComponent(q);
    }
    (function init() {
      const qs = new URLSearchParams(window.location.search);
      const logUrl = qs.get("log") || qs.get("inspect");
      if (logUrl) document.getElementById("tkUrl").value = logUrl;
      loadCautionFeed();
    })();
  </script>
</body>
</html>`;
}

async function buildPackForTarget(targetBrand, tier, bodyParams = {}, env = null) {
  const scan = await runCautionOnlyScan(targetBrand, env?.FUNNEL_KV || null);
  return buildCautionDossier(targetBrand, tier, scan, bodyParams.notes || "");
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
          strict_filter: "Caution: Video flagged for unverified content ONLY",
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

    if (path === "/api/scan" || path === "/api/feed") {
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
      const res = await runCautionOnlyScan(q, env?.FUNNEL_KV || null);
      return jsonResp(res, 200, cors);
    }

    if (path === "/api/ingest-caution") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      if (!isAuthorizedAdmin(req, env)) return jsonResp({ error: "Unauthorized" }, 401, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      const rawItems = Array.isArray(body?.items) ? body.items : body ? [body] : [];
      let accepted = 0;
      let rejected = 0;
      const saved = [];
      for (const raw of rawItems) {
        const rec = extractUnverifiedCautionRecord(raw, String(raw?.sourceType || body?.source || "scraper_api"));
        if (!rec) {
          rejected += 1;
          continue;
        }
        await appendKvIndexItem(env?.FUNNEL_KV, "bw:caution:index", "bw:caution:item:", rec.id, rec);
        accepted += 1;
        saved.push(rec);
      }
      if (accepted > 0) await incrementFunnelCounter(env, "brand_watch", "caution_ingested", accepted);
      return jsonResp({ ok: true, accepted, rejected, items: saved }, accepted > 0 ? 201 : 200, cors);
    }

    if (path === "/api/report") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      const cautionLabel = String(body?.cautionLabel || "").trim();
      if (!/(?:caution:\s*)?(?:video\s+)?flagged\s+for\s+unverified\s+content/i.test(cautionLabel)) {
        return jsonResp({ ok: false, error: "Only 'Caution: Video flagged for unverified content' videos are accepted." }, 422, cors);
      }
      try {
        const clip = await resolveTikTokOembed(body?.url, fetch);
        const rec = extractUnverifiedCautionRecord(
          {
            id: clip.videoId || (await sha256Hex(clip.url)).slice(0, 16),
            webVideoUrl: clip.url,
            authorMeta: { name: clip.authorUsername.replace(/^@+/, ""), nickName: clip.authorName },
            text: clip.description,
            voice_to_text: String(body?.voiceToText || "").trim(),
            thumbnailUrl: clip.thumbnailUrl,
            brandTag: String(body?.brandTag || "").trim(),
            cautionLabel,
          },
          "app_caution_submission",
        );
        if (!rec) return jsonResp({ ok: false, error: "Missing required Caution unverified metadata" }, 422, cors);
        const persisted = await appendKvIndexItem(env?.FUNNEL_KV, "bw:caution:index", "bw:caution:item:", rec.id, rec);
        await incrementFunnelCounter(env, "brand_watch", "caution_reports");
        return jsonResp({ ok: true, persisted, entry: rec }, 201, cors);
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
      const accountType = String(body?.account_type || "Business / Individual").trim().slice(0, 80);
      const company = String(body?.company || "").trim().slice(0, 140);
      const email = String(body?.email || "").trim().toLowerCase().slice(0, 140);
      const keywords = String(body?.keywords || "").trim().slice(0, 280);
      if (!company || !keywords || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return jsonResp({ ok: false, error: "Valid name, email, and alert keywords are required." }, 400, cors);
      }
      const leadId = `BW-${(await sha256Hex(`${company}:${email}:${Date.now()}`)).slice(0, 8).toUpperCase()}`;
      const record = {
        lead_id: leadId,
        account_type: accountType,
        company,
        contact_name: String(body?.contact_name || company).trim().slice(0, 120),
        email,
        keywords,
        reference_url: String(body?.reference_url || "").trim().slice(0, 300),
        plan: String(body?.plan || "Live Caution Alert Inquiry").trim().slice(0, 140),
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
          body: JSON.stringify({ event: "caution_watch_subscriber_lead", ...record }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => {});
      }

      return jsonResp(
        {
          ok: true,
          lead_id: leadId,
          persisted,
          contact_email: contactEmail,
          message: "Live alert inquiry saved.",
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
            (Array.isArray(ids) ? ids : []).slice(0, 100).map(async (id) => {
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
        zipFilename: "caution-watch-dossier.zip",
        serviceTitle: "CautionWatch Evidence Dossier",
        buildPackFn: (target, tier, bp) => buildPackForTarget(target, tier, bp, env),
      });
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
