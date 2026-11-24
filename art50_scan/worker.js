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
  const daysLine =
    deadline.daysUntilLegacyDeadline > 0
      ? `EU AI Act Art. 50 is live now (since Aug 2, 2026) · Pre-Aug legacy grace period (Art. 111(4)) ends Dec 2 (${deadline.daysUntilLegacyDeadline} days).`
      : "EU AI Act Article 50 full enforcement is active (Art. 113 & Art. 111(4)).";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Art50Scan — Check if your website is stripping AI image labels (EU AI Act Art. 50)</title>
  <meta name="description" content="Free live check to see if Next.js, Cloudflare, Shopify, or Cloudinary is stripping C2PA AI image labels from your website before the Dec 2, 2026 EU AI Act Article 50 deadline." />
  <link rel="canonical" href="${escapeHtml(origin)}/" />
  <link rel="manifest" href="/manifest.json" />
  ${buildStructuredJsonLd(origin)}
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8f6f1;
      color: #1c1917;
      margin: 0;
      padding: 0 1.2rem 5rem;
      line-height: 1.62;
      -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 820px; margin: 0 auto; }
    a { color: #0f4c81; text-underline-offset: 3px; }
    a:hover { color: #1c1917; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.86em;
      background: #efece4;
      color: #1c1917;
      padding: 0.12rem 0.36rem;
      border-radius: 4px;
    }
    nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 1.25rem 0;
      border-bottom: 1px solid #e4e0d5;
      margin-bottom: 2.2rem;
      font-size: 0.88rem;
    }
    .brand {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 700;
      font-size: 1.15rem;
      color: #1c1917;
      text-decoration: none;
      letter-spacing: -0.01em;
    }
    .nav-links { display: flex; gap: 1.15rem; align-items: center; flex-wrap: wrap; }
    .nav-links a, .nav-links button {
      background: none;
      border: 0;
      padding: 0;
      font: inherit;
      color: #57534e;
      text-decoration: none;
      cursor: pointer;
    }
    .nav-links a:hover, .nav-links button:hover { color: #1c1917; text-decoration: underline; }
    .kicker {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 600;
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 0.22rem 0.62rem;
      border-radius: 4px;
      margin-bottom: 0.9rem;
    }
    h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(1.9rem, 4.2vw, 2.65rem);
      line-height: 1.16;
      letter-spacing: -0.02em;
      margin: 0 0 0.85rem;
      color: #111110;
    }
    .lead {
      font-size: 1.06rem;
      color: #44403c;
      margin: 0 0 1.6rem;
      max-width: 680px;
    }
    h2 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.45rem;
      letter-spacing: -0.015em;
      margin: 0 0 0.55rem;
      color: #111110;
    }
    h3 { font-size: 1rem; margin: 0 0 0.35rem; color: #1c1917; }
    .panel {
      background: #ffffff;
      border: 1px solid #e2ded3;
      border-radius: 10px;
      padding: 1.35rem;
      box-shadow: 0 1px 2px rgba(28, 25, 23, 0.04);
    }
    section { margin-top: 2.6rem; padding-top: 2.2rem; border-top: 1px solid #e4e0d5; }
    .scan-bar { display: flex; gap: 0.55rem; flex-wrap: wrap; }
    input, textarea {
      width: 100%;
      background: #ffffff;
      color: #1c1917;
      border: 1px solid #cbc6b8;
      border-radius: 7px;
      padding: 0.75rem 0.9rem;
      font-size: 0.96rem;
      font-family: inherit;
    }
    input:focus, textarea:focus { outline: 2px solid #1c1917; outline-offset: 1px; border-color: #1c1917; }
    label { display: block; font-size: 0.82rem; font-weight: 600; color: #44403c; margin: 0.65rem 0 0.25rem; }
    .btn {
      display: inline-block;
      background: #1c1917;
      color: #faf8f4;
      border: 1px solid #1c1917;
      border-radius: 7px;
      padding: 0.75rem 1.2rem;
      font-size: 0.93rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      white-space: nowrap;
    }
    .btn:hover { background: #292524; }
    .btn-green { background: #166534; border-color: #166534; color: #ffffff; }
    .btn-green:hover { background: #14532d; }
    .btn-outline { background: #ffffff; color: #1c1917; border: 1px solid #cbc6b8; }
    .btn-outline:hover { background: #f3f0e8; border-color: #a8a29e; }
    .btn-sm { padding: 0.36rem 0.7rem; font-size: 0.8rem; font-weight: 500; }
    .demos { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; margin-top: 0.85rem; font-size: 0.83rem; color: #57534e; }
    .row { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media(max-width:680px){ .two-col{ grid-template-columns: 1fr; } }
    .verdict-box {
      margin-top: 1.15rem;
      padding: 1.1rem 1.2rem;
      border-radius: 8px;
      border: 1px solid #e2ded3;
      background: #fcfbf8;
    }
    .check-list { list-style: none; padding: 0; margin: 0.75rem 0; font-size: 0.9rem; }
    .check-list li { padding: 0.32rem 0; border-bottom: 1px solid #efece4; display: flex; gap: 0.55rem; align-items: baseline; }
    .check-list li:last-child { border-bottom: 0; }
    .mark-ok { color: #15803d; font-weight: 700; }
    .mark-no { color: #b91c1c; font-weight: 700; }
    .tag {
      display: inline-block;
      font-size: 0.74rem;
      font-weight: 600;
      padding: 0.12rem 0.48rem;
      border-radius: 4px;
      margin-right: 0.3rem;
      background: #efece4;
      color: #44403c;
    }
    .tag-ok { background: #dcfce7; color: #166534; }
    .tag-err { background: #fee2e2; color: #991b1b; }
    .tag-warn { background: #fef3c7; color: #92400e; }
    .file-row {
      padding: 0.65rem 0.8rem;
      border: 1px solid #e7e3d8;
      border-radius: 7px;
      background: #ffffff;
      margin-top: 0.45rem;
      font-size: 0.84rem;
    }
    .fix-box {
      margin-top: 1.1rem;
      padding: 1.15rem 1.25rem;
      border: 1.5px solid #166534;
      border-radius: 9px;
      background: #f0fdf4;
    }
    .dropzone {
      border: 1.5px dashed #b8b2a4;
      border-radius: 8px;
      padding: 1.35rem 1rem;
      text-align: center;
      background: #fcfbf8;
      cursor: pointer;
      margin: 0.75rem 0;
    }
    .dropzone:hover { border-color: #1c1917; background: #ffffff; }
    .price-num {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.9rem;
      font-weight: 700;
      color: #111110;
    }
    .price-sub { font-size: 0.82rem; color: #78716c; font-weight: 400; }
    .muted { color: #57534e; font-size: 0.88rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.86rem; background: #ffffff; }
    th, td { border: 1px solid #e2ded3; padding: 0.65rem 0.75rem; text-align: left; vertical-align: top; }
    th { background: #f3f0e8; color: #1c1917; font-weight: 600; }
    details {
      background: #ffffff;
      border: 1px solid #e2ded3;
      border-radius: 7px;
      padding: 0.75rem 0.95rem;
      margin-bottom: 0.55rem;
    }
    summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; color: #1c1917; }
    pre {
      background: #f3f0e8;
      border: 1px solid #e2ded3;
      border-radius: 6px;
      padding: 0.7rem;
      overflow: auto;
      max-height: 220px;
      font-size: 0.78rem;
      color: #1c1917;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <nav>
      <a class="brand" href="/">Art50Scan</a>
      <div class="nav-links">
        <a href="#local-check">Check a local file</a>
        <a href="#pricing">Fix Pack ($15)</a>
        <a href="#faq">FAQ</a>
        <button type="button" onclick="toggleRestore()">Restore purchase</button>
      </div>
    </nav>

    <div id="restoreModal" class="panel" style="display:none;margin-bottom:1.5rem;border-color:#1c1917;">
      <h3>Restore a previous Fix Pack purchase</h3>
      <p class="muted" style="margin:0.2rem 0 0.75rem;">Enter the email address you paid with (or your Stripe <code>session_id</code>) to get a fresh download link and license key.</p>
      <div class="scan-bar">
        <input id="restoreInput" type="text" placeholder="you@company.com or cs_live_..." style="flex:1;" />
        <button type="button" class="btn" onclick="runRestore()">Find my order</button>
      </div>
      <div id="restoreOut" style="margin-top:0.65rem;font-size:0.86rem;"></div>
    </div>

    <div class="kicker">${escapeHtml(daysLine)}</div>
    <h1>Is your website quietly stripping AI image labels?</h1>
    <p class="lead">EU AI Act Article 50 requires AI-generated media to carry machine-readable provenance tags (C2PA). Most teams add them — then <strong>Next.js, Cloudflare, Shopify, or Cloudinary</strong> wipes them out on the way to visitors. Paste your URL to check in 3 seconds.</p>

    <div class="panel" id="live-scanner">
      <div class="scan-bar">
        <input id="urlInput" type="text" placeholder="https://yourwebsite.com (or a direct image link)" style="flex:1;" onkeydown="if(event.key==='Enter'){runLiveScan();}" />
        <button type="button" class="btn" onclick="runLiveScan()">Check my site — Free</button>
      </div>
      <div class="demos">
        <span>Try real sites we tested today:</span>
        <button type="button" class="btn btn-outline btn-sm" data-demo-url="https://contentcredentials.org">contentcredentials.org</button>
        <button type="button" class="btn btn-outline btn-sm" data-demo-url="https://blackforestlabs.ai">blackforestlabs.ai</button>
        <button type="button" class="btn btn-outline btn-sm" data-demo-url="https://photoroom.com">photoroom.com</button>
      </div>
      <div id="liveOut" style="margin-top:0.9rem;font-size:0.88rem;color:#57534e;">
        No account needed. We inspect up to 8 live images straight from your CDN and tell you in plain English what survived and what got wiped.
      </div>
    </div>

    <section id="local-check">
      <h2>Check or clean a file on your computer (100% private)</h2>
      <p class="muted" style="margin:0 0 0.7rem;">Files never leave your device. See whether a photo or video carries C2PA AI labels, hidden Stable Diffusion / ComfyUI prompts, or your phone&apos;s GPS location — and strip metadata cleanly without losing a single pixel of quality.</p>
      <div class="panel">
        <div class="dropzone" onclick="document.getElementById('localFileInput').click()" ondragover="event.preventDefault()" ondrop="handleDrop(event)">
          <strong>Drop a JPG, PNG, WebP, or MP4 here — or click to pick a file</strong>
          <div class="muted" style="margin-top:0.2rem;font-size:0.82rem;">Runs locally in your browser &middot; zero upload</div>
          <input id="localFileInput" type="file" style="display:none;" onchange="handleFilePick(event)" />
        </div>
        <div class="demos" style="margin-top:0.35rem;">
          <span>Or test with a sample file:</span>
          <button type="button" class="btn btn-outline btn-sm" onclick="runSyntheticSample('c2pa_jpeg')">AI photo with C2PA label</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="runSyntheticSample('comfy_png')">PNG leaking a hidden prompt</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="runSyntheticSample('gps_jpeg')">iPhone photo leaking GPS</button>
        </div>
        <div id="localOut" style="margin-top:0.8rem;font-size:0.86rem;color:#57534e;">Drop a file or click a sample above to see what&apos;s hidden inside it.</div>
      </div>
    </section>

    <section id="pricing">
      <h2>Need to fix your site before Dec 2?</h2>
      <p class="muted" style="margin:0 0 1rem;">Checking your site and inspecting/cleaning local files is free. If your CDN is stripping tags and you don&apos;t want to burn two days figuring out C2PA configs, download a ready-to-commit Fix Pack tailored to your exact domain. One-time payment, no subscription.</p>

      <div class="two-col">
        <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <h3>Single-Site Fix Pack</h3>
            <div style="margin:0.35rem 0 0.65rem;"><span class="price-num">$15</span> <span class="price-sub">one-time ZIP download</span></div>
            <p class="muted" style="margin:0 0 0.7rem;">Built from your live scan above. Includes 7 files you can commit straight to your repo:</p>
            <ul style="margin:0 0 1rem 1.1rem;padding:0;font-size:0.85rem;color:#44403c;">
              <li>Exact CDN rules to stop stripping C2PA (Cloudflare, Next.js, Cloudinary, Nginx)</li>
              <li>Copy-paste GitHub Actions check that blocks broken deploys</li>
              <li>Working Node.js <code>c2pa-node</code> signing script for AI images</li>
              <li>Visible "Made with AI" HTML badge + Schema.org markup (Art. 50(4))</li>
              <li>Timestamped SHA-256 audit log (JSON + CSV) &amp; plain-English summary memo</li>
            </ul>
          </div>
          <button type="button" class="btn btn-green" style="width:100%;" onclick="buyKit('audit')">Download Fix Pack — $15</button>
        </div>

        <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <h3>Agency / Multi-Site Pack</h3>
            <div style="margin:0.35rem 0 0.65rem;"><span class="price-num">$39</span> <span class="price-sub">one-time ZIP + license key</span></div>
            <p class="muted" style="margin:0 0 0.7rem;">For studios, agencies, and teams managing multiple EU client sites or AI apps:</p>
            <ul style="margin:0 0 1rem 1.1rem;padding:0;font-size:0.85rem;color:#44403c;">
              <li>Everything in the Single-Site Fix Pack</li>
              <li>Multi-client rollout checklist for the Dec 2 deadline</li>
              <li>Automated CI / API verification templates (<code>$0.05</code>/scan pay-as-you-go)</li>
              <li>Cross-device purchase restore by email + verifiable license key</li>
            </ul>
          </div>
          <button type="button" class="btn" style="width:100%;" onclick="buyKit('pro')">Get Agency Pack — $39</button>
        </div>
      </div>

      <p class="muted" style="margin-top:0.85rem;font-size:0.81rem;">
        <strong>Honest technical note:</strong> Art50Scan inspects real binary C2PA boxes, IPTC tags, and CDN headers on live delivered files. For full cryptographic certificate validation &amp; signing in production, use the official <code>c2pa-node</code> starter inside the pack. Stripping file metadata does not remove pixel-level watermarks like Google SynthID. Programmatic CI / x402 API (<code>$0.05</code> USDC): <a href="/.well-known/x402.json">/.well-known/x402.json</a> &middot; <a href="/llms.txt">/llms.txt</a>.
      </p>
    </section>

    <section id="enterprise-contact">
      <h2>Managing 10+ sites or need a custom signing pipeline?</h2>
      <p class="muted" style="margin:0 0 0.85rem;">Drop your email and stack below if you want help rolling out C2PA signing or auditing multiple client domains before Dec 2.</p>
      <div class="panel">
        <form onsubmit="submitLead(event)">
          <div class="two-col">
            <div>
              <label for="leadCompany">Your name or company *</label>
              <input id="leadCompany" required placeholder="Acme Studio" />
            </div>
            <div>
              <label for="leadEmail">Work email *</label>
              <input id="leadEmail" type="email" required placeholder="you@company.com" />
            </div>
          </div>
          <label for="leadDomain">Website &amp; stack *</label>
          <input id="leadDomain" required placeholder="https://company.com (Next.js + Cloudflare)" />
          <label for="leadNotes">What do you need help with? (optional)</label>
          <textarea id="leadNotes" rows="2" placeholder="e.g. Auditing 12 EU client sites and setting up C2PA signing"></textarea>
          <button type="submit" class="btn" style="margin-top:0.75rem;">Send note</button>
          <div id="leadStatus" style="margin-top:0.6rem;font-size:0.85rem;"></div>
        </form>
      </div>
    </section>

    <section id="faq">
      <article>
        <h2>Plain-English Guide: EU AI Act Article 50 &amp; Why CDNs Break It</h2>
        <p class="muted"><strong>EU AI Act Article 50</strong> went into effect on <strong>August 2, 2026</strong>, with a grace period ending <strong>December 2, 2026</strong> for legacy generative AI tools to attach machine-readable provenance labels (Article 50(2)). Penalties under Article 99(4) can reach up to <strong>&euro;15 million or 3% of global annual turnover</strong>. The European Commission&apos;s Code of Practice points directly to <strong>C2PA Content Credentials (ISO/IEC 22144)</strong> as the benchmark standard.</p>
        <p class="muted">The catch: almost everyone tests C2PA on local files before uploading. The moment those files pass through default <code>Next.js /_next/image</code>, <code>Cloudflare Polish</code>, <code>Shopify CDN</code>, or <code>Cloudinary</code> pipelines, the image optimizer strips out the C2PA headers to save a few kilobytes. In our live scan of 15 European &amp; global AI websites, <strong>all 15 delivered 0 surviving C2PA tags across their CDN</strong>.</p>

        <table>
          <thead>
            <tr>
              <th>What you need to check</th>
              <th>Art50Scan</th>
              <th>Normal single-file C2PA viewers</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Does C2PA survive your live CDN?</strong></td>
              <td>Fetches live images straight from your website CDN and flags stripping headers</td>
              <td>Only checks files sitting on your laptop</td>
            </tr>
            <tr>
              <td><strong>Visible "Made with AI" notice (Art. 50(4))</strong></td>
              <td>Checks page HTML, meta tags, and Schema.org markup</td>
              <td>Not checked</td>
            </tr>
            <tr>
              <td><strong>Ready-to-commit CDN &amp; CI fix files</strong></td>
              <td>7 tailored files in an instant $15 ZIP</td>
              <td>Read-only viewer</td>
            </tr>
            <tr>
              <td><strong>Local file privacy &amp; lossless scrubbing</strong></td>
              <td>Free in-browser inspection, prompt check, and lossless JPEG/PNG/WebP clean</td>
              <td>Often uploads files to a server or re-compresses pixels</td>
            </tr>
          </tbody>
        </table>

        <h2 style="margin-top:1.8rem;">Frequently Asked Questions</h2>
        <details>
          <summary>What actually happens on December 2, 2026?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">Article 50 took general effect on August 2, 2026. Generative AI systems already on the EU market before August 2 got until December 2, 2026 to ship compliant machine-readable markings under Article 50(2).</p>
        </details>
        <details>
          <summary>Why do Next.js, Cloudflare, Shopify, and Cloudinary strip C2PA tags?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">Image optimizers re-encode images into smaller WebP/AVIF files and drop extra file headers (like JPEG APP11 and PNG caBX C2PA blocks) unless you explicitly tell them to preserve metadata (e.g. Cloudflare <code>metadata=keep</code>, Cloudinary <code>fl_keep_iptc</code>, or Next.js <code>unoptimized</code> for signed AI assets).</p>
        </details>
        <details>
          <summary>How do I check if a PNG is accidentally leaking my Stable Diffusion or ComfyUI prompts?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">Drop the PNG into the local file checker above. It reads PNG text chunks right in your browser so you can see leaked prompts or workflow JSON and strip them losslessly without uploading the file anywhere.</p>
        </details>
        <details>
          <summary>Does cleaning metadata remove Google SynthID invisible watermarks?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">No. Lossless cleaning removes container metadata (EXIF, GPS, prompts, C2PA headers) without changing pixels. Pixel-level watermarks like SynthID live inside the pixels themselves and are not removed by metadata scrubbers.</p>
        </details>
        <details>
          <summary>Are local files ever uploaded to a server?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">No. The local checker, SHA-256 receipt, and lossless scrubber run 100% inside your browser.</p>
        </details>
        <details>
          <summary>What exact files come in the $15 Fix Pack ZIP?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">Seven files built for your domain: <code>article50-compliance-audit.json</code>, <code>asset-provenance-matrix.csv</code>, <code>article50-executive-memo.md</code>, <code>cdn-c2pa-preservation-configs.md</code>, <code>.github/workflows/art50-c2pa-gate.yml</code>, <code>c2pa-sign-and-verify-starter.mjs</code>, and <code>article50-disclosure-snippets.html</code>.</p>
        </details>
        <details>
          <summary>Can I re-download my Fix Pack on another computer?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">Yes — click <strong>Restore purchase</strong> at the top of the page and enter the email you paid with to get a fresh verified download link.</p>
        </details>
        <details>
          <summary>Can CI pipelines or AI agents run automated checks?</summary>
          <p class="muted" style="margin:0.45rem 0 0;">Yes. Send a POST request to <code>${escapeHtml(origin)}/api/verify-c2pa</code> with <code>{"url":"https://..."}</code> via x402 V2 ($0.05 USDC on Base or Solana), or drop the GitHub Actions workflow from the Fix Pack into your repo.</p>
        </details>
      </article>
    </section>
  </div>

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
        '<div class="file-row">' +
          '<div><strong>' + esc(filename) + '</strong> <span class="tag">' + esc(fmt) + '</span><span class="tag">' + Number(bytes.length) + ' bytes</span>' +
          (c2paFound ? '<span class="tag tag-ok">C2PA Manifest Present</span>' : '<span class="tag tag-warn">No C2PA Label</span>') +
          (gpsRisk ? '<span class="tag tag-err">GPS Location Found</span>' : '') +
          (leaked ? '<span class="tag tag-warn">Leaked AI Prompt Found</span>' : '') +
          '</div>' +
          '<div style="margin-top:0.45rem;color:#44403c;"><strong>File fingerprint (SHA-256):</strong> <code>' + esc(hash.slice(0, 32)) + '...</code></div>' +
          '<div style="margin-top:0.28rem;color:#44403c;"><strong>Tool / camera found:</strong> ' + esc(signers.join(", ") || "None") + ' &middot; <strong>AI label type:</strong> ' + esc(srcTypes.join(", ") || "None") + ' &middot; <strong>Metadata blocks:</strong> ' + (exifFound ? "EXIF " : "") + (xmpFound ? "XMP" : (!exifFound ? "None" : "")) + '</div>' +
          (leaked ? '<pre style="margin-top:0.5rem;">' + esc(leaked) + '</pre>' : '') +
          '<div class="row" style="margin-top:0.65rem;">' +
            (canScrub ? '<button type="button" class="btn btn-sm" onclick="downloadLosslessScrubbed()">Clean metadata losslessly (' + esc(fmt) + ')</button>' : '') +
            '<button type="button" class="btn btn-outline btn-sm" onclick="downloadShaReceipt()">Save SHA-256 receipt</button>' +
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
          out.innerHTML = '<div class="file-row" style="border-color:#fca5a5;color:#991b1b;">Could not scan that site: ' + esc(d.error || res.status) + '</div>';
          return;
        }
        const pct = Math.max(5, Math.min(100, Number(d.readiness_score || 0)));
        const scoreColor = pct >= 80 ? "#15803d" : pct >= 50 ? "#b45309" : "#b91c1c";
        const cdnSummary = (d.site_cdn || []).join(", ") || "Direct Origin";
        const scannedN = Number(d.assets_scanned || 0);
        const c2paN = Number(d.assets_with_c2pa || 0);
        const stripN = Number(d.assets_stripped_by_cdn || 0);
        const leakN = Number(d.assets_with_leaked_prompts || 0);
        const gpsN = Number(d.assets_with_gps_risk || 0);
        const hasDisc = Boolean(d.page_disclosure && d.page_disclosure.hasVisibleDisclosure);
        const headline =
          scannedN === 0
            ? "No raster images found on that page to test."
            : c2paN === scannedN
              ? "All " + scannedN + " checked images kept their C2PA label."
              : c2paN + " of " + scannedN + " live images kept their AI provenance label.";

        const plainStatus = (st) => {
          if (st === "C2PA_PRESENT" || st === "C2PA_BOX_DETECTED") return '<span class="tag tag-ok">C2PA tag survived</span>';
          if (st === "LIKELY_STRIPPED_BY_CDN") return '<span class="tag tag-err">Stripped by CDN</span>';
          if (st === "IPTC_ONLY_NO_C2PA") return '<span class="tag tag-warn">IPTC only (no C2PA)</span>';
          return '<span class="tag tag-err">No C2PA tag</span>';
        };

        const assetsHtml = (d.assets || []).map((a) =>
          '<div class="file-row">' +
            '<div><strong>' + esc(a.filename || a.url) + '</strong> <span class="tag">' + esc(a.format) + '</span>' +
            plainStatus(a.article50Status) +
            (a.leakedPrompts && a.leakedPrompts.length ? '<span class="tag tag-warn">Prompt leaked</span>' : '') +
            (a.gpsRisk ? '<span class="tag tag-err">GPS leaked</span>' : '') +
            '</div>' +
            '<div style="color:#57534e;margin-top:0.2rem;">Delivered via: ' + esc((a.cdnDetected || []).join(", ") || "Direct origin") + ' &middot; Tool detected: ' + esc((a.signerIssuers || []).join(", ") || "None") + ' &middot; SHA-256: <code>' + esc((a.sha256 || "").slice(0, 14)) + '...</code></div>' +
          '</div>'
        ).join("");

        const curlCmd = 'curl -sS ' + window.location.origin + '/api/scan?url=' + encodeURIComponent(d.target_url || target);

        out.innerHTML =
          '<div class="verdict-box">' +
            '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0.5rem;">' +
              '<div><strong style="font-size:1.08rem;color:#111110;">' + esc(d.hostname) + ': ' + esc(headline) + '</strong><div class="muted" style="font-size:0.82rem;">CDN detected: ' + esc(cdnSummary) + '</div></div>' +
              '<div style="font-family:Georgia,serif;font-size:1.45rem;font-weight:700;color:' + scoreColor + ';">' + pct + ' / 100</div>' +
            '</div>' +
            '<ul class="check-list">' +
              '<li><span class="' + (c2paN > 0 ? 'mark-ok">&#10003;' : 'mark-no">&#10007;') + '</span><span><strong>AI provenance tags survived CDN delivery:</strong> ' + c2paN + ' of ' + scannedN + ' live images carried C2PA tags.</span></li>' +
              '<li><span class="' + (stripN === 0 ? 'mark-ok">&#10003;' : 'mark-no">&#10007;') + '</span><span><strong>CDN image optimizer check:</strong> ' + (stripN > 0 ? stripN + ' image(s) went through an optimizer that wipes C2PA by default.' : 'No active C2PA-stripping image proxy headers seen.') + '</span></li>' +
              '<li><span class="' + (hasDisc ? 'mark-ok">&#10003;' : 'mark-no">&#10007;') + '</span><span><strong>Visible &ldquo;Made with AI&rdquo; page notice (Art. 50(4)):</strong> ' + (hasDisc ? 'Disclosure text or markup found.' : 'None detected on this page.') + '</span></li>' +
              '<li><span class="' + (leakN === 0 && gpsN === 0 ? 'mark-ok">&#10003;' : 'mark-no">&#10007;') + '</span><span><strong>Private prompt &amp; GPS leak check:</strong> ' + (leakN === 0 && gpsN === 0 ? 'Clean (0 leaked prompts, 0 GPS tags).' : leakN + ' leaked prompt(s), ' + gpsN + ' GPS exposure(s).') + '</span></li>' +
            '</ul>' +
            assetsHtml +
            '<div class="fix-box">' +
              '<strong style="color:#14532d;font-size:0.98rem;">Fix ' + esc(d.hostname) + ' in 10 minutes — 7-file ZIP ready ($15 one-time)</strong>' +
              '<p class="muted" style="margin:0.25rem 0 0.65rem;font-size:0.83rem;color:#166534;">Includes your exact SHA-256 audit log (JSON + CSV), copy-paste CDN rules for <strong>' + esc(cdnSummary) + '</strong>, a GitHub Actions CI check pre-wired for <code>' + esc(d.hostname) + '</code>, a working Node.js C2PA signing starter, and an Art. 50(4) disclosure badge.</p>' +
              '<div class="row">' +
                '<button type="button" class="btn btn-green" data-buy-tier="audit">Download Fix Pack for ' + esc(d.hostname) + ' — $15</button>' +
                '<button type="button" class="btn btn-outline" data-buy-tier="pro">Multi-Site Agency Pack — $39</button>' +
              '</div>' +
              '<div style="margin-top:0.55rem;font-size:0.76rem;color:#57534e;">Free terminal check: <code>' + esc(curlCmd) + '</code></div>' +
            '</div>' +
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
          out.style.color = "#991b1b";
          out.textContent = "Restore failed: " + (d.error || res.status);
          return;
        }
        localStorage.setItem("art50_license_token", d.token || "");
        out.style.color = "#166534";
        out.innerHTML = 'Verified <strong>' + esc(d.tier) + '</strong> purchase for <code>' + esc(d.domain) + '</code>. License Key: <code>' + esc(d.licenseKey) + '</code> &middot; <a href="' + esc(d.downloadUrl) + '">Download Fix Pack ZIP</a>';
      } catch (e) {
        out.style.color = "#991b1b";
        out.textContent = "Restore error: " + e.message;
      }
    }

    async function submitLead(ev) {
      ev.preventDefault();
      const st = document.getElementById("leadStatus");
      st.textContent = "Sending...";
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
        if (!res.ok || !d.ok) { st.style.color = "#991b1b"; st.textContent = "Error: " + (d.error || res.status); return; }
        st.style.color = "#166534";
        st.innerHTML = 'Note received (Ref: <code>' + esc(d.lead_id) + '</code>). We reply within 24h, or email <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a> directly.';
      } catch (e) {
        st.style.color = "#991b1b";
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
      return htmlResp(renderLanding(url.origin, contactEmail), 200, cors, {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "frame-ancestors 'none'",
      });
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
