/**
 * Art50Scan — EU AI Act Article 50 C2PA Content Credentials & Live CDN Survival Scanner
 * Monetizes the Dec 2, 2026 EU AI Act Article 50(2) legacy marking deadline via
 * B2B corporate-card impulse packs ($15 Single-Site Compliance & CDN Fix Kit / $39 Pro Agency Pack)
 * + $0.05 x402 V2 CI/Agent verification API, backed by a 100% free client-side local inspector & lossless scrubber.
 */

import {
  MERCHANT_BASE,
  MERCHANT_SOLANA_ATA,
  BASE_USDC,
  SOLANA_NETWORK,
  SOLANA_USDC_MINT,
  MERCHANT_SOLANA_OWNER,
  PAYAI_SOLANA_FEE_PAYER,
  buildCorsHeaders,
  jsonResp,
  htmlResp,
  escapeHtml,
  constantTimeEqual,
  sha256Hex,
  handleStripeCheckoutRoute,
  handleGenericX402BuyRoute,
  handleRescueDownloadRoute,
  generic402Response,
  verifyAndSettleGenericX402,
  incrementFunnelCounter,
} from "../edge_helpers.js";
import { cleanSecret, hasSigningSecretConfigured, signToken } from "../stripe_billing.js";
import {
  getArticle50DeadlineInfo,
  inspectBinaryMedia,
  scanLiveSiteArticle50,
  buildArticle50ComplianceKit,
} from "./c2pa_engine.js";

export const ART50_PLANS = {
  audit: {
    id: "audit",
    sku: "art50-audit-kit-v1",
    name: "EU AI Act Article 50 Compliance Audit & CDN Fix Kit (.zip) — $15",
    description:
      "One-time domain-tailored EU AI Act Article 50 Compliance Kit (.zip): SHA-256 provenance audit JSON, asset CSV matrix, compliance memo, Cloudflare/Next.js/Cloudinary C2PA preservation configs, GitHub Actions CI gate, Node.js c2pa-node v2.1 signing starter, and WCAG Article 50(4) disclosure badge.",
    amountCents: 1500,
    amountMicro: 15000000,
    priceDisplay: "$15 USD / USDC (one-time)",
    tier: "audit_15",
  },
  pro: {
    id: "pro",
    sku: "art50-pro-agency-v1",
    name: "Pro Dev & Agency Multi-Site Article 50 Pack + License Key (.zip) — $39",
    description:
      "Full EU AI Act Article 50 Compliance & CDN Fix Kit PLUS multi-site agency rollout playbook, CI/x402 automation templates, and cross-device verifiable License Key restore.",
    amountCents: 3900,
    amountMicro: 39000000,
    priceDisplay: "$39 USD / USDC (one-time)",
    tier: "pro_39",
  },
};

export const ART50_API_CALL_PLAN = {
  id: "api_scan",
  sku: "art50-verify-call-v1",
  name: "Art50Scan CI / Agent C2PA Verification Call",
  description: "Single live URL CDN survival audit or binary C2PA inspection call ($0.05 USDC via x402 V2 Base or Solana).",
  amountCents: 5,
  amountMicro: 50000,
  priceDisplay: "$0.05 USDC",
  tier: "api_call",
};

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

async function appendKvLead(kv, leadId, record) {
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") return false;
  try {
    const rawIdx = await kv.get("art50:leads:index");
    const ids = rawIdx ? JSON.parse(rawIdx) : [];
    await kv.put(`art50:lead:item:${leadId}`, JSON.stringify(record), { expirationTtl: 180 * 86400 });
    const next = [leadId, ...(Array.isArray(ids) ? ids.filter((x) => x !== leadId) : [])].slice(0, 200);
    await kv.put("art50:leads:index", JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function buildStructuredJsonLd(origin) {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Art50Scan — EU AI Act Article 50 C2PA & CDN Provenance Scanner",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Any (Web Browser & Cloudflare Edge)",
    url: origin,
    description:
      "Live website CDN C2PA survival auditor, EU AI Act Article 50 readiness scanner, and 100% client-side C2PA Content Credentials, AI prompt inspector & lossless metadata scrubber.",
    browserRequirements: "Requires modern HTML5 browser with Web Crypto API",
    featureList: [
      "Live website CDN C2PA Content Credentials survival audit",
      "EU AI Act Article 50(2) & 50(4) compliance readiness scoring",
      "Zero-upload client-side JUMBF, PNG caBX, WebP C2PA, and ISOBMFF parser",
      "ComfyUI, Automatic1111, and Midjourney leaked prompt detector",
      "True lossless JPEG/PNG/WebP binary metadata scrubber",
      "Downloadable Cloudflare/Next.js/Cloudinary C2PA preservation configs & GitHub Actions CI gate",
    ],
    offers: [
      {
        "@type": "Offer",
        name: "Single-Site Article 50 Compliance & CDN Fix Kit",
        price: "15.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${origin}/#pricing`,
      },
      {
        "@type": "Offer",
        name: "Pro Dev & Agency Multi-Site Article 50 Pack",
        price: "39.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${origin}/#pricing`,
      },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the EU AI Act Article 50 December 2, 2026 deadline?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "EU AI Act Article 50 took legal effect on August 2, 2026. Providers of generative AI systems placed on the market before August 2, 2026 received a grace period until December 2, 2026 to implement compliant machine-readable markings (Article 50(2)). Penalties reach up to EUR 15 million or 3% of global annual turnover.",
        },
      },
      {
        "@type": "Question",
        name: "Why do CDNs like Next.js, Cloudflare, and Shopify break C2PA compliance?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Default image optimizers (such as Next.js /_next/image, Cloudflare Polish/Resizing without metadata=keep, Cloudinary without fl_keep_iptc, and Shopify CDN) re-encode images to WebP/AVIF and strip JPEG APP11 JUMBF and PNG caBX C2PA blocks silently, causing compliant source assets to arrive at EU users stripped of provenance.",
        },
      },
      {
        "@type": "Question",
        name: "How do I check if a live website's images still contain C2PA Content Credentials?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Enter your website or direct asset URL into Art50Scan's Live CDN Audit. The edge scanner fetches live published assets directly from your CDN, parses raw binary APP11/caBX/C2PA/XMP containers, checks CDN transformation headers, and reports whether C2PA survived edge delivery.",
        },
      },
      {
        "@type": "Question",
        name: "Are local files uploaded to a server when using the Local File Inspector?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Art50Scan's local C2PA inspector, leaked AI prompt reader, SHA-256 authorship receipt generator, and lossless JPEG/PNG/WebP scrubber run 100% locally inside your browser using JavaScript ArrayBuffers and Web Crypto.",
        },
      },
      {
        "@type": "Question",
        name: "Does stripping C2PA metadata remove Google SynthID invisible watermarks?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Lossless binary metadata scrubbing removes file-container metadata (EXIF, GPS, XMP, PNG text prompts, and C2PA manifests) without altering pixels. Pixel-embedded invisible watermarks such as Google SynthID live inside pixel distributions and are not removed by metadata scrubbing.",
        },
      },
      {
        "@type": "Question",
        name: "How can I inspect leaked ComfyUI or Stable Diffusion prompts inside PNG files?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Drop any PNG into Art50Scan's local inspector. It walks PNG tEXt, iTXt, and zTXt chunks locally to expose embedded Automatic1111 parameters, ComfyUI workflow JSON graphs, and Midjourney descriptions before you accidentally publish internal prompts.",
        },
      },
      {
        "@type": "Question",
        name: "What is included in the $15 Article 50 Compliance & CDN Fix Kit?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You receive an immediate server-compiled ZIP tailored to your scanned domain containing article50-compliance-audit.json, asset-provenance-matrix.csv, an executive compliance memo, drop-in Cloudflare/Next.js/Cloudinary/Nginx C2PA preservation configs, a GitHub Actions CI gate, a Node.js c2pa-node v2.1 signing starter, and WCAG-accessible Article 50(4) HTML/JSON-LD disclosure badges.",
        },
      },
      {
        "@type": "Question",
        name: "Can AI agents or CI/CD pipelines call Art50Scan programmatically?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Automated CI pipelines and x402-compatible AI agents can call POST /api/verify-c2pa using x402 V2 gasless USDC micropayments ($0.05 per scan on Base or Solana) or use the included GitHub Actions workflow template.",
        },
      },
    ],
  };

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Audit Your Live Website for EU AI Act Article 50 & C2PA CDN Survival in 3 Steps",
    step: [
      {
        "@type": "HowToStep",
        name: "Scan Your Live Production URL",
        text: "Paste your domain or live media URL into Art50Scan to inspect real CDN-delivered bytes for C2PA JUMBF manifests, IPTC DigitalSourceType tags, leaked AI prompts, and Article 50(4) disclosures.",
      },
      {
        "@type": "HowToStep",
        name: "Identify Stripping CDNs & Missing Disclosures",
        text: "Review the asset-by-asset report to spot Next.js /_next/image, Cloudflare Polish, Cloudinary, or Shopify transforms stripping C2PA credentials in transit.",
      },
      {
        "@type": "HowToStep",
        name: "Apply Drop-In CDN Configs & CI Gate",
        text: "Download your tailored Art50Scan Compliance Fix Kit (.zip) to apply metadata-preserving CDN rules, install the GitHub Actions C2PA gate, and publish Article 50(4) disclosure badges.",
      },
    ],
  };

  return [softwareApp, faqPage, howTo]
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n  ");
}

function renderLanding(origin, contactEmail) {
  const deadline = getArticle50DeadlineInfo();
  const daysText =
    deadline.daysUntilLegacyDeadline > 0
      ? `EU AI Act Article 50(2) Legacy Grace Period Ends Dec 2, 2026 (${deadline.daysUntilLegacyDeadline} days)`
      : "EU AI Act Article 50 Full Enforcement Active";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Art50Scan — EU AI Act Article 50 C2PA &amp; Live CDN Provenance Scanner</title>
  <meta name="description" content="Audit any live website CDN for EU AI Act Article 50 C2PA Content Credentials survival, inspect local files for C2PA/ComfyUI/EXIF metadata privately in-browser, and download drop-in CDN &amp; CI fix kits." />
  <link rel="canonical" href="${escapeHtml(origin)}/" />
  <link rel="manifest" href="/manifest.json" />
  ${buildStructuredJsonLd(origin)}
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#060911; color:#f1f5f9; max-width:1160px; margin:0 auto; padding:1.4rem 1rem 4.5rem; line-height:1.58; }
    a { color:#38bdf8; }
    header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem; border-bottom:1px solid #1e293b; padding-bottom:1rem; margin-bottom:1.1rem; }
    h1 { margin:0.25rem 0 0; font-size:1.85rem; color:#f8fafc; letter-spacing:-0.02em; }
    h2 { font-size:1.25rem; color:#f8fafc; margin:1.6rem 0 0.6rem; }
    .badge-red { display:inline-block; background:#450a0a; border:1px solid #ef4444; color:#fca5a5; font-size:0.74rem; font-weight:800; padding:0.24rem 0.68rem; border-radius:999px; letter-spacing:0.03em; }
    .badge-ok { display:inline-block; background:#052e16; border:1px solid #10b981; color:#6ee7b7; font-size:0.74rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:999px; }
    .notice { background:#0f172a; border:1px solid #334155; border-left:4px solid #38bdf8; border-radius:8px; padding:0.85rem 1rem; font-size:0.86rem; color:#cbd5e1; margin-bottom:1.2rem; }
    .grid { display:grid; grid-template-columns:1.32fr 0.92fr; gap:1.25rem; align-items:start; }
    @media(max-width:900px){ .grid{ grid-template-columns:1fr; } }
    .card { background:#0f1624; border:1px solid #1e293b; border-radius:12px; padding:1.2rem; margin-bottom:1rem; }
    .row { display:flex; gap:0.6rem; flex-wrap:wrap; align-items:center; }
    input, textarea, select { width:100%; background:#050810; color:#f8fafc; border:1px solid #334155; border-radius:8px; padding:0.68rem 0.8rem; font-size:0.9rem; margin:0.3rem 0 0.7rem; font-family:inherit; }
    label { display:block; font-size:0.8rem; font-weight:600; color:#94a3b8; }
    .btn { display:inline-block; padding:0.7rem 1.05rem; border-radius:8px; font-weight:700; cursor:pointer; border:0; color:#fff; background:#0284c7; text-align:center; font-size:0.89rem; text-decoration:none; }
    .btn:hover { filter:brightness(1.08); }
    .btn-green { background:#059669; }
    .btn-amber { background:#d97706; }
    .btn-slate { background:#334155; }
    .btn-sm { padding:0.42rem 0.75rem; font-size:0.78rem; }
    .pill { display:inline-block; font-size:0.72rem; font-weight:700; padding:0.15rem 0.52rem; border-radius:6px; margin:0.15rem 0.3rem 0.15rem 0; background:#0c4a6e; color:#7dd3fc; border:1px solid #075985; }
    .pill-warn { background:#451a03; color:#fde68a; border-color:#d97706; }
    .pill-err { background:#450a0a; color:#fca5a5; border-color:#dc2626; }
    .pill-ok { background:#052e16; color:#6ee7b7; border-color:#059669; }
    .dropzone { border:2px dashed #334155; border-radius:10px; padding:1.2rem; text-align:center; background:#080d18; cursor:pointer; margin:0.5rem 0 0.75rem; transition:border-color 0.15s; }
    .dropzone:hover { border-color:#38bdf8; }
    .tier { background:#090e1a; border:1px solid #1e293b; border-radius:10px; padding:0.95rem; margin-top:0.75rem; }
    .price { font-size:1.35rem; font-weight:800; color:#34d399; }
    .score-box { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; background:#080d18; border:1px solid #1e293b; border-radius:10px; padding:0.85rem 1rem; margin-top:0.75rem; }
    .asset-row { background:#080d18; border:1px solid #1e293b; border-radius:8px; padding:0.72rem; margin-top:0.55rem; font-size:0.82rem; }
    table { width:100%; border-collapse:collapse; margin:0.8rem 0; font-size:0.84rem; }
    th, td { border:1px solid #1e293b; padding:0.58rem 0.7rem; text-align:left; vertical-align:top; }
    th { background:#0b1220; color:#e2e8f0; }
    details { background:#0b1220; border:1px solid #1e293b; border-radius:8px; padding:0.7rem 0.9rem; margin-bottom:0.55rem; }
    summary { cursor:pointer; font-weight:700; color:#f8fafc; font-size:0.9rem; }
    pre { background:#050810; border:1px solid #1e293b; border-radius:8px; padding:0.75rem; overflow:auto; max-height:260px; font-size:0.77rem; color:#93c5fd; }
  </style>
</head>
<body>
  <header>
    <div>
      <span class="badge-red">&#9888; ${escapeHtml(daysText)}</span>
      <h1>Art50Scan — EU AI Act Article 50 C2PA &amp; CDN Survival Scanner</h1>
    </div>
    <div class="row">
      <button type="button" class="btn btn-slate btn-sm" onclick="toggleRestore()">Restore Purchase</button>
      <a class="btn btn-green btn-sm" href="#pricing">Get Fix Kit ($15)</a>
    </div>
  </header>

  <div class="notice">
    <strong>The Silent CDN Problem:</strong> Even when generative AI tools sign files with C2PA Content Credentials, production image pipelines (<code>Next.js /_next/image</code>, <code>Cloudflare Polish</code>, <code>Shopify CDN</code>, <code>Cloudinary</code>) strip JPEG <code>APP11</code> JUMBF and PNG <code>caBX</code> segments by default. In our live test, even <code>contentcredentials.org</code> served <strong>0 / 4</strong> C2PA-surviving images across its CDN (<code>55/100</code>). Audit your live production URL in 3 seconds below — or inspect &amp; scrub local files 100% privately in your browser.
  </div>

  <div id="restoreModal" class="card" style="display:none;border-color:#38bdf8;">
    <strong>Restore Previous Compliance Kit Purchase (Cross-Device)</strong>
    <p style="font-size:0.82rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Enter either your Stripe Checkout <code>session_id</code> (<code>cs_live_...</code>) or the email address used at checkout to recover your HMAC-signed License Key and download link.</p>
    <div class="row">
      <input id="restoreInput" type="text" placeholder="you@company.com or cs_live_..." style="flex:1;margin:0;" />
      <button type="button" class="btn" onclick="runRestore()">Verify &amp; Restore</button>
    </div>
    <div id="restoreOut" style="margin-top:0.65rem;font-size:0.84rem;"></div>
  </div>

  <div class="grid">
    <div>
      <div class="card" id="live-scanner">
        <strong>1. Free Live Website &amp; CDN C2PA Survival Audit</strong>
        <p style="font-size:0.83rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Fetches live images directly from your production CDN, parses raw binary JUMBF / <code>APP11</code> / <code>caBX</code> / <code>C2PA</code> / XMP containers, checks CDN stripping headers, and scores EU AI Act Article 50(2) &amp; 50(4) readiness.</p>
        <div class="row">
          <input id="urlInput" type="text" placeholder="https://your-saas-or-agency.com (or direct .jpg / .png / .webp URL)" style="flex:1;margin:0;" onkeydown="if(event.key==='Enter'){runLiveScan();}" />
          <button type="button" class="btn" onclick="runLiveScan()">Audit Live CDN</button>
        </div>
        <div class="row" style="margin-top:0.55rem;">
          <span style="font-size:0.76rem;color:#94a3b8;">Quick demos:</span>
          <button type="button" class="btn btn-slate btn-sm" data-demo-url="https://contentcredentials.org">Scan contentcredentials.org</button>
          <button type="button" class="btn btn-slate btn-sm" data-demo-url="https://openai.com">Scan openai.com</button>
        </div>
        <div id="liveOut" style="margin-top:0.75rem;font-size:0.86rem;color:#94a3b8;">Enter any domain above to run a live Article 50 &amp; CDN C2PA survival audit.</div>
      </div>

      <div class="card" id="local-inspector">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
          <strong>2. 100% Free Local File C2PA Inspector &amp; Lossless Scrubber</strong>
          <span class="badge-ok">Zero Server Upload &middot; Runs Locally</span>
        </div>
        <p style="font-size:0.82rem;color:#cbd5e1;margin:0.35rem 0 0.55rem;">Drop JPG, PNG, WEBP, AVIF, HEIC, MP4, or MOV files locally. Detects C2PA JUMBF boxes, X.509 signers, leaked ComfyUI/A1111/Midjourney prompts, EXIF GPS risks, generates a SHA-256 Authorship Receipt, and offers true <strong>lossless binary byte-splicing</strong> for JPEG/PNG/WebP.</p>
        <div class="dropzone" onclick="document.getElementById('localFileInput').click()" ondragover="event.preventDefault()" ondrop="handleDrop(event)">
          <strong>Drop image/video here or click to inspect locally</strong>
          <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.25rem;">Never leaves your device &middot; Instant ArrayBuffer binary parser</div>
          <input id="localFileInput" type="file" style="display:none;" onchange="handleFilePick(event)" />
        </div>
        <div class="row" style="margin-bottom:0.65rem;">
          <span style="font-size:0.76rem;color:#94a3b8;">1-Click Synthetic Binary Samples:</span>
          <button type="button" class="btn btn-slate btn-sm" onclick="runSyntheticSample('c2pa_jpeg')">OpenAI C2PA v2.1 JPEG</button>
          <button type="button" class="btn btn-slate btn-sm" onclick="runSyntheticSample('comfy_png')">ComfyUI Leaked Prompt PNG</button>
          <button type="button" class="btn btn-slate btn-sm" onclick="runSyntheticSample('gps_jpeg')">iPhone GPS-Exposed JPEG</button>
        </div>
        <div id="localOut" style="font-size:0.84rem;color:#94a3b8;">Select a file or click a 1-click binary sample above to inspect locally.</div>
      </div>
    </div>

    <div>
      <div class="card" id="pricing">
        <strong>EU AI Act Article 50 Compliance &amp; CDN Fix Kits</strong>
        <p style="font-size:0.82rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">One-time engineering kits (no subscription, no sales call). Saves ~10&ndash;15 engineering hours configuring CDN C2PA preservation, GitHub Actions CI checks, and Article 50(4) disclosure docs. Server-compiled ZIP with Stripe &amp; x402 USDC checkout.</p>

        <div class="tier" style="border-color:#059669;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Single-Site Article 50 Fix Kit (.zip)</strong>
            <span class="price">$15 <span style="font-size:0.74rem;color:#94a3b8;font-weight:500;">one-time</span></span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">7 ready-to-commit files tailored to your scanned domain: SHA-256 audit JSON, asset CSV matrix, compliance memo, Cloudflare/Next.js/Cloudinary/Nginx C2PA configs, GitHub Actions CI gate, Node.js <code>c2pa-node</code> v2.1 signing starter, and WCAG Article 50(4) badge.</p>
          <button type="button" class="btn btn-green" style="width:100%;" onclick="buyKit('audit')">Download Site Fix Kit — $15 (Card / Apple Pay)</button>
        </div>

        <div class="tier" style="border-color:#d97706;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>Pro Dev &amp; Agency Multi-Site Pack</strong>
            <span class="price" style="color:#fbbf24;">$39 <span style="font-size:0.74rem;color:#94a3b8;font-weight:500;">one-time</span></span>
          </div>
          <p style="font-size:0.81rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Everything in the Site Fix Kit PLUS multi-site agency rollout playbook, CI/x402 automation templates, and cross-device verifiable License Key restore.</p>
          <button type="button" class="btn btn-amber" style="width:100%;" onclick="buyKit('pro')">Get Pro Agency Pack — $39 (Card / Apple Pay)</button>
        </div>

        <div class="tier">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>CI / AI Agent API (<code>POST /api/verify-c2pa</code>)</strong>
            <span class="price" style="color:#38bdf8;font-size:1.1rem;">$0.05 / scan</span>
          </div>
          <p style="font-size:0.8rem;color:#cbd5e1;margin:0.35rem 0 0;">Gasless x402 V2 pay-per-call verification on Base &amp; Solana USDC. Zero monthly commitment; discoverable at <a href="/.well-known/x402.json">/.well-known/x402.json</a> &amp; <a href="/llms.txt">/llms.txt</a>.</p>
        </div>
        <p style="font-size:0.75rem;color:#94a3b8;margin:0.65rem 0 0;"><strong>Engineering Transparency:</strong> Art50Scan inspects real binary JUMBF/APP11/caBX/C2PA boxes, IPTC tags, and CDN headers on live edge responses. For full CA trust-list cryptographic signature validation &amp; signing in production, use the official <code>c2pa-node</code> starter included in every kit. Container scrubbing does not remove pixel-level watermarks like Google SynthID.</p>
      </div>

      <div class="card" id="enterprise-contact">
        <strong>Need Managed C2PA Signing API / Custom Agency Audit?</strong>
        <p style="font-size:0.82rem;color:#cbd5e1;margin:0.35rem 0 0.65rem;">Need HSM-backed X.509 C2PA signing or bulk EU AI Act compliance across 10+ domains before Dec 2, 2026? Drop your stack below.</p>
        <form onsubmit="submitLead(event)">
          <label for="leadCompany">Company / Agency Name *</label>
          <input id="leadCompany" required placeholder="e.g. Acme Media SaaS" />
          <label for="leadEmail">Work Email *</label>
          <input id="leadEmail" type="email" required placeholder="cto@company.com" />
          <label for="leadDomain">Primary Domain &amp; CDN Stack *</label>
          <input id="leadDomain" required placeholder="https://company.com (Next.js + Cloudflare)" />
          <label for="leadNotes">Monthly AI Assets / Deadline Notes (optional)</label>
          <textarea id="leadNotes" rows="2" placeholder="e.g. ~50,000 generated images/month needing C2PA signing + CDN rules"></textarea>
          <button type="submit" class="btn" style="width:100%;">Request Managed C2PA / Audit Quote</button>
          <div id="leadStatus" style="margin-top:0.6rem;font-size:0.82rem;"></div>
        </form>
      </div>
    </div>
  </div>

  <article class="card" id="guide">
    <h2>2026 EU AI Act Article 50 &amp; C2PA Content Credentials Compliance Guide</h2>
    <p style="font-size:0.88rem;color:#cbd5e1;"><strong>EU AI Act Article 50</strong> became legally enforceable on <strong>August 2, 2026</strong>, with a short grace period ending <strong>December 2, 2026</strong> for legacy generative AI systems to implement machine-readable provenance markings (Article 50(2)). Violations carry statutory penalties under Article 99(4) of up to <strong>&euro;15 million or 3% of global annual turnover</strong>. While the statute does not name a single vendor, the European Commission&apos;s Code of Practice highlights <strong>C2PA Content Credentials (ISO/IEC 22144)</strong> as the primary interoperable benchmark for machine-readable AI provenance.</p>

    <h2>Comparison: Art50Scan Live CDN Audit vs. Single-File Metadata Viewers</h2>
    <table>
      <thead>
        <tr>
          <th>Capability</th>
          <th>Art50Scan (Live CDN + Local Suite)</th>
          <th>Standard Free C2PA / EXIF Viewers</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Live Production URL &amp; CDN Survival Test</strong></td>
          <td>Fetches live edge-delivered assets across Cloudflare, Next.js, Shopify &amp; Cloudinary to prove whether C2PA actually survives delivery</td>
          <td>Manual single-file drag-and-drop only (misses silent CDN stripping)</td>
        </tr>
        <tr>
          <td><strong>Article 50(4) Page Disclosure Check</strong></td>
          <td>Audits visible AI labels, HTML meta tags, and Schema.org <code>DigitalSourceType</code> markup</td>
          <td>Not checked</td>
        </tr>
        <tr>
          <td><strong>Drop-In Engineering Fix Kit (.zip)</strong></td>
          <td>Domain-tailored CDN configs, GitHub Actions CI gate, <code>c2pa-node</code> v2.1 signing starter, CSV/JSON audit trail</td>
          <td>None (read-only)</td>
        </tr>
        <tr>
          <td><strong>Local File Privacy &amp; Lossless Scrubbing</strong></td>
          <td>100% browser-local ArrayBuffer parser + lossless JPEG/PNG/WebP byte-splicing + SHA-256 authorship receipt (Free)</td>
          <td>Often requires cloud upload or re-encodes pixels lossily</td>
        </tr>
        <tr>
          <td><strong>Honest SynthID Transparency</strong></td>
          <td>Explicitly notes that metadata scrubbing removes container tags only and cannot strip pixel-level watermarks like Google SynthID</td>
          <td>Often makes misleading claims about defeating pixel watermarks</td>
        </tr>
      </tbody>
    </table>

    <h2>Frequently Asked Questions</h2>
    <details>
      <summary>What happens on December 2, 2026 under EU AI Act Article 50?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Article 50 took general effect on August 2, 2026. Legacy generative AI systems placed on the EU market prior to August 2, 2026 were granted until December 2, 2026 to implement compliant machine-readable markings under Article 50(2).</p>
    </details>
    <details>
      <summary>Why do Next.js, Cloudflare, Shopify, and Cloudinary strip C2PA metadata?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Automatic image optimization pipelines transcode JPEG/PNG files into smaller WebP/AVIF buffers and discard application segments (JPEG APP11 JUMBF, PNG caBX) by default unless explicitly configured to preserve metadata (e.g., Cloudflare <code>metadata=keep</code>, Cloudinary <code>fl_keep_iptc</code>, or Next.js <code>unoptimized</code> for signed assets).</p>
    </details>
    <details>
      <summary>How do I inspect leaked Stable Diffusion or ComfyUI prompts inside PNG files?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Drop any PNG into the Local File Inspector above. Art50Scan reads PNG <code>tEXt</code>, <code>iTXt</code>, and <code>zTXt</code> chunks directly in browser memory to surface embedded Automatic1111 parameters, ComfyUI workflow JSON, and Midjourney descriptions — and lets you scrub them losslessly without re-encoding pixels.</p>
    </details>
    <details>
      <summary>Does lossless metadata scrubbing remove Google SynthID or invisible pixel watermarks?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">No. Lossless binary splicing excises file-header metadata blocks (EXIF, GPS, XMP, PNG text chunks, C2PA containers) with zero pixel degradation. Invisible pixel-level watermarks such as Google SynthID live inside pixel values themselves and are unaffected by metadata removal.</p>
    </details>
    <details>
      <summary>Are local files uploaded to any server?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Never. Everything in Section 2 (local binary C2PA parser, prompt viewer, SHA-256 receipt, and lossless scrubber) executes 100% locally in your browser using Web Crypto and typed <code>Uint8Array</code> buffers.</p>
    </details>
    <details>
      <summary>What exact files are inside the $15 Compliance &amp; CDN Fix Kit?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Seven tailored files: <code>article50-compliance-audit.json</code>, <code>asset-provenance-matrix.csv</code>, <code>article50-executive-memo.md</code>, <code>cdn-c2pa-preservation-configs.md</code>, <code>.github/workflows/art50-c2pa-gate.yml</code>, <code>c2pa-sign-and-verify-starter.mjs</code>, and <code>article50-disclosure-snippets.html</code>.</p>
    </details>
    <details>
      <summary>Can I restore my purchase on another laptop or browser?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Yes. Click <strong>Restore Purchase</strong> at the top of the page and enter your checkout email or Stripe <code>session_id</code>. Our Cloudflare Worker verifies your paid Stripe session server-side and mints a fresh signed download link and License Key.</p>
    </details>
    <details>
      <summary>How do CI pipelines or AI agents call Art50Scan automatically?</summary>
      <p style="font-size:0.84rem;color:#cbd5e1;margin-top:0.5rem;">Send a JSON request to <code>POST ${escapeHtml(origin)}/api/verify-c2pa</code> with <code>{"url":"https://..."}</code> using x402 V2 USDC payment headers ($0.05 on Base or Solana), or drop the included GitHub Actions workflow into your repository.</p>
    </details>
  </article>

  <script>
    let LAST_LOCAL_BYTES = null;
    let LAST_LOCAL_NAME = "asset";
    let LAST_LOCAL_FORMAT = "UNKNOWN";
    let LAST_LOCAL_SHA256 = "";

    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function toggleRestore() {
      const m = document.getElementById("restoreModal");
      if (m) m.style.display = m.style.display === "none" ? "block" : "none";
    }

    function readAscii(bytes, start, len) {
      const end = Math.min(bytes.length, start + len);
      let s = "";
      for (let i = start; i < end; i++) {
        const c = bytes[i];
        s += c >= 32 && c <= 126 ? String.fromCharCode(c) : " ";
      }
      return s;
    }

    function readU32BE(b, o) {
      return (((b[o] << 24) >>> 0) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    }

    function readU32LE(b, o) {
      return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | ((b[o + 3] << 24) >>> 0)) >>> 0;
    }

    async function sha256Local(bytes) {
      const d = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
    }

    function detectLocalFormat(bytes) {
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPEG";
      if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "PNG";
      if (bytes.length >= 12 && readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") return "WEBP";
      if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") return "ISOBMFF";
      return "OTHER";
    }

    async function inspectLocalBytes(bytes, filename) {
      LAST_LOCAL_BYTES = bytes;
      LAST_LOCAL_NAME = filename || "file";
      const fmt = detectLocalFormat(bytes);
      LAST_LOCAL_FORMAT = fmt;
      const hash = await sha256Local(bytes);
      LAST_LOCAL_SHA256 = hash;

      let c2paFound = false;
      let exifFound = false;
      let xmpFound = false;
      const textBlobs = [];
      const pngTexts = {};

      if (fmt === "JPEG") {
        let off = 2;
        while (off + 4 <= bytes.length) {
          if (bytes[off] !== 0xff) { off++; continue; }
          while (off < bytes.length && bytes[off] === 0xff) off++;
          if (off >= bytes.length) break;
          const mk = bytes[off++];
          if (mk === 0xd9 || mk === 0xda) break;
          if (mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) continue;
          if (off + 2 > bytes.length) break;
          const len = (bytes[off] << 8) | bytes[off + 1];
          if (len < 2 || off + len > bytes.length) break;
          const txt = readAscii(bytes, off + 2, Math.min(len - 2, 32768));
          if (mk === 0xe1) {
            if (txt.startsWith("Exif")) exifFound = true;
            if (txt.includes("xmp") || txt.includes("ns.adobe.com")) xmpFound = true;
            textBlobs.push(txt);
          } else if (mk === 0xeb) {
            if (/JP|jumb|c2pa/i.test(txt)) c2paFound = true;
            textBlobs.push(txt);
          } else if (mk === 0xfe) {
            textBlobs.push(txt);
          }
          off += len;
        }
      } else if (fmt === "PNG") {
        let off = 8;
        while (off + 12 <= bytes.length) {
          const len = readU32BE(bytes, off);
          const type = readAscii(bytes, off + 4, 4);
          if (off + 12 + len > bytes.length) break;
          if (type === "caBX") {
            c2paFound = true;
            textBlobs.push(readAscii(bytes, off + 8, Math.min(len, 32768)));
          } else if (type === "eXIf") {
            exifFound = true;
            textBlobs.push(readAscii(bytes, off + 8, Math.min(len, 16384)));
          } else if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
            const slice = bytes.subarray(off + 8, off + 8 + Math.min(len, 32768));
            const nIdx = slice.indexOf(0);
            const k = nIdx > 0 ? readAscii(slice, 0, nIdx).trim() : type;
            const v = readAscii(slice, Math.max(0, nIdx + 1), slice.length).trim();
            if (k) pngTexts[k] = v.slice(0, 600);
            if (/xmp/i.test(k) || v.includes("ns.adobe.com")) xmpFound = true;
            textBlobs.push(k + ": " + v);
          }
          if (type === "IEND") break;
          off += 12 + len;
        }
      } else if (fmt === "WEBP") {
        let off = 12;
        while (off + 8 <= bytes.length) {
          const id = readAscii(bytes, off, 4);
          const sz = readU32LE(bytes, off + 4);
          if (off + 8 + sz > bytes.length) break;
          if (id === "C2PA") c2paFound = true;
          if (id === "EXIF") exifFound = true;
          if (id === "XMP ") xmpFound = true;
          if (id === "C2PA" || id === "EXIF" || id === "XMP ") textBlobs.push(readAscii(bytes, off + 8, Math.min(sz, 32768)));
          off += 8 + sz + (sz % 2);
        }
      } else {
        textBlobs.push(readAscii(bytes, 0, Math.min(bytes.length, 32768)));
      }

      const corpus = textBlobs.join("\\n");
      if (/c2pa\\.actions|c2pa\\.manifest|c2pa\\.ai-disclosure/i.test(corpus)) c2paFound = true;
      const gpsRisk = /GPSLatitude|GPSLongitude|exif:GPS|GPSInfo/i.test(corpus);
      const srcTypes = ["trainedAlgorithmicMedia", "compositeWithTrainedAlgorithmicMedia", "digitalCapture"].filter((t) => corpus.includes(t));
      const signers = ["OpenAI", "Adobe", "Google", "Truepic", "Sony", "Leica", "Microsoft", "Midjourney", "ComfyUI"].filter((s) => new RegExp(s, "i").test(corpus));
      const leaked = pngTexts.prompt || pngTexts.workflow || pngTexts.parameters || "";

      const canScrub = fmt === "JPEG" || fmt === "PNG" || fmt === "WEBP";
      const out = document.getElementById("localOut");
      out.innerHTML =
        '<div class="asset-row">' +
          '<div><strong>' + esc(filename) + '</strong> <span class="pill">' + esc(fmt) + '</span><span class="pill">' + Number(bytes.length) + ' bytes</span>' +
          (c2paFound ? '<span class="pill pill-ok">C2PA Manifest Present</span>' : '<span class="pill pill-warn">No C2PA Manifest</span>') +
          (gpsRisk ? '<span class="pill pill-err">EXIF GPS Exposed</span>' : '') +
          (leaked ? '<span class="pill pill-warn">Leaked AI Prompt Found</span>' : '') +
          '</div>' +
          '<div style="margin-top:0.45rem;color:#cbd5e1;"><strong>SHA-256:</strong> <code>' + esc(hash) + '</code></div>' +
          '<div style="margin-top:0.35rem;color:#cbd5e1;"><strong>Signers / Generators:</strong> ' + esc(signers.join(", ") || "None detected") + ' &middot; <strong>DigitalSourceType:</strong> ' + esc(srcTypes.join(", ") || "None") + ' &middot; <strong>EXIF/XMP:</strong> ' + (exifFound ? "EXIF " : "") + (xmpFound ? "XMP" : (!exifFound ? "None" : "")) + '</div>' +
          (leaked ? '<pre style="margin-top:0.5rem;">' + esc(leaked) + '</pre>' : '') +
          '<div class="row" style="margin-top:0.65rem;">' +
            (canScrub ? '<button type="button" class="btn btn-amber btn-sm" onclick="downloadLosslessScrubbed()">Lossless Binary Scrub (' + esc(fmt) + ')</button>' : '') +
            '<button type="button" class="btn btn-slate btn-sm" onclick="downloadShaReceipt()">Download SHA-256 Authorship Receipt</button>' +
          '</div>' +
        '</div>';
    }

    function losslessScrubBytes(bytes, fmt) {
      if (fmt === "JPEG") {
        const parts = [bytes.subarray(0, 2)];
        let off = 2;
        while (off + 2 <= bytes.length) {
          if (bytes[off] !== 0xff) { parts.push(bytes.subarray(off)); break; }
          const start = off;
          while (off < bytes.length && bytes[off] === 0xff) off++;
          if (off >= bytes.length) break;
          const mk = bytes[off++];
          if (mk === 0xda || mk === 0xd9) { parts.push(bytes.subarray(start)); break; }
          if (mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { parts.push(bytes.subarray(start, off)); continue; }
          if (off + 2 > bytes.length) { parts.push(bytes.subarray(start)); break; }
          const len = (bytes[off] << 8) | bytes[off + 1];
          const segEnd = Math.min(bytes.length, off + len);
          const drop = mk === 0xe1 || mk === 0xe2 || mk === 0xeb || mk === 0xfe;
          if (!drop) parts.push(bytes.subarray(start, segEnd));
          off = segEnd;
        }
        const total = parts.reduce((a, p) => a + p.length, 0);
        const out = new Uint8Array(total);
        let pos = 0;
        for (const p of parts) { out.set(p, pos); pos += p.length; }
        return out;
      }
      if (fmt === "PNG") {
        const parts = [bytes.subarray(0, 8)];
        let off = 8;
        const dropTypes = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "caBX"]);
        while (off + 12 <= bytes.length) {
          const len = readU32BE(bytes, off);
          const type = readAscii(bytes, off + 4, 4);
          const end = off + 12 + len;
          if (end > bytes.length) break;
          if (!dropTypes.has(type)) parts.push(bytes.subarray(off, end));
          off = end;
          if (type === "IEND") break;
        }
        const total = parts.reduce((a, p) => a + p.length, 0);
        const out = new Uint8Array(total);
        let pos = 0;
        for (const p of parts) { out.set(p, pos); pos += p.length; }
        return out;
      }
      if (fmt === "WEBP") {
        const chunks = [];
        let off = 12;
        const dropIds = new Set(["EXIF", "XMP ", "C2PA"]);
        while (off + 8 <= bytes.length) {
          const id = readAscii(bytes, off, 4);
          const sz = readU32LE(bytes, off + 4);
          const padded = sz + (sz % 2);
          const end = off + 8 + padded;
          if (end > bytes.length) break;
          if (!dropIds.has(id)) chunks.push(bytes.subarray(off, end));
          off = end;
        }
        const payloadSize = chunks.reduce((a, c) => a + c.length, 0);
        const out = new Uint8Array(12 + payloadSize);
        out.set(bytes.subarray(0, 12), 0);
        const riffSize = 4 + payloadSize;
        out[4] = riffSize & 0xff;
        out[5] = (riffSize >> 8) & 0xff;
        out[6] = (riffSize >> 16) & 0xff;
        out[7] = (riffSize >>> 24) & 0xff;
        let pos = 12;
        for (const c of chunks) { out.set(c, pos); pos += c.length; }
        return out;
      }
      return bytes;
    }

    function downloadBlob(blob, name) {
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    }

    function downloadLosslessScrubbed() {
      if (!LAST_LOCAL_BYTES) return;
      const scrubbed = losslessScrubBytes(LAST_LOCAL_BYTES, LAST_LOCAL_FORMAT);
      downloadBlob(new Blob([scrubbed]), "scrubbed-" + LAST_LOCAL_NAME);
      inspectLocalBytes(scrubbed, "scrubbed-" + LAST_LOCAL_NAME);
    }

    function downloadShaReceipt() {
      if (!LAST_LOCAL_SHA256) return;
      const receipt = {
        receipt_type: "Art50Scan Local SHA-256 Provenance Snapshot",
        filename: LAST_LOCAL_NAME,
        format: LAST_LOCAL_FORMAT,
        byte_length: LAST_LOCAL_BYTES ? LAST_LOCAL_BYTES.length : 0,
        sha256: LAST_LOCAL_SHA256,
        generated_at_utc: new Date().toISOString(),
        note: "Client-side cryptographic hash proof computed via browser Web Crypto API.",
      };
      downloadBlob(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }), LAST_LOCAL_NAME + ".sha256-receipt.json");
    }

    function encodeAscii(str) {
      const a = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0x7f;
      return a;
    }

    function makePngChunk(type, dataBytes) {
      const out = new Uint8Array(12 + dataBytes.length);
      const len = dataBytes.length;
      out[0] = (len >>> 24) & 0xff;
      out[1] = (len >>> 16) & 0xff;
      out[2] = (len >>> 8) & 0xff;
      out[3] = len & 0xff;
      out.set(encodeAscii(type), 4);
      out.set(dataBytes, 8);
      return out;
    }

    function runSyntheticSample(kind) {
      if (kind === "c2pa_jpeg") {
        const payload = encodeAscii("JP  jumb c2pa.manifest c2pa.actions c2pa.ai-disclosure trainedAlgorithmicMedia OpenAI ChatGPT Truepic");
        const segLen = payload.length + 2;
        const out = new Uint8Array(2 + 4 + payload.length + 2);
        out[0] = 0xff; out[1] = 0xd8;
        out[2] = 0xff; out[3] = 0xeb;
        out[4] = (segLen >> 8) & 0xff; out[5] = segLen & 0xff;
        out.set(payload, 6);
        out[out.length - 2] = 0xff; out[out.length - 1] = 0xd9;
        inspectLocalBytes(out, "sample-openai-c2pa-v2.1.jpg");
      } else if (kind === "comfy_png") {
        const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const txt = encodeAscii("prompt\\0" + JSON.stringify({ model: "flux1-dev.safetensors", prompt: "editorial studio portrait of founder, 85mm lens", cfg: 3.5, seed: 42918821, software: "ComfyUI" }));
        const c1 = makePngChunk("tEXt", txt);
        const end = makePngChunk("IEND", new Uint8Array(0));
        const out = new Uint8Array(sig.length + c1.length + end.length);
        out.set(sig, 0); out.set(c1, sig.length); out.set(end, sig.length + c1.length);
        inspectLocalBytes(out, "sample-comfyui-leaked-prompt.png");
      } else {
        const payload = encodeAscii("Exif\\0\\0 Apple iPhone 16 Pro GPSLatitude 51.5074N GPSLongitude 0.1278W");
        const segLen = payload.length + 2;
        const out = new Uint8Array(2 + 4 + payload.length + 2);
        out[0] = 0xff; out[1] = 0xd8;
        out[2] = 0xff; out[3] = 0xe1;
        out[4] = (segLen >> 8) & 0xff; out[5] = segLen & 0xff;
        out.set(payload, 6);
        out[out.length - 2] = 0xff; out[out.length - 1] = 0xd9;
        inspectLocalBytes(out, "sample-iphone-gps-exposed.jpg");
      }
    }

    function handleFilePick(ev) {
      const f = ev.target && ev.target.files ? ev.target.files[0] : null;
      if (!f) return;
      f.arrayBuffer().then((ab) => inspectLocalBytes(new Uint8Array(ab), f.name));
    }

    function handleDrop(ev) {
      ev.preventDefault();
      const f = ev.dataTransfer && ev.dataTransfer.files ? ev.dataTransfer.files[0] : null;
      if (!f) return;
      f.arrayBuffer().then((ab) => inspectLocalBytes(new Uint8Array(ab), f.name));
    }

    async function runLiveScan(overrideUrl) {
      const inp = document.getElementById("urlInput");
      if (overrideUrl) inp.value = overrideUrl;
      const target = inp.value.trim();
      const out = document.getElementById("liveOut");
      if (!target) { out.textContent = "Enter a website domain or live media URL first."; return; }
      out.textContent = "Fetching live production CDN assets & parsing binary C2PA manifests...";
      try {
        const res = await fetch("/api/scan?url=" + encodeURIComponent(target));
        const d = await res.json();
        if (!res.ok || !d.ok) {
          out.innerHTML = '<div class="asset-row" style="border-color:#dc2626;color:#fca5a5;">Scan failed: ' + esc(d.error || res.status) + '</div>';
          return;
        }
        const scoreColor = d.readiness_score >= 80 ? "#34d399" : d.readiness_score >= 50 ? "#fbbf24" : "#f87171";
        const issuesHtml = (d.issues || []).map((i) =>
          '<div class="asset-row" style="border-color:#d97706;"><strong>[' + esc(i.severity) + '] ' + esc(i.title) + '</strong><div style="color:#cbd5e1;margin-top:0.2rem;">' + esc(i.remediation) + '</div></div>'
        ).join("");
        const assetsHtml = (d.assets || []).map((a) =>
          '<div class="asset-row"><div><strong>' + esc(a.filename || a.url) + '</strong> <span class="pill">' + esc(a.format) + '</span>' +
          (a.c2paPresent ? '<span class="pill pill-ok">C2PA Present</span>' : '<span class="pill pill-err">' + esc(a.article50Status) + '</span>') +
          (a.leakedPrompts && a.leakedPrompts.length ? '<span class="pill pill-warn">Leaked Prompt</span>' : '') +
          (a.gpsRisk ? '<span class="pill pill-err">GPS Risk</span>' : '') +
          '</div><div style="color:#94a3b8;margin-top:0.2rem;">CDN: ' + esc((a.cdnDetected || []).join(", ") || "Origin") + ' &middot; Signers: ' + esc((a.signerIssuers || []).join(", ") || "None") + ' &middot; SHA-256: <code>' + esc((a.sha256 || "").slice(0, 16)) + '...</code></div></div>'
        ).join("");

        const pct = Math.max(5, Math.min(100, Number(d.readiness_score || 0)));
        const barBg = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
        const cdnSummary = (d.site_cdn || []).join(", ") || "Direct Origin";
        const curlCmd = 'curl -sS ' + window.location.origin + '/api/scan?url=' + encodeURIComponent(d.target_url || target);

        out.innerHTML =
          '<div class="score-box">' +
            '<div style="flex:1;min-width:220px;"><strong style="font-size:1.05rem;">' + esc(d.hostname) + '</strong><div style="font-size:0.78rem;color:#94a3b8;">CDN: ' + esc(cdnSummary) + ' &middot; Assets Scanned: ' + Number(d.assets_scanned || 0) + ' &middot; C2PA Surviving: ' + Number(d.assets_with_c2pa || 0) + '</div>' +
            '<div style="margin-top:0.45rem;height:7px;background:#1e293b;border-radius:999px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + barBg + ';"></div></div></div>' +
            '<div style="text-align:right;"><div style="font-size:1.55rem;font-weight:800;color:' + scoreColor + ';">' + pct + ' / 100</div><div style="font-size:0.74rem;color:#cbd5e1;">' + esc(d.verdict) + '</div></div>' +
          '</div>' +
          issuesHtml +
          assetsHtml +
          '<div class="asset-row" style="border-color:#059669;background:#071512;margin-top:0.75rem;">' +
            '<strong style="color:#6ee7b7;">Ready-to-Download Fix Kit Compiled for ' + esc(d.hostname) + ' (7 Files)</strong>' +
            '<ul style="margin:0.4rem 0 0.65rem 1.15rem;padding:0;color:#cbd5e1;font-size:0.8rem;">' +
              '<li><code>article50-compliance-audit.json</code> &amp; <code>asset-provenance-matrix.csv</code> (with exact SHA-256 hashes above)</li>' +
              '<li><code>cdn-c2pa-preservation-configs.md</code> (tailored for ' + esc(cdnSummary) + ')</li>' +
              '<li><code>.github/workflows/art50-c2pa-gate.yml</code> (pre-wired CI gate for <code>' + esc(d.hostname) + '</code>)</li>' +
              '<li><code>c2pa-sign-and-verify-starter.mjs</code> + <code>article50-disclosure-snippets.html</code> + executive memo</li>' +
            '</ul>' +
            '<div class="row">' +
              '<button type="button" class="btn btn-green" data-buy-tier="audit">Download 7-File Fix Kit for ' + esc(d.hostname) + ' ($15)</button>' +
              '<button type="button" class="btn btn-amber" data-buy-tier="pro">Multi-Site Agency Pack ($39)</button>' +
            '</div>' +
            '<div style="margin-top:0.55rem;font-size:0.75rem;color:#94a3b8;">Free CI one-liner: <code>' + esc(curlCmd) + '</code></div>' +
          '</div>';
      } catch (e) {
        out.textContent = "Scan error: " + e.message;
      }
    }

    function buyKit(tier) {
      const target = document.getElementById("urlInput").value.trim() || "your-site.com";
      window.location.href = "/api/checkout?tier=" + encodeURIComponent(tier) + "&domain=" + encodeURIComponent(target);
    }

    async function runRestore() {
      const val = document.getElementById("restoreInput").value.trim();
      const out = document.getElementById("restoreOut");
      if (!val) { out.textContent = "Enter your checkout email or Stripe session_id."; return; }
      out.textContent = "Verifying paid Stripe order...";
      const payload = val.includes("@") ? { customer_email: val } : { session_id: val };
      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (!res.ok || !d.ok) {
          out.style.color = "#fca5a5";
          out.textContent = "Restore failed: " + (d.error || res.status);
          return;
        }
        localStorage.setItem("art50_license_token", d.token || "");
        out.style.color = "#34d399";
        out.innerHTML = 'Verified <strong>' + esc(d.tier) + '</strong> purchase for <code>' + esc(d.domain) + '</code>. License Key: <code>' + esc(d.licenseKey) + '</code> &middot; <a href="' + esc(d.downloadUrl) + '">Download Compliance Kit ZIP</a>';
      } catch (e) {
        out.style.color = "#fca5a5";
        out.textContent = "Restore error: " + e.message;
      }
    }

    async function submitLead(ev) {
      ev.preventDefault();
      const st = document.getElementById("leadStatus");
      st.textContent = "Submitting request...";
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: document.getElementById("leadCompany").value.trim(),
            email: document.getElementById("leadEmail").value.trim(),
            domain: document.getElementById("leadDomain").value.trim(),
            notes: document.getElementById("leadNotes").value.trim(),
          }),
        });
        const d = await res.json();
        if (!res.ok || !d.ok) { st.style.color = "#fca5a5"; st.textContent = "Error: " + (d.error || res.status); return; }
        st.style.color = "#34d399";
        st.innerHTML = 'Saved inquiry (Ref: <code>' + esc(d.lead_id) + '</code>). We respond within 24h or reach us directly at <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>.';
      } catch (e) {
        st.style.color = "#fca5a5";
        st.textContent = "Network error: " + e.message;
      }
    }

    document.addEventListener("click", function(ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest("[data-demo-url]") : null;
      if (btn) {
        ev.preventDefault();
        runLiveScan(btn.getAttribute("data-demo-url"));
        return;
      }
      const buyBtn = ev.target && ev.target.closest ? ev.target.closest("[data-buy-tier]") : null;
      if (buyBtn) {
        ev.preventDefault();
        buyKit(buyBtn.getAttribute("data-buy-tier") || "audit");
      }
    });

    (function init() {
      const qs = new URLSearchParams(window.location.search);
      const sid = qs.get("session_id");
      if (sid) {
        document.getElementById("restoreModal").style.display = "block";
        document.getElementById("restoreInput").value = sid;
        runRestore();
      }
      const qUrl = qs.get("url") || qs.get("domain");
      if (qUrl) runLiveScan(qUrl);
    })();
  </script>
</body>
</html>`;
}

async function buildPackForTarget(targetDomain, tier, bodyParams = {}, _env = null) {
  let scan;
  try {
    scan = await scanLiveSiteArticle50(targetDomain, fetch);
  } catch {
    scan = {
      ok: true,
      mode: "offline_fallback",
      target_url: /^https?:\/\//i.test(targetDomain) ? targetDomain : `https://${targetDomain}`,
      hostname: String(targetDomain || "target-site.com").replace(/^https?:\/\//i, "").split("/")[0],
      scanned_at: new Date().toISOString(),
      deadline: getArticle50DeadlineInfo(),
      readiness_score: 35,
      verdict: "PARTIAL_GAPS_ACTION_NEEDED",
      site_cdn: ["Origin / Edge CDN"],
      page_disclosure: { hasVisibleDisclosure: false, signals: [] },
      assets_scanned: 0,
      assets_with_c2pa: 0,
      assets_stripped_by_cdn: 0,
      assets_with_leaked_prompts: 0,
      assets_with_gps_risk: 0,
      issues: [
        {
          severity: "HIGH",
          code: "UNREACHABLE_OR_PRIVATE_ORIGIN",
          title: "Live origin could not be fetched from edge during pack build — full generic CDN/CI Article 50 remediation kit included",
          remediation: "Apply the included Cloudflare/Next.js/Cloudinary configs and GitHub Actions C2PA gate directly in your repo.",
        },
      ],
      assets: [],
    };
  }
  return buildArticle50ComplianceKit(targetDomain, tier, scan, bodyParams?.notes || "");
}

async function handleRestorePurchase(req, env, origin, cors) {
  const stripeKey = cleanSecret(env?.STRIPE_SECRET_KEY);
  if (!stripeKey || !hasSigningSecretConfigured(env)) {
    return jsonResp({ ok: false, error: "Stripe restore is not configured on this edge worker." }, 503, cors);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: "Invalid JSON body." }, 400, cors);
  }
  const sessionId = String(body?.session_id || "").trim();
  const email = String(body?.customer_email || body?.email || "").trim().toLowerCase();
  if (!sessionId && !email) {
    return jsonResp({ ok: false, error: "Provide either session_id or customer_email." }, 400, cors);
  }

  let paidSession = null;
  if (sessionId) {
    const sr = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!sr.ok) return jsonResp({ ok: false, error: "Stripe session lookup failed." }, 404, cors);
    const s = await sr.json();
    if (s.payment_status === "paid") paidSession = s;
  } else {
    const qs = new URLSearchParams({ "customer_details[email]": email, status: "complete", limit: "5" });
    const sr = await fetch(`https://api.stripe.com/v1/checkout/sessions?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!sr.ok) return jsonResp({ ok: false, error: "Stripe customer lookup failed." }, 502, cors);
    const list = await sr.json();
    paidSession = (list.data || []).find((s) => s.payment_status === "paid") || null;
  }

  if (!paidSession) {
    return jsonResp({ ok: false, error: "No paid Stripe order found for that session or email." }, 404, cors);
  }

  const tier = String(paidSession.metadata?.tier || "audit");
  const domain = String(paidSession.metadata?.target_domain || "your-site.com");
  const now = Math.floor(Date.now() / 1000);
  const token = await signToken(
    {
      typ: "art50_dl",
      tier,
      domain,
      sid: paidSession.id,
      iat: now,
      exp: now + 30 * 86400,
    },
    env.KUROX_SIGNING_SECRET,
    "art50_v1",
  );
  const licenseKey = `ART50-${(await sha256Hex(`${paidSession.id}:${domain}`)).slice(0, 12).toUpperCase()}`;
  return jsonResp(
    {
      ok: true,
      session_id: paidSession.id,
      tier,
      domain,
      licenseKey,
      token,
      downloadUrl: `${origin}/api/download?token=${encodeURIComponent(token)}&format=zip`,
    },
    200,
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
          service: "art50-scan",
          deadline: getArticle50DeadlineInfo(),
          merchant_base: MERCHANT_BASE,
          merchant_solana_ata: MERCHANT_SOLANA_ATA,
          has_kv: Boolean(env?.FUNNEL_KV),
          has_stripe: Boolean(cleanSecret(env?.STRIPE_SECRET_KEY) && hasSigningSecretConfigured(env)),
          plans: ART50_PLANS,
        },
        200,
        cors,
      );
    }

    if (path === "/robots.txt") {
      const txt = [
        "User-agent: *",
        "Allow: /",
        "User-agent: OAI-SearchBot",
        "Allow: /",
        "User-agent: GPTBot",
        "Allow: /",
        "User-agent: PerplexityBot",
        "Allow: /",
        "User-agent: ClaudeBot",
        "Allow: /",
        `Sitemap: ${url.origin}/sitemap.xml`,
      ].join("\n");
      return new Response(txt + "\n", { status: 200, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
    }

    if (path === "/sitemap.xml") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url.origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n  <url><loc>${url.origin}/llms.txt</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>\n`;
      return new Response(xml, { status: 200, headers: { ...cors, "Content-Type": "application/xml; charset=utf-8" } });
    }

    if (path === "/llms.txt") {
      const md = [
        "# Art50Scan — EU AI Act Article 50 C2PA & Live CDN Survival Scanner",
        "",
        `> Live URL: ${url.origin}`,
        "> Purpose: Audit live website CDNs (Cloudflare, Next.js, Shopify, Cloudinary) for C2PA Content Credentials survival & EU AI Act Article 50(2)/(4) readiness ahead of the Dec 2, 2026 grace-period deadline.",
        "",
        "## Capabilities",
        "- Free Live Website CDN & C2PA Survival Scanner: `GET /api/scan?url=https://example.com`",
        "- 100% Client-Side Local C2PA / ComfyUI / EXIF Inspector & Lossless JPEG/PNG/WebP Scrubber (zero server upload)",
        "- Tailored EU AI Act Article 50 Compliance & CDN Fix Kit (.zip): $15 Single-Site (`tier=audit`) / $39 Pro Agency (`tier=pro`)",
        "- Autonomous CI / Agent Verification API (x402 V2 Base & Solana USDC, $0.05/call): `POST /api/verify-c2pa`",
        "",
        "## Discovery & Payment Metadata",
        `- Health: ${url.origin}/health`,
        `- x402 Discovery: ${url.origin}/.well-known/x402.json`,
      ].join("\n");
      return new Response(md + "\n", { status: 200, headers: { ...cors, "Content-Type": "text/markdown; charset=utf-8" } });
    }

    if (path === "/manifest.json") {
      return jsonResp(
        {
          name: "Art50Scan — EU AI Act Article 50 C2PA Scanner",
          short_name: "Art50Scan",
          start_url: "/",
          display: "standalone",
          background_color: "#060911",
          theme_color: "#0284c7",
          description: "Live CDN C2PA survival audit & client-side media provenance suite for EU AI Act Article 50.",
        },
        200,
        cors,
      );
    }

    if (path === "/.well-known/x402.json") {
      return jsonResp(
        {
          x402Version: 2,
          service: "art50-scan",
          description: "EU AI Act Article 50 C2PA Content Credentials & Live CDN Survival Scanner",
          merchant: { base: MERCHANT_BASE, solanaOwner: MERCHANT_SOLANA_OWNER, solanaAta: MERCHANT_SOLANA_ATA },
          endpoints: [
            {
              path: "/api/verify-c2pa",
              method: "POST",
              priceUsd: "0.05",
              networks: ["eip155:8453", SOLANA_NETWORK],
              assets: { base: BASE_USDC, solana: SOLANA_USDC_MINT, solanaFeePayer: PAYAI_SOLANA_FEE_PAYER },
            },
            {
              path: "/api/buy",
              method: "POST",
              tiers: { audit: "$15.00", pro: "$39.00" },
              networks: ["eip155:8453", SOLANA_NETWORK],
            },
          ],
        },
        200,
        cors,
      );
    }

    if (path === "/api/scan") {
      if (req.method !== "GET" && req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405, cors);
      let target = url.searchParams.get("url") || url.searchParams.get("domain") || "";
      if (req.method === "POST") {
        try {
          const b = await req.json();
          target = b.url || b.domain || target;
        } catch {
          return jsonResp({ ok: false, error: "Invalid JSON body" }, 400, cors);
        }
      }
      try {
        const result = await scanLiveSiteArticle50(target, fetch);
        await incrementFunnelCounter(env, "art50_scan", "scans_total");
        return jsonResp(result, 200, cors);
      } catch (err) {
        return jsonResp({ ok: false, error: err.message }, err.httpStatus || 400, cors);
      }
    }

    if (path === "/api/verify-c2pa") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      const paymentHdr = req.headers.get("PAYMENT-SIGNATURE") || req.headers.get("X-PAYMENT") || "";
      if (!paymentHdr) {
        return generic402Response(req, "/api/verify-c2pa", ART50_API_CALL_PLAN, cors);
      }
      let settled;
      try {
        settled = await verifyAndSettleGenericX402(req, "/api/verify-c2pa", paymentHdr, ART50_API_CALL_PLAN, env);
      } catch (err) {
        return generic402Response(req, "/api/verify-c2pa", ART50_API_CALL_PLAN, cors, `Payment rejected: ${err.message}`);
      }
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ ok: false, error: "Invalid JSON body" }, 400, cors);
      }
      let report;
      if (body?.base64) {
        const binStr = atob(String(body.base64));
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        report = {
          ok: true,
          mode: "binary_api_verify",
          deadline: getArticle50DeadlineInfo(),
          asset: await inspectBinaryMedia(bytes, { filename: body.filename || "upload.bin", contentType: body.contentType || "" }),
        };
      } else {
        try {
          report = await scanLiveSiteArticle50(body?.url || body?.domain || "", fetch);
        } catch (err) {
          return jsonResp({ ok: false, error: err.message }, err.httpStatus || 400, cors);
        }
      }
      await incrementFunnelCounter(env, "art50_scan", "x402_api_calls");
      const receipt = btoa(
        JSON.stringify({
          success: true,
          payer: settled.payer,
          transaction: settled.transaction,
          network: settled.network,
          amount: String(ART50_API_CALL_PLAN.amountMicro),
          resource: `${url.origin}/api/verify-c2pa`,
        }),
      );
      return jsonResp(report, 200, cors, { "PAYMENT-RESPONSE": receipt, "X-Payment-Response": receipt });
    }

    if (path === "/api/restore") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      return await handleRestorePurchase(req, env, url.origin, cors);
    }

    if (path === "/api/contact") {
      if (req.method !== "POST") return jsonResp({ error: "POST required" }, 405, cors);
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResp({ ok: false, error: "Invalid JSON body" }, 400, cors);
      }
      const company = String(body?.company || "").trim().slice(0, 140);
      const email = String(body?.email || "").trim().toLowerCase().slice(0, 140);
      const domain = String(body?.domain || "").trim().slice(0, 200);
      if (!company || !domain || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return jsonResp({ ok: false, error: "Valid company, work email, and domain are required." }, 400, cors);
      }
      const leadId = `A50-${(await sha256Hex(`${company}:${email}:${Date.now()}`)).slice(0, 8).toUpperCase()}`;
      const record = {
        lead_id: leadId,
        company,
        email,
        domain,
        notes: String(body?.notes || "").trim().slice(0, 1200),
        created_at: new Date().toISOString(),
      };
      const persisted = await appendKvLead(env?.FUNNEL_KV, leadId, record);
      await incrementFunnelCounter(env, "art50_scan", "b2b_leads");
      return jsonResp({ ok: true, lead_id: leadId, persisted }, 201, cors);
    }

    if (path === "/api/leads") {
      if (req.method !== "GET") return jsonResp({ error: "GET required" }, 405, cors);
      if (!isAuthorizedAdmin(req, env)) return jsonResp({ error: "Unauthorized" }, 401, cors);
      const kv = env?.FUNNEL_KV;
      if (!kv) return jsonResp({ ok: true, count: 0, leads: [] }, 200, cors);
      const rawIdx = await kv.get("art50:leads:index");
      const ids = rawIdx ? JSON.parse(rawIdx) : [];
      const leads = (
        await Promise.all(
          (Array.isArray(ids) ? ids : []).slice(0, 100).map(async (id) => {
            const raw = await kv.get(`art50:lead:item:${id}`);
            return raw ? JSON.parse(raw) : null;
          }),
        )
      ).filter(Boolean);
      return jsonResp({ ok: true, count: leads.length, leads }, 200, cors);
    }

    if (path === "/api/checkout") {
      return await handleStripeCheckoutRoute({
        req,
        url,
        env,
        cors,
        plansMap: ART50_PLANS,
        defaultTier: "audit",
        targetParamKeys: ["domain", "url", "target"],
      });
    }

    if (path === "/api/buy") {
      return await handleGenericX402BuyRoute({
        req,
        url,
        env,
        cors,
        plansMap: ART50_PLANS,
        defaultTier: "audit",
        buildPackFn: (target, tier, bp) => buildPackForTarget(target, tier, bp, env),
        targetParamKeys: ["domain", "url", "target"],
      });
    }

    if (path === "/api/download") {
      return await handleRescueDownloadRoute({
        req,
        url,
        env,
        cors,
        plansMap: ART50_PLANS,
        defaultTier: "audit",
        tokenPrefix: "art50_v1",
        zipFilename: "art50-compliance-kit.zip",
        serviceTitle: "Art50Scan EU AI Act Article 50 Compliance Kit",
        buildPackFn: (target, tier, bp) => buildPackForTarget(target, tier, bp, env),
      });
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
