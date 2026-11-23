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
  validateTikTokHandle,
  loadCautionFeedEntries,
  loadMonitoredAccounts,
  inspectTikTokAccountLive,
  runCautionOnlyScan,
  buildCautionDossier,
} from "./scanner.js";

export const BRAND_WATCH_PLANS = {
  single: {
    id: "single",
    sku: "cautionwatch-single-v1",
    name: "Single Flagged Clip Forensic Proof (.zip) — $2 Impulse Deal",
    description:
      "Instant forensic proof ZIP for a flagged Caution TikTok clip (saved caption, @handle, thumbnail & voice-to-text fallback if deleted).",
    amountCents: 200,
    amountMicro: 2000000,
    originalCents: 1900,
    originalDisplay: "$19",
    priceDisplay: "$2 USD / USDC",
    tier: "single_2",
  },
  audit: {
    id: "audit",
    sku: "cautionwatch-dossier-v1",
    name: "Caution-Flagged Video Evidence Dossier (.zip) — $5 Impulse Deal",
    description:
      "Instant Evidence ZIP of all archived Caution-flagged TikTok videos matching your business, creator handle, or keyword (CSV + JSON + takedown brief).",
    amountCents: 500,
    amountMicro: 5000000,
    originalCents: 4900,
    originalDisplay: "$49",
    priceDisplay: "$5 USD / USDC",
    tier: "audit_5",
  },
  retainer: {
    id: "retainer",
    sku: "cautionwatch-alerts-v1",
    name: "30-Day Live Caution-Video Alert Watchlist & Webhook Pass — $15",
    description:
      "Automated polling for your business, brand, or personal name across high-risk TikTok keywords + instant live email/webhook alerts on Caution matches.",
    amountCents: 1500,
    amountMicro: 15000000,
    originalCents: 9900,
    originalDisplay: "$99",
    priceDisplay: "$15 USD / USDC",
    tier: "retainer_15",
  },
};

const MAX_KV_LIST = 200;

async function appendKvIndexItem(kv, indexKey, itemKeyPrefix, id, payload) {
  return appendKvIndexBatch(kv, indexKey, itemKeyPrefix, [{ id, payload }]);
}

async function appendKvIndexBatch(kv, indexKey, itemKeyPrefix, entries) {
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function" || !entries?.length) return false;
  let ids = [];
  try {
    const cur = await kv.get(indexKey);
    const parsed = cur ? JSON.parse(cur) : [];
    if (Array.isArray(parsed)) ids = parsed;
  } catch {
    ids = [];
  }
  const newIds = [];
  for (const e of entries.slice(0, 15)) {
    if (!e?.id) continue;
    await kv.put(`${itemKeyPrefix}${e.id}`, JSON.stringify(e.payload), { expirationTtl: 180 * 86400 });
    newIds.push(e.id);
  }
  const newIdSet = new Set(newIds);
  const next = [...newIds, ...ids.filter((x) => !newIdSet.has(x))].slice(0, MAX_KV_LIST);
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
    .pill.clickable { cursor:pointer; transition:background 0.15s,border-color 0.15s; }
    .pill.clickable:hover { background:#0284c7; color:#fff; border-color:#38bdf8; }
    .tag-bar { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.65rem; padding-top:0.55rem; border-top:1px solid #1e293b; }
    .tag-btn { background:#0f172a; border:1px solid #334155; color:#cbd5e1; font-size:0.74rem; font-weight:600; padding:0.22rem 0.58rem; border-radius:999px; cursor:pointer; transition:all 0.15s; }
    .tag-btn:hover, .tag-btn.active { background:#0284c7; border-color:#38bdf8; color:#fff; }
    .tag-count { opacity:0.75; font-size:0.68rem; margin-left:0.22rem; }
    .ac-wrap { position:relative; flex:1; }
    .ac-menu { position:absolute; top:100%; left:0; right:0; z-index:40; background:#0f172a; border:1px solid #38bdf8; border-radius:8px; margin-top:0.25rem; max-height:230px; overflow-y:auto; box-shadow:0 10px 25px rgba(0,0,0,0.65); }
    .ac-item { padding:0.5rem 0.75rem; font-size:0.84rem; color:#f8fafc; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; }
    .ac-item:last-child { border-bottom:0; }
    .ac-item:hover { background:#1e293b; }
    .ac-badge { font-size:0.7rem; color:#7dd3fc; background:#0c4a6e; padding:0.1rem 0.45rem; border-radius:999px; }
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
    <strong>Zero-Noise Strict Policy:</strong> This site indexes and displays <strong>only</strong> TikTok videos verified to carry the official <code>"Caution: Video flagged for unverified content"</code> label (extracted via raw scraper <code>misc_info.ktf_info</code> / <code>warnInfo</code> / <code>labelTop</code> fields or direct verified operator submissions). All unflagged videos, general news, and unrelated posts are excluded. Official TikTok embeds load directly from TikTok, with saved caption/thumbnail/transcript fallback records kept in case the creator deletes the post.
  </div>

  <div class="grid">
    <div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <strong>Verified "Caution: Unverified Content" Video Feed (<span id="countBadge">0</span>)</strong>
          <span id="autoUpdateStatus" style="font-size:0.75rem;color:#34d399;background:rgba(16,185,129,0.12);border:1px solid rgba(52,211,153,0.35);padding:0.18rem 0.55rem;border-radius:999px;">&#9679; Self-Updating Archive Active (Auto-Refreshes Every 30s)</span>
        </div>
        <div class="row" style="margin-top:0.6rem;">
          <div class="ac-wrap">
            <input id="queryInput" type="text" list="cautionSuggestions" autocomplete="off" placeholder="Search or autofill by #hashtag, @handle, business, person, or claim..." style="margin:0;" oninput="onSearchInput(this.value)" onfocus="onSearchInput(this.value)" onkeydown="if(event.key==='Enter'){hideAutofill();loadCautionFeed();}" />
            <div id="autofillMenu" class="ac-menu" style="display:none;"></div>
          </div>
          <datalist id="cautionSuggestions"></datalist>
          <button class="btn" onclick="hideAutofill();loadCautionFeed();">Filter Flagged Videos</button>
          <button class="btn" style="background:#334155;" onclick="filterByTag('')">Show All</button>
        </div>
        <div id="tagCloud" class="tag-bar"></div>
        <div id="feedOut" style="margin-top:0.6rem;font-size:0.88rem;color:#94a3b8;">Loading verified Caution-tagged TikTok feed...</div>
      </div>

      <div class="card" id="report-account">
        <strong>Report TikTok Account (<code>@handle</code> Only) — Auto-Inspect All Account Videos</strong>
        <p style="font-size:0.83rem;color:#cbd5e1;margin:0.35rem 0 0.7rem;">Solely the TikTok <code>@handle</code> is needed (e.g. <code>@maskedtruthmt</code>). Submitting a handle registers the account in the self-updating watchlist and inspects all of its videos via mobile <code>aweme</code> metadata to extract every video carrying the <code>"Caution: Video flagged for unverified content"</code> tag.</p>
        <div class="row">
          <div style="flex:2;">
            <label for="acctHandle">TikTok Account @Handle Only *</label>
            <input id="acctHandle" type="text" list="cautionSuggestions" placeholder="e.g. @maskedtruthmt or maskedtruthmt" onkeydown="if(event.key==='Enter'){submitAccountHandle();}" />
          </div>
          <div style="flex:1;">
            <label for="acctBrand">Topic / Brand Watch Tag (optional)</label>
            <input id="acctBrand" type="text" list="cautionSuggestions" placeholder="e.g. Anthony Joshua / Viral Claims" onkeydown="if(event.key==='Enter'){submitAccountHandle();}" />
          </div>
        </div>
        <button class="btn btn-green" onclick="submitAccountHandle()">Inspect All Videos on @Handle for Caution Tags</button>
        <div id="acctStatus" style="margin-top:0.7rem;font-size:0.85rem;"></div>

        <div style="margin-top:1rem;padding-top:0.85rem;border-top:1px solid #1e293b;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
            <strong style="font-size:0.86rem;color:#f8fafc;">Self-Updating Monitored Accounts Registry (<span id="acctCountBadge">0</span> Accounts &middot; <span id="inspectedVideosBadge">0</span> Videos Inspected)</strong>
            <button type="button" class="tag-btn" onclick="loadCautionFeed()">&#8635; Sync Registry Now</button>
          </div>
          <div id="accountsRegistryOut" style="margin-top:0.55rem;font-size:0.82rem;color:#94a3b8;">Loading monitored @handle registry...</div>
        </div>
      </div>

      <div class="card" id="log-caution">
        <strong>Submit Specific Verified "Caution: Video flagged for unverified content" Clip (or @Handle)</strong>
        <p style="font-size:0.83rem;color:#cbd5e1;margin:0.35rem 0 0.7rem;">Have a direct link to a specific video carrying the grey Caution banner (or paste a <code>@handle</code>)? Paste it below (or drag the 1-click bookmarklet <a href="${escapeHtml(bookmarkletHref)}" style="color:#fbbf24;font-weight:700;">+ Add Caution Video</a> to your browser bookmarks bar).</p>
        <label for="tkUrl">TikTok Video URL (or @Handle)</label>
        <input id="tkUrl" type="text" placeholder="https://www.tiktok.com/@maskedtruthmt/video/... or @maskedtruthmt" />
        <label for="tkBrand">Subject / Brand / Name Mentioned (optional)</label>
        <input id="tkBrand" type="text" list="cautionSuggestions" placeholder="e.g. Anthony Joshua or Acme Brand" />
        <label for="tkVoice">Observed Caption / Audio Summary (preserved if creator deletes clip)</label>
        <input id="tkVoice" type="text" placeholder="Optional transcript or context note" />
        <button class="btn btn-amber" onclick="submitCautionVideo()">Verify &amp; Archive Caution Clip / Account</button>
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
          <input id="cKeywords" required list="cautionSuggestions" placeholder="e.g. Anthony Joshua, @yourbrand, Product Name" />
          <label for="cRefUrl">Existing Flagged TikTok URL (optional)</label>
          <input id="cRefUrl" placeholder="https://www.tiktok.com/@.../video/..." />
          <label for="cPlan">Alert / Dossier Option (Impulse-Buy Pricing)</label>
          <select id="cPlan">
            <option value="Live Caution Alert Subscription Inquiry">Free Watchlist Intake / Live Alert Inquiry</option>
            <option value="Single Clip Forensic Proof ($2)">Single Flagged Clip Forensic Proof ZIP ($2)</option>
            <option value="Archived Caution Evidence Dossier ($5)">Full Caution Evidence Dossier Pack ($5)</option>
            <option value="30-Day Live Caution Alert Watchlist Pass ($15)">30-Day Live Caution Alert Watchlist &amp; Webhook Pass ($15)</option>
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
        <strong>Instant Impulse-Buy Dossiers &amp; Live Alert Passes (Stripe)</strong>
        <p style="font-size:0.79rem;color:#94a3b8;margin:0.25rem 0 0.65rem;">Instant self-serve checkout priced for creators, journalists, researchers &amp; businesses:</p>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Single Clip Forensic Proof (.zip)</strong>
            <span><s style="color:#64748b;font-size:0.78rem;margin-right:0.3rem;">$19</s><span style="color:#38bdf8;font-weight:800;">$2</span></span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Timestamped forensic fallback snapshot (caption, @handle, thumbnail &amp; transcript) before the creator deletes the clip.</p>
          <button class="btn" style="width:100%;" onclick="buyPlan('single')">Instant Clip Proof Pack ($2)</button>
        </div>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Full Caution Evidence Dossier (.zip)</strong>
            <span><s style="color:#64748b;font-size:0.78rem;margin-right:0.3rem;">$49</s><span style="color:#34d399;font-weight:800;">$5</span></span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Complete archived CSV + JSON fallback records + escalation brief for your watched keyword, brand, or creator.</p>
          <button class="btn btn-green" style="width:100%;" onclick="buyPlan('audit')">Download Full Dossier Pack ($5)</button>
        </div>
        <div class="feed-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>30-Day Live Alert Watchlist Pass</strong>
            <span><s style="color:#64748b;font-size:0.78rem;margin-right:0.3rem;">$99</s><span style="color:#fbbf24;font-weight:800;">$15</span></span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Automated keyword/@handle polling + instant email &amp; Make.com/Slack webhook alerts on new Caution matches + dossier ZIP.</p>
          <button class="btn btn-amber" style="width:100%;" onclick="buyPlan('retainer')">Activate Live Alert Pass ($15)</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let CATALOG_TAGS = [];
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function hideAutofill() {
      const m = document.getElementById("autofillMenu");
      if (m) m.style.display = "none";
    }
    function filterByTag(tag) {
      document.getElementById("queryInput").value = tag || "";
      hideAutofill();
      loadCautionFeed();
    }
    function onSearchInput(val) {
      const menu = document.getElementById("autofillMenu");
      if (!menu || !CATALOG_TAGS.length) return;
      const q = String(val || "").trim().toLowerCase();
      const qBare = q.replace(/^[#@]+/, "");
      const matches = CATALOG_TAGS.filter((t) => {
        if (!q) return true;
        const low = String(t.tag || "").toLowerCase();
        return low.includes(q) || (qBare && low.includes(qBare));
      }).slice(0, 10);
      if (!matches.length) {
        menu.style.display = "none";
        return;
      }
      menu.innerHTML = matches.map((t) =>
        '<div class="ac-item" data-ac-tag="' + esc(t.tag) + '">' +
          '<span><strong>' + esc(t.tag) + '</strong></span>' +
          '<span class="ac-badge">' + esc(t.type || "tag") + ' &middot; ' + Number(t.count || 1) + '</span>' +
        '</div>'
      ).join("");
      menu.style.display = "block";
    }
    function renderTagCatalog(tags, totalCount, activeQuery) {
      CATALOG_TAGS = Array.isArray(tags) ? tags : [];
      const dl = document.getElementById("cautionSuggestions");
      if (dl) {
        dl.innerHTML = CATALOG_TAGS.map((t) => '<option value="' + esc(t.tag) + '"></option>').join("");
      }
      const cloud = document.getElementById("tagCloud");
      if (!cloud) return;
      const qLow = String(activeQuery || "").trim().toLowerCase();
      const allBtn = '<button type="button" class="tag-btn' + (!qLow ? ' active' : '') + '" data-filter-tag="">All Flagged <span class="tag-count">(' + Number(totalCount || 0) + ')</span></button>';
      const pills = CATALOG_TAGS.slice(0, 22).map((t) => {
        const isAct = qLow && qLow === String(t.tag || "").toLowerCase();
        return '<button type="button" class="tag-btn' + (isAct ? ' active' : '') + '" data-filter-tag="' + esc(t.tag) + '">' + esc(t.tag) + '<span class="tag-count">(' + Number(t.count || 1) + ')</span></button>';
      }).join("");
      cloud.innerHTML = allBtn + pills;
    }
    document.addEventListener("click", function(ev) {
      const acItem = ev.target && ev.target.closest ? ev.target.closest("[data-ac-tag]") : null;
      if (acItem) {
        ev.preventDefault();
        filterByTag(acItem.getAttribute("data-ac-tag") || "");
        return;
      }
      const tagBtn = ev.target && ev.target.closest ? ev.target.closest("[data-filter-tag]") : null;
      if (tagBtn) {
        ev.preventDefault();
        filterByTag(tagBtn.getAttribute("data-filter-tag") || "");
        return;
      }
      if (!ev.target || !ev.target.closest || !ev.target.closest(".ac-wrap")) {
        hideAutofill();
      }
      const btn = ev.target && ev.target.closest ? ev.target.closest("[data-alert-url]") : null;
      if (btn) {
        ev.preventDefault();
        document.getElementById("cRefUrl").value = btn.getAttribute("data-alert-url") || "";
        const kw = btn.getAttribute("data-alert-kw") || "";
        if (kw && !document.getElementById("cKeywords").value.trim()) document.getElementById("cKeywords").value = kw;
        document.getElementById("alert-contact").scrollIntoView({ behavior: "smooth" });
        return;
      }
      const reinspectBtn = ev.target && ev.target.closest ? ev.target.closest("[data-inspect-handle]") : null;
      if (reinspectBtn) {
        ev.preventDefault();
        const h = reinspectBtn.getAttribute("data-inspect-handle") || "";
        if (h) {
          document.getElementById("acctHandle").value = h;
          submitAccountHandle();
        }
      }
    });
    function renderMonitoredAccounts(accounts, totalVideosInspected) {
      const list = Array.isArray(accounts) ? accounts : [];
      const countEl = document.getElementById("acctCountBadge");
      if (countEl) countEl.textContent = String(list.length);
      const vidEl = document.getElementById("inspectedVideosBadge");
      if (vidEl) vidEl.textContent = String(totalVideosInspected ?? list.reduce((a, x) => a + Number(x.videosInspected || 0), 0));
      const box = document.getElementById("accountsRegistryOut");
      if (!box) return;
      if (!list.length) {
        box.textContent = "No @handle accounts monitored yet. Submit a @handle above.";
        return;
      }
      box.innerHTML = list.map((a) => {
        const hasMatch = Number(a.cautionFoundCount || 0) > 0;
        const badgeColor = hasMatch ? "background:#3f1d0b;border-color:#f59e0b;color:#fde68a;" : "background:#0f172a;border-color:#334155;color:#94a3b8;";
        return '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;padding:0.42rem 0.6rem;background:#0a0e1a;border:1px solid #1e293b;border-radius:8px;margin-top:0.35rem;">' +
          '<div>' +
            '<span class="pill clickable" data-filter-tag="' + esc(a.displayHandle) + '" style="font-weight:700;color:#38bdf8;">' + esc(a.displayHandle) + '</span>' +
            '<span class="pill" style="' + badgeColor + '">' + Number(a.cautionFoundCount || 0) + ' Caution Flagged</span>' +
            '<span class="pill">' + Number(a.videosInspected || 0) + ' Videos Inspected</span>' +
            '<span class="pill" style="text-transform:uppercase;font-size:0.68rem;">' + esc(a.status || "inspected") + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:0.4rem;align-items:center;">' +
            '<a href="' + esc(a.profileUrl) + '" target="_blank" rel="noopener" style="font-size:0.75rem;">TikTok Profile</a>' +
            '<button type="button" class="tag-btn" data-inspect-handle="' + esc(a.displayHandle) + '">Inspect All Videos</button>' +
          '</div>' +
        '</div>';
      }).join("");
    }
    async function loadCautionFeed(silent) {
      const q = document.getElementById("queryInput").value.trim();
      const out = document.getElementById("feedOut");
      if (!silent) out.textContent = "Loading strict Caution-flagged TikTok videos...";
      try {
        const res = await fetch("/api/scan" + (q ? "?q=" + encodeURIComponent(q) : ""));
        const d = await res.json();
        document.getElementById("countBadge").textContent = String(d.matched_count ?? 0);
        renderTagCatalog(d.searchable_tags || [], d.total_stored_caution_videos || 0, q);
        renderMonitoredAccounts(d.monitored_accounts || [], d.total_videos_inspected || 0);
        const autoEl = document.getElementById("autoUpdateStatus");
        if (autoEl) {
          autoEl.innerHTML = "&#9679; Self-Updating Archive Active &middot; " + Number(d.total_monitored_accounts || 0) + " Accounts &middot; " + Number(d.total_videos_inspected || 0) + " Videos Inspected";
        }
        const list = d.caution_videos || [];
        if (!list.length) {
          out.innerHTML = '<div class="feed-item">No verified <code>Caution: Video flagged for unverified content</code> videos matched right now (' + Number(d.total_stored_caution_videos || 0) + ' total archived across ' + Number(d.total_videos_inspected || 0) + ' inspected videos). Click <strong>Show All</strong> above or report a TikTok <code>@handle</code> below to inspect all of its videos.</div>';
          return;
        }
        out.innerHTML = list.map((v) => {
          const iframeHtml = v.playerUrl
            ? '<div class="embed-box"><iframe src="' + esc(v.playerUrl) + '" style="width:100%;height:390px;border:0;" allow="fullscreen" loading="lazy" title="TikTok Embed"></iframe></div>'
            : "";
          const tagsHtml = (v.hashtags || []).slice(0, 8).map((h) => '<span class="pill clickable" data-filter-tag="#' + esc(h) + '">#' + esc(h) + '</span>').join("");
          const creatorLabel = v.authorUsername || v.authorName || "unknown";
          return '<div class="feed-item">' +
            '<div class="caution-bar">&#9888; ' + esc(v.cautionText || "Caution: Video flagged for unverified content") + '</div>' +
            '<div><span class="pill clickable" data-filter-tag="' + esc(creatorLabel) + '">' + esc(creatorLabel) + '</span><span class="pill">Matched: ' + esc(v.matchedField || "warnInfo") + '</span>' + tagsHtml + '</div>' +
            '<div style="margin-top:0.45rem;font-size:0.88rem;">' + esc(v.description || "(No caption saved)") + '</div>' +
            iframeHtml +
            '<div class="fallback-box"><strong>Saved Fallback Record</strong> (preserved if creator deletes clip): Video ID <code>' + esc(v.videoId) + '</code> | Creator <code>' + esc(v.authorUsername) + '</code>' +
            (v.voiceToText ? ' | Transcript: ' + esc(v.voiceToText.slice(0, 220)) : '') +
            '<div style="margin-top:0.4rem;"><a href="' + esc(v.url) + '" target="_blank" rel="noopener">Open Original TikTok</a> | <a href="#alert-contact" data-alert-url="' + esc(v.url) + '" data-alert-kw="' + esc(v.authorUsername || v.brandTag) + '">Get Live Alerts ($15)</a> | <a href="javascript:void(0)" onclick="document.getElementById(\'queryInput\').value=\'' + esc(v.videoId) + '\';buyPlan(\'single\')">Instant Proof ZIP ($2)</a></div></div></div>';
        }).join("");
      } catch (e) {
        if (!silent) out.textContent = "Failed to load feed: " + e.message;
      }
    }
    async function submitAccountHandle() {
      const handle = document.getElementById("acctHandle").value.trim();
      const brandTag = document.getElementById("acctBrand").value.trim();
      const st = document.getElementById("acctStatus");
      if (!handle) { st.style.color = "#fca5a5"; st.textContent = "Enter a TikTok @handle first (e.g. @maskedtruthmt)."; return; }
      st.style.color = "#38bdf8";
      st.textContent = "Registering " + handle + " and inspecting all account videos for 'Caution: Video flagged for unverified content' tags...";
      try {
        const res = await fetch("/api/report-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle, brandTag })
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { st.style.color = "#fca5a5"; st.textContent = "Error: " + (d.error || res.status); return; }
        st.style.color = "#34d399";
        st.innerHTML = 'Account <strong>' + esc(d.handle) + '</strong> registered &amp; inspected (' + Number(d.videosInspected || 0) + ' videos inspected, <strong>' + Number(d.cautionFoundCount || 0) + ' Caution-flagged videos</strong> archived; status: <code>' + esc(d.status) + '</code>).';
        loadCautionFeed(true);
      } catch (e) {
        st.style.color = "#fca5a5";
        st.textContent = "Inspection request failed: " + e.message;
      }
    }
    async function submitCautionVideo() {
      const url = document.getElementById("tkUrl").value.trim();
      const brandTag = document.getElementById("tkBrand").value.trim();
      const voiceToText = document.getElementById("tkVoice").value.trim();
      const st = document.getElementById("logStatus");
      if (!url) { st.textContent = "Paste a TikTok video URL or @handle first."; return; }
      st.style.color = "#38bdf8";
      st.textContent = "Verifying and archiving Caution record / inspecting @handle...";
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
        if (d.handle && !d.entry) {
          st.innerHTML = 'Account <strong>' + esc(d.handle) + '</strong> inspected (' + Number(d.videosInspected || 0) + ' videos inspected, <strong>' + Number(d.cautionFoundCount || 0) + ' Caution matches</strong> archived).';
        } else {
          st.innerHTML = 'Verified &amp; archived Caution clip <code>' + esc(d.entry?.videoId) + '</code> by <strong>' + esc(d.entry?.authorUsername) + '</strong>.';
        }
        loadCautionFeed(true);
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
      if (logUrl) {
        if (logUrl.indexOf("/video/") === -1) {
          document.getElementById("acctHandle").value = logUrl;
        } else {
          document.getElementById("tkUrl").value = logUrl;
        }
      }
      loadCautionFeed();
      setInterval(function() {
        loadCautionFeed(true);
      }, 30000);
    })();
  </script>
</body>
</html>`;
}

async function buildPackForTarget(targetBrand, tier, bodyParams = {}, env = null) {
  const scan = await runCautionOnlyScan(targetBrand, env?.FUNNEL_KV || null);
  return buildCautionDossier(targetBrand, tier, scan, bodyParams.notes || "");
}

async function handleAccountInspectionRequest(body, req, env, cors) {
  let handleInfo;
  try {
    handleInfo = validateTikTokHandle(body?.handle || body?.username || body?.account || body?.url || "");
  } catch (err) {
    return jsonResp({ ok: false, error: err.message }, err.httpStatus || 400, cors);
  }

  const allCaution = await loadCautionFeedEntries(env?.FUNNEL_KV || null, 100);
  const existingAccounts = await loadMonitoredAccounts(env?.FUNNEL_KV || null, allCaution, 100);
  const existing = existingAccounts.find((a) => a.handle === handleInfo.handle) || null;
  const brandTag = String(body?.brandTag || existing?.brandTag || handleInfo.displayHandle).trim().slice(0, 140);
  const notes = String(body?.notes || existing?.notes || "").trim().slice(0, 500);

  let liveRes = {
    liveApifyRan: false,
    apifyStatus: "skipped",
    apifyRunId: null,
    inspectedCount: 0,
    cautionRecords: [],
    dispatchedWorkflow: false,
  };

  const isAdminSync = Boolean(body?.sync_stats && isAuthorizedAdmin(req, env));
  if (!isAdminSync && body?.skipLive !== true) {
    liveRes = await inspectTikTokAccountLive(handleInfo, env, fetch, {
      maxVideos: Number(body?.maxVideos || 50),
      waitForFinish: Number(body?.waitForFinish ?? 25),
      brandTag,
    });
    for (const rec of liveRes.cautionRecords) {
      await appendKvIndexItem(env?.FUNNEL_KV, "bw:caution:index", "bw:caution:item:", rec.id, rec);
    }
    if (liveRes.cautionRecords.length > 0) {
      await incrementFunnelCounter(env, "brand_watch", "caution_ingested", liveRes.cautionRecords.length);
    }
  }

  const updatedCaution = await loadCautionFeedEntries(env?.FUNNEL_KV || null, 100);
  const matchedMap = new Map();
  for (const v of [...liveRes.cautionRecords, ...updatedCaution]) {
    const u = String(v?.authorUsername || "").trim().replace(/^@+/, "").toLowerCase();
    if (u === handleInfo.handle && v?.id && !matchedMap.has(v.id)) {
      matchedMap.set(v.id, v);
    }
  }
  const matchedVideos = Array.from(matchedMap.values());

  const videosInspected = isAdminSync
    ? Math.max(Number(body?.videosInspected ?? 0), Number(existing?.videosInspected || 0), matchedVideos.length)
    : Math.max(
        Number(existing?.videosInspected || 0) + Number(liveRes.inspectedCount || 0),
        Number(body?.videosInspected || 0),
        matchedVideos.length,
      );
  const cautionFoundCount = isAdminSync
    ? Math.max(Number(body?.cautionFoundCount ?? 0), matchedVideos.length)
    : matchedVideos.length;
  const nowIso = new Date().toISOString();
  const status = isAdminSync
    ? String(body?.status || "inspected")
    : liveRes.liveApifyRan || videosInspected > 0
      ? "inspected"
      : "queued";

  const accountRecord = {
    handle: handleInfo.handle,
    displayHandle: handleInfo.displayHandle,
    profileUrl: handleInfo.profileUrl,
    status,
    videosInspected,
    cautionFoundCount,
    matchedVideoIds: matchedVideos.map((v) => v.videoId || v.id),
    brandTag,
    notes,
    source: isAdminSync ? String(body?.source || "poller_account_sync") : "user_reported_handle",
    reportedAt: existing?.reportedAt || nowIso,
    lastInspectedAt: status === "inspected" ? nowIso : existing?.lastInspectedAt || null,
  };

  const persisted = await appendKvIndexItem(
    env?.FUNNEL_KV,
    "bw:accounts:index",
    "bw:account:item:",
    handleInfo.handle,
    accountRecord,
  );
  await incrementFunnelCounter(env, "brand_watch", "accounts_reported");

  return jsonResp(
    {
      ok: true,
      persisted,
      handle: handleInfo.displayHandle,
      username: handleInfo.handle,
      profileUrl: handleInfo.profileUrl,
      status: accountRecord.status,
      videosInspected: accountRecord.videosInspected,
      cautionFoundCount: accountRecord.cautionFoundCount,
      liveApifyRan: liveRes.liveApifyRan,
      apifyStatus: liveRes.apifyStatus,
      apifyRunId: liveRes.apifyRunId,
      dispatchedWorkflow: liveRes.dispatchedWorkflow,
      matchedVideos,
      account: accountRecord,
    },
    201,
    cors,
  );
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
        accepted += 1;
        saved.push(rec);
      }
      if (saved.length > 0) {
        await appendKvIndexBatch(
          env?.FUNNEL_KV,
          "bw:caution:index",
          "bw:caution:item:",
          saved.map((rec) => ({ id: rec.id, payload: rec })),
        );
      }
      if (accepted > 0) await incrementFunnelCounter(env, "brand_watch", "caution_ingested", accepted);
      return jsonResp({ ok: true, accepted, rejected, items: saved }, accepted > 0 ? 201 : 200, cors);
    }

    if (path === "/api/accounts") {
      if (req.method !== "GET") return jsonResp({ error: "GET required" }, 405, cors);
      const allCaution = await loadCautionFeedEntries(env?.FUNNEL_KV || null, 100);
      const accounts = await loadMonitoredAccounts(env?.FUNNEL_KV || null, allCaution, 100);
      const totalVideosInspected = accounts.reduce((acc, a) => acc + Number(a.videosInspected || 0), 0);
      const totalCautionFound = accounts.reduce((acc, a) => acc + Number(a.cautionFoundCount || 0), 0);
      return jsonResp(
        {
          ok: true,
          total_accounts: accounts.length,
          total_videos_inspected: totalVideosInspected,
          total_caution_found: totalCautionFound,
          self_updating_schedule: "Every 12 hours + On-Demand @Handle Full-Profile Inspection",
          accounts,
        },
        200,
        cors,
      );
    }

    if (path === "/api/report-account") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      return handleAccountInspectionRequest(body, req, env, cors);
    }

    if (path === "/api/report") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ error: "Invalid JSON body" }, 400, cors);
      }
      const rawUrlOrHandle = String(body?.url || "").trim();
      const isHandleOnly =
        Boolean(body?.handle || body?.username || body?.account) ||
        (rawUrlOrHandle && !/\/video\/\d+/i.test(rawUrlOrHandle) && !/^https?:\/\/(?:vt|vm)\.tiktok\.com\//i.test(rawUrlOrHandle));
      if (isHandleOnly) {
        return handleAccountInspectionRequest(body, req, env, cors);
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
