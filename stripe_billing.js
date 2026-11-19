/**
 * Action2MCP Stripe Instant Checkout, x402 Tier Metadata & HMAC Token Billing
 * Pure Web Standards (crypto.subtle / Uint8Array / TextEncoder) — zero deps.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const ACTION2MCP_PLANS = {
  bundle: {
    id: "bundle",
    sku: "action2mcp-bundle-v1",
    name: "Action2MCP Deployable Cloudflare Worker + SKILL.md Bundle",
    description:
      "Pre-compiled standalone Cloudflare Workers Remote MCP Server (worker.js, wrangler.toml, deploy.yml, SKILL.md, ChatGPT Plugin Setup Guide) compiled from your Custom GPT OpenAPI schema.",
    amountCents: 4900,
    amountMicro: 49000000, // $49.00 USDC
    priceDisplay: "$49 USD / USDC",
    ttlSeconds: 30 * 24 * 60 * 60,
    tier: "bundle_49",
  },
  hosted: {
    id: "hosted",
    sku: "action2mcp-hosted-v1",
    name: "Action2MCP Done-For-You Hosted Remote MCP Bridge + Bundle",
    description:
      "Deployable Cloudflare Worker ZIP bundle PLUS multi-tenant Hosted Remote MCP Bridge URL (/mcp/h/...) with pre-signed HMAC management token & priority async setup support.",
    amountCents: 14900,
    amountMicro: 149000000, // $149.00 USDC
    priceDisplay: "$149 USD / USDC",
    ttlSeconds: 365 * 24 * 60 * 60,
    tier: "hosted_149",
  },
};

export function resolvePlanTier(rawTierOrSku) {
  const key = String(rawTierOrSku || "bundle").trim().toLowerCase();
  if (ACTION2MCP_PLANS[key]) return ACTION2MCP_PLANS[key];
  return Object.values(ACTION2MCP_PLANS).find((p) => p.sku.toLowerCase() === key) || null;
}

export function cleanSecret(value) {
  return typeof value === "string" ? value.replace(/[\uFEFF\x00-\x20\x7F]+/g, "") : "";
}

export function hasSigningSecretConfigured(env) {
  return cleanSecret(env?.KUROX_SIGNING_SECRET).length >= 16;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64UrlToBytes(b64url) {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  const normalized = cleanSecret(secret);
  if (!normalized || normalized.length < 16) {
    throw new Error("KUROX_SIGNING_SECRET is not configured.");
  }
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(normalized),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(payload, secret, prefix = "dl_v1") {
  const key = await importHmacKey(secret);
  const bodyB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const signedData = `${prefix}.${bodyB64}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedData));
  return `${signedData}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyToken(token, secret, expectedPrefix = "dl_v1") {
  if (!token || typeof token !== "string" || !secret) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== expectedPrefix || !parts[1] || !parts[2]) return null;
  try {
    const key = await importHmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, fromBase64UrlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(fromBase64UrlToBytes(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

function appendFormParams(params, obj, prefix = "") {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          appendFormParams(params, item, `${key}[${idx}]`);
        } else {
          params.append(`${key}[${idx}]`, String(item));
        }
      });
    } else if (typeof v === "object") {
      appendFormParams(params, v, key);
    } else {
      params.append(key, String(v));
    }
  }
}

export async function createStripeCheckoutSession(options, env) {
  const stripeKey = cleanSecret(env?.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    throw Object.assign(new Error("Stripe checkout not configured on worker"), { httpStatus: 503 });
  }
  const form = new URLSearchParams();
  appendFormParams(form, {
    mode: "payment",
    customer_creation: "always",
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    line_items: options.lineItems,
    metadata: options.metadata,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw Object.assign(new Error(data.error?.message || `Stripe API error HTTP ${res.status}`), {
      httpStatus: 502,
    });
  }
  return data;
}

export async function verifyStripeSessionAndMint(sessionId, origin, env) {
  const stripeKey = cleanSecret(env?.STRIPE_SECRET_KEY);
  const signingSecret = cleanSecret(env?.KUROX_SIGNING_SECRET);
  if (!stripeKey || !signingSecret) {
    throw Object.assign(new Error("Stripe or signing secrets not configured on worker"), { httpStatus: 503 });
  }
  if (!/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId || "")) {
    throw Object.assign(new Error("Invalid Stripe Checkout session_id"), { httpStatus: 400 });
  }

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
    signal: AbortSignal.timeout(15000),
  });
  const session = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(session.error?.message || `Stripe lookup failed HTTP ${res.status}`), {
      httpStatus: res.status === 404 ? 404 : 502,
    });
  }
  if (session.payment_status !== "paid") {
    throw Object.assign(new Error(`Payment status is '${session.payment_status || "unpaid"}' (expected paid)`), {
      httpStatus: 402,
    });
  }

  const tierId = session.metadata?.tier || (session.amount_total >= 14900 ? "hosted" : "bundle");
  const plan = resolvePlanTier(tierId) || ACTION2MCP_PLANS.bundle;
  const now = Math.floor(Date.now() / 1000);
  const specUrl = (session.metadata?.spec_url || "").trim();

  const dlToken = await signToken(
    {
      typ: "a2m_download",
      sid: session.id,
      sku: plan.sku,
      tier: plan.id,
      ...(specUrl ? { specUrl } : {}),
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
      {
        typ: "a2m_hosted_mgmt",
        sid: session.id,
        sku: plan.sku,
        tier: plan.id,
        email: session.customer_details?.email || null,
        iat: now,
        exp: now + plan.ttlSeconds,
      },
      env.KUROX_SIGNING_SECRET,
      "a2m_mgmt_v1",
    );
    if (specUrl) {
      const bridgeTok = await signToken(
        {
          typ: "a2m_bridge",
          sid: session.id,
          specUrl,
          iat: now,
          exp: now + plan.ttlSeconds,
        },
        env.KUROX_SIGNING_SECRET,
        "a2m_bridge_v1",
      );
      hostedBridgeUrl = `${origin}/mcp/h/${encodeURIComponent(bridgeTok)}`;
    }
  }

  return {
    paid: true,
    session_id: session.id,
    customer_email: session.customer_details?.email || null,
    amount_total_cents: session.amount_total,
    currency: (session.currency || "usd").toUpperCase(),
    tier: plan.id,
    sku: plan.sku,
    product_name: plan.name,
    download_token: dlToken,
    download_zip_url: `${origin}/api/download?token=${encodeURIComponent(dlToken)}&format=zip`,
    download_json_url: `${origin}/api/download?token=${encodeURIComponent(dlToken)}&format=json`,
    management_token: managementToken,
    hosted_bridge_url: hostedBridgeUrl,
    priority_notification_target: "ak10082247@gmail.com",
  };
}
