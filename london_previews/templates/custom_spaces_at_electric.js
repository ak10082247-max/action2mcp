/**
 * MotionSites "Custom Spaces" Template -> Bespoke build for AT Electric Contractors Ltd (atelectric.co.uk)
 * Uses 100% REAL photos from atelectric.co.uk (Ali in AT Electric hoodie, dressed consumer units,
 * Ryefield commercial boards, Caffè Nero storefront, marble/LED kitchen, restaurant & dental clinic fit-outs)
 * + ALL official numbers from /contact-us (NICEIC #616575000, TrustMark #2516511, Co #14486367, VAT #440926693).
 */

export function renderAtElectricCustomSpaces(site, { clean = false, origin, previewBarHtml, claimScriptJs }) {
  const r = (name) => `${origin}/assets/real/${name}`;
  const waQuick = `https://wa.me/${site.waDigits}?text=${encodeURIComponent("Hi Ali (AT Electric), I'd like a quote for electrical / EICR work in London.")}`;

  const slides = [
    { img: r("at-ali-board.jpg"), cap: "Ali — NICEIC Approved Contractor", sub: "Direct Local Engineer · #616575000" },
    { img: r("at-cu-neat.jpg"), cap: "18th Edition Consumer Units", sub: "Dressed, Tested & Part P Certified" },
    { img: r("at-caffe-nero.jpg"), cap: "Commercial Retail — Caffè Nero", sub: "Full Commercial Fit-Out · London" },
    { img: r("at-ryefield.jpg"), cap: "Ryefield & Three-Phase Boards", sub: "Commercial Distribution · AT Electric" },
    { img: r("at-marble-led.jpg"), cap: "Architectural LED & Kitchen Wiring", sub: "Domestic & Luxury Renovations" },
    { img: r("at-restaurant.jpg"), cap: "Restaurants, Bars & Hospitality", sub: "Full Design, Lighting & Power" },
  ];

  const gallery = [
    { img: r("at-ali-board.jpg"), title: "Distribution Board Testing", meta: "Ali · NICEIC #616575000" },
    { img: r("at-cu-neat.jpg"), title: "Precision Consumer Unit Wiring", meta: "18th Edition · Part P" },
    { img: r("at-ryefield.jpg"), title: "Ryefield & Three-Phase Enclosures", meta: "Commercial Multi-Unit Supply" },
    { img: r("at-caffe-nero.jpg"), title: "Caffè Nero Commercial Storefront", meta: "Retail Electrical Fit-Out" },
    { img: r("at-marble-led.jpg"), title: "LED Strip & Feature Lighting", meta: "Domestic & Kitchen Upgrade" },
    { img: r("at-restaurant.jpg"), title: "London Restaurant Fit-Out", meta: "Full Commercial Wiring & Lighting" },
    { img: r("at-dental.jpg"), title: "Dental Clinic Commercial Fit-Out", meta: "Clean-Room & LED Panel Lighting" },
    { img: r("at-commercial-riser.jpg"), title: "Commercial Riser & Containment", meta: "Three-Phase Power Distribution" },
  ];

  const realServices = [
    {
      tag: "Landlords & Safety",
      title: "Landlord EICR Certificates",
      price: "5-Year / Tenancy Compliant",
      desc: "Mandatory Electrical Installation Condition Reports for private landlords in England, HMOs, home buyers, and commercial sites — replacing old or unsafe wiring before faults become fire hazards.",
      bullets: ["Full circuit testing prior to new tenancies", "Digital NICEIC certificate (#616575000)", "Clear remedial quotes handled directly by Ali"],
    },
    {
      tag: "Commercial London",
      title: "Retail, Restaurants, Offices & Ryefield Boards",
      price: "Full Design & Wiring",
      desc: "Proven commercial electrical projects across London for retail shops, cafés, restaurants, dental clinics, and offices — planned cleanly around your build schedule.",
      bullets: ["Ryefield & three-phase distribution boards", "Fire alarm & CCTV security camera systems", "Commercial fault finding & EICR compliance"],
    },
    {
      tag: "Domestic Upgrades",
      title: "Rewiring, Panel Upgrades & EV Chargers",
      price: "Single & Three-Phase",
      desc: "Full or part rewires, extensions and build-outs, consumer unit upgrades, new sockets, LED downlights and strip lighting, and certified home EV charger installations.",
      bullets: ["Consumer unit / panel upgrades", "EV charger & LED lighting installations", "TrustMark (#2516511) & JIB / ECS registered"],
    },
    {
      tag: "Rapid Response",
      title: "Fault Finding & Emergency Call-Outs",
      price: "NW & Central London",
      desc: "Tripping circuits, sudden power loss, or urgent commercial faults traced accurately and repaired safely by our own North West London electricians.",
      bullets: ["Direct WhatsApp or call to Ali: 07590 056206", "No agency mark-ups or call centres", "Transparent upfront pricing"],
    },
  ];

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AT Electric Contractors Ltd — NICEIC Approved Electricians London</title>
<meta name="description" content="NICEIC Approved Contractor (#616575000) & TrustMark (#2516511) across North West & Central London. Commercial fit-outs, Ryefield boards, EV chargers & Landlord EICRs.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;scroll-behavior:smooth}
body{font-family:'Geist',sans-serif;color:#171717;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{text-decoration:none;color:inherit}
button{font-family:inherit}
:root{--e:cubic-bezier(0.16,1,0.3,1)}

.pv-bar{position:sticky;top:0;z-index:120;background:#111827;color:#f9fafb;border-bottom:1px solid rgba(255,255,255,.14);font-size:12.5px;line-height:1.4}
.pv-inner{max-width:1280px;margin:0 auto;padding:9px 18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.pv-copy{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pv-pill{background:#f59e0b;color:#111827;font-weight:800;font-size:10px;letter-spacing:.08em;padding:3px 8px;border-radius:999px}
.pv-actions{display:flex;align-items:center;gap:8px}
.pv-buy{background:#10b981;color:#052e16;border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer}
.pv-close{background:transparent;color:#d1d5db;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 11px;font-size:12px;cursor:pointer}

.page{min-height:100vh;background:#fff;overflow:hidden}
nav.cs-nav{position:sticky;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:18px 16px;background:rgba(255,255,255,.9);backdrop-filter:blur(10px);border-bottom:1px solid #f0f0f0}
.cs-brand{display:inline-flex;align-items:center;gap:10px;font-size:14.5px;font-weight:600;letter-spacing:-.02em}
.cs-spacer{width:28px}
.burger{position:absolute;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:5px;background:none;border:0;cursor:pointer;padding:8px}
.burger i{display:block;width:24px;height:1.5px;background:#171717;border-radius:9999px;transition:all .3s;margin:0 auto}
.burger:hover i{width:20px}
.pill{display:none;font-size:13.5px;font-weight:500;color:#fff;background:#171717;border-radius:9999px;padding:10px 20px;transition:background-color .15s}
.pill:hover{background:#262626}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:160;transition:all .5s var(--e);opacity:0;pointer-events:none}
.overlay.open{opacity:1;pointer-events:auto}
.drawer{position:fixed;inset:0;background:#fff;z-index:170;padding:20px;opacity:0;transform:translateY(100%);pointer-events:none;transition:all .5s var(--e)}
.drawer.open{opacity:1;transform:none;pointer-events:auto}
.dh{display:flex;justify-content:space-between;align-items:center}
.close{position:relative;width:40px;height:40px;border-radius:9999px;border:0;background:none;cursor:pointer}
.close:hover{background:#f5f5f5}
.close i{position:absolute;left:10px;top:50%;width:20px;height:1.5px;background:#171717;border-radius:9999px;transition:all .5s var(--e)}
.close .a{transform:translateY(-3px)}.close .b{transform:translateY(3px)}
.drawer.open .close .a{transform:rotate(45deg)}.drawer.open .close .b{transform:rotate(-45deg)}
.dlinks{padding:44px 8px 0}
.dlinks a{display:block;font-size:28px;line-height:36px;font-weight:500;padding:11px 0;opacity:0;transform:translateX(32px);transition:all .5s var(--e)}
.dlinks a:hover{color:#737373}
.drawer.open .dlinks a{opacity:1;transform:none;transition-delay:calc(140ms + var(--i)*55ms)}
.dcta{padding:34px 8px 0;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.dcta a{display:inline-block;font-size:14px;font-weight:500;color:#fff;background:#171717;border-radius:9999px;padding:12px 24px;opacity:0;transform:translateY(16px);transition:all .5s var(--e)}
.drawer.open .dcta a{opacity:1;transform:none;transition-delay:380ms}
.dcta small{color:#737373;font-size:12.5px;line-height:1.5}

.hero{padding:44px 16px 6px;text-align:center}
.kicker{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#525252;margin-bottom:18px}
.kdot{width:7px;height:7px;border-radius:50%;background:#16a34a}
h1{font-size:38px;line-height:1.04;font-weight:600;letter-spacing:-.03em;max-width:56rem;margin:0 auto;color:#171717}
.sub{margin:18px auto 0;font-size:16px;line-height:1.62;max-width:40rem;color:#404040}

.mq{position:relative;padding:16px 0;overflow:hidden;margin-top:8px}
.mask{position:absolute;left:0;right:0;height:78px;pointer-events:none;z-index:10}
.mask svg{display:block;width:100%;height:100%}
.mask.t{top:0}.mask.b{bottom:0}
.track{display:flex;width:max-content;gap:14px;padding:16px 0;user-select:none;-webkit-user-select:none;cursor:grab;will-change:transform;touch-action:pan-y}
.track.drag{cursor:grabbing}
.slide{position:relative;width:248px;height:335px;flex-shrink:0;border-radius:16px;overflow:hidden;background:#f3f2ee}
.slide img{width:100%;height:100%;object-fit:cover;object-position:center 22%;pointer-events:none;display:block}
.slide-cap{position:absolute;left:14px;right:14px;bottom:34px;background:rgba(255,255,255,.93);backdrop-filter:blur(8px);border-radius:12px;padding:10px 13px;pointer-events:none}
.slide-cap strong{display:block;font-size:13.5px;font-weight:600;color:#171717;line-height:1.25}
.slide-cap span{font-size:11.5px;color:#525252}

.bottom{text-align:center;padding:6px 16px 56px;max-width:44rem;margin:0 auto}
.bottom p{font-size:17px;line-height:1.62;color:#262626}
.ctas{margin-top:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.ctas a{font-weight:600;font-size:15.5px;text-decoration:underline;text-underline-offset:5px;text-decoration-color:#a3a3a3;transition:text-decoration-color .15s}
.ctas a:hover{text-decoration-color:#171717}

.sec{max-width:1160px;margin:0 auto;padding:64px 20px;border-top:1px solid #e5e5e5}
.sec-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:34px}
.sec-top h2{font-size:clamp(28px,3.6vw,44px);font-weight:600;letter-spacing:-.025em;line-height:1.08}
.sec-top p{max-width:440px;font-size:15px;color:#525252;line-height:1.55}

/* REAL PHOTO GALLERY GRID */
.gal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.gal-item{border-radius:14px;overflow:hidden;border:1px solid #e5e5e5;background:#fafafa;display:flex;flex-direction:column}
.gal-item img{width:100%;aspect-ratio:4/3;object-fit:cover;object-position:center 25%;display:block;transition:transform .4s ease}
.gal-item:hover img{transform:scale(1.04)}
.gal-cap{padding:11px 13px;background:#fff}
.gal-cap strong{display:block;font-size:13.5px;font-weight:600;color:#171717}
.gal-cap span{font-size:11.5px;color:#737373}

.spec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#e5e5e5;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden}
.spec-item{background:#fff;padding:28px;display:flex;flex-direction:column;gap:10px}
.spec-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#737373;text-transform:uppercase;letter-spacing:.06em}
.spec-item h3{font-size:21px;font-weight:600;letter-spacing:-.02em}
.spec-item p{font-size:14.5px;color:#525252;line-height:1.55}
.spec-item ul{list-style:none;margin-top:4px;display:flex;flex-direction:column;gap:5px;font-size:13.5px;color:#262626}
.spec-item li::before{content:"— ";color:#a3a3a3}
.spec-pick{margin-top:auto;padding-top:12px;align-self:flex-start;background:none;border:0;font-size:13.5px;font-weight:600;text-decoration:underline;text-underline-offset:4px;text-decoration-color:#a3a3a3;cursor:pointer;color:#171717}
.spec-pick:hover{text-decoration-color:#171717}

.q-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
.qf{margin-bottom:14px}
.qf label{display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#525252;margin-bottom:6px}
.qf input,.qf select,.qf textarea{width:100%;padding:12px 14px;font:inherit;font-size:15px;border:1px solid #d4d4d4;border-radius:10px;background:#fafafa;color:#171717}
.qf textarea{min-height:80px;resize:vertical}
.q-box{background:#fafafa;border:1px solid #e5e5e5;border-radius:16px;padding:26px}
.q-box h3{font-size:19px;font-weight:600;margin-bottom:6px}
.q-box .qs{font-size:13.5px;color:#525252;margin-bottom:14px}
.q-prev{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:14px;font-size:13.5px;white-space:pre-wrap;line-height:1.55;margin-bottom:18px}
.q-acts{display:flex;flex-wrap:wrap;gap:10px}
.btn-blk{display:inline-flex;align-items:center;justify-content:center;background:#171717;color:#fff;padding:12px 22px;border-radius:9999px;font-weight:600;font-size:14px}
.btn-blk:hover{background:#262626}
.btn-out{display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#171717;border:1px solid #171717;padding:12px 20px;border-radius:9999px;font-weight:600;font-size:14px}

.reg-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.reg-card{border:1px solid #e5e5e5;border-radius:14px;padding:20px;background:#fff}
.reg-card small{display:block;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#737373;margin-bottom:6px}
.reg-card strong{font-size:19px;font-weight:700;letter-spacing:-.02em;color:#171717}
.areas{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.areas span{border:1px solid #e5e5e5;border-radius:9999px;padding:6px 13px;font-size:13px;color:#404040}
footer.cs-foot{max-width:1160px;margin:0 auto;padding:28px 20px 84px;border-top:1px solid #e5e5e5;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:13px;color:#737373}

.mob-bar{position:fixed;bottom:12px;left:12px;right:12px;z-index:90;background:#171717;border-radius:9999px;padding:6px;display:flex;gap:6px;box-shadow:0 14px 30px rgba(0,0,0,.22)}
.mob-bar a{flex:1;text-align:center;font-size:13.5px;font-weight:600;padding:10px;border-radius:9999px}
.mb-c{color:#fff;background:rgba(255,255,255,.12)}
.mb-w{color:#171717;background:#fff}

@media(min-width:640px){
  nav.cs-nav{padding:20px 28px}.pill{display:inline-block}.cs-spacer{display:none}
  .drawer{inset:0 0 0 auto;width:100%;max-width:24rem;transform:translateX(100%)}
  .hero{padding:52px 24px 6px}h1{font-size:52px}.sub{margin-top:22px;font-size:18px}
  .mask{height:98px}.track{gap:16px}.slide{width:320px;height:440px}
  .bottom{padding:8px 24px 64px}.bottom p{font-size:18px}.ctas{margin-top:32px;flex-direction:row;gap:32px}
  .mob-bar{display:none}
  footer.cs-foot{padding-bottom:44px}
}
@media(min-width:768px){nav.cs-nav{padding:20px 44px}h1{font-size:70px}.sub{font-size:19.5px}.bottom p{font-size:19.5px}}
@media(min-width:1024px){h1{font-size:5.1rem}}
@media(max-width:900px){.gal-grid{grid-template-columns:repeat(2,1fr)}.reg-strip{grid-template-columns:repeat(2,1fr)}}
@media(max-width:780px){.spec-grid,.q-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
${previewBarHtml}
<div class="page">
  <nav class="cs-nav">
    <a class="cs-brand" href="#top">
      <svg width="26" height="26" viewBox="0 0 256 256" fill="#1a1a1a" aria-hidden="true"><path d="M 144 256 L 27.598 256 L 144 139.598 Z M 256 207.5 L 200 256 L 200 56 L 0 56 L 48 0 L 256 0 Z M 0 204.402 L 0 112 L 92.402 112 Z"/></svg>
      <span>AT Electric Contractors Ltd</span>
    </a>
    <button class="burger" id="open" aria-label="Open menu"><i></i><i></i></button>
    <a class="pill" href="#quote">Speak to Ali · 07590 056206</a>
    <div class="cs-spacer"></div>
  </nav>

  <div class="overlay" id="ov"></div>
  <aside class="drawer" id="dr">
    <div class="dh">
      <svg width="26" height="26" viewBox="0 0 256 256" fill="#1a1a1a" aria-hidden="true"><path d="M 144 256 L 27.598 256 L 144 139.598 Z M 256 207.5 L 200 256 L 200 56 L 0 56 L 48 0 L 256 0 Z M 0 204.402 L 0 112 L 92.402 112 Z"/></svg>
      <button class="close" id="close" aria-label="Close menu"><i class="a"></i><i class="b"></i></button>
    </div>
    <div class="dlinks">
      <a href="#projects" style="--i:0">Real Projects</a>
      <a href="#services" style="--i:1">Services &amp; EICR</a>
      <a href="#quote" style="--i:2">Quick Quote</a>
      <a href="#credentials" style="--i:3">Registrations</a>
    </div>
    <div class="dcta">
      <a href="${waQuick}" target="_blank" rel="noopener">WhatsApp Ali Direct →</a>
      <small>NICEIC #616575000 · TrustMark #2516511<br>Co. Reg #14486367 · VAT #440926693<br>07590 056206 · info@atelectric.co.uk</small>
    </div>
  </aside>

  <section id="top" class="hero">
    <div class="kicker"><span class="kdot"></span> NICEIC #616575000 · TrustMark #2516511 · JIB &amp; ECS Registered</div>
    <h1>NICEIC Approved<br>London Electricians</h1>
    <p class="sub">Commercial &amp; domestic electrical contractors across North West &amp; Central London — Ryefield &amp; three-phase distribution, retail &amp; restaurant fit-outs, EV chargers, and Landlord EICRs.</p>
  </section>

  <section class="mq" aria-label="Completed AT Electric projects">
    <div class="mask t"><svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path fill="#fff" d="M0 0H1440V50C1440 50 1200 100 720 100C240 100 0 50 0 50V0Z"/></svg></div>
    <div class="track" id="tr"></div>
    <div class="mask b"><svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path fill="#fff" d="M0 100H1440V50C1440 50 1200 0 720 0C240 0 0 50 0 50V100Z"/></svg></div>
  </section>

  <section class="bottom">
    <p>From Caffè Nero storefronts, restaurants, and dental clinics to complete domestic rewires and Landlord EICR inspections — deal directly with Ali and our qualified London team.</p>
    <div class="ctas">
      <a href="#quote">Request a Free Quote</a>
      <a href="tel:${site.phoneTel}">Call Ali: ${site.phoneDisplay}</a>
      <a href="${waQuick}" target="_blank" rel="noopener">WhatsApp Direct</a>
    </div>
  </section>

  <section id="projects" class="sec">
    <div class="sec-top">
      <h2>Completed London<br>Project Gallery</h2>
      <p>Real commercial and domestic electrical installations completed by AT Electric Contractors Ltd across North West &amp; Central London.</p>
    </div>
    <div class="gal-grid">
      ${gallery
        .map(
          (g) => `<figure class="gal-item"><img src="${g.img}" alt="${g.title}" loading="lazy"><figcaption class="gal-cap"><strong>${g.title}</strong><span>${g.meta}</span></figcaption></figure>`
        )
        .join("")}
    </div>
  </section>

  <section id="services" class="sec">
    <div class="sec-top">
      <h2>Domestic, Commercial<br>&amp; Landlord EICR Scope</h2>
      <p>Single-phase, three-phase, Ryefield boards, EV charging, CCTV/fire alarms, and 5-year Landlord EICR testing — certified to 18th Edition standards.</p>
    </div>
    <div class="spec-grid">
      ${realServices
        .map(
          (s) => `<article class="spec-item">
        <div class="spec-meta"><span>${s.tag}</span><span>${s.price}</span></div>
        <h3>${s.title}</h3>
        <p>${s.desc}</p>
        <ul>${s.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
        <button type="button" class="spec-pick" data-pick="${s.title}">Quote this service →</button>
      </article>`
        )
        .join("")}
    </div>
  </section>

  <section id="quote" class="sec">
    <div class="sec-top">
      <h2>Direct Free Quote<br>With Ali</h2>
      <p>Pick your electrical scope and postcode below — opens a clean pre-filled WhatsApp or email straight to Ali (07590 056206).</p>
    </div>
    <div class="q-grid">
      <div>
        <div class="qf"><label for="qJob">Work Needed</label><select id="qJob">
          <option>Landlord EICR Certificate</option>
          <option>Commercial / Shop / Restaurant Fit-Out</option>
          <option>Ryefield / Three-Phase Distribution Board</option>
          <option>Consumer Unit / Panel Upgrade</option>
          <option>EV Charger / LED Lighting / Rewiring</option>
          <option>Fire Alarm / CCTV Security Cameras</option>
          <option>Fault Finding / Emergency Call-Out</option>
        </select></div>
        <div class="qf"><label for="qSec">${site.quoteSecondaryLabel}</label><select id="qSec">${site.quoteSecondaryOptions.map((o) => `<option>${o}</option>`).join("")}</select></div>
        <div class="qf"><label for="qPost">London Postcode</label><input id="qPost" type="text" placeholder="e.g. NW6, NW2, W1" maxlength="16"></div>
        <div class="qf"><label for="qNotes">Brief Details</label><textarea id="qNotes" placeholder="Property size, commercial unit details, or preferred inspection date..."></textarea></div>
      </div>
      <div class="q-box">
        <h3>Ready-to-Send Enquiry</h3>
        <p class="qs">Tap below to message Ali directly on WhatsApp or email info@atelectric.co.uk.</p>
        <div id="qPreview" class="q-prev"></div>
        <div class="q-acts">
          <a id="qWa" class="btn-blk" target="_blank" rel="noopener" href="${waQuick}">Send via WhatsApp →</a>
          <a id="qMail" class="btn-out" href="mailto:${site.email}">Send by Email</a>
        </div>
      </div>
    </div>
  </section>

  <section id="credentials" class="sec">
    <div class="sec-top">
      <h2>Official Company<br>&amp; Scheme Numbers</h2>
      <p>Fully verified UK Limited Company, VAT-registered, NICEIC Approved Contractor, Domestic Installer, TrustMark &amp; JIB/ECS member.</p>
    </div>
    <div class="reg-strip">
      <div class="reg-card"><small>NICEIC Registration</small><strong>616575000</strong></div>
      <div class="reg-card"><small>TrustMark Registration</small><strong>2516511</strong></div>
      <div class="reg-card"><small>UK Company No.</small><strong>14486367</strong></div>
      <div class="reg-card"><small>VAT Registration</small><strong>440926693</strong></div>
    </div>
    <div class="areas">${site.areas.map((a) => `<span>${a}</span>`).join("")}</div>
  </section>

  <footer class="cs-foot">
    <span>© 2026 AT Electric Contractors Ltd · Co. #14486367 · VAT #440926693 · NICEIC #616575000</span>
    <span>Ali: <a href="tel:${site.phoneTel}">${site.phoneDisplay}</a> · <a href="mailto:${site.email}">${site.email}</a></span>
  </footer>
</div>

<div class="mob-bar">
  <a class="mb-c" href="tel:${site.phoneTel}">Call Ali</a>
  <a class="mb-w" href="#quote">WhatsApp Quote →</a>
</div>

<script>
(function(){
  var slides = ${JSON.stringify(slides)};
  var tr = document.getElementById('tr'), html = '';
  slides.concat(slides).forEach(function(s){
    html += '<div class="slide"><img src="' + s.img + '" alt="' + s.cap + '" loading="eager" draggable="false"><div class="slide-cap"><strong>' + s.cap + '</strong><span>' + s.sub + '</span></div></div>';
  });
  tr.innerHTML = html;

  var off = 0, vel = 0, drag = false, sx = 0, so = 0, lx = 0, lt = 0, SPEED = 0.75;
  tr.addEventListener('pointerdown', function(e){
    drag = true; vel = 0;
    if (tr.setPointerCapture) tr.setPointerCapture(e.pointerId);
    sx = lx = e.clientX; so = off; lt = performance.now();
    tr.classList.add('drag');
  });
  tr.addEventListener('pointermove', function(e){
    if (!drag) return;
    var n = performance.now(), dt = Math.max(n - lt, 1);
    vel = (e.clientX - lx) / dt * 16; lx = e.clientX; lt = n;
    off = so + (e.clientX - sx);
  });
  function up(){ drag = false; tr.classList.remove('drag'); }
  tr.addEventListener('pointerup', up);
  tr.addEventListener('pointercancel', up);

  function tick(){
    var h = tr.scrollWidth / 2;
    if (h > 0) {
      if (!drag) {
        if (Math.abs(vel) > 0.1) { off += vel; vel *= 0.95; }
        else { vel = 0; off -= SPEED; }
      }
      if (off <= -h) off += h;
      if (off > 0) off -= h;
      tr.style.transform = 'translate3d(' + off.toFixed(1) + 'px,0,0)';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  var ov = document.getElementById('ov'), dr = document.getElementById('dr');
  function setM(o){ ov.classList.toggle('open', o); dr.classList.toggle('open', o); document.body.style.overflow = o ? 'hidden' : ''; }
  document.getElementById('open').onclick = function(){ setM(true); };
  document.getElementById('close').onclick = function(){ setM(false); };
  ov.onclick = function(){ setM(false); };
  Array.prototype.forEach.call(document.querySelectorAll('.dlinks a, .dcta a'), function(a){ a.addEventListener('click', function(){ setM(false); }); });

  var qJob = document.getElementById('qJob'), qSec = document.getElementById('qSec'), qPost = document.getElementById('qPost'), qNotes = document.getElementById('qNotes'), qPrev = document.getElementById('qPreview'), qWa = document.getElementById('qWa'), qMail = document.getElementById('qMail');
  function syncQ(){
    var p = qPost.value.trim() ? qPost.value.trim().toUpperCase() : 'NW / Central London';
    var n = qNotes.value.trim() ? qNotes.value.trim() : 'Please let me know availability and estimated cost.';
    var msg = 'Hi Ali (AT Electric),\\nJob: ' + qJob.value + '\\nProperty: ' + qSec.value + '\\nPostcode: ' + p + '\\nDetails: ' + n;
    qPrev.textContent = msg;
    qWa.href = 'https://wa.me/${site.waDigits}?text=' + encodeURIComponent(msg);
    qMail.href = 'mailto:${site.email}?subject=' + encodeURIComponent('Quote Request: ' + qJob.value + ' (' + p + ')') + '&body=' + encodeURIComponent(msg);
  }
  [qJob, qSec, qPost, qNotes].forEach(function(el){ el.addEventListener('input', syncQ); el.addEventListener('change', syncQ); });
  syncQ();

  document.addEventListener('click', function(ev){
    var pk = ev.target && ev.target.closest ? ev.target.closest('[data-pick]') : null;
    if (pk) {
      var val = pk.getAttribute('data-pick');
      var matched = false;
      for (var i = 0; i < qJob.options.length; i++) {
        if (qJob.options[i].value.toLowerCase().indexOf(val.toLowerCase().slice(0, 10)) !== -1) { qJob.selectedIndex = i; matched = true; break; }
      }
      if (!matched) { var opt = document.createElement('option'); opt.value = val; opt.textContent = val; qJob.appendChild(opt); qJob.value = val; }
      syncQ();
      document.getElementById('quote').scrollIntoView({ behavior: 'smooth' });
    }
  });
  ${claimScriptJs}
})();
</script>
</body>
</html>`;
}
