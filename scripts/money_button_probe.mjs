#!/usr/bin/env node
/**
 * Play E Runtime Engine: Browser Reverse-Engineering "Broken Money-Button" Probe.
 * Launches headless Chromium via Playwright, detects live ad-spend telemetry,
 * intercepts runtime console/pageerror/CORS/XHR failures, inspects cross-origin
 * booking/form iframes, and performs safe read-only interactive click tests on
 * "Add to Cart" / "Book Now" conversion flows.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const NOISE_HOST_RE =
  /(google-analytics|googletagmanager|doubleclick|googlesyndication|facebook\.com|connect\.facebook|fbcdn\.net|tiktok\.com|hotjar|clarity\.ms|sentry\.io|newrelic|datadog|cookiebot|onetrust|cookielaw|usercentrics|klaviyo|intercom|crisp\.chat|tawk\.to|zendesk|zdassets|gorgias|recaptcha|hcaptcha|cloudflareinsights|plausible|segment\.io|mixpanel|amplitude|pinimg|ads-twitter|linkedin\.com\/px|bat\.bing|monorail|web-pixels|shopify\.com\/checkouts\/internal)/i;

const CONVERSION_IFRAME_RE =
  /(calendly\.com|acuityscheduling\.com|square\.site|squareup\.com|cliniko\.com|janeapp\.com|fresha\.com|booksy\.com|setmore\.com|mindbodyonline\.com|typeform\.com|jotform\.com|hsforms|leadconnectorhq\.com|zoho|simplybook|timify|phorest|doctify|stripe\.com)/i;

const DEAD_EMBED_TEXT_RE =
  /(this calendly url is not valid|page not found|404\s*error|this link is no longer valid|this form is currently unavailable|form not found|form is over quota|account has been suspended|this shop is currently unavailable|currently offline|doesn't exist|no longer accepting responses|unable to load booking)/i;

const AD_SCRIPT_SIGNATURES = [
  { label: "Meta Pixel (fbq)", re: /(connect\.facebook\.net\/.*fbevents|facebook\.com\/tr\?|fbq\(['"]init['"])/i },
  { label: "Google Ads Tag (AW)", re: /(googleadservices\.com\/pagead|googlesyndication\.com|AW-[0-9]{6,})/i },
  { label: "TikTok Pixel", re: /(analytics\.tiktok\.com|ttq\.load\()/i },
  { label: "Microsoft Ads UET", re: /bat\.bing\.com/i },
  { label: "LinkedIn Insight", re: /snap\.licdn\.com/i },
];

function parseCliArgs(argv) {
  const args = { urls: [], targetsFile: null, concurrency: 3, timeoutMs: 16000 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--url" && argv[i + 1]) args.urls.push(argv[++i]);
    else if (k === "--targets-file" && argv[i + 1]) args.targetsFile = argv[++i];
    else if (k === "--concurrency" && argv[i + 1]) args.concurrency = Math.max(1, Math.min(5, Number(argv[++i]) || 3));
    else if (k === "--timeout-ms" && argv[i + 1]) args.timeoutMs = Math.max(8000, Number(argv[++i]) || 16000);
  }
  if (args.targetsFile && fs.existsSync(args.targetsFile)) {
    const raw = JSON.parse(fs.readFileSync(args.targetsFile, "utf8"));
    for (const item of raw) {
      if (typeof item === "string") args.urls.push(item);
      else if (item?.url || item?.website) args.urls.push(item.url || item.website);
    }
  }
  return args;
}

function normalizeUrl(raw) {
  let u = String(raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function isNoisyUrl(u) {
  return NOISE_HOST_RE.test(String(u || ""));
}

function detectPlatform(html, reqUrls) {
  const low = (html || "").slice(0, 200000).toLowerCase();
  const joined = reqUrls.join(" ").toLowerCase();
  if (low.includes("shopify.theme") || low.includes("cdn.shopify.com") || joined.includes("cdn.shopify.com")) return "shopify";
  if (low.includes("woocommerce") || low.includes("wc-ajax=")) return "woocommerce";
  if (low.includes("/wp-content/")) return "wordpress";
  if (low.includes("_next/static")) return "nextjs";
  if (low.includes("static.wixstatic.com")) return "wix";
  if (low.includes("squarespace.com")) return "squarespace";
  if (low.includes("website-files.com")) return "webflow";
  return "custom";
}

const TRANSIENT_NOISE_ERR_RE = /^(a network error occurred|aborterror|load failed|failed to fetch|networkerror|resizeobserver loop|script error)[.\s]*$/i;

function isActionableClickError(msg) {
  const clean = String(msg || "").replace(/[.!\s]+$/g, "").trim();
  if (!clean || TRANSIENT_NOISE_ERR_RE.test(clean)) return false;
  if (/resizeobserver|fbevents|gtag|analytics|pixel|hotjar|clarity|tawk|crisp|intercom/i.test(clean)) return false;
  return true;
}

function attachTelemetry(page) {
  const telemetry = {
    pageErrors: [],
    consoleErrors: [],
    failedXhr: [],
    httpErrorXhr: [],
    requestUrls: [],
    extraEmails: [],
  };

  page.on("pageerror", (err) => {
    const msg = String(err?.message || err || "").trim().slice(0, 240);
    if (isActionableClickError(msg) && !telemetry.pageErrors.includes(msg)) telemetry.pageErrors.push(msg);
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = String(msg.text() || "").trim().slice(0, 280);
    if (!text) return;
    telemetry.consoleErrors.push(text);
  });

  page.on("request", (req) => {
    if (telemetry.requestUrls.length < 300) telemetry.requestUrls.push(req.url());
  });

  page.on("requestfailed", (req) => {
    const type = req.resourceType();
    const url = req.url();
    const errText = req.failure()?.errorText || "ERR_FAILED";
    if (!["xhr", "fetch", "document", "script"].includes(type)) return;
    if (errText === "net::ERR_ABORTED") return;
    if (isNoisyUrl(url)) return;
    telemetry.failedXhr.push({
      method: req.method(),
      type,
      url: url.slice(0, 220),
      reason: errText,
    });
  });

  page.on("response", (resp) => {
    const type = resp.request().resourceType();
    const url = resp.url();
    const st = resp.status();
    if (!["xhr", "fetch"].includes(type)) return;
    if (isNoisyUrl(url)) return;
    if (st >= 400 && st !== 404) {
      telemetry.httpErrorXhr.push({
        method: resp.request().method(),
        status: st,
        url: url.slice(0, 220),
      });
    } else if (st === 404 && /(cart|checkout|book|appoint|schedule|stripe|pay|quote|form|wp-json|admin-ajax|api\/)/i.test(url)) {
      telemetry.httpErrorXhr.push({
        method: resp.request().method(),
        status: st,
        url: url.slice(0, 220),
      });
    }
  });

  return telemetry;
}

async function inspectConversionIframes(page, baseHost, findings) {
  const frames = page.frames();
  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;
    const fUrl = frame.url() || "";
    if (!fUrl || fUrl === "about:blank") continue;
    if (fUrl.startsWith("chrome-error://")) {
      findings.push({
        kind: "BOOKING_IFRAME_DEAD",
        severity: "critical",
        actionTested: "Embedded widget/iframe load",
        evidence: "Embedded frame hit browser error page (chrome-error://) due to X-Frame-Options/CSP or dead host",
        url: fUrl,
        rootCauseFix: "Update iframe src / allow frame-ancestors or replace broken embed with direct booking link.",
      });
      continue;
    }
    if (!CONVERSION_IFRAME_RE.test(fUrl) && !/book|appoint|schedule|form|checkout/i.test(fUrl)) continue;
    try {
      const fText = await frame.locator("body").innerText({ timeout: 2500 }).catch(() => "");
      const m = fText.match(DEAD_EMBED_TEXT_RE);
      if (m) {
        findings.push({
          kind: "BOOKING_IFRAME_DEAD",
          severity: "critical",
          actionTested: `Embedded frame (${new URL(fUrl).hostname})`,
          evidence: `Live booking/form iframe renders error: "${m[0]}" inside ${fUrl.slice(0, 140)}`,
          url: fUrl,
          rootCauseFix: "Fix or replace expired Calendly/Typeform/booking embed slug so visitors can submit/book.",
        });
      }
    } catch {
      // Cross-origin isolated iframe content unreadable directly; CSP/frame errors are caught via consoleErrors.
    }
  }
}

async function testShopifyOrWooCart(page, baseUrl, platform, telemetry, findings) {
  // Find 1 live in-stock product URL safely via DOM or Shopify /products.json
  let productUrl = null;
  if (platform === "shopify") {
    try {
      const jsonUrl = new URL("/products.json?limit=8", baseUrl).toString();
      const resp = await fetch(jsonUrl, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        for (const p of data?.products || []) {
          const v = (p.variants || []).find((x) => x.available !== false);
          if (v && p.handle) {
            productUrl = new URL(`/products/${p.handle}`, baseUrl).toString();
            break;
          }
        }
      }
    } catch {
      // Fall back to DOM product link discovery
    }
  }

  if (!productUrl) {
    productUrl = await page
      .evaluate(() => {
        const links = [...document.querySelectorAll("a[href]")]
          .map((a) => ({ href: a.href, text: (a.textContent || "").trim() }))
          .filter((x) => /\/(products?|shop|item)\/[^/?#]+/i.test(x.href) && !/cart|checkout|login/i.test(x.href));
        return links[0]?.href || null;
      })
      .catch(() => null);
  }

  if (!productUrl) return null;

  try {
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.waitForTimeout(1500);
  } catch {
    return null;
  }

  const preErrors = telemetry.pageErrors.length;
  const preHttpErr = telemetry.httpErrorXhr.length;
  const preFailed = telemetry.failedXhr.length;

  const btnInfo = await page
    .evaluate(() => {
      const candidates = [
        ...document.querySelectorAll('button[name="add"], button.single_add_to_cart_button, button[type="submit"], a.add_to_cart_button'),
        ...[...document.querySelectorAll("button, a, input[type='submit']")].filter((el) =>
          /^\s*(add to cart|add to bag|add to basket|buy now)\s*$/i.test((el.textContent || el.value || "").trim())
        ),
      ];
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 14) continue;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const txt = (el.textContent || el.value || "").trim();
        if (/sold out|unavailable|out of stock|notify me/i.test(txt) || el.disabled) continue;
        el.setAttribute("data-kurox-test-btn", "1");
        return { label: txt.slice(0, 60), tag: el.tagName.toLowerCase() };
      }
      return null;
    })
    .catch(() => null);

  if (!btnInfo) return null;

  const cartResponses = [];
  const onCartResp = (resp) => {
    const u = resp.url();
    if (/(\/cart\/add|wc-ajax=add_to_cart|\/cart\/update)/i.test(u)) {
      cartResponses.push({ url: u.slice(0, 180), status: resp.status() });
    }
  };
  page.on("response", onCartResp);

  try {
    await page.locator('[data-kurox-test-btn="1"]').first().click({ timeout: 4000 });
    await page.waitForTimeout(2600);
  } catch {
    // Button overlapped or detached dynamically
  } finally {
    page.off("response", onCartResp);
  }

  const newErrors = telemetry.pageErrors.slice(preErrors);
  const newHttpErr = telemetry.httpErrorXhr.slice(preHttpErr);
  const newFailed = telemetry.failedXhr.slice(preFailed);
  const badCart = cartResponses.find((c) => c.status >= 400 && c.status !== 422);

  // If Shopify/Woo returned 422 explicitly, check whether response text was genuine variant/JS breakage vs benign stock limit
  const status422 = cartResponses.find((c) => c.status === 422);

  if (badCart) {
    findings.push({
      kind: "CART_ADD_API_FAILED",
      severity: "critical",
      actionTested: `Clicked "${btnInfo.label}" on ${productUrl}`,
      evidence: `Cart endpoint returned HTTP ${badCart.status}: ${badCart.url}`,
      url: productUrl,
      rootCauseFix: "Fix broken Ajax cart endpoint / CSRF nonce or theme variant script rejecting valid Add-to-Cart POST.",
    });
  } else if (newErrors.length > 0) {
    findings.push({
      kind: "CLICK_HANDLER_JS_CRASH",
      severity: "critical",
      actionTested: `Clicked "${btnInfo.label}" on ${productUrl}`,
      evidence: `Uncaught JS exception fired on Add-to-Cart click: ${newErrors[0]}`,
      url: productUrl,
      rootCauseFix: "Patch JavaScript TypeError/runtime crash in theme cart/variant click handler so buyers can add items cleanly.",
    });
  } else if (newFailed.length > 0 || newHttpErr.length > 0) {
    const hit = newFailed[0] || newHttpErr[0];
    findings.push({
      kind: "CART_ADD_API_FAILED",
      severity: "high",
      actionTested: `Clicked "${btnInfo.label}" on ${productUrl}`,
      evidence: `Network request failed on Add-to-Cart click (${hit.status || hit.reason}): ${hit.url}`,
      url: productUrl,
      rootCauseFix: "Fix failing checkout/cart API call or CORS policy triggered when clicking Add to Cart.",
    });
  } else if (status422) {
    findings.push({
      kind: "CART_ADD_API_FAILED",
      severity: "high",
      actionTested: `Clicked "${btnInfo.label}" on ${productUrl}`,
      evidence: `Add-to-Cart endpoint returned HTTP 422 (${status422.url}) despite active in-stock button`,
      url: productUrl,
      rootCauseFix: "Sync hidden variant ID / form serialization in product template with available variant inventory.",
    });
  }

  // Also inspect /checkout on WooCommerce if Add-to-Cart passed cleanly (catches broken Stripe/PayPal/shipping AJAX)
  if (platform === "woocommerce" && findings.length === 0) {
    try {
      const checkoutUrl = new URL("/checkout/", productUrl).toString();
      const preCheckoutHttpErr = telemetry.httpErrorXhr.length;
      const preCheckoutPageErr = telemetry.pageErrors.length;
      const ckResp = await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(1800);
      const ckSt = ckResp ? ckResp.status() : 0;
      if (ckSt >= 500) {
        findings.push({
          kind: "PAYMENT_OR_API_ERROR",
          severity: "critical",
          actionTested: `Loaded checkout route ${checkoutUrl}`,
          evidence: `Checkout route returned HTTP ${ckSt}`,
          url: checkoutUrl,
          rootCauseFix: "Debug PHP/plugin fatal error on WooCommerce /checkout/ page.",
        });
      } else if (telemetry.httpErrorXhr.length > preCheckoutHttpErr) {
        const hit = telemetry.httpErrorXhr[preCheckoutHttpErr];
        findings.push({
          kind: "PAYMENT_OR_API_ERROR",
          severity: "critical",
          actionTested: `Loaded checkout route ${checkoutUrl}`,
          evidence: `Checkout API call failed with HTTP ${hit.status}: ${hit.url}`,
          url: checkoutUrl,
          rootCauseFix: "Fix payment gateway client-token or WooCommerce update_order_review AJAX 4xx/5xx error.",
        });
      } else if (telemetry.pageErrors.length > preCheckoutPageErr) {
        findings.push({
          kind: "CLICK_HANDLER_JS_CRASH",
          severity: "high",
          actionTested: `Loaded checkout route ${checkoutUrl}`,
          evidence: `Uncaught JS error on checkout page: ${telemetry.pageErrors[preCheckoutPageErr]}`,
          url: checkoutUrl,
          rootCauseFix: "Patch uncaught JavaScript error breaking checkout/payment script execution.",
        });
      }
    } catch {
      // Optional checkout check skip on timeout
    }
  }

  return productUrl;
}

async function testBookingCta(page, baseUrl, telemetry, findings) {
  const ctas = await page
    .evaluate(() => {
      const kw = /\b(book now|book online|book an appointment|book appointment|schedule|make an appointment|appointments?|reserve|free consultation|request quote|get a quote|enquire)\b/i;
      const out = [];
      for (const el of document.querySelectorAll("a, button")) {
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!txt || txt.length > 60 || !kw.test(txt)) continue;
        const href = el.tagName === "A" ? el.getAttribute("href") || "" : "";
        const resolved = el.tagName === "A" && el.href ? el.href : "";
        if (/^(mailto:|tel:)/i.test(href)) continue;
        out.push({ txt, href, resolved });
        if (out.length >= 6) break;
      }
      return out;
    })
    .catch(() => []);

  for (const cta of ctas.slice(0, 3)) {
    const target = cta.resolved;
    if (!target || cta.href === "#" || /^javascript:/i.test(cta.href)) continue;
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      continue;
    }
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
    const tHost = parsed.hostname.replace(/^www\./, "");
    const knownBooking = CONVERSION_IFRAME_RE.test(target);
    if (tHost !== baseHost && !knownBooking) continue;

    const preErr = telemetry.pageErrors.length;
    try {
      const resp = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 11000 });
      await page.waitForTimeout(1600);
      const st = resp ? resp.status() : 0;
      const bodyTxt = await page.locator("body").innerText().catch(() => "");
      const deadMatch = bodyTxt.match(DEAD_EMBED_TEXT_RE);
      if (st === 404 || st === 410 || st >= 500) {
        findings.push({
          kind: "BOOKING_CTA_BROKEN",
          severity: "critical",
          actionTested: `Followed "${cta.txt}" CTA`,
          evidence: `Booking destination ${target} returned HTTP ${st}`,
          url: target,
          rootCauseFix: `Restore or redirect broken booking endpoint ${parsed.pathname} so clients can complete bookings.`,
        });
        break;
      }
      if (deadMatch) {
        findings.push({
          kind: "BOOKING_CTA_BROKEN",
          severity: "critical",
          actionTested: `Followed "${cta.txt}" CTA`,
          evidence: `Live booking destination (${target}) renders broken error state: "${deadMatch[0]}"`,
          url: target,
          rootCauseFix: "Update broken/expired external booking URL or calendar slug on site CTAs.",
        });
        break;
      }
      await inspectConversionIframes(page, tHost, findings);
      const extraEmails = await page
        .evaluate(() => {
          const out = [];
          for (const a of document.querySelectorAll('a[href^="mailto:"]')) {
            const em = (a.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
            if (em.includes("@") && !out.includes(em)) out.push(em);
          }
          return out.slice(0, 6);
        })
        .catch(() => []);
      for (const em of extraEmails) {
        if (!telemetry.extraEmails.includes(em)) telemetry.extraEmails.push(em);
      }
      if (telemetry.pageErrors.length > preErr) {
        findings.push({
          kind: "CLICK_HANDLER_JS_CRASH",
          severity: "high",
          actionTested: `Loaded "${cta.txt}" page (${target})`,
          evidence: `Uncaught JS error on booking page: ${telemetry.pageErrors[preErr]}`,
          url: target,
          rootCauseFix: "Patch broken JavaScript bundle or third-party booking widget script crashing booking UI.",
        });
        break;
      }
    } catch {
      // Transient navigation timeout — ignore cleanly
    }
  }
}

export async function probeSingleUrl(context, rawUrl, timeoutMs = 16000) {
  const norm = normalizeUrl(rawUrl);
  if (!norm) return null;
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const rt = route.request().resourceType();
    if (rt === "media" || rt === "font") return route.abort();
    return route.continue();
  });

  const telemetry = attachTelemetry(page);
  const findings = [];
  let finalUrl = norm;
  let httpStatus = 0;
  let html = "";
  let bodyText = "";

  try {
    const resp = await page.goto(norm, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    httpStatus = resp ? resp.status() : 0;
    await page.waitForTimeout(1800);
    finalUrl = page.url();
    html = await page.content().catch(() => "");
    bodyText = await page.locator("body").innerText().catch(() => "");
  } catch (err) {
    await page.close().catch(() => {});
    return { inputUrl: norm, error: String(err?.message || err).slice(0, 140), findings: [] };
  }

  const baseHost = new URL(finalUrl).hostname.replace(/^www\./, "").toLowerCase();
  const platform = detectPlatform(html, telemetry.requestUrls);

  // Detect active ad-spend pixels (both script source & outgoing network requests)
  const combinedSignals = html + "\n" + telemetry.requestUrls.join("\n");
  const adPixels = AD_SCRIPT_SIGNATURES.filter((sig) => sig.re.test(combinedSignals)).map((s) => s.label);

  // Extract rendered emails inside live Chromium DOM (catches JS-rendered & Cloudflare-decoded mailto links)
  const emails = await page
    .evaluate(() => {
      const found = [];
      for (const a of document.querySelectorAll('a[href^="mailto:"]')) {
        const em = (a.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
        if (em.includes("@") && !found.includes(em)) found.push(em);
      }
      const txt = document.body?.innerText || "";
      for (const m of txt.matchAll(/\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,12})\b/g)) {
        const em = m[1].toLowerCase();
        if (!found.includes(em)) found.push(em);
      }
      return found.slice(0, 10);
    })
    .catch(() => []);

  // Check 1: Client-side Next.js/React hydration crash on load
  if (/Application error:\s*a client-side exception has occurred/i.test(bodyText)) {
    findings.push({
      kind: "CLIENT_HYDRATION_CRASH",
      severity: "critical",
      actionTested: "Initial page render in Chrome",
      evidence: 'Page crashed at runtime with "Application error: a client-side exception has occurred"',
      url: finalUrl,
      rootCauseFix: "Fix unhandled null/hydration mismatch crashing React/Next.js client bundle.",
    });
  }

  // Check 2: Frame-ancestors / X-Frame-Options CSP refusal logged by Chromium console
  const frameRefusal = telemetry.consoleErrors.find((c) => /refused to display .* in a frame|frame-ancestors|x-frame-options/i.test(c));
  if (frameRefusal && /(calendly|acuity|square|cliniko|janeapp|fresha|typeform|jotform|stripe|book|checkout)/i.test(frameRefusal)) {
    findings.push({
      kind: "BOOKING_IFRAME_DEAD",
      severity: "critical",
      actionTested: "Booking/payment iframe load",
      evidence: `Chrome blocked embedded widget: ${frameRefusal.slice(0, 180)}`,
      url: finalUrl,
      rootCauseFix: "Replace X-Frame-Options-blocked iframe with supported embed script or direct CTA button link.",
    });
  }

  // Check 3: CORS policy errors blocking real first-party or payment/booking API calls
  const corsErr = telemetry.consoleErrors.find(
    (c) => /blocked by cors policy|access-control-allow-origin/i.test(c) && !isNoisyUrl(c) && !/fonts\.googleapis|gstatic|youtube/i.test(c)
  );
  if (corsErr) {
    findings.push({
      kind: "RUNTIME_CHECKOUT_CORS_OR_CRASH",
      severity: "high",
      actionTested: "Browser XHR/Fetch API call",
      evidence: `Runtime CORS rejection: ${corsErr.slice(0, 180)}`,
      url: finalUrl,
      rootCauseFix: "Add valid Access-Control-Allow-Origin headers or proxy API calls through same-origin endpoint.",
    });
  }

  // Check 4: Inspect conversion iframes on landing page
  await inspectConversionIframes(page, baseHost, findings);

  // Check 4B: Mobile viewport (390x844) primary CTA clipping or overlay block check
  if (findings.length === 0) {
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
      const mobIssue = await page
        .evaluate(() => {
          const kw = /\b(book now|book online|book an appointment|book appointment|add to cart|add to bag|buy now|checkout)\b/i;
          for (const el of document.querySelectorAll("a, button")) {
            const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
            if (!txt || txt.length > 50 || !kw.test(txt)) continue;
            const st = window.getComputedStyle(el);
            if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) continue;
            if (el.closest('[aria-hidden="true"], .swiper-slide:not(.swiper-slide-active), .slick-slide:not(.slick-active), nav')) continue;
            el.scrollIntoView({ block: "center", inline: "nearest" });
            const r = el.getBoundingClientRect();
            if (r.width < 30 || r.height < 16) continue;
            if (r.right > window.innerWidth + 18 && r.left >= -5 && document.documentElement.scrollWidth > window.innerWidth + 12) {
              return { type: "clip", label: txt, detail: `Primary CTA "${txt}" overflows 390px mobile viewport (right=${Math.round(r.right)}px)` };
            }
            if (r.left < -5 || r.right <= 0) continue;
            const cx = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
            const cy = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height / 2));
            const topEl = document.elementFromPoint(cx, cy);
            if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
              const blockerMeta = `${topEl.tagName.toLowerCase()}#${topEl.id || ""}.${String(topEl.className || "").slice(0, 40)}`;
              const blockerTxt = (topEl.innerText || "").slice(0, 120);
              if (/cookie|consent|gdpr|privacy|accept|dialog|modal|overlay|backdrop/i.test(blockerMeta + " " + blockerTxt)) {
                return null;
              }
              const topPos = window.getComputedStyle(topEl).position;
              if (topPos === "fixed" || topPos === "sticky") {
                return { type: "covered", label: txt, detail: `On 390x844 mobile, fixed element (${blockerMeta}) covers center of "${txt}" button` };
              }
            }
            return null;
          }
          return null;
        })
        .catch(() => null);
      if (mobIssue) {
        findings.push({
          kind: "MOBILE_CTA_BLOCKED",
          severity: "high",
          actionTested: `390x844 mobile tap check on "${mobIssue.label}"`,
          evidence: mobIssue.detail,
          url: finalUrl,
          rootCauseFix: "Fix responsive CSS / z-index sticky element overlapping primary conversion button on mobile.",
        });
      }
      await page.setViewportSize({ width: 1366, height: 850 });
    } catch {
      await page.setViewportSize({ width: 1366, height: 850 }).catch(() => {});
    }
  }

  // Check 5: Storefront Add-to-Cart interactive click OR Local Service Booking CTA probe
  let testedProductUrl = null;
  if (platform === "shopify" || platform === "woocommerce") {
    testedProductUrl = await testShopifyOrWooCart(page, finalUrl, platform, telemetry, findings);
  } else {
    await testBookingCta(page, finalUrl, telemetry, findings);
  }

  // Check 6: Critical API XHR failures caught during load/click (booking, cart, checkout, forms, payments)
  if (findings.length === 0 && telemetry.httpErrorXhr.length > 0) {
    const apiErr = telemetry.httpErrorXhr.find((x) =>
      /(cart|checkout|book|appoint|schedule|stripe|pay|quote|admin-ajax|wp-json.*(form|book|wc|stripe)|api\/.*(book|cart|checkout|lead|quote|pay))/i.test(x.url)
    );
    if (apiErr) {
      findings.push({
        kind: "PAYMENT_OR_API_ERROR",
        severity: "high",
        actionTested: "Live browser network request",
        evidence: `${apiErr.method} ${apiErr.url} returned HTTP ${apiErr.status}`,
        url: finalUrl,
        rootCauseFix: "Resolve server/API 4xx/5xx failure on conversion endpoint in Chrome.",
      });
    }
  }

  // Check 7: Mixed-content HTTPS->HTTP form POST or runtime JS crash directly naming conversion systems
  const mixedFormAction = await page
    .evaluate(() => {
      if (window.location.protocol !== "https:") return null;
      for (const f of document.querySelectorAll("form[action]")) {
        const act = (f.getAttribute("action") || "").trim();
        if (/^http:\/\//i.test(act)) return act.slice(0, 140);
      }
      return null;
    })
    .catch(() => null);
  if (mixedFormAction) {
    findings.push({
      kind: "MIXED_CONTENT_FORM_POST",
      severity: "high",
      actionTested: "HTTPS lead/booking form inspection",
      evidence: `HTTPS page submits <form action="${mixedFormAction}"> over unencrypted HTTP (triggers Chrome insecure-form warning)`,
      url: finalUrl,
      rootCauseFix: "Update form action attribute from http:// to https://.",
    });
  }

  if (findings.length === 0 && telemetry.pageErrors.length > 0) {
    const severeErr = telemetry.pageErrors.find((e) => /(stripe|checkout|cart|calendly|acuity|bookly|square|shopify\.cart|wc_add_to_cart)/i.test(e));
    if (severeErr && (platform === "shopify" || platform === "woocommerce" || adPixels.length > 0)) {
      findings.push({
        kind: "CLICK_HANDLER_JS_CRASH",
        severity: "high",
        actionTested: "Conversion script execution in Chrome",
        evidence: `Uncaught runtime JS error affecting cart/checkout/booking: ${severeErr}`,
        url: testedProductUrl || finalUrl,
        rootCauseFix: "Fix uncaught frontend JavaScript exception breaking cart/checkout/booking scripts.",
      });
    }
  }

  await page.close().catch(() => {});

  // Deduplicate findings by kind
  const dedup = [];
  for (const f of findings) {
    if (!dedup.some((x) => x.kind === f.kind && x.evidence === f.evidence)) dedup.push(f);
  }

  const mergedEmails = [...new Set([...emails, ...(telemetry.extraEmails || [])])];

  return {
    inputUrl: norm,
    domain: baseHost,
    finalUrl,
    httpStatus,
    platform,
    adPixels,
    emails: mergedEmails,
    testedProductUrl,
    findings: dedup,
    stats: {
      pageErrors: telemetry.pageErrors.length,
      consoleErrors: telemetry.consoleErrors.length,
      httpErrorXhr: telemetry.httpErrorXhr.length,
      failedXhr: telemetry.failedXhr.length,
    },
  };
}

async function runBatch(urls, concurrency = 3, timeoutMs = 16000) {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let idx = 0;

  async function worker() {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 850 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    });
    while (idx < urls.length) {
      const myIdx = idx++;
      const target = urls[myIdx];
      try {
        const res = await probeSingleUrl(context, target, timeoutMs);
        if (res) results.push(res);
      } catch (err) {
        results.push({ inputUrl: target, error: String(err?.message || err), findings: [] });
      }
    }
    await context.close().catch(() => {});
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    await browser.close().catch(() => {});
  }
  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseCliArgs(process.argv);
  if (args.urls.length === 0) {
    console.error("Usage: node money_button_probe.mjs --url https://example.com OR --targets-file targets.json");
    process.exit(1);
  }
  const out = await runBatch(args.urls, args.concurrency, args.timeoutMs);
  console.log(JSON.stringify(out, null, 2));
}
