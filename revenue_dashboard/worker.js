/**
 * Kurox Live Revenue & Multi-Play Operations Dashboard Worker
 * Aggregates live Stripe balances & paid sessions, on-chain Base/Solana USDC balances & recent txns,
 * Apify kuroxreal telemetry, GitHub cron outreach metrics, and live endpoint health in real time.
 * Never leaks secrets or customer PII.
 */

import { cleanSecret, escapeHtml } from "../stripe_billing.js";
import {
  MERCHANT_BASE,
  BASE_USDC,
  MERCHANT_SOLANA_ATA,
  buildCorsHeaders,
  jsonResp,
  htmlResp,
  normalizePlayKey,
  constantTimeEqual,
  sha256Hex,
  hmacSha256Hex,
  verifyStripeWebhookSignature,
  recordUniqueFunnelClick,
  incrementFunnelCounter,
  computeStopLossVerdict,
} from "../edge_helpers.js";

const BASE_RPCS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com"];
const SOLANA_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const FLEET_ENDPOINTS = [
  { id: "action2mcp", name: "Action2MCP ($10 Deal, was $25 + Free ZIP)", url: "https://action2mcp.ak10082247.workers.dev/health", binding: "ACTION2MCP_SVC" },
  { id: "site_rescue", name: "Play A: SiteRescue ($10 Deal, was $49)", url: "https://site-rescue.ak10082247.workers.dev/health", binding: "SITE_RESCUE_SVC" },
  { id: "ecom_fix", name: "Play B: StoreFix ($10 Deal, was $49)", url: "https://ecom-fix.ak10082247.workers.dev/health", binding: "ECOM_FIX_SVC" },
  { id: "agentfuel402", name: "AgentFuel402 Data Factory", url: "https://agentfuel402.ak10082247.workers.dev/health", binding: "AGENTFUEL_SVC" },
  { id: "canaryguard", name: "CanaryGuard 402 Firewall", url: "https://canaryguard-402.onrender.com/health" },
  { id: "rugshield", name: "RugShield 402 Simulator", url: "https://rugshield-402.onrender.com/health" },
];

const ALLOWED_REDIRECT_HOSTS = new Set([
  "site-rescue.ak10082247.workers.dev",
  "ecom-fix.ak10082247.workers.dev",
  "action2mcp.ak10082247.workers.dev",
  "agentfuel402.ak10082247.workers.dev",
  "canaryguard-402.onrender.com",
  "rugshield-402.onrender.com",
  "apify.com",
  "www.apify.com",
  "fiverr.com",
  "www.fiverr.com",
]);

const DEFAULT_PLAY_REDIRECTS = {
  play_a_local: "https://site-rescue.ak10082247.workers.dev/",
  play_b_ecom: "https://ecom-fix.ak10082247.workers.dev/",
  play_c_agency: "https://site-rescue.ak10082247.workers.dev/?ref=agency",
  action2mcp: "https://action2mcp.ak10082247.workers.dev/",
  agentfuel402: "https://agentfuel402.ak10082247.workers.dev/",
  canaryguard: "https://canaryguard-402.onrender.com/",
  rugshield: "https://rugshield-402.onrender.com/",
};

const SIX_PLAY_CATALOG = [
  { key: "play_a_local", outreachKey: "site_rescue", stripeLabel: "Play A: SiteRescue", name: "Play A: SiteRescue (Local 404/SSL)", kind: "cold_email", defaultCap: 200, defaultCutoff: null },
  { key: "play_b_ecom", outreachKey: "ecom_fix", stripeLabel: "Play B: StoreFix", name: "Play B: StoreFix (Shopify/Woo)", kind: "cold_email", defaultCap: 200, defaultCutoff: null },
  { key: "play_c_agency", outreachKey: "agency_overflow", stripeLabel: "Play C: Agency Overflow", name: "Play C: Agency B2B Overflow ($49/client)", kind: "cold_email", defaultCap: 200, defaultCutoff: null },
  { key: "action2mcp", outreachKey: "action2mcp", stripeLabel: "Action2MCP", name: "Action2MCP (Hold Dec 11)", kind: "cold_email", defaultCap: null, defaultCutoff: "2026-12-12" },
  { key: "agentfuel402", outreachKey: null, stripeLabel: null, name: "AgentFuel402 (x402 / Apify)", kind: "x402_api", defaultCap: null, defaultCutoff: null },
  { key: "canaryguard", outreachKey: null, stripeLabel: null, name: "CanaryGuard 402 (Firewall)", kind: "x402_api", defaultCap: null, defaultCutoff: null },
  { key: "rugshield", outreachKey: null, stripeLabel: null, name: "RugShield 402 (Pre-Trade Sim)", kind: "x402_api", defaultCap: null, defaultCutoff: null },
];

function classifyStripeSession(s) {
  const meta = s.metadata || {};
  const sku = String(meta.sku || "").toLowerCase();
  const tier = String(meta.tier || "").toLowerCase();
  if (sku.startsWith("siterescue") || tier.startsWith("pack") || tier.startsWith("priority")) return "Play A: SiteRescue";
  if (sku.startsWith("ecomfix") || tier.startsWith("fix_pack") || tier.startsWith("pro_kit")) return "Play B: StoreFix";
  if (sku.startsWith("action2mcp") || tier === "hosted" || tier === "bundle") return "Action2MCP";
  return "Other / Direct";
}

function classifyStripePlayKey(s) {
  const label = classifyStripeSession(s);
  if (label === "Play A: SiteRescue") return "play_a_local";
  if (label === "Play B: StoreFix") return "play_b_ecom";
  if (label === "Action2MCP") return "action2mcp";
  return "other";
}

function maskEmail(raw) {
  const s = String(raw || "").trim();
  const at = s.indexOf("@");
  if (at <= 0 || at === s.length - 1) return "-";
  return `${s[0]}***@${s.slice(at + 1)}`;
}

function redactId(id) {
  const s = String(id || "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}...${s.slice(-4)}`;
}

async function fetchStripeLive(stripeKeyRaw) {
  const key = cleanSecret(stripeKeyRaw);
  if (!key) {
    return {
      configured: false,
      paid_usd: 0,
      stripe_fees_usd: 0,
      net_stripe_usd: 0,
      available_usd: 0,
      pending_usd: 0,
      paid_count: 0,
      abandoned_count: 0,
      by_play: {},
      paid_count_by_play: {},
      checkout_clicks_by_play: {},
      abandoned_by_play: {},
      recent_paid: [],
      recent_abandoned: [],
    };
  }

  const headers = { Authorization: `Bearer ${key}` };
  const [balRes, sessRes] = await Promise.all([
    fetch("https://api.stripe.com/v1/balance", { headers, signal: AbortSignal.timeout(8000) }),
    fetch("https://api.stripe.com/v1/checkout/sessions?limit=100", { headers, signal: AbortSignal.timeout(8000) }),
  ]);

  let availableCents = 0;
  let pendingCents = 0;
  if (balRes.ok) {
    const b = await balRes.json().catch(() => ({}));
    availableCents = (b.available || []).filter((x) => x.currency === "usd").reduce((a, x) => a + Number(x.amount || 0), 0);
    pendingCents = (b.pending || []).filter((x) => x.currency === "usd").reduce((a, x) => a + Number(x.amount || 0), 0);
  }

  let paidCents = 0;
  let feeCents = 0;
  let paidCount = 0;
  let abandonedCount = 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const byPlay = { "Action2MCP": 0, "Play A: SiteRescue": 0, "Play B: StoreFix": 0, "Other / Direct": 0 };
  const paidCountByPlay = { play_a_local: 0, play_b_ecom: 0, action2mcp: 0, other: 0 };
  const clicksByPlay = { "Action2MCP": 0, "Play A: SiteRescue": 0, "Play B: StoreFix": 0, "Other / Direct": 0 };
  const abandonedByPlay = { play_a_local: 0, play_b_ecom: 0, action2mcp: 0, other: 0 };
  const recentPaid = [];
  const recentAbandoned = [];
  if (sessRes.ok) {
    const sj = await sessRes.json().catch(() => ({}));
    for (const s of sj.data || []) {
      const cat = classifyStripeSession(s);
      const pKey = classifyStripePlayKey(s);
      const tdom = String(s.metadata?.target_domain || "").toLowerCase();
      if (!tdom.startsWith("test.")) {
        clicksByPlay[cat] = (clicksByPlay[cat] || 0) + 1;
      }
      const amt = Number(s.amount_total || 0);
      if (s.payment_status === "paid") {
        paidCents += amt;
        feeCents += Math.round(amt * 0.029 + 30);
        paidCount += 1;
        paidCountByPlay[pKey] = (paidCountByPlay[pKey] || 0) + 1;
        byPlay[cat] = Number(((byPlay[cat] || 0) + amt / 100).toFixed(2));
        if (recentPaid.length < 25) {
          recentPaid.push({
            rail: "stripe",
            product: cat,
            sku: s.metadata?.sku || s.metadata?.tier || "checkout",
            amount_usd: Number((amt / 100).toFixed(2)),
            currency: String(s.currency || "usd").toUpperCase(),
            status: s.payment_status,
            ref: redactId(s.id),
            target: s.metadata?.target_domain || (s.metadata?.spec_url ? "OpenAPI Spec" : "-"),
            created_at: s.created ? new Date(s.created * 1000).toISOString() : null,
          });
        }
        continue;
      }
      const isStaleOpen = s.status === "open" && Number(s.created || 0) > 0 && (nowSec - Number(s.created)) >= 1800;
      if (!tdom.startsWith("test.") && (s.status === "expired" || isStaleOpen)) {
        abandonedCount += 1;
        abandonedByPlay[pKey] = (abandonedByPlay[pKey] || 0) + 1;
        if (recentAbandoned.length < 20) {
          recentAbandoned.push({
            product: cat,
            tier: s.metadata?.tier || s.metadata?.sku || "checkout",
            amount_usd: Number((amt / 100).toFixed(2)),
            status: s.status || "expired",
            buyer_masked: maskEmail(s.customer_details?.email || s.customer_email || ""),
            target: s.metadata?.target_domain || (s.metadata?.spec_url ? "OpenAPI Spec" : "-"),
            ref: redactId(s.id),
            created_at: s.created ? new Date(s.created * 1000).toISOString() : null,
          });
        }
      }
    }
  }

  const paidUsd = Number((paidCents / 100).toFixed(2));
  const feesUsd = Number((feeCents / 100).toFixed(2));
  return {
    configured: true,
    paid_usd: paidUsd,
    stripe_fees_usd: feesUsd,
    net_stripe_usd: Number((paidUsd - feesUsd).toFixed(2)),
    available_usd: Number((availableCents / 100).toFixed(2)),
    pending_usd: Number((pendingCents / 100).toFixed(2)),
    paid_count: paidCount,
    abandoned_count: abandonedCount,
    by_play: byPlay,
    paid_count_by_play: paidCountByPlay,
    checkout_clicks_by_play: clicksByPlay,
    abandoned_by_play: abandonedByPlay,
    recent_paid: recentPaid,
    recent_abandoned: recentAbandoned,
  };
}

async function fetchCloudflareAnalytics(env) {
  const token = cleanSecret(env?.CF_ANALYTICS_TOKEN || env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN);
  const acc = cleanSecret(env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID);
  if (!token || !acc) return { configured: false, by_script: {} };

  try {
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
    const query = `query ($acc: String!, $since: Date!) {
      viewer {
        accounts(filter: { accountTag: $acc }) {
          workersInvocationsAdaptive(limit: 100, filter: { date_geq: $since }) {
            sum { requests }
            dimensions { scriptName }
          }
        }
      }
    }`;
    const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "KuroxDashboard/1.0" },
      body: JSON.stringify({ query, variables: { acc, since } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { configured: true, ok: false, status: r.status, by_script: {} };
    const j = await r.json().catch(() => ({}));
    const groups = j?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
    const byScript = {};
    for (const g of groups) {
      const name = g?.dimensions?.scriptName;
      if (name) byScript[name] = (byScript[name] || 0) + Number(g?.sum?.requests || 0);
    }
    return { configured: true, ok: true, since, by_script: byScript };
  } catch {
    return { configured: true, ok: false, by_script: {} };
  }
}

async function fetchOnChainBalances() {
  const wallet = cleanSecret(MERCHANT_BASE).toLowerCase().replace(/^0x/, "").padStart(64, "0");
  let baseUsdc = 0;
  let baseOk = false;
  for (const rpc of BASE_RPCS) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "KuroxDashboard/1.0" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: BASE_USDC, data: `0x70a08231${wallet}` }, "latest"] }),
        signal: AbortSignal.timeout(5000),
      });
      const j = await r.json().catch(() => ({}));
      if (j.result) {
        baseUsdc = Number((Number(BigInt(j.result)) / 1e6).toFixed(6));
        baseOk = true;
        break;
      }
    } catch {}
  }

  let solUsdc = 0;
  let solOk = false;
  let recentSolanaSigs = [];
  for (const sRpc of SOLANA_RPCS) {
    try {
      const balR = await fetch(sRpc, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "KuroxDashboard/1.0" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [MERCHANT_SOLANA_ATA, { encoding: "base64" }] }),
        signal: AbortSignal.timeout(7000),
      });
      const bj = await balR.json().catch(() => ({}));
      const b64 = bj?.result?.value?.data?.[0];
      if (b64) {
        const raw = atob(b64);
        if (raw.length >= 72) {
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
          const amountAtomic = new DataView(bytes.buffer).getBigUint64(64, true);
          solUsdc = Number((Number(amountAtomic) / 1e6).toFixed(6));
          solOk = true;
          break;
        }
      }
    } catch {}
  }

  try {
    const sigR = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "KuroxDashboard/1.0" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "getSignaturesForAddress", params: [MERCHANT_SOLANA_ATA, { limit: 10 }] }),
      signal: AbortSignal.timeout(5000),
    });
    const sj = await sigR.json().catch(() => ({}));
    if (Array.isArray(sj?.result)) {
      recentSolanaSigs = sj.result.map((x) => ({
        rail: "solana-usdc",
        product: "x402 Settlement (ATA)",
        sku: x.err ? "failed" : "confirmed",
        amount_usd: null,
        currency: "USDC",
        status: x.err ? "err" : (x.confirmationStatus || "finalized"),
        ref: redactId(x.signature),
        target: MERCHANT_SOLANA_ATA.slice(0, 8) + "...",
        created_at: x.blockTime ? new Date(x.blockTime * 1000).toISOString() : null,
      }));
    }
  } catch {}

  return {
    base: { ok: baseOk, address: MERCHANT_BASE, usdc: baseUsdc },
    solana: { ok: solOk, ata: MERCHANT_SOLANA_ATA, usdc: solUsdc, recent_sigs: recentSolanaSigs },
    total_usdc: Number((baseUsdc + solUsdc).toFixed(6)),
  };
}

async function fetchApifyTelemetry(apifyTokenRaw) {
  const tok = cleanSecret(apifyTokenRaw);
  if (!tok) return { configured: false, actors: [], total_runs: 0 };
  try {
    const hdr = { Authorization: `Bearer ${tok}` };
    const [actsR, limR] = await Promise.all([
      fetch("https://api.apify.com/v2/acts?my=true&limit=50", { headers: hdr, signal: AbortSignal.timeout(6000) }),
      fetch("https://api.apify.com/v2/users/me/limits", { headers: hdr, signal: AbortSignal.timeout(6000) }),
    ]);
    const actsJ = actsR.ok ? await actsR.json().catch(() => ({})) : {};
    const limJ = limR.ok ? await limR.json().catch(() => ({})) : {};
    const items = (actsJ?.data?.items || []).map((a) => ({
      name: a.name,
      runs: Number(a.stats?.totalRuns || 0),
      url: `https://apify.com/kuroxreal/${a.name}`,
    }));
    const totalRuns = items.reduce((s, x) => s + x.runs, 0);
    return {
      configured: true,
      total_actors: items.length,
      total_runs: totalRuns,
      monthly_usage_usd: Number(limJ?.data?.current?.monthlyUsageUsd || 0),
      monthly_limit_usd: Number(limJ?.data?.limits?.maxMonthlyUsageUsd || 5),
      actors: items,
    };
  } catch {
    return { configured: true, actors: [], total_runs: 0 };
  }
}

async function fetchOutreachTelemetry(repoSlug = "ak10082247-max/action2mcp") {
  const files = [
    { key: "action2mcp", playKey: "action2mcp", label: "Action2MCP (Hold Dec 11)", path: "data/contacted_gpts.json", worker: "action2mcp", playName: "Action2MCP", defaultCap: null, defaultCutoff: "2026-12-12" },
    { key: "site_rescue", playKey: "play_a_local", label: "Play A: SiteRescue", path: "data/site_rescue_state.json", worker: "site-rescue", playName: "Play A: SiteRescue", defaultCap: 200, defaultCutoff: null },
    { key: "ecom_fix", playKey: "play_b_ecom", label: "Play B: StoreFix", path: "data/ecom_fix_state.json", worker: "ecom-fix", playName: "Play B: StoreFix", defaultCap: 200, defaultCutoff: null },
    { key: "agency_overflow", playKey: "play_c_agency", label: "Play C: Agency Overflow", path: "data/agency_overflow_state.json", worker: "site-rescue", playName: "Play C: Agency Overflow", defaultCap: 200, defaultCutoff: null },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const out = {};
  await Promise.all(
    files.map(async (f) => {
      try {
        const cacheBuster = Math.floor(Date.now() / 15000);
        const r = await fetch(`https://raw.githubusercontent.com/${repoSlug}/main/${f.path}?t=${cacheBuster}`, {
          headers: { "User-Agent": "KuroxDashboard/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) {
          out[f.key] = { play_key: f.playKey, label: f.label, emails_total: 0, clean_delivered: 0, known_bounces: 0, active_sent: 0, active_bounces: 0, bounce_rate_pct: 0, emails_today: 0, daily_cap: 20, stop_loss_cap: f.defaultCap, replied_count: 0, status: "unknown", updated_at: null, active: true };
          return;
        }
        const j = await r.json().catch(() => ({}));
        const hist = Array.isArray(j.history) ? j.history : [];
        const totalSent = hist.length || (j.contacted_emails || []).length;
        const knownBounces = Array.isArray(j.bounced_emails) ? j.bounced_emails.length : 0;
        const cleanDelivered = Math.max(0, totalSent - knownBounces);
        const resetAt = String(j.bounce_reset_at || "").trim();
        const activeSent = resetAt ? hist.filter((h) => String(h.sent_date || "") >= resetAt).length : totalSent;
        const activeBounces = resetAt && Array.isArray(j.post_fix_bounced_emails) ? j.post_fix_bounced_emails.length : knownBounces;
        const bounceRate = activeSent > 0 ? Number(((activeBounces / activeSent) * 100).toFixed(1)) : 0;
        const repliedCount = Array.isArray(j.replied_emails) ? j.replied_emails.length : 0;
        const sentToday = hist.filter((h) => String(h.sent_date || "").startsWith(today)).length;
        const stopCap = j.stop_loss_cap ?? f.defaultCap;
        const pausedReason = String(j.paused_reason || "").trim();
        let status = "active";
        if (pausedReason) status = "paused";
        else if (activeSent >= 10 && bounceRate > 5.0) status = "bounce_alert";
        else if (stopCap && cleanDelivered >= stopCap && Number(j.paid_sales || 0) === 0 && repliedCount < 2) status = "stop_loss_200";
        else if (f.defaultCutoff) status = "hold_dec11";

        out[f.key] = {
          play_key: f.playKey,
          label: f.label,
          worker: f.worker,
          play_name: f.playName,
          emails_total: totalSent,
          known_bounces: knownBounces,
          active_sent: activeSent,
          active_bounces: activeBounces,
          clean_delivered: cleanDelivered,
          bounce_rate_pct: bounceRate,
          emails_today: sentToday,
          daily_cap: Number(j.daily_cap ?? 20),
          stop_loss_cap: stopCap,
          cutoff_date: j.cutoff_date || f.defaultCutoff,
          replied_count: repliedCount,
          paid_sales: Number(j.paid_sales || 0),
          paused_reason: pausedReason,
          status,
          updated_at: j.updated_at || null,
          active: !pausedReason,
        };
      } catch {
        out[f.key] = { play_key: f.playKey, label: f.label, emails_total: 0, clean_delivered: 0, known_bounces: 0, active_sent: 0, active_bounces: 0, bounce_rate_pct: 0, emails_today: 0, daily_cap: 20, stop_loss_cap: f.defaultCap, replied_count: 0, status: "error", updated_at: null, active: false };
      }
    }),
  );
  return out;
}

const SESSION_COOKIE_NAME = "kurox_dash_sess";

function parseCookies(req) {
  const hdr = req.headers.get("cookie") || "";
  const out = {};
  for (const part of hdr.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

function getDashboardPassword(env) {
  return cleanSecret(env?.DASHBOARD_PASSWORD);
}

function getCookieSigningSecret(env) {
  const pw = getDashboardPassword(env);
  const kurox = cleanSecret(env?.KUROX_SIGNING_SECRET) || cleanSecret(env?.DASHBOARD_INGEST_TOKEN);
  return `${kurox}:${pw}`;
}

async function createSessionCookieHeader(env) {
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  const sig = await hmacSha256Hex(`kurox.${exp}`, getCookieSigningSecret(env));
  const val = `${exp}.${sig}`;
  return `${SESSION_COOKIE_NAME}=${val}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookieHeader() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function hasValidSessionCookie(req, env) {
  const pw = getDashboardPassword(env);
  if (!pw) return false;
  const raw = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!raw || !raw.includes(".")) return false;
  const dot = raw.indexOf(".");
  const expStr = raw.slice(0, dot);
  const sig = raw.slice(dot + 1).toLowerCase();
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacSha256Hex(`kurox.${exp}`, getCookieSigningSecret(env));
  return constantTimeEqual(sig, expected);
}

function hasValidBearerToken(req, env) {
  const ingestTok = cleanSecret(env?.DASHBOARD_INGEST_TOKEN);
  if (!ingestTok) return false;
  const authHdr = String(req.headers.get("authorization") || "").trim();
  const bearer = authHdr.toLowerCase().startsWith("bearer ") ? authHdr.slice(7).trim() : "";
  const altHdr = String(req.headers.get("x-kurox-ingest-token") || "").trim();
  const candidate = bearer || altHdr;
  return Boolean(candidate) && constantTimeEqual(candidate, ingestTok);
}

async function isAuthorizedApi(req, env) {
  if (await hasValidSessionCookie(req, env)) return true;
  return hasValidBearerToken(req, env);
}

function renderLoginHtml(env, errorMsg = "") {
  const hasPw = Boolean(getDashboardPassword(env));
  const warnBanner = hasPw
    ? ""
    : `<div style="background:#451a03;border:1px solid #f59e0b;color:#fde68a;padding:0.75rem;border-radius:8px;margin-bottom:1rem;font-size:0.84rem;">Dashboard password is not yet configured on Worker secrets (<code>DASHBOARD_PASSWORD</code>). Login stays locked until set.</div>`;
  const errBanner = errorMsg
    ? `<div style="background:#450a0a;border:1px solid #f87171;color:#fecaca;padding:0.7rem;border-radius:8px;margin-bottom:1rem;font-size:0.85rem;">${escapeHtml(errorMsg)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Kurox Cockpit — Sign In</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#080a0f; color:#f8fafc; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1rem; }
    .box { width:100%; max-width:390px; background:#111622; border:1px solid #222c42; border-radius:14px; padding:1.6rem; box-shadow:0 20px 50px rgba(0,0,0,0.45); }
    h1 { margin:0 0 0.35rem; font-size:1.3rem; color:#38bdf8; }
    p { margin:0 0 1.2rem; color:#94a3b8; font-size:0.86rem; }
    label { display:block; font-size:0.78rem; color:#cbd5e1; margin-bottom:0.4rem; text-transform:uppercase; font-weight:700; }
    input[type="password"] { width:100%; padding:0.7rem 0.85rem; border-radius:8px; border:1px solid #334155; background:#090d16; color:#f8fafc; font-size:0.95rem; margin-bottom:1rem; }
    button { width:100%; padding:0.75rem; border:0; border-radius:8px; background:#0284c7; color:#fff; font-weight:700; font-size:0.95rem; cursor:pointer; }
    button:hover { background:#0369a1; }
    code { background:#06080d; padding:0.12rem 0.3rem; border-radius:4px; color:#38bdf8; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Kurox Cockpit Login</h1>
    <p>Private revenue, P&amp;L, and outreach telemetry.</p>
    ${warnBanner}
    ${errBanner}
    <form method="POST" action="/login">
      <label for="pw">Dashboard Password</label>
      <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus />
      <button type="submit">Unlock Cockpit</button>
    </form>
  </div>
</body>
</html>`;
}

async function readKvPlayBundle(env, playKey) {
  const kv = env?.FUNNEL_KV;
  const empty = {
    unique_clicks: 0,
    free_previews_or_zips: 0,
    abandoned_checkouts: 0,
    paid_sales: 0,
    gross_cents: 0,
    emails_sent: 0,
    emails_bounced: 0,
    pause: null,
    ingest: null,
  };
  if (!kv || typeof kv.get !== "function") return empty;
  try {
    const keys = [
      `metric:${playKey}:unique_clicks`,
      `metric:${playKey}:free_previews_or_zips`,
      `metric:${playKey}:abandoned_checkouts`,
      `metric:${playKey}:paid_sales`,
      `metric:${playKey}:gross_cents`,
      `metric:${playKey}:emails_sent`,
      `metric:${playKey}:emails_bounced`,
      `play_pause:${playKey}`,
      `ingest:${playKey}`,
    ];
    const vals = await Promise.all(keys.map((k) => kv.get(k)));
    let pause = null;
    let ingest = null;
    try { if (vals[7]) pause = JSON.parse(vals[7]); } catch {}
    try { if (vals[8]) ingest = JSON.parse(vals[8]); } catch {}
    return {
      unique_clicks: Number(vals[0] || 0) || 0,
      free_previews_or_zips: Number(vals[1] || 0) || 0,
      abandoned_checkouts: Number(vals[2] || 0) || 0,
      paid_sales: Number(vals[3] || 0) || 0,
      gross_cents: Number(vals[4] || 0) || 0,
      emails_sent: Number(vals[5] || 0) || 0,
      emails_bounced: Number(vals[6] || 0) || 0,
      pause,
      ingest,
    };
  } catch {
    return empty;
  }
}

async function listKvAlerts(env, dueOnly = true) {
  const kv = env?.FUNNEL_KV;
  if (!kv || typeof kv.list !== "function" || typeof kv.get !== "function") return [];
  try {
    const listed = await kv.list({ prefix: "alert:", limit: 50 });
    const nowMs = Date.now();
    const alerts = [];
    for (const entry of listed.keys || []) {
      const raw = await kv.get(entry.name);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        obj.id = entry.name;
        const dueMs = Date.parse(obj.due_at || obj.created_at || 0);
        if (!dueOnly || !Number.isFinite(dueMs) || dueMs <= nowMs) {
          alerts.push(obj);
        }
      } catch {}
    }
    alerts.sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));
    return alerts;
  } catch {
    return [];
  }
}

async function getPlayStatusMap(env) {
  const kv = env?.FUNNEL_KV;
  const targets = ["play_a_local", "play_b_ecom", "play_c_agency", "action2mcp"];
  const plays = {};
  await Promise.all(
    targets.map(async (pk) => {
      let pause = null;
      let ingest = null;
      if (kv && typeof kv.get === "function") {
        try {
          const [pRaw, iRaw] = await Promise.all([kv.get(`play_pause:${pk}`), kv.get(`ingest:${pk}`)]);
          if (pRaw) pause = JSON.parse(pRaw);
          if (iRaw) ingest = JSON.parse(iRaw);
        } catch {}
      }
      plays[pk] = {
        paused: Boolean(pause?.paused),
        reason: String(pause?.reason || ""),
        bounce_rate_pct: Number(pause?.bounce_rate_pct ?? ingest?.bounce_rate_pct ?? 0),
        active_sent: Number(pause?.active_sent ?? ingest?.post_fix_sent ?? ingest?.emails_sent ?? 0),
        active_bounced: Number(pause?.active_bounced ?? ingest?.post_fix_bounced ?? ingest?.emails_bounced ?? 0),
        updated_at: pause?.updated_at || ingest?.updated_at || null,
      };
    }),
  );
  return plays;
}

async function handleClickRedirect(req, url, env, cors) {
  const play = normalizePlayKey(url.searchParams.get("play") || "action2mcp");
  const leadHash = url.searchParams.get("id") || url.searchParams.get("lead") || "";
  const rawTo = (url.searchParams.get("to") || url.searchParams.get("url") || "").trim();
  let dest = DEFAULT_PLAY_REDIRECTS[play] || DEFAULT_PLAY_REDIRECTS.action2mcp;
  if (rawTo) {
    let parsed;
    try {
      parsed = new URL(rawTo);
    } catch {
      return jsonResp({ ok: false, error: "Blocked malformed redirect destination" }, 400, cors);
    }
    if (parsed.protocol !== "https:" || !ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())) {
      return jsonResp({ ok: false, error: "Blocked untrusted redirect destination" }, 400, cors);
    }
    dest = parsed.toString();
  }
  if (!leadHash.toLowerCase().startsWith("test_")) {
    await recordUniqueFunnelClick(env, play, leadHash);
  }
  return new Response(null, {
    status: 302,
    headers: {
      ...cors,
      Location: dest,
      "Cache-Control": "no-store",
    },
  });
}

async function handleStripeWebhook(req, env, cors) {
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405, cors);
  const webhookSecret = cleanSecret(env?.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret) return jsonResp({ ok: false, error: "STRIPE_WEBHOOK_SECRET not configured" }, 503, cors);
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";
  const verified = await verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret, 300);
  if (!verified.ok) return jsonResp({ ok: false, error: verified.error }, 401, cors);

  let evt;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return jsonResp({ ok: false, error: "Invalid JSON payload" }, 400, cors);
  }
  const eventId = String(evt?.id || "").trim();
  const kv = env?.FUNNEL_KV;
  if (eventId && kv && typeof kv.get === "function" && typeof kv.put === "function") {
    const seen = await kv.get(`webhook_seen:${eventId}`);
    if (seen) return jsonResp({ ok: true, duplicate: true, event_id: eventId }, 200, cors);
    await kv.put(`webhook_seen:${eventId}`, "1", { expirationTtl: 90 * 86400 });
  }

  const session = evt?.data?.object || {};
  const tdom = String(session.metadata?.target_domain || "").toLowerCase();
  if (tdom.startsWith("test.")) {
    return jsonResp({ ok: true, skipped: "synthetic_test_domain" }, 200, cors);
  }

  const playKey = classifyStripePlayKey(session);
  const playLabel = classifyStripeSession(session);
  const tier = String(session.metadata?.tier || session.metadata?.sku || "checkout");
  const amountUsd = Number((Number(session.amount_total || 0) / 100).toFixed(2));
  const custEmail = String(session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  const emailHash = custEmail ? await sha256Hex(custEmail) : "";
  const nowIso = new Date().toISOString();

  if (evt?.type === "checkout.session.completed") {
    await incrementFunnelCounter(env, playKey, "paid_sales", 1);
    await incrementFunnelCounter(env, playKey, "gross_cents", Number(session.amount_total || 0));

    if (kv && typeof kv.list === "function" && emailHash) {
      try {
        await kv.put(`paid_email:${emailHash}`, nowIso, { expirationTtl: 90 * 86400 });
        const existing = await kv.list({ prefix: "alert:", limit: 50 });
        for (const item of existing.keys || []) {
          const val = await kv.get(item.name);
          if (!val) continue;
          const parsed = JSON.parse(val);
          if (parsed.kind === "abandoned_recovery" && parsed.email_hash === emailHash.slice(0, 24)) {
            await kv.delete(item.name);
          }
        }
      } catch {}
    }

    const alertObj = {
      kind: "sale_confirmed",
      play: playKey,
      play_label: playLabel,
      tier,
      amount_usd: amountUsd,
      target_domain: session.metadata?.target_domain || (session.metadata?.spec_url ? "OpenAPI Spec" : "-"),
      due_at: nowIso,
      created_at: nowIso,
      subject: `$$$ SALE CONFIRMED: ${playLabel} ($${amountUsd.toFixed(2)})`,
      session_ref: redactId(session.id),
    };
    if (kv && typeof kv.put === "function") {
      const alertKey = `alert:${Date.now()}:${eventId || crypto.randomUUID()}`;
      await kv.put(alertKey, JSON.stringify(alertObj), { expirationTtl: 30 * 86400 });
    }
    const webhookAlertUrl = cleanSecret(env?.SALE_ALERT_WEBHOOK_URL);
    if (webhookAlertUrl) {
      try {
        await fetch(webhookAlertUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `${alertObj.subject} | target=${alertObj.target_domain} | ref=${alertObj.session_ref}`, ...alertObj }),
          signal: AbortSignal.timeout(4000),
        });
      } catch {}
    }
    return jsonResp({ ok: true, handled: "checkout.session.completed", play: playKey, queued_alert: true }, 200, cors);
  }

  if (evt?.type === "checkout.session.expired") {
    await incrementFunnelCounter(env, playKey, "abandoned_checkouts", 1);
    let queuedRecovery = false;
    if (custEmail && custEmail.includes("@") && kv && typeof kv.get === "function" && typeof kv.put === "function") {
      const alreadySent = await kv.get(`abandoned_sent:${emailHash}`);
      const alreadyPaid = await kv.get(`paid_email:${emailHash}`);
      if (!alreadySent && !alreadyPaid) {
        await kv.put(`abandoned_sent:${emailHash}`, nowIso, { expirationTtl: 90 * 86400 });
        const dueMs = Date.now() + 30 * 60 * 1000;
        const recoveryObj = {
          kind: "abandoned_recovery",
          play: playKey,
          play_label: playLabel,
          tier,
          amount_usd: amountUsd,
          target_domain: session.metadata?.target_domain || "-",
          recipient_email: custEmail,
          email_hash: emailHash.slice(0, 24),
          due_at: new Date(dueMs).toISOString(),
          created_at: nowIso,
          checkout_url: DEFAULT_PLAY_REDIRECTS[playKey] || DEFAULT_PLAY_REDIRECTS.action2mcp,
          session_ref: redactId(session.id),
        };
        const recoveryKey = `alert:${dueMs}:${eventId || crypto.randomUUID()}`;
        await kv.put(recoveryKey, JSON.stringify(recoveryObj), { expirationTtl: 14 * 86400 });
        queuedRecovery = true;
      }
    }
    return jsonResp({ ok: true, handled: "checkout.session.expired", play: playKey, queued_recovery: queuedRecovery }, 200, cors);
  }

  return jsonResp({ ok: true, ignored_event: evt?.type || "unknown" }, 200, cors);
}

async function handleIngestPost(req, env, cors) {
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: "Invalid JSON body" }, 400, cors);
  }
  const play = normalizePlayKey(body.play);
  if (!play || play === "other") return jsonResp({ ok: false, error: "Valid 'play' required" }, 400, cors);
  const kv = env?.FUNNEL_KV;
  const nowIso = new Date().toISOString();
  const activeSent = Number(body.post_fix_sent ?? body.emails_sent ?? 0);
  const activeBounced = Number(body.post_fix_bounced ?? body.emails_bounced ?? 0);
  const computedRate = activeSent > 0 ? Number(((activeBounced / activeSent) * 100).toFixed(1)) : Number(body.bounce_rate_pct || 0);
  const highBounce = Boolean(body.paused_high_bounce) || (activeSent >= 10 && computedRate > 5.0);

  if (kv && typeof kv.put === "function") {
    const snap = {
      play,
      emails_sent: Number(body.emails_sent || 0),
      emails_bounced: Number(body.emails_bounced || 0),
      post_fix_sent: activeSent,
      post_fix_bounced: activeBounced,
      bounce_rate_pct: computedRate,
      emails_today: Number(body.emails_today || 0),
      daily_cap: Number(body.daily_cap || 20),
      stop_loss_cap: body.stop_loss_cap ?? null,
      replied_count: Number(body.replied_count || 0),
      source: String(body.source || "cron"),
      updated_at: nowIso,
    };
    await kv.put(`ingest:${play}`, JSON.stringify(snap));
    if (Number.isFinite(Number(body.emails_sent))) await kv.put(`metric:${play}:emails_sent`, String(Number(body.emails_sent)));
    if (Number.isFinite(Number(body.emails_bounced))) await kv.put(`metric:${play}:emails_bounced`, String(Number(body.emails_bounced)));
    if (highBounce) {
      await kv.put(`play_pause:${play}`, JSON.stringify({
        paused: true,
        reason: "PAUSED_HIGH_BOUNCE",
        bounce_rate_pct: computedRate,
        active_sent: activeSent,
        active_bounced: activeBounced,
        updated_at: nowIso,
      }));
    } else if (body.clear_pause === true && typeof kv.delete === "function") {
      await kv.delete(`play_pause:${play}`);
    }
  }
  return jsonResp({
    ok: true,
    play,
    paused_high_bounce: highBounce,
    pause_reason: highBounce ? "PAUSED_HIGH_BOUNCE" : "",
    bounce_rate_pct: computedRate,
  }, 200, cors);
}

async function pingFleetHealth(env) {
  return await Promise.all(
    FLEET_ENDPOINTS.map(async (ep) => {
      const t0 = Date.now();
      try {
        const svc = ep.binding ? env?.[ep.binding] : null;
        const r = svc
          ? await svc.fetch(new Request(ep.url), { signal: AbortSignal.timeout(4000) })
          : await fetch(ep.url, { headers: { "User-Agent": "KuroxDashboard/1.0" }, signal: AbortSignal.timeout(4000) });
        return { id: ep.id, name: ep.name, url: ep.url, ok: r.ok, status: r.status, ms: Date.now() - t0 };
      } catch {
        return { id: ep.id, name: ep.name, url: ep.url, ok: false, status: 0, ms: Date.now() - t0 };
      }
    }),
  );
}

export async function gatherLiveDashboardData(env) {
  const repoSlug = cleanSecret(env?.GITHUB_REPO) || "ak10082247-max/action2mcp";
  const [stripe, chain, apify, outreach, fleet, cfAnalytics, kvBundles, allAlerts] = await Promise.all([
    fetchStripeLive(env?.STRIPE_SECRET_KEY),
    fetchOnChainBalances(),
    fetchApifyTelemetry(env?.APIFY_TOKEN),
    fetchOutreachTelemetry(repoSlug),
    pingFleetHealth(env),
    fetchCloudflareAnalytics(env),
    Promise.all(SIX_PLAY_CATALOG.map((c) => readKvPlayBundle(env, c.key))),
    listKvAlerts(env, false),
  ]);

  const kvByKey = {};
  SIX_PLAY_CATALOG.forEach((c, idx) => {
    kvByKey[c.key] = kvBundles[idx];
  });

  for (const item of Object.values(outreach)) {
    item.cf_requests_7d = cfAnalytics?.by_script?.[item.worker] ?? null;
    item.stripe_clicks = stripe?.checkout_clicks_by_play?.[item.play_name] ?? 0;
    const kb = kvByKey[item.play_key];
    if (kb) {
      item.unique_clicks = kb.unique_clicks;
      item.free_previews_or_zips = kb.free_previews_or_zips;
      item.abandoned_checkouts = Math.max(Number(stripe?.abandoned_by_play?.[item.play_key] || 0), kb.abandoned_checkouts);
      if (kb.pause?.paused && !item.paused_reason) {
        item.paused_reason = kb.pause.reason || "PAUSED_HIGH_BOUNCE";
        item.status = "paused";
        item.active = false;
      }
    }
  }

  const dec11TargetMs = Date.parse("2026-12-11T23:59:59Z");
  const daysLeftDec11 = Math.max(0, Math.ceil((dec11TargetMs - Date.now()) / 86400000));
  const todayStr = new Date().toISOString().slice(0, 10);

  const matrix = SIX_PLAY_CATALOG.map((c) => {
    const o = c.outreachKey ? outreach[c.outreachKey] : null;
    const kb = kvByKey[c.key] || {};
    const ing = kb.ingest || {};
    const emailsSent = Math.max(Number(o?.emails_total || 0), Number(ing.emails_sent || 0), Number(kb.emails_sent || 0));
    const emailsBounced = Math.max(Number(o?.known_bounces || 0), Number(ing.emails_bounced || 0), Number(kb.emails_bounced || 0));
    const cleanDelivered = Math.max(0, emailsSent - emailsBounced);
    const activeSent = Math.max(Number(o?.active_sent || 0), Number(ing.post_fix_sent ?? ing.emails_sent ?? 0));
    const activeBounced = Math.max(Number(o?.active_bounces || 0), Number(ing.post_fix_bounced ?? ing.emails_bounced ?? 0));
    const bounceRatePct = kb.pause?.bounce_rate_pct !== undefined
      ? Number(kb.pause.bounce_rate_pct)
      : (activeSent > 0 ? Number(((activeBounced / activeSent) * 100).toFixed(1)) : Number(o?.bounce_rate_pct || 0));
    const repliedCount = Math.max(Number(o?.replied_count || 0), Number(ing.replied_count || 0));
    const abandonedCheckouts = Math.max(Number(stripe?.abandoned_by_play?.[c.key] || 0), Number(kb.abandoned_checkouts || 0));
    const paidSales = Math.max(Number(stripe?.paid_count_by_play?.[c.key] || 0), Number(kb.paid_sales || 0));
    const stripeRev = c.stripeLabel ? Number(stripe?.by_play?.[c.stripeLabel] || 0) : 0;
    const revenueUsd = Number(Math.max(stripeRev, Number(kb.gross_cents || 0) / 100).toFixed(2));
    const stopLossCap = o?.stop_loss_cap ?? c.defaultCap;
    const cutoffDate = o?.cutoff_date || c.defaultCutoff;
    const pausedHighBounce = Boolean(kb.pause?.paused || String(o?.paused_reason || "").toUpperCase().includes("BOUNCE") || (activeSent >= 10 && bounceRatePct > 5.0));

    const verdict = computeStopLossVerdict({
      paid_sales: paidSales,
      clean_delivered: cleanDelivered,
      active_sent: activeSent,
      bounce_rate_pct: bounceRatePct,
      stop_loss_cap: stopLossCap,
      replied_count: repliedCount,
      unique_clicks: Number(kb.unique_clicks || 0),
      abandoned_checkouts: abandonedCheckouts,
      paused_high_bounce: pausedHighBounce,
      cutoff_date: cutoffDate,
      today_str: todayStr,
    });

    return {
      key: c.key,
      name: c.name,
      kind: c.kind,
      emails_sent: emailsSent,
      clean_delivered: cleanDelivered,
      emails_bounced: emailsBounced,
      bounce_rate_pct: bounceRatePct,
      unique_clicks: Number(kb.unique_clicks || 0),
      free_previews_or_zips: Number(kb.free_previews_or_zips || 0),
      abandoned_checkouts: abandonedCheckouts,
      paid_sales: paidSales,
      revenue_usd: revenueUsd,
      replied_count: repliedCount,
      stop_loss_cap: stopLossCap,
      cutoff_date: cutoffDate,
      days_left_dec11: c.key === "action2mcp" ? daysLeftDec11 : null,
      paused_high_bounce: pausedHighBounce,
      paused_reason: kb.pause?.reason || o?.paused_reason || "",
      verdict,
    };
  });

  const totalTrackedUsd = Number((stripe.paid_usd + chain.total_usdc).toFixed(4));
  const monthlyFixedCostUsd = Number(cleanSecret(env?.MONTHLY_FIXED_COST_USD) || 0) || 0;
  const apifyComputeUsd = Number((apify.monthly_usage_usd || 0).toFixed(4));
  const stripeFeesUsd = Number(stripe.stripe_fees_usd || 0);
  const netProfitUsd = Number((totalTrackedUsd - stripeFeesUsd - apifyComputeUsd - monthlyFixedCostUsd).toFixed(2));

  const pnl = {
    gross_revenue_usd: Number(totalTrackedUsd.toFixed(2)),
    gross_stripe_usd: stripe.paid_usd,
    onchain_usdc: chain.total_usdc,
    stripe_fees_usd: stripeFeesUsd,
    apify_compute_usd: Number(apifyComputeUsd.toFixed(2)),
    monthly_fixed_cost_usd: Number(monthlyFixedCostUsd.toFixed(2)),
    net_profit_usd: netProfitUsd,
  };

  return {
    generated_at: new Date().toISOString(),
    totals: {
      tracked_revenue_usd: totalTrackedUsd,
      stripe_paid_usd: stripe.paid_usd,
      stripe_available_usd: stripe.available_usd,
      stripe_pending_usd: stripe.pending_usd,
      onchain_usdc: chain.total_usdc,
      paid_orders: stripe.paid_count,
      abandoned_orders: stripe.abandoned_count,
      pending_alerts: allAlerts.length,
    },
    pnl,
    matrix,
    stripe,
    chain,
    apify,
    cf_analytics: cfAnalytics,
    outreach,
    fleet,
  };
}

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Kurox Live Revenue &amp; Operations Cockpit</title>
  <style>
    :root { color-scheme: dark; --bg:#080a0f; --panel:#111622; --border:#222c42; --cyan:#38bdf8; --green:#34d399; --amber:#fbbf24; --muted:#94a3b8; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:#f8fafc; display:flex; min-height:100vh; }
    nav { width:240px; flex-shrink:0; background:#0c1018; border-right:1px solid var(--border); padding:1.2rem 0.9rem; display:flex; flex-direction:column; gap:0.35rem; }
    .brand { font-size:1.15rem; font-weight:800; color:var(--cyan); margin-bottom:0.8rem; padding:0 0.5rem; }
    .nav-btn { text-align:left; background:transparent; color:#cbd5e1; border:1px solid transparent; border-radius:8px; padding:0.62rem 0.75rem; font-weight:600; cursor:pointer; font-size:0.9rem; }
    .nav-btn:hover, .nav-btn.active { background:#162033; color:#fff; border-color:#2b3a55; }
    main { flex:1; padding:1.4rem 1.8rem 3rem; max-width:1200px; }
    @media(max-width:860px){ body{ flex-direction:column; } nav{ width:100%; flex-direction:row; overflow-x:auto; border-right:0; border-bottom:1px solid var(--border); } main{ padding:1rem; } }
    .topbar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.8rem; margin-bottom:1.25rem; }
    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:1rem; margin-bottom:1.25rem; }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:1.15rem; margin-bottom:1rem; }
    .kpi-label { font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); font-weight:700; }
    .kpi-val { font-size:2rem; font-weight:800; color:var(--green); margin-top:0.35rem; }
    .kpi-sub { font-size:0.8rem; color:var(--muted); margin-top:0.25rem; }
    .btn { background:#0284c7; color:#fff; border:0; border-radius:8px; padding:0.55rem 0.95rem; font-weight:700; cursor:pointer; text-decoration:none; display:inline-block; font-size:0.85rem; }
    .btn-green { background:#059669; }
    table { width:100%; border-collapse:collapse; font-size:0.86rem; }
    th, td { text-align:left; padding:0.6rem 0.5rem; border-bottom:1px solid #1e273a; }
    th { color:var(--muted); font-weight:600; font-size:0.78rem; text-transform:uppercase; }
    .pill { display:inline-block; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700; }
    .ok { background:#064e3b; color:#34d399; }
    .bad { background:#7f1d1d; color:#fca5a5; }
    .tab-pane { display:none; }
    .tab-pane.active { display:block; }
    code { background:#06080d; padding:0.15rem 0.35rem; border-radius:4px; color:var(--cyan); }
  </style>
</head>
<body>
  <nav>
    <div class="brand">Kurox Cockpit</div>
    <button class="nav-btn active" onclick="showTab('overview', this)">1. Live Money Tally</button>
    <button class="nav-btn" onclick="showTab('ledger', this)">2. Sales &amp; Chain Ledger</button>
    <button class="nav-btn" onclick="showTab('playa', this)">3. Play A: SiteRescue ($10)</button>
    <button class="nav-btn" onclick="showTab('playb', this)">4. Play B: StoreFix ($10)</button>
    <button class="nav-btn" onclick="showTab('action2mcp', this)">5. Action2MCP ($10)</button>
    <button class="nav-btn" onclick="showTab('fleet', this)">6. Apify &amp; Fleet Health</button>
  </nav>

  <main>
    <div class="topbar">
      <div>
        <h2 style="margin:0;">Live Revenue &amp; Product Operations</h2>
        <div id="lastUpdated" style="font-size:0.82rem;color:var(--muted);">Loading live data...</div>
      </div>
      <div style="display:flex;gap:0.6rem;align-items:center;">
        <label style="font-size:0.82rem;color:var(--muted);"><input id="autoRefresh" type="checkbox" checked /> Auto-refresh (20s)</label>
        <button class="btn" onclick="loadLive()">Refresh Now</button>
        <form method="POST" action="/logout" style="margin:0;"><button class="btn" style="background:#334155;" type="submit">Logout</button></form>
      </div>
    </div>

    <div id="tab-overview" class="tab-pane active">
      <div class="kpi-grid">
        <div class="card">
          <div class="kpi-label">Gross Tracked Revenue (Stripe + USDC)</div>
          <div class="kpi-val" id="kpiTotal">$0.00</div>
          <div class="kpi-sub" id="kpiOrders">0 paid | 0 abandoned checkouts</div>
        </div>
        <div class="card">
          <div class="kpi-label">Real Net P&amp;L (After Fees &amp; Compute)</div>
          <div class="kpi-val" id="kpiNetPnl">$0.00</div>
          <div class="kpi-sub" id="kpiPnlBreakdown">Fees: $0.00 | Apify: $0.00 | Fixed: $0.00</div>
        </div>
        <div class="card">
          <div class="kpi-label">Stripe Paid Checkout Volume</div>
          <div class="kpi-val" style="color:var(--cyan);" id="kpiStripePaid">$0.00</div>
          <div class="kpi-sub" id="kpiStripeBal">Avail: $0.00 | Pending: $0.00</div>
        </div>
        <div class="card">
          <div class="kpi-label">Base + Solana Treasury USDC</div>
          <div class="kpi-val" style="color:var(--amber);" id="kpiUsdc">$0.000</div>
          <div class="kpi-sub" id="kpiUsdcSplit">Base: $0 | Sol: $0</div>
        </div>
        <div class="card">
          <div class="kpi-label">Apify Store &amp; Pending Alerts</div>
          <div class="kpi-val" style="color:#c084fc;" id="kpiApifyRuns">0</div>
          <div class="kpi-sub" id="kpiApifyActors">kuroxreal public PPE actors</div>
        </div>
      </div>

      <div class="card">
        <strong>Stop-Loss Decision Matrix &amp; Middle-of-Funnel Scorecard (All 6 Plays)</strong>
        <div style="overflow-x:auto;margin-top:0.65rem;">
          <table>
            <thead>
              <tr>
                <th>Play</th>
                <th>Progress / Stop-Loss</th>
                <th>Sent (Bounced %)</th>
                <th>Unique Clicks</th>
                <th>Free Previews / ZIPs</th>
                <th>Abandoned Checkouts</th>
                <th>Paid Sales</th>
                <th>Gross Rev</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody id="matrixRows"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <strong>Revenue by Product / Play (Stripe Checkouts)</strong>
        <div class="kpi-grid" id="playCards" style="margin-top:0.8rem;margin-bottom:0;"></div>
      </div>

      <div class="card">
        <strong>Daily Outreach Cap &amp; Worker Telemetry (20/day Cap | &lt;5% Post-Fix Bounce Gate)</strong>
        <table><thead><tr><th>Play</th><th>Delivered / Stop-Loss</th><th>Today / Cap</th><th>Bounces</th><th>Replies</th><th>7d Worker Reqs</th><th>Stripe Clicks</th><th>Gate Status</th></tr></thead><tbody id="outreachRows"></tbody></table>
      </div>
    </div>

    <div id="tab-ledger" class="tab-pane">
      <div class="card">
        <strong>Live Redacted Transaction &amp; Solana ATA Ledger</strong>
        <table><thead><tr><th>Timestamp</th><th>Rail</th><th>Product</th><th>Amount</th><th>Status</th><th>Ref</th></tr></thead><tbody id="ledgerRows"></tbody></table>
      </div>
      <div class="card">
        <strong>Abandoned Stripe Checkouts (Expired or Open &gt;30m — Masked PII)</strong>
        <table><thead><tr><th>Timestamp</th><th>Product</th><th>Tier</th><th>Amount</th><th>Buyer (Masked)</th><th>Target</th><th>Status</th></tr></thead><tbody id="abandonedRows"></tbody></table>
      </div>
    </div>

    <div id="tab-playa" class="tab-pane">
      <div class="card">
        <h3>Play A: Local Business Broken-Link &amp; SSL Rescue</h3>
        <p style="color:var(--muted);">Targets dental clinics, med-spas, solicitors &amp; agencies via Nominatim/Overpass -&gt; catches broken booking links &amp; SSL cliffs -&gt; sells <strong>$10 Deal</strong> (<s>$49</s>) Recovery Pack ZIP &amp; <strong>$29 Deal</strong> (<s>$149</s>) Priority Recovery.</p>
        <a class="btn btn-green" href="https://site-rescue.ak10082247.workers.dev" target="_blank">Open SiteRescue Storefront</a>
      </div>
    </div>

    <div id="tab-playb" class="tab-pane">
      <div class="card">
        <h3>Play B: Shopify &amp; WooCommerce Revenue-Leak Kit</h3>
        <p style="color:var(--muted);">Discovers active stores via Common Crawl &amp; live inventory APIs -&gt; detects invalid Google Shopping JSON-LD, 404 nav links &amp; March 2027 ScriptTags -&gt; sells <strong>$10 Deal</strong> (<s>$49</s>) Fix Bundle &amp; <strong>$25 Deal</strong> (<s>$79</s>) Pro Kit.</p>
        <a class="btn btn-green" href="https://ecom-fix.ak10082247.workers.dev" target="_blank">Open StoreFix Storefront</a>
      </div>
    </div>

    <div id="tab-action2mcp" class="tab-pane">
      <div class="card">
        <h3>Action2MCP: Free Cloudflare MCP ZIP + $10 Deal Hosted URL (was $25)</h3>
        <p style="color:var(--muted);">100% free OpenAPI-to-Cloudflare-MCP ZIP exporter + <strong>$10 Deal</strong> (<s>$25</s>) Hosted URL (Stripe + Coinbase CDP Bazaar x402) + Apify Pay-Per-Event Actor.</p>
        <div style="display:flex;gap:0.7rem;flex-wrap:wrap;">
          <a class="btn" href="https://action2mcp.ak10082247.workers.dev" target="_blank">Open Action2MCP</a>
          <a class="btn btn-green" href="https://apify.com/kuroxreal/action2mcp" target="_blank">Open Apify Actor</a>
        </div>
      </div>
    </div>

    <div id="tab-fleet" class="tab-pane">
      <div class="card">
        <strong>Live Worker &amp; Render Service Uptime</strong>
        <table><thead><tr><th>Service</th><th>Status</th><th>HTTP</th><th>Latency</th></tr></thead><tbody id="fleetRows"></tbody></table>
      </div>
      <div class="card">
        <strong>Apify kuroxreal Public Actors</strong>
        <table><thead><tr><th>Actor</th><th>Total Runs</th><th>Link</th></tr></thead><tbody id="apifyRows"></tbody></table>
      </div>
    </div>
  </main>

  <script>
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }
    function showTab(id, btn) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + id).classList.add('active');
      if (btn) btn.classList.add('active');
    }
    function verdictStyle(v) {
      if (v === 'SCALING') return 'background:#064e3b;color:#34d399;';
      if (v === 'KILL') return 'background:#7f1d1d;color:#fca5a5;';
      if (v === 'FIX DELIVERABILITY') return 'background:#78350f;color:#fde68a;';
      if (v === 'FIX TRUST/PRICE') return 'background:#581c87;color:#e9d5ff;';
      return 'background:#1e293b;color:#38bdf8;';
    }
    async function loadLive() {
      try {
        const res = await fetch('/api/live');
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/login';
          return;
        }
        const d = await res.json();
        document.getElementById('lastUpdated').textContent = 'Last live sync: ' + new Date(d.generated_at).toLocaleString();
        document.getElementById('kpiTotal').textContent = '$' + Number(d.totals.tracked_revenue_usd || 0).toFixed(2);
        document.getElementById('kpiOrders').textContent = (d.totals.paid_orders || 0) + ' paid | ' + (d.totals.abandoned_orders || 0) + ' abandoned checkouts';

        const netVal = Number(d.pnl?.net_profit_usd || 0);
        const netEl = document.getElementById('kpiNetPnl');
        netEl.textContent = (netVal < 0 ? '-$' : '$') + Math.abs(netVal).toFixed(2);
        netEl.style.color = netVal >= 0 ? 'var(--green)' : '#f87171';
        document.getElementById('kpiPnlBreakdown').textContent =
          'Fees: $' + Number(d.pnl?.stripe_fees_usd || 0).toFixed(2) +
          ' | Apify: $' + Number(d.pnl?.apify_compute_usd || 0).toFixed(2) +
          ' | Fixed: $' + Number(d.pnl?.monthly_fixed_cost_usd || 0).toFixed(2);

        document.getElementById('kpiStripePaid').textContent = '$' + Number(d.totals.stripe_paid_usd || 0).toFixed(2);
        document.getElementById('kpiStripeBal').textContent = 'Avail: $' + Number(d.totals.stripe_available_usd || 0).toFixed(2) + ' | Pending: $' + Number(d.totals.stripe_pending_usd || 0).toFixed(2);
        document.getElementById('kpiUsdc').textContent = '$' + Number(d.totals.onchain_usdc || 0).toFixed(3);
        document.getElementById('kpiUsdcSplit').textContent = 'Base: $' + d.chain.base.usdc.toFixed(3) + ' | Sol: $' + d.chain.solana.usdc.toFixed(3);
        document.getElementById('kpiApifyRuns').textContent = String(d.apify.total_runs || 0);
        document.getElementById('kpiApifyActors').textContent = (d.apify.total_actors || 0) + ' actors | ' + (d.totals.pending_alerts || 0) + ' queued alerts';

        document.getElementById('matrixRows').innerHTML = (d.matrix || []).map(m => {
          const capText = m.days_left_dec11 !== null
            ? (m.days_left_dec11 + 'd left (Dec 11)')
            : (m.stop_loss_cap ? (m.clean_delivered + ' / ' + m.stop_loss_cap) : (m.kind === 'x402_api' ? 'Always-on API' : String(m.clean_delivered)));
          return '<tr><td><strong>' + esc(m.name) + '</strong></td><td>' + esc(capText) + '</td><td>' + m.emails_sent + ' (' + m.emails_bounced + ' / ' + m.bounce_rate_pct + '%)</td><td>' + m.unique_clicks + '</td><td>' + m.free_previews_or_zips + '</td><td>' + m.abandoned_checkouts + '</td><td>' + m.paid_sales + '</td><td>$' + Number(m.revenue_usd || 0).toFixed(2) + '</td><td><span class="pill" style="' + verdictStyle(m.verdict) + '">' + esc(m.verdict) + '</span></td></tr>';
        }).join('');

        const pc = document.getElementById('playCards');
        pc.innerHTML = Object.entries(d.stripe.by_play || {}).map(([name, val]) =>
          '<div class="tier" style="background:#0b101b;border:1px solid #222c42;border-radius:10px;padding:0.85rem;"><div class="kpi-label">' + esc(name) + '</div><div style="font-size:1.4rem;font-weight:800;color:#34d399;margin-top:0.25rem;">$' + Number(val).toFixed(2) + '</div></div>'
        ).join('');

        document.getElementById('outreachRows').innerHTML = Object.values(d.outreach || {}).map(o => {
          const capLbl = o.stop_loss_cap ? (o.clean_delivered + ' / ' + o.stop_loss_cap) : (o.clean_delivered + ' (until Dec 11)');
          const bClass = (o.bounce_rate_pct > 5) ? 'bad' : 'ok';
          const sClass = (o.status === 'active' || o.status === 'hold_dec11') ? 'ok' : 'bad';
          const stLabel = o.paused_reason ? ('PAUSED (' + o.bounce_rate_pct + '% / ' + o.paused_reason + ')') : String(o.status || 'active').toUpperCase();
          return '<tr><td>' + esc(o.label) + '</td><td>' + esc(capLbl) + '</td><td>' + o.emails_today + ' / ' + (o.daily_cap || 20) + '</td><td><span class="pill ' + bClass + '">' + o.known_bounces + ' (' + o.bounce_rate_pct + '%)</span></td><td>' + (o.replied_count || 0) + '</td><td>' + (o.cf_requests_7d !== null && o.cf_requests_7d !== undefined ? o.cf_requests_7d : 'n/a') + '</td><td>' + (o.stripe_clicks || 0) + '</td><td><span class="pill ' + sClass + '" title="' + esc(o.paused_reason || '') + '">' + esc(stLabel) + '</span></td></tr>';
        }).join('');

        const combined = [...(d.stripe.recent_paid || []), ...(d.chain.solana.recent_sigs || [])];
        document.getElementById('ledgerRows').innerHTML = combined.length
          ? combined.map(x => '<tr><td>' + (x.created_at ? new Date(x.created_at).toLocaleString() : '-') + '</td><td><code>' + esc(x.rail) + '</code></td><td>' + esc(x.product) + '</td><td>' + (x.amount_usd !== null ? ('$' + Number(x.amount_usd).toFixed(2)) : 'ATA tx') + '</td><td><span class="pill ok">' + esc(x.status) + '</span></td><td><code>' + esc(x.ref) + '</code></td></tr>').join('')
          : '<tr><td colspan="6" style="color:var(--muted);">No paid transactions yet.</td></tr>';

        const abList = d.stripe?.recent_abandoned || [];
        document.getElementById('abandonedRows').innerHTML = abList.length
          ? abList.map(x => '<tr><td>' + (x.created_at ? new Date(x.created_at).toLocaleString() : '-') + '</td><td>' + esc(x.product) + '</td><td><code>' + esc(x.tier) + '</code></td><td>$' + Number(x.amount_usd || 0).toFixed(2) + '</td><td>' + esc(x.buyer_masked) + '</td><td>' + esc(x.target) + '</td><td><span class="pill bad">' + esc(x.status) + '</span></td></tr>').join('')
          : '<tr><td colspan="7" style="color:var(--muted);">No abandoned checkouts detected.</td></tr>';

        document.getElementById('fleetRows').innerHTML = (d.fleet || []).map(f =>
          '<tr><td><a href="' + f.url.replace('/health','') + '" target="_blank" style="color:var(--cyan);">' + f.name + '</a></td><td><span class="pill ' + (f.ok ? 'ok' : 'bad') + '">' + (f.ok ? 'ONLINE' : 'DOWN') + '</span></td><td>' + f.status + '</td><td>' + f.ms + ' ms</td></tr>'
        ).join('');

        document.getElementById('apifyRows').innerHTML = (d.apify.actors || []).map(a =>
          '<tr><td>' + a.name + '</td><td>' + a.runs + '</td><td><a href="' + a.url + '" target="_blank" style="color:var(--cyan);">Open</a></td></tr>'
        ).join('');
      } catch (e) {
        document.getElementById('lastUpdated').textContent = 'Sync error: ' + e.message;
      }
    }
    loadLive();
    setInterval(() => { if (document.getElementById('autoRefresh').checked) loadLive(); }, 20000);
  </script>
</body>
</html>`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = buildCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path === "/health" || path === "/ping") {
      return jsonResp({
        status: "ok",
        service: "kurox-revenue-dashboard",
        kv_bound: Boolean(env?.FUNNEL_KV),
        auth_configured: Boolean(getDashboardPassword(env)),
      }, 200, cors);
    }

    if (path === "/t") {
      return await handleClickRedirect(req, url, env, cors);
    }

    if (path === "/webhooks/stripe") {
      return await handleStripeWebhook(req, env, cors);
    }

    if (path === "/login") {
      if (req.method === "GET") {
        return htmlResp(renderLoginHtml(env), 200, cors, { "Cache-Control": "no-store" });
      }
      if (req.method === "POST") {
        const configuredPw = getDashboardPassword(env);
        if (!configuredPw) {
          return htmlResp(renderLoginHtml(env, "DASHBOARD_PASSWORD secret is not configured."), 401, cors, { "Cache-Control": "no-store" });
        }
        let supplied = "";
        const ctype = String(req.headers.get("content-type") || "").toLowerCase();
        if (ctype.includes("application/json")) {
          const j = await req.json().catch(() => ({}));
          supplied = String(j?.password || "");
        } else {
          const rawForm = await req.text();
          supplied = String(new URLSearchParams(rawForm).get("password") || "");
        }
        if (!supplied || !constantTimeEqual(supplied, configuredPw)) {
          return htmlResp(renderLoginHtml(env, "Incorrect dashboard password."), 401, cors, { "Cache-Control": "no-store" });
        }
        const cookieHdr = await createSessionCookieHeader(env);
        return new Response(null, {
          status: 302,
          headers: {
            ...cors,
            Location: "/",
            "Set-Cookie": cookieHdr,
            "Cache-Control": "no-store",
          },
        });
      }
      return jsonResp({ error: "Method not allowed" }, 405, cors);
    }

    if (path === "/logout") {
      return new Response(null, {
        status: 302,
        headers: {
          ...cors,
          Location: "/login",
          "Set-Cookie": clearSessionCookieHeader(),
          "Cache-Control": "no-store",
        },
      });
    }

    if (path === "/" || path === "/index.html") {
      if (!(await hasValidSessionCookie(req, env))) {
        return new Response(null, {
          status: 302,
          headers: {
            ...cors,
            Location: "/login",
            "Cache-Control": "no-store",
          },
        });
      }
      return htmlResp(renderDashboardHtml(), 200, cors, { "Cache-Control": "no-store" });
    }

    if (path === "/api/ingest") {
      if (!(await isAuthorizedApi(req, env))) return jsonResp({ ok: false, error: "Unauthorized" }, 401, cors);
      if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405, cors);
      return await handleIngestPost(req, env, cors);
    }

    if (path === "/api/play-status") {
      if (!(await isAuthorizedApi(req, env))) return jsonResp({ ok: false, error: "Unauthorized" }, 401, cors);
      const plays = await getPlayStatusMap(env);
      const onePlay = url.searchParams.get("play");
      if (onePlay) {
        const pk = normalizePlayKey(onePlay);
        const entry = plays[pk] || { paused: false, reason: "", bounce_rate_pct: 0 };
        return jsonResp({ ok: true, play: pk, ...entry, plays }, 200, cors, { "Cache-Control": "no-store" });
      }
      return jsonResp({ ok: true, plays }, 200, cors, { "Cache-Control": "no-store" });
    }

    if (path === "/api/pending-alerts") {
      if (!(await isAuthorizedApi(req, env))) return jsonResp({ ok: false, error: "Unauthorized" }, 401, cors);
      const dueOnly = url.searchParams.get("all") !== "1";
      const alerts = await listKvAlerts(env, dueOnly);
      return jsonResp({ ok: true, count: alerts.length, alerts }, 200, cors, { "Cache-Control": "no-store" });
    }

    if (path === "/api/ack-alert") {
      if (!(await isAuthorizedApi(req, env))) return jsonResp({ ok: false, error: "Unauthorized" }, 401, cors);
      if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405, cors);
      const body = await req.json().catch(() => ({}));
      const id = String(body?.id || "").trim();
      if (!id.startsWith("alert:")) return jsonResp({ ok: false, error: "Valid alert id required" }, 400, cors);
      if (env?.FUNNEL_KV && typeof env.FUNNEL_KV.delete === "function") {
        await env.FUNNEL_KV.delete(id);
      }
      return jsonResp({ ok: true, acked: id }, 200, cors);
    }

    if (path === "/api/live" || path === "/telemetry_data.json") {
      if (!(await isAuthorizedApi(req, env))) return jsonResp({ ok: false, error: "Unauthorized" }, 401, cors);
      const data = await gatherLiveDashboardData(env);
      return jsonResp(data, 200, cors, { "Cache-Control": "no-store" });
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
