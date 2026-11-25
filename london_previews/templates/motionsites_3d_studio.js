/**
 * Style 3: Interactive 3D Showroom powered by:
 * - MotionSites unwatermarked 3D animated background video ("Eclipse Ring" / "Prism Ring" via get_background_video)
 * - True interactive 3D Perspective Cylinder Carousel (preserve-3d + rotateY + translateZ + pointer drag inertia + click-to-inspect lightbox)
 * - 3D cursor-tilt glass treatment cards with specular sheen
 * - 100% REAL Fresha studio photos, real £ prices, real verified reviews & direct WhatsApp booking concierge
 * - Unified 3-Style Live Switcher pill (3D Stage · Gallery · Fluted Glass · Go Live £199), stripped cleanly on ?clean=1
 */

const ASSET_ORIGIN = "https://london-previews.ak10082247.workers.dev";
const VIDEO_ECLIPSE = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261021_005636_b3cfb8b5-d8a7-4627-b543-4194e24ab5b7.mp4";
const VIDEO_PRISM = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePhotoUrl(p) {
  return /^https?:\/\//i.test(p) ? p : `${ASSET_ORIGIN}${p}`;
}

export function renderStyleSwitcherBar(studio, activeStyle, { clean = false } = {}) {
  if (clean) return "";
  const slug = esc(studio.slug);
  const styles = [
    { id: "3d", label: "3D Stage" },
    { id: "custom-spaces", label: "Gallery" },
    { id: "modern-agency", label: "Fluted Glass" },
  ];
  const tabsHtml = styles
    .map(
      (s) =>
        `<a class="sw-tab${activeStyle === s.id ? " on" : ""}" href="/s/${slug}?style=${s.id}">${s.label}</a>`
    )
    .join("");

  return `
  <aside class="sw-dock" id="previewPill" aria-label="Style switcher and launch controls">
    <div class="sw-tabs" role="navigation" aria-label="Choose website style">
      <span class="sw-dot" title="Live preview"></span>
      ${tabsHtml}
    </div>
    <button type="button" class="sw-go" id="openClaimBtn">Go Live · £199</button>
    <button type="button" class="sw-x" id="closePillBtn" aria-label="Hide switcher">×</button>
  </aside>
  <div class="cm-bg" id="claimModal" hidden>
    <div class="cm-box" role="dialog" aria-modal="true">
      <button type="button" class="cm-x" id="closeClaimBtn" aria-label="Close">×</button>
      <p class="cm-k">ONE-TIME LAUNCH · £0/MO HOSTING · ZERO CALLS</p>
      <h3>Launch ${esc(studio.name)} in this exact style.</h3>
      <p class="cm-p">Selected style: <strong>${esc(styles.find((x) => x.id === activeStyle)?.label || "3D Stage")}</strong>. Built with your real ${esc(studio.neighbourhood)} studio photos, real prices &amp; ${esc(studio.rating)}★ reviews. £199 one-time — everything handled strictly over WhatsApp or email.</p>
      <ul class="cm-ul">
        <li>Connected to your own <strong>.co.uk</strong> domain on <strong>£0/month</strong> Cloudflare hosting forever</li>
        <li>Full price list, extra photos &amp; wording tweaks included before going live in 24h</li>
        <li>Direct WhatsApp booking — keep 100% of repeat clients with zero platform commission</li>
        <li>Floating switcher bar removed completely on your live site</li>
      </ul>
      <button type="button" class="cm-pay" id="startCheckoutBtn">Claim This Style — £199 One-Time →</button>
      <a class="cm-mail" href="mailto:armkhan18@gmail.com?subject=${encodeURIComponent(`Launch ${studio.name} (${activeStyle}) — £199`)}">Questions? Email armkhan18@gmail.com</a>
      <p class="cm-st" id="claimStatus"></p>
    </div>
  </div>`;
}

export const STYLE_SWITCHER_CSS = `
.sw-dock{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:75;display:inline-flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-radius:9999px;background:rgba(14,14,17,.90);color:#fff;border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 16px 44px rgba(0,0,0,.38);font-family:system-ui,-apple-system,sans-serif;font-size:12px;max-width:calc(100vw - 20px)}
.sw-tabs{display:inline-flex;align-items:center;gap:4px}
.sw-dot{width:7px;height:7px;border-radius:50%;background:#34d399;margin-right:4px;flex-shrink:0}
.sw-tab{padding:6px 11px;border-radius:9999px;color:rgba(255,255,255,.72);font-weight:500;white-space:nowrap;transition:all .2s;text-decoration:none}
.sw-tab:hover{color:#fff;background:rgba(255,255,255,.09)}
.sw-tab.on{background:#fff;color:#111;font-weight:600}
.sw-go{padding:7px 14px;border-radius:9999px;border:0;background:#F26522;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;transition:transform .2s}
.sw-go:hover{transform:translateY(-1px)}
.sw-x{width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:15px;line-height:1;cursor:pointer;flex-shrink:0}
.cm-bg{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.68);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;font-family:system-ui,-apple-system,sans-serif}
.cm-bg[hidden]{display:none}
.cm-box{position:relative;width:min(510px,100%);background:#111216;color:#f5f5f7;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:32px 28px;box-shadow:0 28px 80px rgba(0,0,0,.55)}
.cm-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:transparent;color:#fff;font-size:18px;cursor:pointer}
.cm-k{font-size:11px;font-weight:700;letter-spacing:.14em;color:#F26522;margin:0 0 8px}
.cm-box h3{font-size:25px;font-weight:600;letter-spacing:-.025em;line-height:1.15;margin:0 0 12px}
.cm-p{font-size:14px;color:#b4b8c2;line-height:1.6;margin:0 0 16px}
.cm-ul{padding-left:18px;font-size:14px;color:#e5e7eb;display:grid;gap:8px;margin:0 0 22px}
.cm-pay{width:100%;padding:14px 20px;border-radius:9999px;border:0;background:#F26522;color:#fff;font-size:15px;font-weight:600;margin-bottom:10px;cursor:pointer}
.cm-mail{display:block;text-align:center;padding:11px;border-radius:9999px;border:1px solid rgba(255,255,255,.18);font-size:13px;font-weight:500;color:#e5e7eb;text-decoration:none}
.cm-st{font-size:13px;color:#f87171;text-align:center;margin:8px 0 0;min-height:18px}
@media(max-width:639px){
  .sw-dock{padding:5px 6px 5px 8px;gap:5px;font-size:11px}
  .sw-dot{display:none}
  .sw-tab{padding:5px 8px}
  .sw-go{padding:6px 10px;font-size:11px}
}
`;

export function renderMotionSites3DStudio(studio, { clean = false } = {}) {
  const photos = (studio.photos || []).map(resolvePhotoUrl);
  const ringPhotos = photos.length >= 6 ? photos.slice(0, 6) : [...photos, ...photos].slice(0, 6);
  const bgVideo = studio.cat === "barber" ? VIDEO_ECLIPSE : VIDEO_PRISM;
  const directWa = `https://wa.me/${studio.waDigits}?text=${encodeURIComponent(`Hi ${studio.name}, I'd love to book an appointment — do you have availability this week?`)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${studio.name} ${studio.street} ${studio.postcode} London`)}`;

  const servicesHtml = (studio.services && studio.services.length ? studio.services : [
    { name: "Signature Appointment", dur: "45 min", price: "Ask on WhatsApp" },
    { name: "Full Studio Consultation & Treatment", dur: "60 min", price: "Ask on WhatsApp" },
  ])
    .map(
      (srv, idx) => `
      <div class="tilt-card srv-card" data-tilt>
        <div class="srv-top">
          <span class="srv-idx">0${idx + 1}</span>
          <span class="srv-dur">${esc(srv.dur)}</span>
        </div>
        <h3>${esc(srv.name)}</h3>
        <div class="srv-bot">
          <span class="srv-price">${esc(srv.price)}</span>
          <button type="button" class="srv-btn" data-srv="${esc(srv.name)} (${esc(srv.price)})">+ Select</button>
        </div>
      </div>`
    )
    .join("");

  const reviewsHtml = studio.reviews && studio.reviews.length
    ? `
    <section class="sec" id="reviews">
      <div class="wrap">
        <div class="sec-k">VERIFIED CLIENT REVIEWS</div>
        <h2 class="sec-h">${esc(studio.rating)} ★ from ${esc(studio.reviewCount.toLocaleString("en-GB"))} visits.</h2>
        <div class="rev-grid">
          ${studio.reviews
            .map(
              (rv) => `
            <blockquote class="rev-card" data-tilt>
              <div class="rev-stars">★★★★★</div>
              <p>“${esc(rv.text)}”</p>
              <footer>— ${esc(rv.author)} · Verified Client</footer>
            </blockquote>`
            )
            .join("")}
        </div>
      </div>
    </section>`
    : "";

  const switcherHtml = renderStyleSwitcherBar(studio, "3d", { clean });

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(studio.name)} — ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)}</title>
<meta name="description" content="${esc(studio.name)} at ${esc(studio.street)}, ${esc(studio.neighbourhood)} ${esc(studio.postcode)}. Rated ${esc(studio.rating)} stars from ${esc(studio.reviewCount)} verified reviews.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{background:#070709;color:#f4f4f6;font-family:'Geist',system-ui,sans-serif;overflow-x:hidden;line-height:1.55}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer}
img{display:block;max-width:100%}
.wrap{width:100%;max-width:1280px;margin:0 auto;padding:0 24px}

/* TOP NAV */
.nav{position:fixed;top:0;left:0;right:0;z-index:50;padding:16px 0;background:rgba(7,7,9,.55);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.08)}
.nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:17px;letter-spacing:-.02em}
.brand-badge{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#fff,#b4b8c8);color:#09090b;font-size:11px;font-weight:700;display:grid;place-items:center}
.nav-links{display:none;gap:26px;font-size:13px;color:rgba(244,244,246,.76)}
.nav-links a:hover{color:#fff}
.nav-r{display:flex;align-items:center;gap:12px}
.clock{display:none;align-items:center;gap:6px;font-size:12px;color:rgba(244,244,246,.72);padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14)}
.dot{width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399}
.nav-btn{padding:9px 18px;border-radius:999px;background:#fff;color:#09090b;font-size:13px;font-weight:600;transition:transform .2s}
.nav-btn:hover{transform:translateY(-1px)}

/* 3D HERO + MOTIONSITES 3D VIDEO + TRUE 3D PHOTO CYLINDER STAGE */
.hero{position:relative;min-height:100svh;display:flex;flex-direction:column;justify-content:center;padding:96px 0 108px;overflow:hidden}
.bg-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.46;pointer-events:none;filter:saturate(1.08) contrast(1.05)}
.bg-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,rgba(242,101,34,.14),transparent 54%),linear-gradient(180deg,rgba(7,7,9,.68) 0%,rgba(7,7,9,.36) 45%,rgba(7,7,9,.96) 100%);pointer-events:none}
.hero-inner{position:relative;z-index:2;text-align:center}
.hero-chip{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);backdrop-filter:blur(10px);font-size:12px;font-weight:500;color:#e4e4e7;margin-bottom:14px}
.hero-chip strong{color:#fff}
.hero h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(38px,5.6vw,74px);font-weight:600;line-height:1.0;letter-spacing:-.04em;max-width:920px;margin:0 auto 12px;background:linear-gradient(180deg,#ffffff 30%,rgba(255,255,255,.72) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-size:clamp(14px,1.3vw,17px);color:rgba(244,244,246,.76);max-width:600px;margin:0 auto 22px}
.hero-ctas{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-bottom:18px}
.btn-p{padding:14px 28px;border-radius:999px;background:#fff;color:#09090b;font-size:14px;font-weight:600;transition:transform .2s,box-shadow .2s}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(255,255,255,.18)}
.btn-g{padding:14px 24px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.20);color:#fff;font-size:14px;font-weight:500;backdrop-filter:blur(10px)}
.btn-g:hover{background:rgba(255,255,255,.15)}

/* INTERACTIVE 3D CYLINDER STAGE */
.stage-wrap{position:relative;height:390px;perspective:1350px;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;cursor:grab;touch-action:pan-y;margin-top:8px}
.stage-wrap.drag{cursor:grabbing}
.ring{position:relative;width:270px;height:330px;transform-style:preserve-3d;will-change:transform}
.face{position:absolute;inset:0;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.22);background:#121216;box-shadow:0 24px 60px rgba(0,0,0,.62);backface-visibility:hidden;transition:border-color .25s}
.face:hover{border-color:rgba(255,255,255,.62)}
.face img{width:100%;height:100%;object-fit:cover;pointer-events:none}
.face-cap{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:12px;background:rgba(7,7,9,.68);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);font-size:11px;font-weight:500;color:#fff}
.stage-controls{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px;font-size:12px;color:rgba(244,244,246,.62)}
.ctrl-b{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-size:15px;display:grid;place-items:center}
.ctrl-b:hover{background:rgba(255,255,255,.16)}

/* 3D LIGHTBOX */
.lb{position:fixed;inset:0;z-index:92;background:rgba(5,5,7,.88);backdrop-filter:blur(14px);display:grid;place-items:center;padding:24px}
.lb[hidden]{display:none}
.lb img{max-width:min(92vw,960px);max-height:82vh;border-radius:18px;border:1px solid rgba(255,255,255,.18);box-shadow:0 30px 90px rgba(0,0,0,.7)}
.lb-x{position:fixed;top:22px;right:22px;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.1);color:#fff;font-size:22px}

/* SECTIONS & 3D TILT GLASS CARDS */
.sec{padding:92px 0;border-top:1px solid rgba(255,255,255,.08)}
.sec-k{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#F26522;margin-bottom:10px}
.sec-h{font-family:'Space Grotesk',sans-serif;font-size:clamp(30px,4.4vw,52px);font-weight:600;letter-spacing:-.03em;line-height:1.06;margin-bottom:38px}
.srv-grid{display:grid;grid-template-columns:1fr;gap:18px}
.tilt-card{position:relative;background:linear-gradient(155deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.11);border-radius:20px;padding:26px;transform-style:preserve-3d;transition:transform .18s ease,border-color .25s ease}
.tilt-card:hover{border-color:rgba(255,255,255,.28)}
.srv-top{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:rgba(244,244,246,.55);margin-bottom:16px}
.srv-idx{font-family:'Space Grotesk',sans-serif;font-weight:600;color:#F26522}
.srv-card h3{font-family:'Space Grotesk',sans-serif;font-size:21px;font-weight:500;letter-spacing:-.015em;margin-bottom:22px;min-height:52px}
.srv-bot{display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid rgba(255,255,255,.09)}
.srv-price{font-size:20px;font-weight:600}
.srv-btn{padding:8px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#fff;font-size:13px;font-weight:500;transition:all .2s}
.srv-btn:hover{border-color:#fff}
.srv-btn.on{background:#F26522;border-color:#F26522;color:#fff}

.rev-grid{display:grid;grid-template-columns:1fr;gap:18px}
.rev-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:26px;transition:transform .2s ease}
.rev-stars{color:#F26522;font-size:14px;letter-spacing:2px;margin-bottom:12px}
.rev-card p{font-size:15px;color:rgba(244,244,246,.88);line-height:1.65}
.rev-card footer{margin-top:14px;font-size:12px;color:rgba(244,244,246,.54)}

/* BOOKING CONCIERGE */
.bk-grid{display:grid;grid-template-columns:1fr;gap:32px}
.info-box{display:grid;gap:18px;align-content:start}
.info-item{padding:18px 20px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}
.info-item small{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#F26522;margin-bottom:5px;font-weight:600}
.info-item strong,.info-item a{font-size:15px;font-weight:500}
.info-item a:hover{text-decoration:underline;text-underline-offset:4px}
.bk-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:28px}
.fg{margin-bottom:20px}
.fl{display:block;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,244,246,.62);margin-bottom:8px}
.sel-box{padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);font-size:14px;color:#fff}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:transparent;color:rgba(244,244,246,.82);font-size:13px}
.chip.on{background:#fff;color:#09090b;border-color:#fff;font-weight:600}
.inp{width:100%;padding:13px 15px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#fff;font:inherit;font-size:15px}
.inp:focus{outline:none;border-color:#F26522}
.wa-go{width:100%;padding:15px 22px;border-radius:999px;border:0;background:#F26522;color:#fff;font-size:15px;font-weight:600;transition:transform .2s}
.wa-go:hover{transform:translateY(-2px)}
.wa-note{text-align:center;font-size:12px;color:rgba(244,244,246,.54);margin-top:10px}
.ft{border-top:1px solid rgba(255,255,255,.08);padding:32px 0 88px;font-size:13px;color:rgba(244,244,246,.56)}
.ft-in{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}

${STYLE_SWITCHER_CSS}

@media(min-width:768px){
  .nav-links,.clock{display:flex}
  .srv-grid{grid-template-columns:repeat(2,1fr)}
  .rev-grid{grid-template-columns:repeat(3,1fr)}
  .bk-grid{grid-template-columns:5fr 7fr;gap:40px}
  .stage-wrap{height:370px}
  .ring{width:280px;height:330px}
}
@media(min-width:1024px){
  .srv-grid{grid-template-columns:repeat(3,1fr)}
}
</style>
</head>
<body>
<header class="nav">
  <div class="wrap nav-in">
    <a href="#" class="brand"><span class="brand-badge">${esc(studio.monogram)}</span><span>${esc(studio.name)}</span></a>
    <nav class="nav-links">
      <a href="#stage">3D Gallery</a>
      <a href="#menu">Prices</a>
      ${studio.reviews && studio.reviews.length ? '<a href="#reviews">Reviews</a>' : ""}
      <a href="#book">Book Direct</a>
    </nav>
    <div class="nav-r">
      <span class="clock"><span class="dot"></span><span id="ldnClock">London</span></span>
      <a class="nav-btn" href="${esc(directWa)}" target="_blank" rel="noopener">WhatsApp ↗</a>
    </div>
  </div>
</header>

<section class="hero" id="stage">
  <video class="bg-vid" autoplay muted loop playsinline preload="metadata">
    <source src="${esc(bgVideo)}" type="video/mp4">
  </video>
  <div class="bg-glow"></div>
  <div class="wrap hero-inner">
    <div class="hero-chip"><span>★</span> <strong>${esc(studio.rating)}</strong> (${esc(studio.reviewCount.toLocaleString("en-GB"))} verified reviews) · ${esc(studio.neighbourhood)}, ${esc(studio.postcode)}</div>
    <h1>${esc(studio.name)}</h1>
    <p class="hero-sub">${esc(studio.street)}, ${esc(studio.neighbourhood)} — drag the 3D studio showcase below or book directly on WhatsApp with zero platform fees.</p>
    <div class="hero-ctas">
      <a class="btn-p" href="#book">Book via WhatsApp →</a>
      <a class="btn-g" href="#menu">View Prices &amp; Services</a>
    </div>

    <div class="stage-wrap" id="stageWrap">
      <div class="ring" id="ring3d"></div>
    </div>
    <div class="stage-controls">
      <button type="button" class="ctrl-b" id="prev3d" aria-label="Rotate left">←</button>
      <span>Drag to rotate in 3D · Tap any real studio photo to inspect</span>
      <button type="button" class="ctrl-b" id="next3d" aria-label="Rotate right">→</button>
    </div>
  </div>
</section>

<section class="sec" id="menu">
  <div class="wrap">
    <div class="sec-k">REAL STUDIO MENU</div>
    <h2 class="sec-h">Services &amp; transparent prices.</h2>
    <div class="srv-grid">${servicesHtml}</div>
  </div>
</section>

${reviewsHtml}

<section class="sec" id="book">
  <div class="wrap">
    <div class="sec-k">DIRECT WHATSAPP CONCIERGE</div>
    <h2 class="sec-h">Reserve directly — zero booking fees.</h2>
    <div class="bk-grid">
      <div class="info-box">
        <div class="info-item"><small>Location</small><a href="${esc(mapsUrl)}" target="_blank" rel="noopener">${esc(studio.street)}, ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)} ↗</a></div>
        <div class="info-item"><small>Opening Hours</small><strong>${esc(studio.hours)}</strong></div>
        <div class="info-item"><small>WhatsApp &amp; Direct Phone</small><a href="tel:+${esc(studio.waDigits)}">${esc(studio.phoneDisplay)}</a></div>
      </div>
      <div class="bk-card">
        <div class="fg">
          <span class="fl">Selected Services</span>
          <div class="sel-box" id="selBox">Tap + Select on any service above (or send a quick WhatsApp message)</div>
        </div>
        <div class="fg">
          <span class="fl">Preferred Day</span>
          <div class="chips" id="dayRow">
            <button type="button" class="chip on" data-v="This Week">This Week</button>
            <button type="button" class="chip" data-v="Tomorrow">Tomorrow</button>
            <button type="button" class="chip" data-v="This Weekend">Weekend</button>
            <button type="button" class="chip" data-v="Flexible">Flexible</button>
          </div>
        </div>
        <div class="fg">
          <span class="fl">Preferred Time</span>
          <div class="chips" id="timeRow">
            <button type="button" class="chip on" data-v="Morning">Morning</button>
            <button type="button" class="chip" data-v="Afternoon">Afternoon</button>
            <button type="button" class="chip" data-v="Evening">Evening</button>
          </div>
        </div>
        <div class="fg">
          <label class="fl" for="cname">Your Name</label>
          <input class="inp" id="cname" type="text" placeholder="Your first name">
        </div>
        <button type="button" class="wa-go" id="waSend">Send Booking Request on WhatsApp ↗</button>
        <p class="wa-note">Opens WhatsApp directly to ${esc(studio.name)} (${esc(studio.phoneDisplay)})</p>
      </div>
    </div>
  </div>
</section>

<footer class="ft">
  <div class="wrap ft-in">
    <div><strong>${esc(studio.name)}</strong> · ${esc(studio.street)}, London ${esc(studio.postcode)}</div>
    <div>${esc(studio.rating)} ★ (${esc(studio.reviewCount.toLocaleString("en-GB"))} Verified Reviews)</div>
  </div>
</footer>

<div class="lb" id="lb" hidden>
  <button type="button" class="lb-x" id="lbX" aria-label="Close photo">×</button>
  <img id="lbImg" alt="${esc(studio.name)} studio photo" referrerpolicy="no-referrer">
</div>

${switcherHtml}

<script>
(function(){
  // Live London clock
  function tick(){
    var el=document.getElementById('ldnClock');if(!el)return;
    try{el.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())+' London'}catch(e){el.textContent='London'}
  }
  tick();setInterval(tick,15000);

  // Interactive 3D Cylinder Stage
  var photos=${JSON.stringify(ringPhotos)};
  var ring=document.getElementById('ring3d'),wrap=document.getElementById('stageWrap');
  var n=photos.length,step=360/n;
  function getRadius(){return window.innerWidth<768?290:410}
  var html='';
  photos.forEach(function(src,i){
    html+='<div class="face" data-idx="'+i+'" data-src="'+src+'"><img src="'+src+'" alt="${esc(studio.name)} photo '+(i+1)+'" referrerpolicy="no-referrer" draggable="false"><div class="face-cap"><span>0'+(i+1)+' / 0'+n+'</span><span>Inspect ↗</span></div></div>';
  });
  ring.innerHTML=html;
  function layoutFaces(){
    var r=getRadius();
    ring.querySelectorAll('.face').forEach(function(f,i){
      f.style.transform='rotateY('+(i*step)+'deg) translateZ('+r+'px)';
    });
  }
  layoutFaces();addEventListener('resize',layoutFaces);

  var angle=0,vel=0,drag=false,moved=false,sx=0,sa=0,lx=0,lt=0;
  wrap.addEventListener('pointerdown',function(e){drag=true;moved=false;vel=0;wrap.setPointerCapture(e.pointerId);sx=lx=e.clientX;sa=angle;lt=performance.now();wrap.classList.add('drag')});
  wrap.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-sx;if(Math.abs(dx)>6)moved=true;var now=performance.now(),dt=Math.max(now-lt,1);vel=((e.clientX-lx)/dt)*3.2;lx=e.clientX;lt=now;angle=sa+dx*0.32});
  function up(){drag=false;wrap.classList.remove('drag')}
  wrap.addEventListener('pointerup',up);wrap.addEventListener('pointercancel',up);
  document.getElementById('prev3d').onclick=function(){vel=2.6};
  document.getElementById('next3d').onclick=function(){vel=-2.6};

  // Lightbox inspect on tap (only if not dragging)
  var lb=document.getElementById('lb'),lbImg=document.getElementById('lbImg');
  ring.querySelectorAll('.face').forEach(function(f){
    f.addEventListener('click',function(){if(moved)return;lbImg.src=f.getAttribute('data-src');lb.hidden=false});
  });
  document.getElementById('lbX').onclick=function(){lb.hidden=true};
  lb.onclick=function(e){if(e.target===lb)lb.hidden=true};

  function loop(){
    if(!drag){
      if(Math.abs(vel)>0.04){angle+=vel;vel*=0.94}
      else{vel=0;angle-=0.18}
    }
    ring.style.transform='translateZ(-120px) rotateX(-4deg) rotateY('+angle.toFixed(2)+'deg)';
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Subtle 3D tilt on desktop service cards
  document.querySelectorAll('[data-tilt]').forEach(function(card){
    card.addEventListener('pointermove',function(e){
      if(window.innerWidth<768)return;
      var r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      card.style.transform='perspective(800px) rotateX('+(-y*7).toFixed(1)+'deg) rotateY('+(x*7).toFixed(1)+'deg)';
    });
    card.addEventListener('pointerleave',function(){card.style.transform=''});
  });

  // Service selection + WhatsApp builder
  var picked=new Set(),day='This Week',tm='Morning';
  document.querySelectorAll('.srv-btn').forEach(function(b){
    b.onclick=function(){
      var v=b.getAttribute('data-srv');
      if(picked.has(v))picked.delete(v);else picked.add(v);
      b.classList.toggle('on',picked.has(v));
      b.textContent=picked.has(v)?'✓ Selected':'+ Select';
      document.getElementById('selBox').textContent=picked.size?Array.from(picked).join(' + '):'Tap + Select on any service above (or send a quick WhatsApp message)';
    };
  });
  document.querySelectorAll('#dayRow .chip').forEach(function(b){b.onclick=function(){day=b.getAttribute('data-v');document.querySelectorAll('#dayRow .chip').forEach(function(x){x.classList.toggle('on',x===b)})}});
  document.querySelectorAll('#timeRow .chip').forEach(function(b){b.onclick=function(){tm=b.getAttribute('data-v');document.querySelectorAll('#timeRow .chip').forEach(function(x){x.classList.toggle('on',x===b)})}});
  document.getElementById('waSend').onclick=function(){
    var nm=(document.getElementById('cname').value||'').trim();
    var what=picked.size?Array.from(picked).join(', '):'an appointment';
    var msg='Hi '+${JSON.stringify(studio.name)}+', '+(nm?'I\\'m '+nm+' and ':'')+'I\\'d like to book '+what+' ('+day+', '+tm+'). Do you have availability?';
    window.open('https://wa.me/'+${JSON.stringify(studio.waDigits)}+'?text='+encodeURIComponent(msg),'_blank','noopener');
  };

  // Switcher & Stripe £199 Checkout (persists chosen style=3d!)
  var pill=document.getElementById('previewPill'),cm=document.getElementById('claimModal');
  var cp=document.getElementById('closePillBtn'),oc=document.getElementById('openClaimBtn'),cc=document.getElementById('closeClaimBtn'),pb=document.getElementById('startCheckoutBtn'),st=document.getElementById('claimStatus');
  if(cp&&pill)cp.onclick=function(){pill.style.display='none'};
  if(oc&&cm)oc.onclick=function(){cm.hidden=false};
  if(cc&&cm)cc.onclick=function(){cm.hidden=true};
  if(cm)cm.onclick=function(e){if(e.target===cm)cm.hidden=true};
  if(pb)pb.onclick=function(){
    pb.disabled=true;pb.textContent='Opening £199 Stripe Checkout...';if(st)st.textContent='';
    fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(studio.slug)},style:'3d'})})
      .then(function(r){return r.json()}).then(function(d){if(d&&d.url){location.href=d.url;return}throw new Error((d&&d.error)||'Checkout failed')})
      .catch(function(e){pb.disabled=false;pb.textContent='Claim This Style — £199 One-Time →';if(st)st.textContent=e.message});
  };
})();
</script>
</body>
</html>`;
}
