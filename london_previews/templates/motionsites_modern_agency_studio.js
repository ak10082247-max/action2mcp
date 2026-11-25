/**
 * Official MotionSites MCP "Modern Agency" Ready-Made HTML Template
 * Verbatim ChromaFlow pointer-reactive canvas + dual fluted glass + grain + floating pill nav
 * + live London clock + vertical roll-text #F26522 buttons + 26%/1fr/48% asymmetric editorial spread
 * + expanding hover-pill showcase cards — populated with 100% REAL Fresha studio photos, prices & reviews.
 */

import { renderStyleSwitcherBar, STYLE_SWITCHER_CSS } from "./motionsites_3d_studio.js";

const ASSET_ORIGIN = "https://london-previews.ak10082247.workers.dev";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolvePhoto(p) {
  return /^https?:\/\//i.test(p) ? p : `${ASSET_ORIGIN}${p}`;
}

export function renderMotionSitesModernAgencyStudio(studio, { clean = false } = {}) {
  const photos = (studio.photos || []).map(resolvePhoto);
  const imgA = photos[0] || "";
  const imgB = photos[2] || photos[1] || imgA;
  const imgC = photos[1] || imgA;
  const imgD = photos[3] || photos[0] || imgA;
  const directWa = `https://wa.me/${studio.waDigits}?text=${encodeURIComponent(`Hi ${studio.name}, I'd love to book an appointment — do you have availability this week?`)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${studio.name} ${studio.street} ${studio.postcode}`)}`;

  const heroLabel = studio.heroLabel || `${studio.name} · ${studio.street}, ${studio.neighbourhood} ${studio.postcode}`;
  const heroLines = studio.heroLines || [
    `${studio.rating}-star ${studio.cat === "barber" ? "barbering" : "beauty & care"}`,
    `trusted by ${studio.reviewCount.toLocaleString("en-GB")}+ clients`,
    `in ${studio.neighbourhood}.`,
  ];
  const aboutTag = studio.aboutTag || `Inside ${studio.shortName}`;
  const aboutHeadline = studio.aboutHeadline || `${esc(studio.rating)}-star rated craft,<br>direct WhatsApp booking.`;
  const aboutBody = studio.aboutBody || `Located at ${esc(studio.street)}, ${esc(studio.neighbourhood)} —<br>book straight into the studio with zero<br>third-party platform fees.`;
  const casesTag = studio.casesTag || `Inside Our ${studio.postcode} Studio`;
  const casesHeadline = studio.casesHeadline || `The studio &amp; craft`;
  const case1Title = studio.case1Title || `${studio.name} Interior`;
  const case1Desc = studio.case1Desc || `Real studio photography from ${studio.street} — rated ${studio.rating} stars across ${studio.reviewCount.toLocaleString("en-GB")} verified visits.`;
  const case2Title = studio.case2Title || `${studio.street}, ${studio.postcode}`;
  const case2Desc = studio.case2Desc || `Open ${studio.hours}. Tap to message directly on WhatsApp (${studio.phoneDisplay}).`;

  const servicesList = studio.services && studio.services.length ? studio.services : [
    { name: "Signature Studio Appointment", dur: "45 min", price: "Ask on WhatsApp" },
    { name: "Consultation & Bespoke Treatment", dur: "60 min", price: "Ask on WhatsApp" },
  ];

  const servicesHtml = servicesList
    .map(
      (srv) => `
      <div class="srv-row">
        <div>
          <div class="srv-t">${esc(srv.name)}</div>
          <div class="srv-d">${esc(srv.dur)}</div>
        </div>
        <div class="srv-r">
          <span class="srv-p">${esc(srv.price)}</span>
          <button type="button" class="srv-b" data-srv="${esc(srv.name)} (${esc(srv.price)})">+ Select</button>
        </div>
      </div>`
    )
    .join("");

  const reviewsHtml = studio.reviews
    .map(
      (rv) => `
      <div class="rv-c">
        <div class="rv-s">★★★★★</div>
        <p>“${esc(rv.text)}”</p>
        <div class="rv-a">— ${esc(rv.author)} · Verified Client</div>
      </div>`
    )
    .join("");

  const previewPill = renderStyleSwitcherBar(studio, "modern-agency", { clean });

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(studio.name)} — ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)}</title>
<meta name="description" content="${esc(studio.name)} at ${esc(studio.street)}, ${esc(studio.neighbourhood)} ${esc(studio.postcode)}. Rated ${esc(studio.rating)} stars from ${esc(studio.reviewCount)} verified reviews.">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#111827;background:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;border:0;cursor:pointer;background:none;color:inherit}
img,video{display:block;max-width:100%}
svg{display:block}
.wrap{max-width:1440px;margin:0 auto}
.hide-m{display:none}
/* EXACT MOTIONSITES MODERN AGENCY HERO */
.hero{position:relative;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;background:#efefef;overflow:hidden}
.fx{position:absolute;inset:0;z-index:10;pointer-events:none;overflow:hidden}
.fx canvas{position:absolute;inset:0;width:100%;height:100%}
.fx .glass{position:absolute;inset:-20%;background:repeating-linear-gradient(121deg,rgba(255,255,255,0) 0,rgba(255,255,255,.55) 38px,rgba(255,255,255,0) 90px,rgba(0,0,0,.035) 120px,rgba(255,255,255,0) 160px);mix-blend-mode:soft-light;animation:drift 18s linear infinite}
.fx .glass2{position:absolute;inset:-20%;background:repeating-linear-gradient(121deg,rgba(255,255,255,0) 0,rgba(255,255,255,.7) 14px,rgba(255,255,255,0) 44px,rgba(120,120,120,.05) 70px);opacity:.55;animation:drift 26s linear infinite reverse}
.fx .grain{position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
@keyframes drift{from{transform:translateX(-90px)}to{transform:translateX(90px)}}
nav.top{position:relative;z-index:20;width:100%}
.nav-in{max-width:1440px;margin:0 auto;padding:8px}
.pill{background:#fff;border-radius:999px;padding:5px;display:flex;align-items:center;justify-content:space-between}
.left,.right{display:flex;align-items:center}
.logo{width:36px;height:36px;border-radius:50%;background:#111827;color:#fff;font-size:10px;font-weight:700;letter-spacing:-.025em;display:flex;align-items:center;justify-content:center}
.links{display:none;gap:24px;margin-left:24px}
.links a{font-size:14px;color:#111827;transition:color .3s}
.links a:hover{color:#6b7280}
.right{gap:16px}
.status{display:none;font-size:13px;color:#4b5563}
.clock{display:none;align-items:center;gap:6px;font-size:13px;color:#4b5563}
.menu-btn{background:#111827;color:#fff;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;padding:9px 16px}
/* roll button */
.btn{display:inline-flex;align-items:center;gap:12px;border-radius:999px;color:#fff;font-weight:500;font-size:13px;padding:8px 8px 8px 20px;white-space:nowrap}
.btn.dark{background:#111827}
.btn.org{background:#F26522;transition:background .3s}
.btn.org:hover{background:#e05a1a}
.roll{height:20px;overflow:hidden;display:block}
.roll>span{display:flex;flex-direction:column;transition:transform .5s cubic-bezier(.25,.1,.25,1)}
.roll>span>span{height:20px;line-height:20px;display:block}
.btn:hover .roll>span{transform:translateY(-50%)}
.circ{width:24px;height:24px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;transition:transform .5s cubic-bezier(.25,.1,.25,1)}
.btn:hover .circ{transform:rotate(-45deg)}
.btn.org .circ{width:28px;height:28px}
.btn.dark .circ{color:#111827}
.btn.org .circ{color:#F26522}
.hero-c{position:relative;z-index:20;margin-top:auto;width:100%}
.hero-in{max-width:1440px;margin:0 auto;padding:0 20px 64px}
.label{font-size:13px;letter-spacing:.025em;color:#111827;margin-bottom:20px}
h1{font-size:clamp(1.75rem,7vw,4.2rem);font-weight:500;line-height:1.08;letter-spacing:-.03em;color:#111827}
.cta{display:flex;flex-direction:column;align-items:flex-start;gap:16px;margin-top:32px}
.badge{display:inline-flex;align-items:center;gap:8px;background:#fff;border-radius:4px;padding:8px 10px;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:box-shadow .3s;font-size:13px;font-weight:500}
.badge:hover{box-shadow:0 4px 16px rgba(0,0,0,.12)}
.badge svg{width:20px;height:20px;fill:#E8704E}
.badge em{font-style:normal;font-size:10px;background:#111827;color:#fff;padding:2px 6px;border-radius:4px;font-weight:500}
.br{display:none}
/* mobile menu */
.mm{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;justify-content:flex-end;visibility:hidden;transition:visibility 0s .5s}
.mm.open{visibility:visible;transition:none}
.mm .bd{position:absolute;inset:0;background:rgba(0,0,0,.6);opacity:0;transition:opacity .5s}
.mm.open .bd{opacity:1}
.sheet{position:relative;background:#fff;border-radius:16px;margin:0 12px 12px;padding:20px;transform:translateY(110%);transition:transform .5s cubic-bezier(.32,.72,0,1)}
.mm.open .sheet{transform:translateY(0)}
.tb{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#4b5563;background:#f3f4f6;border-radius:999px;padding:6px 12px;margin-bottom:16px}
.sheet a.l{display:block;font-size:28px;font-weight:500;padding:6px 0}
.sheet .btn{margin-top:20px}
/* about */
.about{background:#fff;padding:64px 0 48px;overflow:hidden}
.badge-row{display:flex;align-items:center;gap:12px;padding:0 20px;margin-bottom:24px}
.num{width:24px;height:24px;border-radius:50%;background:#111827;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center}
.tag{font-size:12px;font-weight:500;border:1px solid #e5e7eb;border-radius:999px;padding:4px 12px}
h2{font-size:clamp(1.5rem,4vw,3.2rem);font-weight:500;line-height:1.12;letter-spacing:-.02em;color:#111827;padding:0 20px;margin-bottom:48px}
.mob{padding:0 20px}
.mob p{font-size:15px;line-height:1.6;font-weight:500;margin-bottom:20px}
.mob .imgs{display:flex;flex-direction:column;gap:16px;margin-top:32px}
.rimg{border-radius:12px;object-fit:cover;width:100%}
.i1{aspect-ratio:438/346}.i2{aspect-ratio:900/600}
.desk{display:none}
/* cases */
.cases{background:#F5F5F5;padding:64px 0}
h2.big{font-size:clamp(1.75rem,7vw,4.2rem);line-height:1.08;letter-spacing:-.03em;margin-bottom:40px}
.grid{display:grid;grid-template-columns:1fr;gap:20px;padding:0 20px}
.vid{position:relative;border-radius:16px;overflow:hidden;cursor:pointer}
.vid img{width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.25,.1,.25,1)}
.vid:hover img{transform:scale(1.035)}
.hb{position:absolute;left:16px;bottom:16px;height:36px;width:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;overflow:hidden;transition:all .3s ease-in-out;background:#fff;white-space:nowrap}
.vid:hover .hb{width:168px}
.hb.dk{background:#111827;color:#fff}
.vid:hover .hb.dk{width:176px}
.hb span{font-size:13px;font-weight:500;opacity:0;transition:opacity .3s .1s;width:0;overflow:hidden}
.vid:hover .hb span{opacity:1;width:auto}
.hb svg{flex:none;transform:rotate(-45deg);transition:transform .3s}
.vid:hover .hb svg{transform:rotate(0)}
.desc{font-size:13px;line-height:1.625;color:#4b5563;margin-top:16px}
.ttl{font-size:14px;font-weight:600;color:#111827;margin-top:4px}

/* MATCHING SECTIONS 3 & 4 (PRICES + REVIEWS + WHATSAPP BOOKING) */
.menu-sec{background:#fff;padding:72px 0}
.menu-list{padding:0 20px}
.srv-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 0;border-bottom:1px solid #e5e7eb}
.srv-t{font-size:17px;font-weight:500;color:#111827}
.srv-d{font-size:13px;color:#6b7280;margin-top:2px}
.srv-r{display:flex;align-items:center;gap:16px;flex-shrink:0}
.srv-p{font-size:17px;font-weight:600;color:#111827}
.srv-b{padding:8px 16px;border-radius:999px;border:1px solid #d1d5db;font-size:13px;font-weight:500;background:#fff;color:#111827;transition:all .2s}
.srv-b:hover{border-color:#111827}
.srv-b.on{background:#F26522;color:#fff;border-color:#F26522}

.book-sec{background:#F5F5F5;padding:72px 0 96px}
.rv-grid{display:grid;grid-template-columns:1fr;gap:16px;padding:0 20px;margin-bottom:44px}
.rv-c{background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb}
.rv-s{color:#F26522;font-size:14px;letter-spacing:2px;margin-bottom:10px}
.rv-c p{font-size:15px;line-height:1.6;color:#111827}
.rv-a{font-size:12px;color:#6b7280;margin-top:12px;font-weight:500}
.bk-grid{display:grid;grid-template-columns:1fr;gap:28px;padding:0 20px}
.bk-info{background:#fff;border-radius:16px;padding:28px;border:1px solid #e5e7eb;display:grid;gap:18px;align-content:start}
.bk-info small{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin-bottom:4px}
.bk-info strong,.bk-info a{font-size:15px;font-weight:500;color:#111827}
.bk-info a:hover{text-decoration:underline;text-underline-offset:4px}
.bk-card{background:#fff;border-radius:16px;padding:28px;border:1px solid #e5e7eb}
.fg{margin-bottom:18px}
.fl{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin-bottom:8px}
.sel-box{padding:12px 14px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{padding:8px 14px;border-radius:999px;border:1px solid #d1d5db;font-size:13px;font-weight:500;background:#fff;color:#374151}
.chip.on{background:#111827;color:#fff;border-color:#111827}
.inp{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;font:inherit;font-size:15px}
.inp:focus{outline:none;border-color:#111827}
.ft{background:#fff;border-top:1px solid #e5e7eb;padding:28px 20px 72px;font-size:13px;color:#6b7280}
.ft-in{max-width:1440px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:0 28px}

${STYLE_SWITCHER_CSS}

@media(min-width:640px){
 .nav-in{padding:12px}.logo{width:40px;height:40px;font-size:11px}
 .hero-in{padding:0 32px 72px}.label{font-size:14px;margin-bottom:32px}
 h1{font-size:clamp(2.5rem,5vw,4.2rem)}
 .br{display:inline}.sp{display:none}
 .cta{flex-direction:row;align-items:center;gap:20px;margin-top:48px}
 .btn.org{padding-left:24px;font-size:14px}.btn.org .circ{width:32px;height:32px}
 .badge{font-size:14px}.badge svg{width:24px;height:24px}.badge em{font-size:11px;padding:2px 8px}
 .about{padding:80px 0 64px}.badge-row{padding:0 32px;margin-bottom:32px}
 .num{width:28px;height:28px;font-size:12px}.tag{font-size:13px;padding:6px 16px}
 h2{padding:0 32px;margin-bottom:64px}
 .mob{padding:0 32px}.mob p{font-size:17px}
 .mob .imgs{flex-direction:row;gap:20px}
 .mob .imgs .rimg{border-radius:16px}.mob .a{width:45%}.mob .b{width:55%}
 .cases{padding:80px 0}h2.big{font-size:clamp(2.5rem,5vw,4.2rem);margin-bottom:56px}
 .grid,.menu-list,.rv-grid,.bk-grid{padding:0 32px;gap:24px}
 .desc{font-size:14px}.ttl{font-size:15px}
}
@media(min-width:768px){
 .links{display:flex}.status{display:none}.clock{display:flex}.menu-btn{display:none}
 .hide-m{display:flex}.grid{grid-template-columns:1fr 1fr}.rv-grid{grid-template-columns:repeat(3,1fr)}.bk-grid{grid-template-columns:5fr 7fr}
 .right{display:flex}
}
@media(min-width:1024px){
 .status{display:block}
 .hero-in{padding:0 48px 86px}
 .about{padding:128px 0 96px}.badge-row{padding:0 48px}h2{padding:0 48px;margin-bottom:96px}
 .mob{display:none}
 .desk{display:grid;grid-template-columns:26% 1fr 48%;align-items:end;gap:24px;padding:0 48px}
 .desk .c{align-self:start;display:flex;justify-content:flex-end}
 .desk .c>div{display:flex;flex-direction:column;align-items:flex-start}
 .desk p{font-size:16px;line-height:1.65;white-space:nowrap;margin-bottom:20px;font-weight:400}
 .desk .rimg{border-radius:16px}.desk .l{align-self:end}.desk .r{align-self:end}
 .desk .r .rimg{aspect-ratio:3/2}
 .cases{padding:112px 0}h2.big{margin-bottom:64px}.grid,.menu-list,.rv-grid,.bk-grid{padding:0 48px;gap:28px}
}
@media(min-width:1280px){.desk{gap:32px}.desk p{font-size:18px}}
.right .btn{display:none}
@media(min-width:768px){.right .btn{display:inline-flex}}
@media(max-width:639px){.pv-txt{display:none}.srv-row{flex-direction:column;align-items:flex-start}.srv-r{width:100%;justify-content:space-between}}
</style>
</head>
<body>
<section class="hero">
  <div class="fx">
    <canvas id="cv"></canvas>
    <div class="glass2"></div><div class="glass"></div><div class="grain"></div>
  </div>
  <nav class="top"><div class="nav-in"><div class="pill">
    <div class="left">
      <a class="logo" href="#">${esc(studio.monogram)}</a>
      <div class="links"><a href="#about">Studio</a><a href="#space">Gallery</a><a href="#menu">Prices</a><a href="#book">Book</a></div>
    </div>
    <div class="right">
      <span class="status">${esc(studio.hours)}</span>
      <span class="clock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span class="t">00:00</span> in London</span>
      <a class="btn dark" href="${esc(directWa)}" target="_blank" rel="noopener"><span class="roll"><span><span>Book on WhatsApp</span><span>Book on WhatsApp</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
      <button class="menu-btn" id="mb" aria-label="Menu"><svg id="mi" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span id="mt">Menu</span></button>
    </div>
  </div></div></nav>
  <div class="hero-c"><div class="hero-in">
    <p class="label">${esc(heroLabel)}</p>
    <h1>${esc(heroLines[0])}<br class="br"><span class="sp"> </span>${esc(heroLines[1])}<br class="br"><span class="sp"> </span>${esc(heroLines[2])}</h1>
    <div class="cta">
      <a class="btn org" href="#book"><span class="roll"><span><span>Book an appointment</span><span>Book an appointment</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
      <a class="badge" href="#reviews"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"/></svg>${esc(studio.rating)} ★ (${esc(studio.reviewCount.toLocaleString("en-GB"))} Reviews)<em>Verified</em></a>
    </div>
  </div></div>
</section>

<div class="mm" id="mm">
  <div class="bd" id="bd"></div>
  <div class="sheet">
    <div class="tb"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span><span class="t">00:00</span> in London</span></div>
    <a class="l" href="#about">Studio</a><a class="l" href="#space">Gallery</a><a class="l" href="#menu">Prices</a><a class="l" href="#book">Book</a>
    <a class="btn dark" href="${esc(directWa)}" target="_blank" rel="noopener"><span class="roll"><span><span>Book on WhatsApp</span><span>Book on WhatsApp</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
  </div>
</div>

<section class="about" id="about"><div class="wrap">
  <div class="badge-row"><span class="num">1</span><span class="tag">${esc(aboutTag)}</span></div>
  <h2>${aboutHeadline}</h2>
  <div class="mob">
    <p>${aboutBody.replace(/<br>/g, " ")}</p>
    <a class="btn org" href="#menu"><span class="roll"><span><span>See prices</span><span>See prices</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
    <div class="imgs">
      <img class="rimg i1 a" alt="${esc(studio.name)}" referrerpolicy="no-referrer" src="${esc(imgA)}">
      <img class="rimg i2 b" alt="${esc(studio.name)} storefront" referrerpolicy="no-referrer" src="${esc(imgB)}">
    </div>
  </div>
  <div class="desk">
    <div class="l"><img class="rimg i1" alt="${esc(studio.name)}" referrerpolicy="no-referrer" src="${esc(imgA)}"></div>
    <div class="c"><div>
      <p>${aboutBody}</p>
      <a class="btn org" href="#menu"><span class="roll"><span><span>See prices</span><span>See prices</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
    </div></div>
    <div class="r"><img class="rimg" alt="${esc(studio.name)}" referrerpolicy="no-referrer" src="${esc(imgB)}"></div>
  </div>
</div></section>

<section class="cases" id="space"><div class="wrap">
  <div class="badge-row"><span class="num">2</span><span class="tag" style="border-color:#d1d5db">${esc(casesTag)}</span></div>
  <h2 class="big">${casesHeadline}</h2>
  <div class="grid">
    <a href="#book">
      <div class="vid" style="aspect-ratio:329/246;background:#1a1d2e">
        <img src="${esc(imgC)}" alt="${esc(case1Title)}" referrerpolicy="no-referrer">
        <div class="hb"><span>Book direct</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      </div>
      <p class="desc">${esc(case1Desc)}</p>
      <p class="ttl">${esc(case1Title)}</p>
    </a>
    <a href="${esc(mapsUrl)}" target="_blank" rel="noopener">
      <div class="vid" style="aspect-ratio:1/1;background:#6b6b6b">
        <img src="${esc(imgD)}" alt="${esc(case2Title)}" referrerpolicy="no-referrer">
        <div class="hb dk"><span>Open in Maps</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      </div>
      <p class="desc">${esc(case2Desc)}</p>
      <p class="ttl">${esc(case2Title)}</p>
    </a>
  </div>
</div></section>

<section class="menu-sec" id="menu"><div class="wrap">
  <div class="badge-row"><span class="num">3</span><span class="tag">Transparent Prices</span></div>
  <h2>Services &amp; menu</h2>
  <div class="menu-list">${servicesHtml}</div>
</div></section>

<section class="book-sec" id="reviews"><div class="wrap">
  <div class="badge-row"><span class="num">4</span><span class="tag" style="border-color:#d1d5db">${esc(studio.rating)} ★ Reviews &amp; Direct Booking</span></div>
  <h2 id="book">Reserve directly on WhatsApp</h2>
  ${reviewsHtml ? `<div class="rv-grid">${reviewsHtml}</div>` : ""}
  <div class="bk-grid">
    <div class="bk-info">
      <div><small>Location</small><a href="${esc(mapsUrl)}" target="_blank" rel="noopener">${esc(studio.street)}, ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)} ↗</a></div>
      <div><small>Opening Hours</small><strong>${esc(studio.hours)}</strong></div>
      <div><small>Direct WhatsApp &amp; Phone</small><a href="tel:+${esc(studio.waDigits)}">${esc(studio.phoneDisplay)}</a></div>
      <div><small>Rating</small><strong>${esc(studio.rating)} ★ across ${esc(studio.reviewCount.toLocaleString("en-GB"))} verified client visits</strong></div>
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
      <button type="button" class="btn org" id="waSend" style="width:100%;justify-content:space-between;padding:12px 12px 12px 24px"><span class="roll"><span><span>Send Request on WhatsApp</span><span>Send Request on WhatsApp</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></button>
    </div>
  </div>
</div></section>

<footer class="ft"><div class="ft-in">
  <div><strong>${esc(studio.name)}</strong> · ${esc(studio.street)}, London ${esc(studio.postcode)}</div>
  <div>© 2026 ${esc(studio.name)}</div>
</div></footer>

${previewPill}

<script>
(function(){
  function tick(){
    var s;try{s=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}catch(e){s='00:00'}
    document.querySelectorAll('.t').forEach(function(e){e.textContent=s});
  }
  tick();setInterval(tick,1000);
  var mm=document.getElementById('mm'),mb=document.getElementById('mb'),mt=document.getElementById('mt'),mi=document.getElementById('mi');
  var menuP='M4 6h16M4 12h16M4 18h16',closeP='M6 6l12 12M18 6L6 18';
  function setM(o){mm.classList.toggle('open',o);mt.textContent=o?'Close':'Menu';mi.firstElementChild.setAttribute('d',o?closeP:menuP);mb.style.position='relative';mb.style.zIndex=o?60:'';document.body.style.overflow=o?'hidden':''}
  mb.addEventListener('click',function(){setM(!mm.classList.contains('open'))});
  document.getElementById('bd').addEventListener('click',function(){setM(false)});
  mm.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setM(false)})});

  // EXACT MOTIONSITES CHROMAFLOW + SWIRL CANVAS
  var cv=document.getElementById('cv'),cx=cv.getContext('2d'),W,H,mx=.5,my=.5,pts=[];
  function rs(){var d=Math.min(devicePixelRatio||1,1.5);W=cv.width=Math.round(cv.clientWidth*d/2);H=cv.height=Math.round(cv.clientHeight*d/2)}
  rs();addEventListener('resize',rs);
  addEventListener('pointermove',function(e){mx=e.clientX/innerWidth;my=e.clientY/innerHeight;pts.push({x:mx,y:my,a:1});if(pts.length>40)pts.shift()});
  var t0=performance.now();
  function frame(now){
    var t=(now-t0)/1000;
    cx.globalCompositeOperation='source-over';
    var g=cx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#f0f0f0');g.addColorStop(1,'#f7f7f7');
    cx.fillStyle=g;cx.fillRect(0,0,W,H);
    for(var i=0;i<3;i++){
      var x=W*(.5+.4*Math.sin(t*.15+i*2)),y=H*(.4+.3*Math.cos(t*.12+i*1.7)),r=Math.max(W,H)*.45;
      var rg=cx.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(255,255,255,.7)');rg.addColorStop(1,'rgba(255,255,255,0)');
      cx.fillStyle=rg;cx.fillRect(0,0,W,H);
    }
    // subtle ambient warm glow + pointer trail
    var ax=W*(.68+.15*Math.sin(t*.35)),ay=H*(.42+.14*Math.cos(t*.28));
    var ag=cx.createRadialGradient(ax,ay,0,ax,ay,Math.max(W,H)*.36);
    ag.addColorStop(0,'rgba(255,95,3,.16)');ag.addColorStop(1,'rgba(255,95,3,0)');
    cx.fillStyle=ag;cx.fillRect(0,0,W,H);
    for(var j=0;j<pts.length;j++){
      var p=pts[j];p.a*=.975;
      var px=p.x*W,py=p.y*H,rr=Math.max(W,H)*.12*(1+(1-p.a));
      var og=cx.createRadialGradient(px,py,0,px,py,rr);
      og.addColorStop(0,'rgba(255,95,3,'+(p.a*.28)+')');og.addColorStop(1,'rgba(255,95,3,0)');
      cx.fillStyle=og;cx.fillRect(0,0,W,H);
    }
    pts=pts.filter(function(p){return p.a>.03});
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var picked=new Set(),day='This Week',tm='Morning';
  document.querySelectorAll('.srv-b').forEach(function(b){
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

  var pill=document.getElementById('previewPill'),cm=document.getElementById('claimModal');
  var cp=document.getElementById('closePillBtn'),oc=document.getElementById('openClaimBtn'),cc=document.getElementById('closeClaimBtn'),pb=document.getElementById('startCheckoutBtn'),st=document.getElementById('claimStatus');
  if(cp&&pill)cp.onclick=function(){pill.style.display='none'};
  if(oc&&cm)oc.onclick=function(){cm.hidden=false};
  if(cc&&cm)cc.onclick=function(){cm.hidden=true};
  if(cm)cm.onclick=function(e){if(e.target===cm)cm.hidden=true};
  if(pb)pb.onclick=function(){
    pb.disabled=true;pb.textContent='Opening £199 Stripe Checkout...';if(st)st.textContent='';
    fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(studio.slug)},style:'modern-agency'})})
      .then(function(r){return r.json()}).then(function(d){if(d&&d.url){location.href=d.url;return}throw new Error((d&&d.error)||'Checkout failed')})
      .catch(function(e){pb.disabled=false;pb.textContent='Claim This Style — £199 One-Time →';if(st)st.textContent=e.message});
  };
})();
</script>
</body>
</html>`;
}
