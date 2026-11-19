/**
 * Kurox Live Revenue & Multi-Play Operations Dashboard Worker
 * Aggregates live Stripe balances & paid sessions, on-chain Base/Solana USDC balances & recent txns,
 * Apify kuroxreal telemetry, GitHub cron outreach metrics, and live endpoint health in real time.
 * Never leaks secrets or customer PII.
 */

import { cleanSecret } from "../stripe_billing.js";
import { MERCHANT_BASE, BASE_USDC, MERCHANT_SOLANA_ATA, buildCorsHeaders, jsonResp, htmlResp } from "../edge_helpers.js";

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

function classifyStripeSession(s) {
  const meta = s.metadata || {};
  const sku = String(meta.sku || "").toLowerCase();
  const tier = String(meta.tier || "").toLowerCase();
  if (sku.startsWith("siterescue") || tier.startsWith("pack") || tier.startsWith("priority")) return "Play A: SiteRescue";
  if (sku.startsWith("ecomfix") || tier.startsWith("fix_pack") || tier.startsWith("pro_kit")) return "Play B: StoreFix";
  if (sku.startsWith("action2mcp") || tier === "hosted" || tier === "bundle") return "Action2MCP";
  return "Other / Direct";
}

function redactId(id) {
  const s = String(id || "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}...${s.slice(-4)}`;
}

async function fetchStripeLive(stripeKeyRaw) {
  const key = cleanSecret(stripeKeyRaw);
  if (!key) return { configured: false, paid_usd: 0, available_usd: 0, pending_usd: 0, paid_count: 0, by_play: {}, recent_paid: [] };

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
  let paidCount = 0;
  const byPlay = { "Action2MCP": 0, "Play A: SiteRescue": 0, "Play B: StoreFix": 0, "Other / Direct": 0 };
  const recentPaid = [];
  if (sessRes.ok) {
    const sj = await sessRes.json().catch(() => ({}));
    for (const s of sj.data || []) {
      if (s.payment_status !== "paid") continue;
      const amt = Number(s.amount_total || 0);
      paidCents += amt;
      paidCount += 1;
      const cat = classifyStripeSession(s);
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
    }
  }

  return {
    configured: true,
    paid_usd: Number((paidCents / 100).toFixed(2)),
    available_usd: Number((availableCents / 100).toFixed(2)),
    pending_usd: Number((pendingCents / 100).toFixed(2)),
    paid_count: paidCount,
    by_play: byPlay,
    recent_paid: recentPaid,
  };
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
    { key: "action2mcp", label: "Action2MCP GPT Sniper", path: "data/contacted_gpts.json" },
    { key: "site_rescue", label: "Play A: SiteRescue Sniper", path: "data/site_rescue_state.json" },
    { key: "ecom_fix", label: "Play B: StoreFix Sniper", path: "data/ecom_fix_state.json" },
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
          out[f.key] = { label: f.label, emails_total: 0, emails_today: 0, updated_at: null, active: true };
          return;
        }
        const j = await r.json().catch(() => ({}));
        const hist = Array.isArray(j.history) ? j.history : [];
        const sentToday = hist.filter((h) => String(h.sent_date || "").startsWith(today)).length;
        out[f.key] = {
          label: f.label,
          emails_total: (j.contacted_emails || []).length || hist.length,
          emails_today: sentToday,
          updated_at: j.updated_at || null,
          active: true,
        };
      } catch {
        out[f.key] = { label: f.label, emails_total: 0, emails_today: 0, updated_at: null, active: false };
      }
    }),
  );
  return out;
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
  const [stripe, chain, apify, outreach, fleet] = await Promise.all([
    fetchStripeLive(env?.STRIPE_SECRET_KEY),
    fetchOnChainBalances(),
    fetchApifyTelemetry(env?.APIFY_TOKEN),
    fetchOutreachTelemetry(repoSlug),
    pingFleetHealth(env),
  ]);

  const totalTrackedUsd = Number((stripe.paid_usd + chain.total_usdc).toFixed(4));
  return {
    generated_at: new Date().toISOString(),
    totals: {
      tracked_revenue_usd: totalTrackedUsd,
      stripe_paid_usd: stripe.paid_usd,
      stripe_available_usd: stripe.available_usd,
      stripe_pending_usd: stripe.pending_usd,
      onchain_usdc: chain.total_usdc,
      paid_orders: stripe.paid_count,
    },
    stripe,
    chain,
    apify,
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
      </div>
    </div>

    <div id="tab-overview" class="tab-pane active">
      <div class="kpi-grid">
        <div class="card">
          <div class="kpi-label">Total Tracked Money (Stripe Paid + Wallet USDC)</div>
          <div class="kpi-val" id="kpiTotal">$0.00</div>
          <div class="kpi-sub" id="kpiOrders">0 verified Stripe checkouts</div>
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
          <div class="kpi-label">Apify Store Total Actor Runs</div>
          <div class="kpi-val" style="color:#c084fc;" id="kpiApifyRuns">0</div>
          <div class="kpi-sub" id="kpiApifyActors">kuroxreal public PPE actors</div>
        </div>
      </div>

      <div class="card">
        <strong>Revenue by Product / Play (Stripe Checkouts)</strong>
        <div class="kpi-grid" id="playCards" style="margin-top:0.8rem;margin-bottom:0;"></div>
      </div>

      <div class="card">
        <strong>Automated 6-Hour Cron Outreach Counters</strong>
        <table><thead><tr><th>Cron Sniper</th><th>Emails Sent Today</th><th>Total Emails Sent</th><th>Last Updated</th></tr></thead><tbody id="outreachRows"></tbody></table>
      </div>
    </div>

    <div id="tab-ledger" class="tab-pane">
      <div class="card">
        <strong>Live Redacted Transaction &amp; Solana ATA Ledger</strong>
        <table><thead><tr><th>Timestamp</th><th>Rail</th><th>Product</th><th>Amount</th><th>Status</th><th>Ref</th></tr></thead><tbody id="ledgerRows"></tbody></table>
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
    function showTab(id, btn) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + id).classList.add('active');
      if (btn) btn.classList.add('active');
    }
    async function loadLive() {
      try {
        const res = await fetch('/api/live');
        const d = await res.json();
        document.getElementById('lastUpdated').textContent = 'Last live sync: ' + new Date(d.generated_at).toLocaleString();
        document.getElementById('kpiTotal').textContent = '$' + Number(d.totals.tracked_revenue_usd || 0).toFixed(2);
        document.getElementById('kpiOrders').textContent = (d.totals.paid_orders || 0) + ' verified Stripe checkouts';
        document.getElementById('kpiStripePaid').textContent = '$' + Number(d.totals.stripe_paid_usd || 0).toFixed(2);
        document.getElementById('kpiStripeBal').textContent = 'Avail: $' + Number(d.totals.stripe_available_usd || 0).toFixed(2) + ' | Pending: $' + Number(d.totals.stripe_pending_usd || 0).toFixed(2);
        document.getElementById('kpiUsdc').textContent = '$' + Number(d.totals.onchain_usdc || 0).toFixed(3);
        document.getElementById('kpiUsdcSplit').textContent = 'Base: $' + d.chain.base.usdc.toFixed(3) + ' | Sol: $' + d.chain.solana.usdc.toFixed(3);
        document.getElementById('kpiApifyRuns').textContent = String(d.apify.total_runs || 0);
        document.getElementById('kpiApifyActors').textContent = (d.apify.total_actors || 0) + ' actors on kuroxreal';

        const pc = document.getElementById('playCards');
        pc.innerHTML = Object.entries(d.stripe.by_play || {}).map(([name, val]) =>
          '<div class="tier" style="background:#0b101b;border:1px solid #222c42;border-radius:10px;padding:0.85rem;"><div class="kpi-label">' + name + '</div><div style="font-size:1.4rem;font-weight:800;color:#34d399;margin-top:0.25rem;">$' + Number(val).toFixed(2) + '</div></div>'
        ).join('');

        document.getElementById('outreachRows').innerHTML = Object.values(d.outreach || {}).map(o =>
          '<tr><td>' + o.label + '</td><td>' + o.emails_today + '</td><td>' + o.emails_total + '</td><td>' + (o.updated_at ? new Date(o.updated_at).toLocaleString() : 'Not yet run') + '</td></tr>'
        ).join('');

        const combined = [...(d.stripe.recent_paid || []), ...(d.chain.solana.recent_sigs || [])];
        document.getElementById('ledgerRows').innerHTML = combined.length
          ? combined.map(x => '<tr><td>' + (x.created_at ? new Date(x.created_at).toLocaleString() : '-') + '</td><td><code>' + x.rail + '</code></td><td>' + x.product + '</td><td>' + (x.amount_usd !== null ? ('$' + Number(x.amount_usd).toFixed(2)) : 'ATA tx') + '</td><td><span class="pill ok">' + x.status + '</span></td><td><code>' + x.ref + '</code></td></tr>').join('')
          : '<tr><td colspan="6" style="color:var(--muted);">No paid transactions yet.</td></tr>';

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

    if (path === "/" || path === "/index.html") return htmlResp(renderDashboardHtml(), 200, cors);
    if (path === "/health" || path === "/ping") return jsonResp({ status: "ok", service: "kurox-revenue-dashboard" }, 200, cors);
    if (path === "/api/live" || path === "/telemetry_data.json") {
      const data = await gatherLiveDashboardData(env);
      return jsonResp(data, 200, cors, { "Cache-Control": "no-store" });
    }
    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
