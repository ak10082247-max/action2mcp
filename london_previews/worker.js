/**
 * London Fast Sites — Bespoke Live Client Preview & £199 One-Time Stripe Handover Worker
 * Serves <25KB (<0.1s) bespoke mobile-first previews for London local businesses,
 * handles live GBP £199 Stripe Checkout, and delivers the clean production index.html
 * upon verified payment with zero phone calls or meetings required.
 */

import { cleanSecret } from "../stripe_billing.js";
import { LONDON_SITES, escapeHtml, renderClientSiteHtml } from "./sites.js";
import { NO_SITE_STUDIOS } from "./studios.js";
import { renderLuxuryStudioHtml } from "./templates/luxury_studio.js";

function resolveSiteOrStudio(slug) {
  const key = String(slug || "").trim().toLowerCase();
  if (LONDON_SITES[key]) {
    return { kind: "legacy", item: LONDON_SITES[key], pathPrefix: "/" };
  }
  if (NO_SITE_STUDIOS[key]) {
    const st = NO_SITE_STUDIOS[key];
    return {
      kind: "studio",
      item: {
        ...st,
        domain: `${st.slug.replace(/-/g, "")}.co.uk`,
      },
      pathPrefix: "/s/",
    };
  }
  return null;
}

const PRICE_GBP_PENCE = 19900; // £199.00 one-time

function secHeaders(extra = {}) {
  return {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "frame-ancestors 'none'",
    ...extra,
  };
}

function htmlResponse(html, status = 200, extra = {}) {
  return new Response(html, {
    status,
    headers: secHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    }),
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: secHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}

async function createGbpCheckoutSession(env, origin, site, pathPrefix = "/") {
  const stripeKey = cleanSecret(env?.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    return { error: "Stripe checkout is not configured yet.", status: 503 };
  }
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/success?slug=${encodeURIComponent(site.slug)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}${pathPrefix}${encodeURIComponent(site.slug)}`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "gbp");
  params.set("line_items[0][price_data][unit_amount]", String(PRICE_GBP_PENCE));
  params.set("line_items[0][price_data][product_data][name]", `Website Launch for ${site.name} (${site.domain})`);
  params.set(
    "line_items[0][price_data][product_data][description]",
    "One-time £199 handover: clean production HTML, free £0/mo Cloudflare Pages hosting setup, custom .co.uk domain connection within 24h, and minor wording/photo tweaks handled 100% by text or email."
  );
  params.set("metadata[slug]", site.slug);
  params.set("metadata[business]", site.name);
  params.set("metadata[domain]", site.domain);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) {
    return { error: data?.error?.message || `Stripe error (${res.status})`, status: 502 };
  }
  return { id: data.id, url: data.url, amount_pence: PRICE_GBP_PENCE, currency: "gbp" };
}

async function verifyStripePaidSession(env, sessionId, expectedSlug) {
  const stripeKey = cleanSecret(env?.STRIPE_SECRET_KEY);
  if (!stripeKey || !sessionId || !/^cs_(live|test)_[A-Za-z0-9_-]+$/.test(sessionId)) {
    return { paid: false, reason: "Invalid or missing checkout session." };
  }
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { paid: false, reason: "Could not verify Stripe session." };
  const paid = data.payment_status === "paid" || data.status === "complete";
  const metaSlug = data?.metadata?.slug || "";
  if (!paid) return { paid: false, reason: "Payment has not completed yet." };
  if (expectedSlug && metaSlug && metaSlug !== expectedSlug) {
    return { paid: false, reason: "Session does not match this website." };
  }
  return {
    paid: true,
    email: data?.customer_details?.email || "",
    slug: metaSlug || expectedSlug,
    amountTotal: data?.amount_total || PRICE_GBP_PENCE,
  };
}

function renderStudioHome() {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>London Fast Sites — £199 One-Time Websites for Local Trades &amp; Businesses</title>
<style>
  body { margin: 0; background: #f8f6f1; color: #16181a; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 56px 22px 72px; }
  h1, h2 { font-family: Georgia, 'Times New Roman', serif; line-height: 1.18; }
  h1 { font-size: clamp(30px, 4.5vw, 44px); margin: 12px 0 16px; }
  .eyebrow { display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; background: #eae4d8; padding: 4px 10px; border-radius: 4px; }
  .lead { font-size: 18px; color: #484d54; margin: 0 0 28px; }
  .card { background: #ffffff; border: 1px solid #ddd6c8; border-radius: 8px; padding: 24px; margin-bottom: 18px; }
  .card h2 { font-size: 21px; margin: 0 0 10px; }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 8px; }
  .cta { display: inline-block; background: #16181a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 700; margin-top: 8px; }
  footer { margin-top: 36px; font-size: 13px; color: #6a6f75; border-top: 1px solid #ddd6c8; padding-top: 18px; }
</style>
</head>
<body>
<main class="wrap">
  <span class="eyebrow">London Local Web Studio · £199 One-Time</span>
  <h1>Fast, clear websites for London trades and local businesses — live in 24 hours.</h1>
  <p class="lead">No £1,500 agency retainers, no monthly Wix bills, and no 45-minute sales calls. Everything is built upfront as a working preview and launched strictly over WhatsApp or email.</p>

  <div class="card">
    <h2>What's Included for £199 One-Time</h2>
    <ul>
      <li><strong>Sub-0.1 second mobile loading</strong> (~20 KB clean HTML vs 1.5 MB slow Wix/WordPress templates).</li>
      <li><strong>Interactive 30-second WhatsApp &amp; email quote builder</strong> tailored to your exact services and London postcodes.</li>
      <li><strong>£0/month hosting forever</strong> on Cloudflare Pages with automatic HTTPS security — or a clean single-file ZIP if you prefer your own host.</li>
      <li><strong>100% async text/email handover</strong> — send your wording/photo tweaks and domain registrar name (GoDaddy, 123-reg, Wix, IONOS) and we put it live within 24 hours.</li>
    </ul>
  </div>

  <div class="card">
    <h2>Direct Contact (Text / Email Only)</h2>
    <p>Have a preview link from us or want a quick rebuild of a slow site? Drop a quick email with your current website URL.</p>
    <a class="cta" href="mailto:armkhan18@gmail.com?subject=London%20Website%20Rebuild%20(%C2%A3199)">Email armkhan18@gmail.com →</a>
  </div>

  <footer>© 2026 London Fast Sites · Private Preview Server</footer>
</main>
</body>
</html>`;
}

function renderSuccessPage(site, verification, sessionId) {
  if (!verification.paid) {
    return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Pending — ${escapeHtml(site.name)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8f6f1;color:#16181a;margin:0;padding:48px 20px}.box{max-width:600px;margin:0 auto;background:#fff;border:1px solid #ddd6c8;border-radius:8px;padding:28px}</style>
</head><body><div class="box"><h1>Payment not verified yet</h1><p>${escapeHtml(verification.reason)}</p><p><a href="/${escapeHtml(site.slug)}">← Back to preview</a></p></div></body></html>`;
  }
  const dlUrl = `/api/download?slug=${encodeURIComponent(site.slug)}&session_id=${encodeURIComponent(sessionId)}`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Order Confirmed — ${escapeHtml(site.name)}</title>
<style>
  body { margin: 0; background: #f8f6f1; color: #16181a; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 48px 20px; }
  .box { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #d7d0c3; border-radius: 8px; padding: 32px; }
  h1 { font-family: Georgia, serif; margin: 10px 0 12px; font-size: 30px; }
  .ok { display: inline-block; background: #d1fae5; color: #065f46; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.06em; }
  .btn { display: inline-block; background: #0f766e; color: #fff; text-decoration: none; padding: 13px 20px; border-radius: 6px; font-weight: 700; margin: 10px 10px 10px 0; }
  .btn-alt { display: inline-block; background: #16181a; color: #fff; text-decoration: none; padding: 13px 20px; border-radius: 6px; font-weight: 700; margin: 10px 0; }
  ol { padding-left: 20px; }
  li { margin-bottom: 10px; }
</style>
</head>
<body>
<div class="box">
  <span class="ok">PAYMENT CONFIRMED · £199 ONE-TIME</span>
  <h1>Thank you — ${escapeHtml(site.name)} is ready to go live.</h1>
  <p>Your clean, ad-free production website (with the preview bar completely removed) is ready right now. Everything from here is handled purely by email or WhatsApp — no phone calls or meetings required.</p>

  <div>
    <a class="btn" href="${escapeHtml(dlUrl)}">Download Clean Website (index.html) ↓</a>
    <a class="btn-alt" href="mailto:armkhan18@gmail.com?subject=${encodeURIComponent(`Go Live: ${site.domain} (Paid)`)}&body=${encodeURIComponent(`Hi Arman,\n\nWe just paid for ${site.name} (${site.domain}).\n1. Our domain registrar (GoDaddy / 123-reg / Wix / IONOS / other): \n2. Any text, price, or photo tweaks we'd like before going live: \n`)}">Send Domain &amp; Tweaks by Email →</a>
  </div>

  <h2>2 Simple Steps to Go Live on ${escapeHtml(site.domain)} (Within 24 Hours)</h2>
  <ol>
    <li><strong>Reply by WhatsApp or email (armkhan18@gmail.com)</strong> with any wording/price/photo tweaks you'd like and tell us where your domain is registered (e.g. GoDaddy, Wix, 123-reg, IONOS).</li>
    <li><strong>Connect your domain in 2 minutes:</strong> We send you exact copy-paste DNS records (2 lines, zero passwords shared) to point <strong>${escapeHtml(site.domain)}</strong> to free £0/mo Cloudflare Pages hosting with full HTTPS — or you can upload the downloaded <code>index.html</code> file directly to your existing web host.</li>
  </ol>
</div>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "london-previews",
        sites: Object.keys(LONDON_SITES),
        studios: Object.keys(NO_SITE_STUDIOS),
      });
    }

    if (path === "/") {
      return htmlResponse(renderStudioHome());
    }

    if (path === "/api/checkout") {
      let slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
      let wantJson = url.searchParams.get("format") === "json" || request.method === "POST";
      if (!slug && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        slug = String(body?.slug || "").trim().toLowerCase();
      }
      const resolved = resolveSiteOrStudio(slug);
      if (!resolved) return jsonResponse({ ok: false, error: "Unknown preview slug." }, 404);
      const out = await createGbpCheckoutSession(env, url.origin, resolved.item, resolved.pathPrefix);
      if (out.error) return jsonResponse({ ok: false, error: out.error }, out.status || 500);
      if (wantJson) {
        return jsonResponse({ ok: true, ...out });
      }
      return Response.redirect(out.url, 303);
    }

    if (path === "/success") {
      const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
      const sessionId = (url.searchParams.get("session_id") || "").trim();
      const resolved = resolveSiteOrStudio(slug);
      if (!resolved) return htmlResponse("<h1>Not found</h1>", 404);
      const verification = await verifyStripePaidSession(env, sessionId, slug);
      return htmlResponse(renderSuccessPage(resolved.item, verification, sessionId), verification.paid ? 200 : 402);
    }

    if (path === "/api/download") {
      const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
      const sessionId = (url.searchParams.get("session_id") || "").trim();
      const resolved = resolveSiteOrStudio(slug);
      if (!resolved) return jsonResponse({ ok: false, error: "Unknown site." }, 404);
      const verification = await verifyStripePaidSession(env, sessionId, slug);
      if (!verification.paid) return jsonResponse({ ok: false, error: verification.reason }, 402);
      const cleanHtml = resolved.kind === "studio"
        ? renderLuxuryStudioHtml(resolved.item, { clean: true })
        : renderClientSiteHtml(resolved.item, { clean: true });
      return new Response(cleanHtml, {
        status: 200,
        headers: secHeaders({
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${resolved.item.slug}-index.html"`,
          "Cache-Control": "no-store",
        }),
      });
    }

    if (path.startsWith("/s/")) {
      const studioSlug = path.slice(3).toLowerCase();
      const studio = NO_SITE_STUDIOS[studioSlug];
      if (studio) {
        const clean = url.searchParams.get("clean") === "1";
        return htmlResponse(renderLuxuryStudioHtml(studio, { clean }));
      }
      return htmlResponse("<h1>Studio preview not found</h1><p><a href='/'>Home</a></p>", 404);
    }

    const slug = path.slice(1).toLowerCase();
    const site = LONDON_SITES[slug];
    if (site) {
      const clean = url.searchParams.get("clean") === "1";
      return htmlResponse(renderClientSiteHtml(site, { clean }));
    }

    return htmlResponse("<h1>Preview not found</h1><p><a href='/'>Home</a></p>", 404);
  },
};
