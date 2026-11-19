/**
 * Shared Cloudflare Edge Helpers for Kurox Rescue & Dashboard Workers.
 * Centralizes CORS, SSRF-safe target normalization, ZIP/JSON/HTML responses,
 * Stripe Checkout/Download handling, and x402 dual-chain verification.
 */

import { escapeHtml, resolvePlanTier, hasSigningSecretConfigured, signToken, verifyToken, createStripeCheckoutSession, verifyStripeSessionAndMint } from "./stripe_billing.js";
import { createZipArchive } from "./zip_builder.js";
import { isBlockedPrivateHost } from "./schema_fetch.js";
import { CDP_FACILITATOR_URL, CDP_SOLANA_FEE_PAYER, hasCdpCredentials, createCdpRequestHeaders } from "./cdp_auth.js";

export const MERCHANT_BASE = "0x80E0Ae84679b7f11bE171DaADd492FBECf628cd6";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MERCHANT_SOLANA_OWNER = "9wuMysgXwNhtQeqJgGByAiMYc4EjzZ5wUSmnjrrt3ffh";
export const MERCHANT_SOLANA_ATA = "DD3A7jaXFeHcif9eYj6Vhomuxypat5Yxi8ow6wxz27yL";
export const PAYAI_SOLANA_FEE_PAYER = "CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww";
export const PAYAI_FACILITATOR = "https://facilitator.payai.network";

export function buildCorsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, PAYMENT-SIGNATURE, X-PAYMENT, X-X402-Facilitator",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Required, X-Payment-Response",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResp(data, status = 200, cors = {}, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

export function htmlResp(html, status = 200, cors = {}, extra = {}) {
  return new Response(html, {
    status,
    headers: { ...cors, "Content-Type": "text/html; charset=utf-8", ...extra },
  });
}

export function zipResp(files, filename, cors = {}) {
  const zipBytes = createZipArchive(files);
  return new Response(zipBytes, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

export function normalizeTargetOrigin(rawInput) {
  let raw = String(rawInput || "").trim();
  if (!raw) throw Object.assign(new Error("Target domain or URL is required."), { httpStatus: 400 });
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw Object.assign(new Error("Invalid domain or URL format."), { httpStatus: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw Object.assign(new Error("Only http and https URLs are supported."), { httpStatus: 400 });
  }
  if (isBlockedPrivateHost(parsed.hostname)) {
    throw Object.assign(new Error("Blocked private or loopback target host."), { httpStatus: 403 });
  }
  return {
    origin: `${parsed.protocol}//${parsed.host}`,
    hostname: parsed.hostname.toLowerCase().replace(/^www\./, ""),
    fullUrl: parsed.toString(),
  };
}

export function resolvePlanFromMap(plansMap, rawTierOrSku, defaultTier) {
  const key = String(rawTierOrSku || defaultTier).trim().toLowerCase();
  if (plansMap[key]) return plansMap[key];
  return Object.values(plansMap).find((p) => p.sku.toLowerCase() === key || p.tier.toLowerCase() === key) || null;
}

export function buildGeneric402Challenge(req, routePath, plan, details = null) {
  const url = new URL(req.url);
  const resourceUrl = `${url.origin}${routePath}`;
  const challenge = {
    x402Version: 2,
    error: details || `Payment required: ${plan.priceDisplay}`,
    resource: { url: resourceUrl, description: plan.description, mimeType: "application/json" },
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
          feePayer: PAYAI_SOLANA_FEE_PAYER,
          recipientAta: MERCHANT_SOLANA_ATA,
        },
      },
    ],
  };
  return { challenge, b64: btoa(JSON.stringify(challenge)), resourceUrl };
}

export function generic402Response(req, routePath, plan, cors, details = null) {
  const { challenge, b64 } = buildGeneric402Challenge(req, routePath, plan, details);
  return jsonResp(challenge, 402, cors, {
    "Cache-Control": "no-store",
    "PAYMENT-REQUIRED": b64,
    "X-Payment-Required": b64,
    "X-402-Version": "2",
  });
}

export async function verifyAndSettleGenericX402(req, routePath, paymentHdr, plan, env) {
  let payloadStr = String(paymentHdr || "").trim();
  if (!payloadStr.startsWith("{")) payloadStr = atob(payloadStr);
  const parsed = JSON.parse(payloadStr);
  const amt = parsed.accepted?.amount;
  if (amt !== undefined && BigInt(String(amt)) < BigInt(plan.amountMicro)) {
    throw new Error(`Insufficient USDC amount: expected ${plan.amountMicro}`);
  }
  const url = new URL(req.url);
  const resourceUrl = `${url.origin}${routePath}`;
  const isSolana = (parsed.accepted?.network || "").toString().startsWith("solana") || Boolean(parsed.payload?.transaction);
  const useCdp = !isSolana && hasCdpCredentials(env) && (req.headers.get("x-x402-facilitator") || "").toLowerCase() !== "payai";
  const facUrl = useCdp ? CDP_FACILITATOR_URL : PAYAI_FACILITATOR;
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
          feePayer: parsed.accepted?.extra?.feePayer === CDP_SOLANA_FEE_PAYER ? CDP_SOLANA_FEE_PAYER : PAYAI_SOLANA_FEE_PAYER,
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
    },
    paymentRequirements: requirements,
  };

  const vHdrs = useCdp ? await createCdpRequestHeaders(env, "POST", "/verify") : { "Content-Type": "application/json" };
  const vr = await fetch(`${facUrl}/verify`, { method: "POST", headers: vHdrs, body: JSON.stringify(relayBody), signal: AbortSignal.timeout(15000) });
  const vj = await vr.json().catch(() => ({}));
  if (!vr.ok || vj.isValid !== true) {
    throw new Error(vj.invalidMessage || vj.reason || vj.error || `Verify rejected (HTTP ${vr.status})`);
  }

  const sHdrs = useCdp ? await createCdpRequestHeaders(env, "POST", "/settle") : { "Content-Type": "application/json" };
  const sr = await fetch(`${facUrl}/settle`, { method: "POST", headers: sHdrs, body: JSON.stringify(relayBody), signal: AbortSignal.timeout(30000) });
  const sj = await sr.json().catch(() => ({}));
  if (!sr.ok || sj.success !== true || !sj.transaction) {
    throw new Error(sj.errorReason || sj.error || `Settlement failed (HTTP ${sr.status})`);
  }

  return {
    success: true,
    payer: sj.payer || "verified_buyer",
    transaction: sj.transaction,
    amount: String(plan.amountMicro),
    network: isSolana ? SOLANA_NETWORK : "eip155:8453",
    resource: resourceUrl,
  };
}

export async function handleStripeCheckoutRoute({ req, url, env, cors, plansMap, defaultTier, targetParamKeys = ["domain", "target"] }) {
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405, cors);
  }
  let bodyParams = {};
  if (req.method === "POST") {
    try {
      bodyParams = await req.json();
    } catch {
      bodyParams = {};
    }
  }
  const tierKey = url.searchParams.get("tier") || bodyParams.tier || defaultTier;
  const plan = resolvePlanFromMap(plansMap, tierKey, defaultTier);
  if (!plan) return jsonResp({ error: "invalid_tier", available: Object.keys(plansMap) }, 400, cors);

  let targetVal = "";
  for (const k of targetParamKeys) {
    targetVal = String(url.searchParams.get(k) || bodyParams[k] || "").trim();
    if (targetVal) break;
  }
  targetVal = targetVal.slice(0, 350);

  try {
    const session = await createStripeCheckoutSession(
      {
        successUrl: `${url.origin}/api/download?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${url.origin}/?canceled=1${targetVal ? `&domain=${encodeURIComponent(targetVal)}` : ""}`,
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
          ...(targetVal ? { target_domain: targetVal } : {}),
        },
      },
      env,
    );
    if (req.method === "POST" || url.searchParams.get("format") === "json") {
      return jsonResp({ id: session.id, url: session.url, tier: plan.id, sku: plan.sku, amount_cents: plan.amountCents, target_domain: targetVal || null }, 200, cors);
    }
    return new Response(null, { status: 303, headers: { ...cors, Location: session.url } });
  } catch (err) {
    return jsonResp({ error: err.message, charged: false }, err.httpStatus || 502, cors);
  }
}

export async function verifyCheckoutDownloadSession(sessionId, urlOrigin, env, plansMap, defaultTier, tokenPrefix) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${String(env?.STRIPE_SECRET_KEY || "").replace(/[\uFEFF\x00-\x20\x7F]+/g, "")}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!env?.STRIPE_SECRET_KEY || !hasSigningSecretConfigured(env)) {
    throw Object.assign(new Error("Stripe or signing secrets not configured on worker"), { httpStatus: 503 });
  }
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId || "")) {
    throw Object.assign(new Error("Invalid Stripe Checkout session_id"), { httpStatus: 400 });
  }
  const session = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(session.error?.message || `Stripe lookup failed HTTP ${res.status}`), { httpStatus: res.status === 404 ? 404 : 502 });
  if (session.payment_status !== "paid") {
    throw Object.assign(new Error(`Payment status is '${session.payment_status || "unpaid"}' (expected paid)`), { httpStatus: 402 });
  }
  const plan = resolvePlanFromMap(plansMap, session.metadata?.tier, defaultTier) || plansMap[defaultTier];
  const domain = String(session.metadata?.target_domain || "").trim();
  const now = Math.floor(Date.now() / 1000);
  const dlToken = await signToken({ typ: `${tokenPrefix}_dl`, sid: session.id, sku: plan.sku, tier: plan.id, domain, iat: now, exp: now + 30 * 86400 }, env.KUROX_SIGNING_SECRET, tokenPrefix);
  return {
    paid: true,
    session_id: session.id,
    amount_total_cents: session.amount_total,
    tier: plan.id,
    sku: plan.sku,
    product_name: plan.name,
    domain,
    download_token: dlToken,
    download_zip_url: `${urlOrigin}/api/download?token=${encodeURIComponent(dlToken)}&format=zip`,
    priority_email: "ak10082247@gmail.com",
  };
}

export { escapeHtml, resolvePlanTier, hasSigningSecretConfigured, signToken, verifyToken, verifyStripeSessionAndMint };

export async function handleGenericX402BuyRoute({ req, url, env, cors, plansMap, defaultTier, buildPackFn, targetParamKeys = ["domain", "target"] }) {
  if (req.method !== "POST" && req.method !== "GET") return jsonResp({ error: "Method not allowed", charged: false }, 405, cors);
  let bodyParams = {};
  if (req.method === "POST") {
    try { bodyParams = await req.json(); } catch { bodyParams = {}; }
  }
  const tierKey = url.searchParams.get("tier") || bodyParams.tier || defaultTier;
  const plan = resolvePlanFromMap(plansMap, tierKey, defaultTier);
  if (!plan) return jsonResp({ error: "invalid_tier", available: Object.keys(plansMap), charged: false }, 400, cors);

  let targetVal = "";
  for (const k of targetParamKeys) {
    targetVal = String(url.searchParams.get(k) || bodyParams[k] || "").trim();
    if (targetVal) break;
  }
  if (!targetVal) return jsonResp({ error: "Missing required domain or target URL", charged: false }, 400, cors);

  const routeKey = `${url.pathname}?tier=${plan.id}`;
  const paymentHdr = req.headers.get("PAYMENT-SIGNATURE") || req.headers.get("X-PAYMENT") || req.headers.get("payment-signature");
  if (!paymentHdr) return generic402Response(req, routeKey, plan, cors);
  if (!hasSigningSecretConfigured(env)) return jsonResp({ error: "signing_secret_not_configured", charged: false }, 503, cors);

  let pack;
  try {
    pack = await buildPackFn(targetVal, plan.id, bodyParams);
  } catch (err) {
    return jsonResp({ error: `Pre-settlement diagnostic failed: ${err.message}`, charged: false }, err.httpStatus || 422, cors);
  }

  let receipt;
  try {
    receipt = await verifyAndSettleGenericX402(req, routeKey, paymentHdr, plan, env);
  } catch (err) {
    return generic402Response(req, routeKey, plan, cors, `Payment rejected: ${err.message}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const dlToken = await signToken({ typ: `${plan.sku}_dl`, sid: receipt.transaction, sku: plan.sku, tier: plan.id, domain: pack.domain, iat: now, exp: now + 30 * 86400 }, env.KUROX_SIGNING_SECRET, "kdl_v1");
  const b64Receipt = btoa(JSON.stringify(receipt));
  return jsonResp(
    {
      status: "fulfilled",
      paid: true,
      tier: plan.id,
      sku: plan.sku,
      domain: pack.domain,
      tx_hash: receipt.transaction,
      network: receipt.network,
      download_zip_url: `${url.origin}/api/download?token=${encodeURIComponent(dlToken)}&format=zip`,
      diagnostic: pack.diagnostic,
      files: pack.files,
    },
    200,
    cors,
    { "Cache-Control": "no-store", "PAYMENT-RESPONSE": b64Receipt, "X-Payment-Response": b64Receipt },
  );
}

export async function handleRescueDownloadRoute({ req, url, env, cors, plansMap, defaultTier, tokenPrefix, zipFilename, serviceTitle, buildPackFn }) {
  const sessionId = url.searchParams.get("session_id") || "";
  const token = url.searchParams.get("token") || "";
  const reqFormat = (url.searchParams.get("format") || "").toLowerCase();

  let fulfillment;
  if (sessionId) {
    try {
      fulfillment = await verifyCheckoutDownloadSession(sessionId, url.origin, env, plansMap, defaultTier, tokenPrefix);
    } catch (err) {
      return jsonResp({ error: err.message, paid: false }, err.httpStatus || 500, cors, { "Cache-Control": "no-store" });
    }
  } else if (token) {
    if (!hasSigningSecretConfigured(env)) return jsonResp({ error: "signing_secret_not_configured" }, 503, cors);
    const payload = await verifyToken(token, env.KUROX_SIGNING_SECRET, tokenPrefix) || await verifyToken(token, env.KUROX_SIGNING_SECRET, "kdl_v1");
    if (!payload) return jsonResp({ error: "invalid_or_expired_download_token" }, 403, cors);
    const plan = resolvePlanFromMap(plansMap, payload.tier, defaultTier) || plansMap[defaultTier];
    fulfillment = {
      paid: true,
      session_id: payload.sid,
      tier: plan.id,
      sku: plan.sku,
      product_name: plan.name,
      domain: payload.domain || "",
      download_token: token,
      download_zip_url: `${url.origin}/api/download?token=${encodeURIComponent(token)}&format=zip`,
      priority_email: "ak10082247@gmail.com",
    };
  } else {
    return jsonResp({ error: "Missing session_id or token" }, 400, cors);
  }

  if (sessionId && reqFormat !== "zip" && reqFormat !== "json" && req.method === "GET") {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(serviceTitle)} — Payment Confirmed</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#090b10;color:#f8fafc;max-width:780px;margin:0 auto;padding:2rem 1rem} .card{background:#131722;border:1px solid #242d42;border-radius:12px;padding:1.3rem;margin:1rem 0} .btn{display:inline-block;padding:0.75rem 1.2rem;border-radius:8px;font-weight:700;background:#059669;color:#fff;text-decoration:none} input{width:100%;box-sizing:border-box;background:#070a12;color:#f8fafc;border:1px solid #334155;border-radius:8px;padding:0.65rem;margin:0.4rem 0 0.8rem} code{background:#070a12;padding:0.2rem 0.45rem;border-radius:5px;color:#34d399}</style></head><body><h1>Payment Confirmed — ${escapeHtml(fulfillment.product_name)}</h1><p>Session: <code>${escapeHtml(fulfillment.session_id)}</code></p><div class="card"><h3>Download Your Compiled Recovery Bundle</h3><form method="POST" action="/api/download?token=${encodeURIComponent(fulfillment.download_token)}&format=zip"><label>Target Website Domain</label><input name="domain" value="${escapeHtml(fulfillment.domain || "example.com")}" required /><button class="btn" type="submit">Download ${escapeHtml(zipFilename)}</button></form><p style="margin-top:0.8rem;"><a class="btn" style="background:#0284c7" href="${escapeHtml(fulfillment.download_zip_url)}">One-Click Direct Download ZIP</a></p></div>${fulfillment.tier === "priority" || fulfillment.tier === "pro_kit" ? `<div class="card"><h3>Priority Async Turnaround</h3><p>Forward your session ID <code>${escapeHtml(fulfillment.session_id)}</code> to <strong>${escapeHtml(fulfillment.priority_email)}</strong> if you want any theme/host follow-up confirmation.</p></div>` : ""}</body></html>`;
    return htmlResp(html, 200, cors, { "Cache-Control": "no-store" });
  }

  let bodyParams = {};
  if (req.method === "POST") {
    const ct = req.headers.get("Content-Type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      bodyParams = Object.fromEntries(fd.entries());
    } else {
      try { bodyParams = await req.json(); } catch { bodyParams = {}; }
    }
  }
  const targetDomain = String(bodyParams.domain || url.searchParams.get("domain") || fulfillment.domain || "example.com").trim();
  const pack = await buildPackFn(targetDomain, fulfillment.tier, bodyParams);
  if (reqFormat === "json") return jsonResp({ ok: true, fulfillment, diagnostic: pack.diagnostic, files: pack.files }, 200, cors, { "Cache-Control": "no-store" });
  return zipResp(pack.files, zipFilename, cors);
}
