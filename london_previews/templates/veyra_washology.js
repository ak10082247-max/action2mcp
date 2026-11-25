/**
 * MotionSites "Veyra Electric" Template -> Bespoke build for Washology Mobile Detailing (washologymv.co.uk)
 * Exact Veyra Electric design DNA:
 *  - Space Grotesk typography (-0.03em tracking), slate-blue studio canvas (#6b879d / #708fa2), acid-yellow (#edff39) hotspots
 *  - Coordinate-locked 16:9 media-envelope with crisp 3px white frame
 *  - 4 breathing interactive hotspots pinned directly onto Wesley's North London Porsche 911:
 *      1) Bonnet -> Ceramic Coating (smooth scale(1.5) zoom into hydrophobic beading macro + accordion breakdown)
 *      2) Side Panel -> Multi-Stage Paint Correction (zoom + Stage 1/2 accordion breakdown)
 *      3) Wheels & Trim -> Mobile Deep Clean (30 min - 5 hr home/workplace care)
 *      4) Cabin -> 5.0★ North London Reviews (Sarah P., Zoe F., Stephan H. verbatim)
 *  - Keyboard Escape support, Back to Vehicle button, 4-column feature notes strip + 1-tap WhatsApp booking bar (07388 725375)
 */

export function renderWashologyVeyra(site, { clean = false, origin, previewBarHtml, claimScriptJs }) {
  const heroPhoto = `${origin}${site.heroImg}`;
  const detailPhoto = `${origin}${site.detailImg}`;
  const waQuick = `https://wa.me/${site.waDigits}?text=${encodeURIComponent("Hi Wesley, I'd like to book a mobile detail with Washology in North London.")}`;

  const zones = {
    ceramic: {
      index: "01",
      label: "Ceramic coating",
      category: "Long-term hydrophobic shield",
      title: "Glass-like gloss,\nyear round.",
      description:
        "Finest-grade ceramic protection locks in mirror reflections across your paintwork while repelling London road grime, rain, and UV.",
      benefit: "Tight crystal water beading cuts future wash time in half and protects resale value.",
      image: detailPhoto,
      anchor: { x: 35, y: 51 },
      parts: [
        { n: "01", name: "Hydrophobic top coat", desc: "Tight water droplets sheet straight off the bonnet on wet London commutes." },
        { n: "02", name: "Chemical & UV barrier", desc: "Guards clear-coat against bird droppings, traffic film, and oxidation." },
        { n: "03", name: "Applied on your driveway", desc: "Carried out cleanly at your North London home or workplace." },
      ],
    },
    correction: {
      index: "02",
      label: "Paint correction",
      category: "Swirl & defect removal",
      title: "Depth restored,\npanel by panel.",
      description:
        "From single-stage Paint Enhancement to meticulous multi-stage Paint Correction removing swirl marks, haze, and micro-marring.",
      benefit: "Brings dark metallic paint back to crisp showroom clarity before sealing or ceramic coating.",
      image: heroPhoto,
      anchor: { x: 70, y: 49 },
      parts: [
        { n: "01", name: "Decontamination & clay bar", desc: "Safely lifts bonded iron fallout and tar before a polisher ever touches the paint." },
        { n: "02", name: "Stage 1 paint enhancement", desc: "Single-stage machine refinement clearing light wash marks and dullness." },
        { n: "03", name: "Multi-stage correction", desc: "Up to 5-hour dedicated compounding and jewelling for deeper defects." },
      ],
    },
    deepclean: {
      index: "03",
      label: "Mobile deep clean",
      category: "30 min to 5 hr sessions",
      title: "Home or office,\nzero drop-off.",
      description:
        "Safe exterior hand wash, wheel barrel cleaning, and full interior reset using eco-friendly finest-grade products right outside your door.",
      benefit: "Zero waiting rooms — carry on with your workday in North London while Wesley details your vehicle.",
      image: heroPhoto,
      anchor: { x: 58, y: 74 },
      parts: [
        { n: "01", name: "Safe scratch-free exterior", desc: "Pre-wash snow foam, soft microfibre wash, and wheel-face detailing." },
        { n: "02", name: "Full cabin reset", desc: "Carpets, leather, vents, plastics, and streak-free interior glass." },
        { n: "03", name: "Flexible maintenance plans", desc: "Swift 30-minute refresh through to meticulous 4–5 hour details." },
      ],
    },
    reviews: {
      index: "04",
      label: "5.0 ★ Reviews",
      category: "North London client proof",
      title: "Washed like\nhis own car.",
      description:
        "The most highly rated mobile valeting and detailing service in North London — verified five-star client feedback.",
      benefit: "Direct communication and punctual scheduling straight with Wesley on 07388 725375.",
      image: detailPhoto,
      anchor: { x: 52, y: 34 },
      parts: [
        { n: "5★", name: "Sarah P.", desc: "“Wesley was friendly and efficient and washed it like it was his own car, with attention and detail. Highly recommend Washology!”" },
        { n: "5★", name: "Zoe F.", desc: "“Washology truly exceeded my expectations — their customer service was exceptional, from streamlined communication to accommodating my schedule.”" },
        { n: "5★", name: "Stephan H.", desc: "“Arrived bang on time and did a fantastic job. I used to think I kept my car clean but Wesley has put me to shame.”" },
      ],
    },
  };

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Washology — Mobile Car Detailing &amp; Ceramic Coating · North London</title>
<meta name="description" content="North London's highly rated mobile car valeting, paint correction, and ceramic coating service. Direct WhatsApp booking with Wesley on 07388 725375.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --sky:#708fa2;--studio:#637f94;--acid:#edff39;--ink:#fff;--muted:#dde7ee;
  --panel:#2d4c60;--line:#ffffff30;--on-acid:#10190c;
  --radius-panel:14px;--radius-control:8px;--gutter:clamp(20px,4vw,68px);
  --ease:cubic-bezier(.22,.7,.25,1);--ui-fast:180ms;--ui-enter:240ms;
  font-family:'Space Grotesk',system-ui,sans-serif;font-weight:400;letter-spacing:-.03em;color:var(--ink);background:var(--studio);
  -webkit-font-smoothing:antialiased;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-width:320px;background:var(--studio);overflow-x:hidden}
button,a{-webkit-tap-highlight-color:transparent;color:inherit;text-decoration:none}
button{font:inherit;letter-spacing:inherit;cursor:pointer}
::selection{background:var(--acid);color:var(--on-acid)}
[hidden]{display:none!important}

/* Preview handover bar */
.pv-bar{position:sticky;top:0;z-index:120;background:#101824;color:#f8fafc;border-bottom:1px solid rgba(255,255,255,.16);font-size:12.5px;line-height:1.4;letter-spacing:0}
.pv-inner{max-width:1320px;margin:0 auto;padding:9px 18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.pv-copy{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pv-pill{background:var(--acid);color:var(--on-acid);font-weight:700;font-size:10px;letter-spacing:.08em;padding:3px 8px;border-radius:999px}
.pv-actions{display:flex;align-items:center;gap:8px}
.pv-buy{background:#10b981;color:#052e16;border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12.5px}
.pv-close{background:transparent;color:#cbd5e1;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 11px;font-size:12px}

.experience{min-height:92vh;display:flex;flex-direction:column;position:relative;background:var(--studio)}
.masthead{height:74px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;width:min(1260px,calc(100% - 2*var(--gutter)));margin:0 auto;z-index:10;gap:18px;border-bottom:1px solid var(--line)}
.wordmark{font-size:26px;font-weight:500;letter-spacing:-.055em;line-height:1}
.header-mid{font-size:14px;color:var(--muted)}
.header-cta{display:inline-flex;align-items:center;gap:8px;background:var(--acid);color:var(--on-acid);padding:9px 15px;border-radius:var(--radius-control);font-size:13.5px;font-weight:600}
.header-cta:hover{background:#f4ff78}

.stage-outer{width:min(1260px,calc(100% - 2*var(--gutter)));margin:0 auto;padding:24px 0 18px;position:relative;flex:1;display:flex;flex-direction:column;justify-content:center}
.intro{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px;transition:opacity .35s,transform .5s}
.intro.hide{opacity:0;transform:translateY(-8px);pointer-events:none;height:0;margin:0;overflow:hidden}
.intro h1{font-size:clamp(32px,4.2vw,58px);font-weight:400;line-height:.94;letter-spacing:-.035em;margin:0}
.intro-desc{font-size:14px;line-height:1.45;color:var(--muted);margin:0;text-align:right}
.intro-desc span{display:block}

.toolbar-detail{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.back{display:inline-flex;align-items:center;gap:10px;min-height:42px;background:var(--acid);color:var(--on-acid);border:0;border-radius:var(--radius-control);padding:9px 14px;font-size:14px;font-weight:500;transition:background var(--ui-fast)}
.back:hover{background:#f4ff78}
.back kbd{font:inherit;font-size:11.5px;border-left:1px solid #18394b40;padding-left:9px;margin-left:4px;opacity:.8}

/* COORDINATE-LOCKED VEHICLE STAGE + DETAIL SPLIT */
.scene-grid{display:grid;grid-template-columns:1fr;gap:24px;align-items:center}
.experience.phase-detail .scene-grid{grid-template-columns:1.35fr 0.85fr}
.plane{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 0 0 3px #fff,0 26px 60px rgba(12,24,36,.32);background:#0f172a}
.car-visual,.detail-visual{position:absolute;inset:0}
.car-visual{transform-origin:var(--fx,50%) var(--fy,50%);transition:transform 1.1s cubic-bezier(.65,0,.25,1)}
.experience.phase-detail .car-visual{transform:scale(1.42)}
.car-visual img,.detail-visual img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;pointer-events:none}
.detail-visual{opacity:0;transition:opacity .7s ease;pointer-events:none}
.experience.phase-detail .detail-visual{opacity:1}
.detail-visual img{transform:scale(1.06);transition:transform 1.1s cubic-bezier(.22,1,.36,1)}
.experience.phase-detail .detail-visual img{transform:scale(1)}

/* BREATHING ACID HOTSPOTS (EXACT VEYRA) */
.hotspot-layer{position:absolute;inset:0;z-index:4;transition:opacity .3s ease}
.experience.phase-detail .hotspot-layer{opacity:0;pointer-events:none}
.hotspot{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;width:48px;height:48px;border:0;background:none;padding:0;border-radius:50%}
.hotspot-ring{position:relative;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;color:var(--on-acid);background:var(--acid);box-shadow:0 0 0 6px #edff3922;transition:transform var(--ui-fast),box-shadow var(--ui-fast)}
.hotspot-ring:after{content:'';position:absolute;inset:-6px;border:1.5px solid #edff3985;border-radius:50%;animation:breath 3.6s ease-in-out infinite}
@keyframes breath{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.85;transform:scale(1.16)}}
.hotspot:hover .hotspot-ring,.hotspot:focus-visible .hotspot-ring{transform:scale(1.1);box-shadow:0 0 0 8px #edff3930}
.hotspot-label{position:absolute;bottom:calc(100% + 4px);left:50%;transform:translate(-50%,4px);opacity:0;display:flex;gap:8px;align-items:center;white-space:nowrap;background:var(--acid);color:var(--on-acid);border-radius:var(--radius-control);padding:9px 13px;font-size:13.5px;font-weight:600;box-shadow:0 10px 24px rgba(0,0,0,.22);transition:opacity var(--ui-fast),transform var(--ui-enter) var(--ease);pointer-events:none}
.hotspot:hover .hotspot-label,.hotspot:focus-visible .hotspot-label,.hotspot.hint .hotspot-label{opacity:1;transform:translate(-50%,0)}

/* DETAIL ACCORDION PANEL */
.detail-copy{display:none;background:rgba(22,42,56,.62);border:1px solid var(--line);border-radius:16px;padding:26px;backdrop-filter:blur(12px)}
.experience.phase-detail .detail-copy{display:block;animation:fadeUp .45s var(--ease)}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.eyebrow{font-size:13px;color:var(--acid);margin:0 0 10px;text-transform:uppercase;letter-spacing:.04em}
.detail-copy h2{font-size:clamp(28px,2.8vw,42px);line-height:.96;font-weight:400;margin:0 0 16px;white-space:pre-line}
.sys-desc{font-size:14.5px;line-height:1.48;color:var(--muted);margin:0 0 18px}
.part-list{border-top:1px solid var(--line)}
.part-btn{display:block;width:100%;border:0;border-bottom:1px solid var(--line);background:transparent;padding:12px 0;text-align:left;font-size:14.5px;transition:color var(--ui-fast)}
.part-btn:hover,.part-btn.open{color:var(--acid)}
.part-row{display:flex;align-items:center;gap:12px}
.part-row small{font-size:12px;color:var(--muted);min-width:22px}
.part-row .plus{margin-left:auto;transition:transform .2s}
.part-btn.open .plus{transform:rotate(45deg)}
.part-text{display:none;font-size:13.5px;line-height:1.45;color:var(--muted);padding:8px 0 2px 34px}
.part-btn.open .part-text{display:block}
.benefit{margin-top:16px;font-size:13.5px;color:var(--muted)}
.benefit strong{display:block;color:var(--ink);margin-top:4px;font-weight:500}
.detail-book{display:inline-flex;align-items:center;justify-content:center;width:100%;margin-top:18px;background:var(--acid);color:var(--on-acid);padding:12px 16px;border-radius:var(--radius-control);font-weight:600;font-size:14.5px}

/* 4-COLUMN FEATURE NOTES BAR */
.scene-footer{width:min(1260px,calc(100% - 2*var(--gutter)));margin:0 auto;padding:22px 0 26px;color:var(--muted)}
.feature-notes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
.f-note{background:transparent;border:0;border-top:1px solid var(--line);padding:14px 0 0;text-align:left;transition:border-color .2s}
.f-note:hover{border-top-color:var(--acid)}
.f-note h3{font-size:15.5px;font-weight:500;color:var(--ink);margin:0 0 6px;display:flex;justify-content:space-between;align-items:center}
.f-note h3 span{color:var(--acid);font-size:13px}
.f-note p{font-size:13.5px;line-height:1.42;margin:0;color:var(--muted)}

/* WHATSAPP INSTANT BOOKING DOCK BELOW STAGE */
.book-sec{background:#1b3040;border-top:1px solid var(--line);padding:56px 0 64px}
.book-inner{width:min(1260px,calc(100% - 2*var(--gutter)));margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start}
.book-inner h2{font-size:clamp(26px,3.2vw,40px);font-weight:400;line-height:1.05;margin:0 0 10px}
.book-lead{font-size:14.5px;color:var(--muted);margin:0 0 22px}
.qf{margin-bottom:13px}
.qf label{display:block;font-size:12px;color:var(--acid);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.qf input,.qf select,.qf textarea{width:100%;padding:11px 13px;font:inherit;font-size:14.5px;border:1px solid var(--line);border-radius:var(--radius-control);background:rgba(12,24,36,.5);color:#fff}
.qf select option{background:#1b3040}
.qf textarea{min-height:72px;resize:vertical}
.q-panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-panel);padding:24px}
.q-panel h3{font-size:18px;font-weight:500;margin:0 0 6px}
.q-panel p{font-size:13.5px;color:var(--muted);margin:0 0 14px}
.q-prev{background:rgba(12,24,36,.55);border:1px solid var(--line);border-radius:var(--radius-control);padding:13px;font-size:13.5px;white-space:pre-wrap;line-height:1.5;margin-bottom:16px}
.q-acts{display:flex;flex-wrap:wrap;gap:10px}
.btn-acid{flex:1;min-width:170px;text-align:center;background:var(--acid);color:var(--on-acid);padding:12px 18px;border-radius:var(--radius-control);font-weight:600;font-size:14.5px}
.btn-line{text-align:center;border:1px solid var(--line);color:#fff;padding:12px 16px;border-radius:var(--radius-control);font-size:14px}
.foot-base{width:min(1260px,calc(100% - 2*var(--gutter)));margin:32px auto 0;padding-top:16px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:12.5px;color:var(--muted)}

@media(max-width:960px){
  .header-mid{display:none}
  .intro{flex-direction:column;align-items:flex-start}
  .intro-desc{text-align:left}
  .experience.phase-detail .scene-grid,.book-inner{grid-template-columns:1fr}
  .feature-notes{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:520px){
  .feature-notes{grid-template-columns:1fr}
  .hotspot-label{font-size:12px;padding:7px 10px}
}
</style>
</head>
<body>
${previewBarHtml}
<main class="experience" id="exp">
  <header class="masthead">
    <a class="wordmark" href="#top" id="brandReset">WASHOLOGY</a>
    <span class="header-mid">North London mobile valeting &amp; detailing</span>
    <a class="header-cta" href="#book">Book Wesley · 07388 725375 ↗</a>
  </header>

  <section class="stage-outer" id="top">
    <div class="intro" id="intro">
      <h1>Showroom finish,<br>inside out.</h1>
      <p class="intro-desc"><span>Tap any glowing point on the vehicle to inspect our detailing process.</span><span>North London home or workplace · 30 min to 5 hr sessions.</span></p>
    </div>

    <div class="toolbar-detail" id="detailBar" hidden>
      <button type="button" class="back" id="backBtn">← Back to vehicle <kbd>ESC</kbd></button>
      <span style="font-size:13px;color:var(--muted)">North London · Direct with Wesley</span>
    </div>

    <div class="scene-grid">
      <div class="plane" id="plane">
        <div class="car-visual" id="carVisual"><img src="${heroPhoto}" alt="Black Porsche 911 detailed by Washology on a North London driveway"></div>
        <div class="detail-visual" id="detailVisual"><img id="detailImg" src="${detailPhoto}" alt="Washology detailing detail view"></div>
        <div class="hotspot-layer" id="hotspotLayer"></div>
      </div>

      <aside class="detail-copy" id="detailCopy">
        <p class="eyebrow" id="dCat"></p>
        <h2 id="dTitle"></h2>
        <p class="sys-desc" id="dDesc"></p>
        <div class="part-list" id="dParts"></div>
        <div class="benefit"><span>Why drivers book this</span><strong id="dBenefit"></strong></div>
        <a id="dBook" class="detail-book" href="#book">Quote This Service via WhatsApp ↗</a>
      </aside>
    </div>
  </section>

  <div class="scene-footer">
    <div class="feature-notes">
      <button type="button" class="f-note" data-zone="ceramic"><h3>Ceramic coating <span>01 ↗</span></h3><p>Hydrophobic mirror gloss shielding paintwork year-round.</p></button>
      <button type="button" class="f-note" data-zone="correction"><h3>Paint correction <span>02 ↗</span></h3><p>Single-stage enhancement &amp; multi-stage swirl removal.</p></button>
      <button type="button" class="f-note" data-zone="deepclean"><h3>Mobile deep clean <span>03 ↗</span></h3><p>30 min to 5 hr safe detailing at home or workplace.</p></button>
      <button type="button" class="f-note" data-zone="reviews"><h3>5.0 ★ Reviews <span>04 ↗</span></h3><p>Sarah P., Zoe F. &amp; Stephan H. across North London.</p></button>
    </div>
  </div>
</main>

<section class="book-sec" id="book">
  <div class="book-inner">
    <div>
      <h2>Book Your North London<br>Detail in 30 Seconds</h2>
      <p class="book-lead">No slow Wix address widget — select your package and vehicle size below to send a ready-made WhatsApp straight to Wesley on 07388 725375.</p>
      <div class="qf"><label for="qJob">Package</label><select id="qJob">${site.quoteJobs.map((j) => `<option>${j}</option>`).join("")}</select></div>
      <div class="qf"><label for="qSec">${site.quoteSecondaryLabel}</label><select id="qSec">${site.quoteSecondaryOptions.map((o) => `<option>${o}</option>`).join("")}</select></div>
      <div class="qf"><label for="qPost">North London Postcode</label><input id="qPost" type="text" placeholder="e.g. N12, N3, EN4, NW3" maxlength="16"></div>
      <div class="qf"><label for="qNotes">Car Make/Model &amp; Preferred Day</label><textarea id="qNotes" placeholder="e.g. Porsche 911 / BMW X5, weekday morning at home..."></textarea></div>
    </div>
    <div class="q-panel">
      <h3>Direct WhatsApp to Wesley</h3>
      <p>Updates live — tap once to send straight to 07388 725375.</p>
      <div id="qPreview" class="q-prev"></div>
      <div class="q-acts">
        <a id="qWa" class="btn-acid" target="_blank" rel="noopener" href="${waQuick}">Send via WhatsApp →</a>
        <a id="qMail" class="btn-line" href="mailto:${site.email}">Email Wesley</a>
      </div>
    </div>
  </div>
  <div class="foot-base">
    <span>Covering ${site.areas.slice(0, 8).join(" · ")} &amp; surrounding North London</span>
    <span>© 2026 Washology Mobile Valeting &amp; Detailing · 07388 725375 · Wesley@washologymv.co.uk</span>
  </div>
</section>

<script>
(function(){
  var zones = ${JSON.stringify(zones)};
  var exp = document.getElementById('exp');
  var intro = document.getElementById('intro');
  var detailBar = document.getElementById('detailBar');
  var plane = document.getElementById('plane');
  var detailImg = document.getElementById('detailImg');
  var hotspotLayer = document.getElementById('hotspotLayer');
  var dCat = document.getElementById('dCat'), dTitle = document.getElementById('dTitle'), dDesc = document.getElementById('dDesc'), dParts = document.getElementById('dParts'), dBenefit = document.getElementById('dBenefit'), dBook = document.getElementById('dBook');
  var activeZone = null;

  Object.keys(zones).forEach(function(key, idx){
    var z = zones[key];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotspot' + (idx === 0 ? ' hint' : '');
    btn.style.left = z.anchor.x + '%';
    btn.style.top = z.anchor.y + '%';
    btn.setAttribute('aria-label', 'Inspect ' + z.label);
    btn.innerHTML = '<span class="hotspot-ring">+</span><span class="hotspot-label">' + z.label + ' ↗</span>';
    btn.addEventListener('click', function(){ openZone(key); });
    hotspotLayer.appendChild(btn);
  });

  function openZone(key){
    var z = zones[key];
    if (!z) return;
    activeZone = key;
    plane.style.setProperty('--fx', z.anchor.x + '%');
    plane.style.setProperty('--fy', z.anchor.y + '%');
    detailImg.src = z.image;
    dCat.textContent = z.index + ' · ' + z.category;
    dTitle.textContent = z.title;
    dDesc.textContent = z.description;
    dBenefit.textContent = z.benefit;
    dParts.innerHTML = '';
    z.parts.forEach(function(pt, i){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'part-btn' + (i === 0 ? ' open' : '');
      b.innerHTML = '<span class="part-row"><small>' + pt.n + '</small><span>' + pt.name + '</span><span class="plus">+</span></span><span class="part-text">' + pt.desc + '</span>';
      b.addEventListener('click', function(){
        var wasOpen = b.classList.contains('open');
        Array.prototype.forEach.call(dParts.querySelectorAll('.part-btn'), function(x){ x.classList.remove('open'); });
        if (!wasOpen) b.classList.add('open');
      });
      dParts.appendChild(b);
    });
    dBook.setAttribute('data-zone-book', z.label);
    exp.classList.add('phase-detail');
    intro.classList.add('hide');
    detailBar.hidden = false;
  }

  function closeZone(){
    activeZone = null;
    exp.classList.remove('phase-detail');
    intro.classList.remove('hide');
    detailBar.hidden = true;
  }

  document.getElementById('backBtn').addEventListener('click', closeZone);
  document.getElementById('brandReset').addEventListener('click', function(e){ if (activeZone) { e.preventDefault(); closeZone(); } });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && activeZone) closeZone(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-zone]'), function(btn){
    btn.addEventListener('click', function(){
      openZone(btn.getAttribute('data-zone'));
      document.getElementById('top').scrollIntoView({ behavior: 'smooth' });
    });
  });

  var qJob = document.getElementById('qJob'), qSec = document.getElementById('qSec'), qPost = document.getElementById('qPost'), qNotes = document.getElementById('qNotes'), qPrev = document.getElementById('qPreview'), qWa = document.getElementById('qWa'), qMail = document.getElementById('qMail');
  function syncQ(){
    var p = qPost.value.trim() ? qPost.value.trim().toUpperCase() : 'North London';
    var n = qNotes.value.trim() ? qNotes.value.trim() : 'Please let me know your earliest mobile slot and price.';
    var msg = 'Hi Wesley (Washology),\\nPackage: ' + qJob.value + '\\nVehicle: ' + qSec.value + '\\nPostcode: ' + p + '\\nNotes: ' + n;
    qPrev.textContent = msg;
    qWa.href = 'https://wa.me/${site.waDigits}?text=' + encodeURIComponent(msg);
    qMail.href = 'mailto:${site.email}?subject=' + encodeURIComponent('Washology Booking: ' + qJob.value + ' (' + p + ')') + '&body=' + encodeURIComponent(msg);
  }
  [qJob, qSec, qPost, qNotes].forEach(function(el){ el.addEventListener('input', syncQ); el.addEventListener('change', syncQ); });
  syncQ();

  dBook.addEventListener('click', function(){
    var lbl = (dBook.getAttribute('data-zone-book') || '').toLowerCase();
    for (var i = 0; i < qJob.options.length; i++) {
      if (qJob.options[i].value.toLowerCase().indexOf(lbl.slice(0, 7)) !== -1) { qJob.selectedIndex = i; break; }
    }
    syncQ();
  });
  ${claimScriptJs}
})();
</script>
</body>
</html>`;
}
