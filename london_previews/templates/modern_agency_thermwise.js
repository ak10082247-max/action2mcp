/**
 * MotionSites "Modern Agency" Template -> Bespoke build for Thermwise Limited (thermwise.co.uk)
 * Uses 100% REAL Thermwise assets straight from thermwise.co.uk:
 *  - Official Thermwise 4-square orange brand logo (tw-logo.png)
 *  - Real Thermwise engineers in branded navy Thermwise fleeces (tw-eng-tablet.jpg, tw-eng-flue.jpg, tw-eng-kitchen.jpg, tw-eng-rad.jpg)
 *  - Real Thermwise copper manifold & boiler servicing photos (tw-manifold.jpg, tw-boiler-service.jpg)
 *  - Official Gas Safe #597272, 8,000+ jobs, 7+ years family-run, 12-month guarantee, 4.3★ Google, 020 3962 0533
 */

export function renderThermwiseModernAgency(site, { clean = false, origin, previewBarHtml, claimScriptJs }) {
  const r = (name) => `${origin}/assets/real/${name}`;
  const cards = [
    { img: r("tw-eng-flue.jpg"), tag: "24/7 Emergency", price: "Within the Hour", title: "Emergency Boiler Breakdown & Repair", desc: "No heating, no hot water, fault codes, or pressure drops diagnosed fast day or night by our own Gas Safe (#597272) engineers." },
    { img: r("tw-boiler-service.jpg"), tag: "Fixed Price", price: "Free Boiler Survey", title: "New Boiler Installations", desc: "Honest fixed-price boiler replacements properly sized for London homes, installed neatly with full Gas Safe registration and 12-month guarantee." },
    { img: r("tw-manifold.jpg"), tag: "Heating Systems", price: "Same-Day Service", title: "Underfloor Heating, Radiators & Systems", desc: "Precision copper manifold installations, cold radiator diagnostics, valve replacements, hot water cylinders, and full central heating care." },
    { img: r("tw-eng-rad.jpg"), tag: "Plumbing & Gas", price: "Home & Landlord", title: "Leaks, Plumbing & Landlord CP12 Certs", desc: "Burst pipes, dripping taps, gas leaks, cooker/hob installations, blockages, and annual Landlord Gas Safety Certificates." },
  ];

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thermwise Limited — 24/7 Emergency Plumbing &amp; Boilers London</title>
<meta name="description" content="Family-run Gas Safe (#597272) plumbers & heating engineers across North, West & Central London. 8,000+ jobs, 12-month guarantee, 24/7 emergency callouts.">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#111827;background:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;border:0;cursor:pointer;background:none;color:inherit}
img{display:block;max-width:100%}
svg{display:block}
.wrap{max-width:1440px;margin:0 auto}

.pv-bar{position:sticky;top:0;z-index:120;background:#111827;color:#f9fafb;border-bottom:1px solid rgba(255,255,255,.14);font-size:12.5px;line-height:1.4}
.pv-inner{max-width:1440px;margin:0 auto;padding:9px 18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.pv-copy{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pv-pill{background:#f59e0b;color:#111827;font-weight:800;font-size:10px;letter-spacing:.08em;padding:3px 8px;border-radius:999px}
.pv-actions{display:flex;align-items:center;gap:8px}
.pv-buy{background:#10b981;color:#052e16;border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer}
.pv-close{background:transparent;color:#d1d5db;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 11px;font-size:12px;cursor:pointer}

.hero{position:relative;min-height:92vh;display:flex;flex-direction:column;background:#efefef;overflow:hidden}
.fx{position:absolute;inset:0;z-index:10;pointer-events:none;overflow:hidden}
.fx canvas{position:absolute;inset:0;width:100%;height:100%}
.fx .glass{position:absolute;inset:-20%;background:repeating-linear-gradient(121deg,rgba(255,255,255,0) 0,rgba(255,255,255,.55) 38px,rgba(255,255,255,0) 90px,rgba(0,0,0,.035) 120px,rgba(255,255,255,0) 160px);mix-blend-mode:soft-light;animation:drift 18s linear infinite}
.fx .glass2{position:absolute;inset:-20%;background:repeating-linear-gradient(121deg,rgba(255,255,255,0) 0,rgba(255,255,255,.7) 14px,rgba(255,255,255,0) 44px,rgba(120,120,120,.05) 70px);opacity:.55;animation:drift 26s linear infinite reverse}
.fx .grain{position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
@keyframes drift{from{transform:translateX(-90px)}to{transform:translateX(90px)}}

nav.top{position:relative;z-index:20;width:100%}
.nav-in{max-width:1440px;margin:0 auto;padding:10px}
.pill{background:#fff;border-radius:999px;padding:6px 8px 6px 6px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 6px 24px rgba(17,24,39,.06)}
.left,.right{display:flex;align-items:center}
.logo-brand{display:inline-flex;align-items:center;gap:10px}
.logo-img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb}
.logo-txt{font-weight:700;font-size:15px;letter-spacing:-.02em;color:#111827}
.links{display:none;gap:24px;margin-left:24px}
.links a{font-size:14px;color:#111827;transition:color .3s}
.links a:hover{color:#6b7280}
.right{gap:16px}
.status{display:none;font-size:13px;color:#4b5563}
.clock{display:none;align-items:center;gap:6px;font-size:13px;color:#4b5563}
.menu-btn{background:#111827;color:#fff;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;padding:9px 16px}

.btn{display:inline-flex;align-items:center;gap:12px;border-radius:999px;color:#fff;font-weight:500;font-size:13.5px;padding:8px 8px 8px 20px;white-space:nowrap}
.btn.dark{background:#111827}
.btn.org{background:#F26522;transition:background .3s}
.btn.org:hover{background:#e05a1a}
.roll{height:20px;overflow:hidden;display:block}
.roll>span{display:flex;flex-direction:column;transition:transform .5s cubic-bezier(.25,.1,.25,1)}
.roll>span>span{height:20px;line-height:20px;display:block}
.btn:hover .roll>span{transform:translateY(-50%)}
.circ{width:24px;height:24px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;transition:transform .5s cubic-bezier(.25,.1,.25,1)}
.btn:hover .circ{transform:rotate(-45deg)}
.btn.org .circ{width:30px;height:30px;color:#F26522}
.btn.dark .circ{color:#111827}

.hero-c{position:relative;z-index:20;margin-top:auto;width:100%}
.hero-in{max-width:1440px;margin:0 auto;padding:56px 20px 56px}
.label{font-size:13.5px;letter-spacing:.025em;color:#111827;margin-bottom:18px;font-weight:500}
h1{font-size:clamp(2rem,6.8vw,4.35rem);font-weight:500;line-height:1.06;letter-spacing:-.03em;color:#111827}
.cta{display:flex;flex-direction:column;align-items:flex-start;gap:14px;margin-top:32px}
.badge{display:inline-flex;align-items:center;gap:10px;background:#fff;border-radius:6px;padding:9px 12px;box-shadow:0 2px 10px rgba(0,0,0,.08);transition:box-shadow .3s;font-size:13.5px;font-weight:500}
.badge:hover{box-shadow:0 4px 16px rgba(0,0,0,.14)}
.badge em{font-style:normal;font-size:11px;background:#111827;color:#fff;padding:3px 8px;border-radius:4px;font-weight:600}
.br{display:none}

.mm{position:fixed;inset:0;z-index:150;display:flex;flex-direction:column;justify-content:flex-end;visibility:hidden;transition:visibility 0s .5s}
.mm.open{visibility:visible;transition:none}
.mm .bd{position:absolute;inset:0;background:rgba(0,0,0,.6);opacity:0;transition:opacity .5s}
.mm.open .bd{opacity:1}
.sheet{position:relative;background:#fff;border-radius:18px;margin:0 12px 12px;padding:22px;transform:translateY(110%);transition:transform .5s cubic-bezier(.32,.72,0,1)}
.mm.open .sheet{transform:translateY(0)}
.tb{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#4b5563;background:#f3f4f6;border-radius:999px;padding:6px 12px;margin-bottom:16px}
.sheet a.l{display:block;font-size:28px;font-weight:500;padding:6px 0}
.sheet .btn{margin-top:18px}

.about{background:#fff;padding:64px 0 48px;overflow:hidden}
.badge-row{display:flex;align-items:center;gap:12px;padding:0 20px;margin-bottom:24px}
.num{width:26px;height:26px;border-radius:50%;background:#111827;color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center}
.tag{font-size:12.5px;font-weight:500;border:1px solid #e5e7eb;border-radius:999px;padding:5px 14px}
h2{font-size:clamp(1.6rem,4vw,3.25rem);font-weight:500;line-height:1.12;letter-spacing:-.025em;color:#111827;padding:0 20px;margin-bottom:44px}
.mob{padding:0 20px}
.mob p{font-size:15.5px;line-height:1.6;font-weight:500;margin-bottom:20px}
.mob .imgs{display:flex;flex-direction:column;gap:16px;margin-top:28px}
.rimg{border-radius:16px;object-fit:cover;object-position:center 20%;width:100%}
.i1{aspect-ratio:4/4}.i2{aspect-ratio:4/3}
.desk{display:none}

.cases{background:#F5F5F5;padding:64px 0}
h2.big{font-size:clamp(1.85rem,6vw,4.1rem);line-height:1.08;letter-spacing:-.03em;margin-bottom:40px}
.grid{display:grid;grid-template-columns:1fr;gap:22px;padding:0 20px}
.card-box{position:relative;border-radius:18px;overflow:hidden;cursor:pointer;background:#111827;aspect-ratio:16/11}
.card-box img{width:100%;height:100%;object-fit:cover;object-position:center 20%;transition:transform .6s cubic-bezier(.25,.1,.25,1)}
.card-box:hover img{transform:scale(1.04)}
.card-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(17,24,39,.04) 35%,rgba(17,24,39,.62) 100%)}
.card-badge{position:absolute;top:16px;left:16px;background:rgba(255,255,255,.94);color:#111827;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px}
.hb{position:absolute;left:16px;bottom:16px;height:38px;width:38px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;overflow:hidden;transition:all .32s ease-in-out;background:#fff;color:#111827;white-space:nowrap}
.card-box:hover .hb{width:176px}
.hb.dk{background:#F26522;color:#fff}
.card-box:hover .hb.dk{width:186px}
.hb span{font-size:13px;font-weight:600;opacity:0;transition:opacity .28s .08s;width:0;overflow:hidden}
.card-box:hover .hb span{opacity:1;width:auto}
.hb svg{flex:none;transform:rotate(-45deg);transition:transform .3s}
.card-box:hover .hb svg{transform:rotate(0)}
.desc{font-size:13.5px;line-height:1.6;color:#4b5563;margin-top:14px}
.ttl{font-size:16px;font-weight:600;color:#111827;margin-top:4px}

.dispatch{background:#111827;color:#fff;padding:72px 20px 84px}
.d-wrap{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
.d-wrap h2{color:#fff;padding:0;margin-bottom:14px;font-size:clamp(1.8rem,3.6vw,2.9rem)}
.d-lead{color:#9ca3af;font-size:15.5px;line-height:1.6;margin-bottom:24px}
.qf{margin-bottom:14px}
.qf label{display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:6px}
.qf input,.qf select,.qf textarea{width:100%;padding:12px 14px;font:inherit;font-size:15px;border:1px solid #374151;border-radius:10px;background:#1f2937;color:#fff}
.qf textarea{min-height:76px;resize:vertical}
.d-panel{background:#fff;color:#111827;border-radius:18px;padding:26px}
.d-panel h3{font-size:19px;font-weight:600;margin-bottom:6px}
.d-panel .ds{font-size:13.5px;color:#4b5563;margin-bottom:14px}
.d-prev{background:#f3f4f6;border-radius:10px;padding:14px;font-size:13.5px;white-space:pre-wrap;line-height:1.55;margin-bottom:18px}
.d-btns{display:flex;flex-wrap:wrap;gap:10px}
.d-areas{max-width:1180px;margin:48px auto 0;padding-top:28px;border-top:1px solid #1f2937;display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;font-size:13px;color:#9ca3af}

.mob-bar{position:fixed;bottom:12px;left:12px;right:12px;z-index:90;background:#111827;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:6px;display:flex;gap:6px;box-shadow:0 16px 34px rgba(0,0,0,.3)}
.mob-bar a{flex:1;text-align:center;font-size:13.5px;font-weight:600;padding:10px;border-radius:999px}
.mb-c{color:#fff;background:#F26522}
.mb-q{color:#111827;background:#fff}

@media(min-width:640px){
  .nav-in{padding:14px}.logo-img{width:42px;height:42px}
  .hero-in{padding:64px 32px 64px}.label{font-size:14px;margin-bottom:26px}
  .br{display:inline}.sp{display:none}
  .cta{flex-direction:row;align-items:center;gap:18px;margin-top:42px}
  .about{padding:84px 0 64px}.badge-row{padding:0 32px;margin-bottom:28px}
  h2{padding:0 32px;margin-bottom:56px}
  .mob{padding:0 32px}.mob .imgs{flex-direction:row}.mob .a{width:45%}.mob .b{width:55%}
  .cases{padding:84px 0}.grid{padding:0 32px;gap:24px}
  .mob-bar{display:none}
}
@media(min-width:768px){.links{display:flex}.clock{display:flex}.menu-btn{display:none}.grid{grid-template-columns:1fr 1fr}}
@media(min-width:1024px){
  .status{display:block}.hero-in{padding:72px 48px 76px}
  .about{padding:112px 0 92px}.badge-row{padding:0 48px}h2{padding:0 48px;margin-bottom:88px}
  .mob{display:none}
  .desk{display:grid;grid-template-columns:28% 1fr 46%;align-items:end;gap:28px;padding:0 48px}
  .desk .c{align-self:start;display:flex;justify-content:flex-end}
  .desk .c>div{display:flex;flex-direction:column;align-items:flex-start}
  .desk p{font-size:17px;line-height:1.65;margin-bottom:22px;color:#1f2937}
  .cases{padding:104px 0}.grid{padding:0 48px;gap:28px}
}
.right .btn{display:none}
@media(min-width:768px){.right .btn{display:inline-flex}}
@media(max-width:860px){.d-wrap{grid-template-columns:1fr}}
</style>
</head>
<body>
${previewBarHtml}

<section class="hero" id="top">
  <div class="fx">
    <canvas id="cv"></canvas>
    <div class="glass2"></div><div class="glass"></div><div class="grain"></div>
  </div>
  <nav class="top"><div class="nav-in"><div class="pill">
    <div class="left">
      <a class="logo-brand" href="#top"><img class="logo-img" src="${r("tw-logo.png")}" alt="Thermwise Logo"><span class="logo-txt">Thermwise</span></a>
      <div class="links"><a href="#about">Our Engineers</a><a href="#services">Services</a><a href="#dispatch">24/7 Dispatch</a><a href="tel:${site.phoneTel}">${site.phoneDisplay}</a></div>
    </div>
    <div class="right">
      <span class="status">24/7 Engineers On Standby</span>
      <span class="clock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span class="t">00:00</span> in London</span>
      <a class="btn dark" href="tel:${site.phoneTel}"><span class="roll"><span><span>Call 020 3962 0533</span><span>Call 020 3962 0533</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
      <button class="menu-btn" id="mb" aria-label="Menu"><svg id="mi" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span id="mt">Menu</span></button>
    </div>
  </div></div></nav>

  <div class="hero-c"><div class="hero-in">
    <p class="label">Thermwise Limited · North, West &amp; Central London + Hertfordshire</p>
    <h1>London's heating &amp; plumbing<br class="br"><span class="sp"> </span>engineers, at your door<br class="br"><span class="sp"> </span>within the hour.</h1>
    <div class="cta">
      <a class="btn org" href="#dispatch"><span class="roll"><span><span>Request 24/7 Engineer</span><span>Request 24/7 Engineer</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
      <a class="badge" href="#about">
        <img src="${r("tw-logo.png")}" alt="" style="width:22px;height:22px;border-radius:4px">
        Gas Safe Reg #597272 · 4.3★ Google<em>8,000+ Jobs</em>
      </a>
    </div>
  </div></div>
</section>

<div class="mm" id="mm">
  <div class="bd" id="bd"></div>
  <div class="sheet">
    <div class="tb"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span><span class="t">00:00</span> in London</span></div>
    <a class="l" href="#about">Our Engineers</a><a class="l" href="#services">Services</a><a class="l" href="#dispatch">24/7 Dispatch</a><a class="l" href="tel:${site.phoneTel}">${site.phoneDisplay}</a>
    <a class="btn org" href="#dispatch"><span class="roll"><span><span>Request Engineer</span><span>Request Engineer</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
  </div>
</div>

<section class="about" id="about"><div class="wrap">
  <div class="badge-row"><span class="num">1</span><span class="tag">Family-Run · 7+ Years · 12-Month Guarantee</span></div>
  <h2>Our own engineers.<br>Zero call-centre middlemen.</h2>
  <div class="mob">
    <p>Unlike national agencies that pass your emergency to whoever is free, Thermwise sends our own Gas Safe (#597272) engineers across North, West &amp; Central London — backed by 8,000+ completed jobs and a 12-month workmanship guarantee.</p>
    <a class="btn org" href="tel:${site.phoneTel}"><span class="roll"><span><span>Call 020 3962 0533</span><span>Call 020 3962 0533</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
    <div class="imgs">
      <img class="rimg i1 a" alt="Thermwise engineer servicing kitchen boiler" src="${r("tw-eng-kitchen.jpg")}">
      <img class="rimg i2 b" alt="Thermwise Gas Safe engineer diagnosing combi boiler" src="${r("tw-eng-tablet.jpg")}">
    </div>
  </div>
  <div class="desk">
    <div class="l"><img class="rimg i1" alt="Thermwise engineer servicing a London kitchen boiler" src="${r("tw-eng-kitchen.jpg")}"></div>
    <div class="c"><div>
      <p>Unlike agencies that pass your job<br>to whoever is free, Thermwise sends our<br>own uniformed Gas Safe (#597272) team<br>from diagnosis to 12-month sign-off.</p>
      <a class="btn org" href="#dispatch"><span class="roll"><span><span>Book Priority Callback</span><span>Book Priority Callback</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
    </div></div>
    <div class="r"><img class="rimg i2" alt="Thermwise engineer with boiler diagnostics tablet" src="${r("tw-eng-tablet.jpg")}"></div>
  </div>
</div></section>

<section class="cases" id="services"><div class="wrap">
  <div class="badge-row"><span class="num">2</span><span class="tag" style="border-color:#d1d5db">One Team for Your Whole Home</span></div>
  <h2 class="big">Heating, boilers &amp; 24/7 plumbing</h2>
  <div class="grid">
    ${cards
      .map(
        (c, idx) => `<div>
      <div class="card-box" data-pick="${c.title}">
        <img src="${c.img}" alt="${c.title}" loading="lazy">
        <div class="card-scrim"></div>
        <span class="card-badge">${c.tag} · ${c.price}</span>
        <div class="hb${idx % 2 === 1 ? " dk" : ""}"><span>Request quote</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      </div>
      <p class="desc">${c.desc}</p>
      <p class="ttl">${c.title}</p>
    </div>`
      )
      .join("")}
  </div>
</div></section>

<section class="dispatch" id="dispatch">
  <div class="d-wrap">
    <div>
      <h2>24/7 Emergency Triage<br>&amp; Free Boiler Survey</h2>
      <p class="d-lead">No waiting on a slow 9-second Wix page — pick your issue and urgency below to call 020 3962 0533 immediately or send a priority callback request to info@thermwise.co.uk.</p>
      <div class="qf"><label for="qJob">What do you need help with?</label><select id="qJob">${site.quoteJobs.map((j) => `<option>${j}</option>`).join("")}</select></div>
      <div class="qf"><label for="qSec">${site.quoteSecondaryLabel}</label><select id="qSec">${site.quoteSecondaryOptions.map((o) => `<option>${o}</option>`).join("")}</select></div>
      <div class="qf"><label for="qPost">London / Herts Postcode</label><input id="qPost" type="text" placeholder="e.g. W5, NW3, N12" maxlength="16"></div>
      <div class="qf"><label for="qNotes">Boiler Brand / Fault Code / Notes</label><textarea id="qNotes" placeholder="e.g. Worcester / Vaillant boiler fault code, no hot water..."></textarea></div>
    </div>
    <div class="d-panel">
      <h3>Priority Dispatch Summary</h3>
      <p class="ds">For bursts or no heating tonight, tap Call Now. For fixed boiler quotes or CP12 certs, tap Send Callback Email.</p>
      <div id="qPreview" class="d-prev"></div>
      <div class="d-btns">
        <a class="btn org" href="tel:${site.phoneTel}"><span class="roll"><span><span>Call 020 3962 0533</span><span>Call 020 3962 0533</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
        <a id="qMail" class="btn dark" href="mailto:${site.email}"><span class="roll"><span><span>Send Callback Email</span><span>Send Callback Email</span></span></span><span class="circ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></a>
      </div>
    </div>
  </div>
  <div class="d-areas">
    <span>Areas: ${site.areas.join(" · ")}</span>
    <span>© 2026 Thermwise Limited · Gas Safe #597272 · 020 3962 0533</span>
  </div>
</section>

<div class="mob-bar">
  <a class="mb-c" href="tel:${site.phoneTel}">24/7 Call: 020 3962 0533</a>
  <a class="mb-q" href="#dispatch">Quick Quote</a>
</div>

<script>
(function(){
  function tick(){
    var s; try { s = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch(e) { s = '24/7'; }
    document.querySelectorAll('.t').forEach(function(e){ e.textContent = s; });
  }
  tick(); setInterval(tick, 1000);

  var mm = document.getElementById('mm'), mb = document.getElementById('mb'), mt = document.getElementById('mt'), mi = document.getElementById('mi');
  var menuP = 'M4 6h16M4 12h16M4 18h16', closeP = 'M6 6l12 12M18 6L6 18';
  function setM(o){ mm.classList.toggle('open', o); mt.textContent = o ? 'Close' : 'Menu'; mi.firstElementChild.setAttribute('d', o ? closeP : menuP); document.body.style.overflow = o ? 'hidden' : ''; }
  mb.addEventListener('click', function(){ setM(!mm.classList.contains('open')); });
  document.getElementById('bd').addEventListener('click', function(){ setM(false); });
  mm.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setM(false); }); });

  var cv = document.getElementById('cv'), cx = cv.getContext('2d'), W = 0, H = 0, pts = [];
  function rs(){ var d = Math.min(devicePixelRatio || 1, 1.5); W = cv.width = Math.max(1, Math.round(cv.clientWidth * d / 2)); H = cv.height = Math.max(1, Math.round(cv.clientHeight * d / 2)); }
  rs(); window.addEventListener('resize', rs);
  window.addEventListener('pointermove', function(e){
    pts.push({ x: e.clientX / Math.max(1, window.innerWidth), y: e.clientY / Math.max(1, window.innerHeight), a: 1 });
    if (pts.length > 36) pts.shift();
  });
  var t0 = performance.now();
  function frame(now){
    var t = (now - t0) / 1000;
    var g = cx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#efefef'); g.addColorStop(1, '#f7f7f7');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    for (var i = 0; i < 3; i++) {
      var x = W * (0.5 + 0.38 * Math.sin(t * 0.16 + i * 2.1)), y = H * (0.42 + 0.28 * Math.cos(t * 0.12 + i * 1.6)), r = Math.max(W, H) * 0.45;
      var rg = cx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, i === 0 ? 'rgba(242,101,34,.09)' : 'rgba(255,255,255,.72)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    }
    for (var j = 0; j < pts.length; j++) {
      var p = pts[j]; p.a *= 0.972;
      var px = p.x * W, py = p.y * H, rr = Math.max(W, H) * 0.12 * (1 + (1 - p.a));
      var og = cx.createRadialGradient(px, py, 0, px, py, rr);
      og.addColorStop(0, 'rgba(242,101,34,' + (p.a * 0.26).toFixed(3) + ')');
      og.addColorStop(1, 'rgba(242,101,34,0)');
      cx.fillStyle = og; cx.fillRect(0, 0, W, H);
    }
    pts = pts.filter(function(p){ return p.a > 0.03; });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var qJob = document.getElementById('qJob'), qSec = document.getElementById('qSec'), qPost = document.getElementById('qPost'), qNotes = document.getElementById('qNotes'), qPrev = document.getElementById('qPreview'), qMail = document.getElementById('qMail');
  function syncQ(){
    var p = qPost.value.trim() ? qPost.value.trim().toUpperCase() : 'London';
    var n = qNotes.value.trim() ? qNotes.value.trim() : 'Please call me back with engineer availability.';
    var msg = 'Hi Thermwise Team,\\nIssue: ' + qJob.value + '\\nUrgency: ' + qSec.value + '\\nPostcode: ' + p + '\\nDetails: ' + n;
    qPrev.textContent = msg;
    qMail.href = 'mailto:${site.email}?subject=' + encodeURIComponent('[' + qSec.value + '] ' + qJob.value + ' - ' + p) + '&body=' + encodeURIComponent(msg);
  }
  [qJob, qSec, qPost, qNotes].forEach(function(el){ el.addEventListener('input', syncQ); el.addEventListener('change', syncQ); });
  syncQ();

  document.addEventListener('click', function(ev){
    var card = ev.target && ev.target.closest ? ev.target.closest('[data-pick]') : null;
    if (card) {
      var val = card.getAttribute('data-pick');
      for (var i = 0; i < qJob.options.length; i++) {
        if (qJob.options[i].value.toLowerCase().indexOf(val.toLowerCase().slice(0, 8)) !== -1) { qJob.selectedIndex = i; break; }
      }
      syncQ();
      document.getElementById('dispatch').scrollIntoView({ behavior: 'smooth' });
    }
  });
  ${claimScriptJs}
})();
</script>
</body>
</html>`;
}
