/**
 * MotionSites Official "Apple DESIGN.md" Reference -> Bespoke build for Wish Wash Valeting & Detailing (wish-wash.co.uk)
 * Uses 100% REAL Wish Wash photos & facts straight from wish-wash.co.uk:
 *  - Real 2K Porsche Taycan snow-foam driveway wash (ww-taycan-wash.jpg)
 *  - Real spotless dark leather & classic tan gated-manual cabins + foam spray + headlamp gallery
 *  - Real chemistry partners (Gtechniq, Infinity Wax, Chemical Guys) + slogan "Because you Wish we Wash!"
 *  - Exact £43-£49 / £59-£69 / £70-£80 packages + interactive Standard vs SUV toggle + S. Ottmann 5★ review
 */

export function renderWishWashAppleGallery(site, { clean = false, origin, previewBarHtml, claimScriptJs }) {
  const r = (name) => `${origin}/assets/real/${name}`;
  const waQuick = `https://wa.me/${site.waDigits}?text=${encodeURIComponent("Hi Wish Wash, I'd like to book a mobile valet in London.")}`;

  const packages = [
    {
      id: "ext",
      tag: "Essential",
      name: "Exterior Wash & Protect",
      stdPrice: "£43",
      suvPrice: "£49",
      range: "£43 – £49",
      summary: "Safe hand wash and protective wax carried out right outside your home or office.",
      bullets: [
        "Pre-wash rinse & dedicated wheel wash",
        "Microfibre mitt hand wash & soft towel dry",
        "Protective wax coat, glass clean & tyre dressing",
      ],
    },
    {
      id: "mini",
      tag: "Most Popular",
      name: "Mini Valet Plus",
      stdPrice: "£59",
      suvPrice: "£69",
      range: "£59 – £69",
      summary: "Complete Exterior Wash & Protect paired with a full cabin vacuum and trim clean.",
      bullets: [
        "Full Exterior Wash & Protect included",
        "Deep interior vacuum (mats, carpets, seats & boot)",
        "Dashboard, interior plastics & windows cleaned",
      ],
    },
    {
      id: "detail",
      tag: "Showroom SiO2",
      name: "Detail Exterior",
      stdPrice: "£70",
      suvPrice: "£80",
      range: "£70 – £80",
      summary: "pH-neutral snow foam, 3-bucket safe hand wash, and Ultragloss SiO2 ceramic-infused finish.",
      bullets: [
        "Deep pre-wash rinse & pH-neutral snow foam bath",
        "3-bucket hand wash + wheel protection",
        "Ultragloss SiO2 glass/paint + ceramic tyre shine",
      ],
    },
  ];

  const gallery = [
    { img: r("ww-foam-spray.jpg"), title: "pH-Neutral Snow Foam", sub: "Touchless Pre-Wash Soak" },
    { img: r("ww-cabin-dark.jpg"), title: "Deep Interior Valeting", sub: "Leather, Carpets & Trim Care" },
    { img: r("ww-tan-leather.jpg"), title: "Classic & Prestige Cabins", sub: "Gentle Brush & Conditioning" },
    { img: r("ww-bmw-light.jpg"), title: "Showroom Exterior Finish", sub: "Ultragloss SiO2 & Glass Clarity" },
  ];

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wish Wash Valeting &amp; Detailing — Mobile Car Care London</title>
<meta name="description" content="12+ years mobile car valeting & detailing across London. Own onboard pure water & power. Transparent pricing from £43. Because you Wish we Wash!">
<style>
:root{
  --canvas:#f5f5f7;
  --well:#ffffff;
  --ink:#1d1d1f;
  --muted:#6e6e73;
  --hairline:#d2d2d7;
  --blue:#0071e3;
  --blue-h:#0077ed;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:var(--canvas);
  color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;
  letter-spacing:-0.003em;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer}

.pv-bar{position:sticky;top:0;z-index:120;background:#1d1d1f;color:#f5f5f7;border-bottom:1px solid rgba(255,255,255,.14);font-size:12.5px;line-height:1.4}
.pv-inner{max-width:1120px;margin:0 auto;padding:9px 18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.pv-copy{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pv-pill{background:#f59e0b;color:#1d1d1f;font-weight:700;font-size:10px;letter-spacing:.08em;padding:3px 8px;border-radius:999px}
.pv-actions{display:flex;align-items:center;gap:8px}
.pv-buy{background:#10b981;color:#052e16;border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12.5px}
.pv-close{background:transparent;color:#d2d2d7;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 11px;font-size:12px}

.nav{
  position:sticky;top:0;z-index:60;
  background:rgba(245,245,247,.84);
  backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid rgba(0,0,0,.06);
}
.nav-in{max-width:1080px;margin:0 auto;padding:12px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-size:18px;font-weight:600;letter-spacing:-.02em}
.nav-links{display:flex;align-items:center;gap:24px;font-size:13px;color:var(--muted)}
.nav-links a:hover{color:var(--ink)}
.nav-cta{background:var(--blue);color:#fff;font-size:12.5px;font-weight:500;padding:7px 16px;border-radius:999px;transition:background .15s}
.nav-cta:hover{background:var(--blue-h)}

.hero{max-width:1080px;margin:0 auto;padding:68px 22px 44px;text-align:center}
.eyebrow{font-size:16.5px;font-weight:600;color:var(--muted);margin-bottom:14px;letter-spacing:-.01em}
.hero h1{
  font-size:clamp(44px,8.2vw,88px);
  font-weight:700;
  line-height:1.02;
  letter-spacing:-0.022em;
  color:var(--ink);
  margin:0 auto 22px;
  max-width:940px;
}
.hero-lead{
  font-size:clamp(18px,2.2vw,23px);
  font-weight:400;
  color:var(--muted);
  max-width:670px;
  margin:0 auto 30px;
  line-height:1.42;
}
.hero-acts{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-bottom:44px}
.btn-blue{background:var(--blue);color:#fff;padding:13px 26px;border-radius:999px;font-size:16px;font-weight:500;transition:background .15s}
.btn-blue:hover{background:var(--blue-h)}
.btn-link{color:var(--blue);padding:13px 18px;font-size:16px;font-weight:500}
.btn-link:hover{text-decoration:underline;text-underline-offset:4px}

.hero-media{background:var(--well);border-radius:28px;padding:12px;overflow:hidden}
.hero-media img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:20px;display:block}
.hero-specs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}
.spec-pill{background:var(--well);border-radius:18px;padding:18px 16px;text-align:left}
.spec-pill small{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.spec-pill strong{font-size:17px;font-weight:600;letter-spacing:-.015em}

.brands-strip{
  margin-top:14px;background:var(--well);border-radius:18px;padding:15px 22px;
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;
  font-size:13px;color:var(--muted);
}
.brands-list{display:flex;flex-wrap:wrap;gap:18px;font-weight:700;color:var(--ink);letter-spacing:.03em;text-transform:uppercase;font-size:12.5px}

.sec{max-width:1080px;margin:0 auto;padding:60px 22px}
.sec-head{text-align:center;max-width:680px;margin:0 auto 30px}
.sec-head h2{font-size:clamp(32px,5vw,56px);font-weight:700;letter-spacing:-.022em;line-height:1.06;margin-bottom:12px}
.sec-head p{font-size:17px;color:var(--muted)}

.seg-wrap{display:flex;justify-content:center;margin-bottom:28px}
.seg{display:inline-flex;background:#e8e8ed;border-radius:999px;padding:4px;gap:4px}
.seg button{border:0;background:transparent;color:var(--muted);padding:9px 20px;border-radius:999px;font-size:14px;font-weight:600;transition:all .2s ease}
.seg button.active{background:var(--well);color:var(--ink)}

.pkg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.pkg-card{background:var(--well);border-radius:24px;padding:30px 26px;display:flex;flex-direction:column;transition:transform .25s ease}
.pkg-card:hover{transform:translateY(-3px)}
.pkg-tag{font-size:12px;font-weight:600;color:var(--blue);margin-bottom:8px}
.pkg-card h3{font-size:24px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px}
.pkg-price{font-size:38px;font-weight:700;letter-spacing:-.025em;margin:8px 0 4px}
.pkg-subprice{font-size:12.5px;color:var(--muted);margin-bottom:16px}
.pkg-desc{font-size:14.5px;color:var(--muted);margin-bottom:18px;line-height:1.5}
.pkg-list{list-style:none;margin-bottom:24px;display:flex;flex-direction:column;gap:9px;font-size:14px}
.pkg-list li{padding-left:18px;position:relative}
.pkg-list li::before{content:"✓";position:absolute;left:0;color:var(--blue);font-weight:700}
.pkg-btn{margin-top:auto;width:100%;border:0;border-radius:999px;padding:12px 18px;background:var(--ink);color:#fff;font-size:14.5px;font-weight:600}
.pkg-card.featured .pkg-btn{background:var(--blue)}

/* REAL GALLERY STRIP */
.gal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.gal-card{background:var(--well);border-radius:20px;padding:10px;margin:0}
.gal-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;display:block}
.gal-card figcaption{padding:10px 6px 4px}
.gal-card strong{display:block;font-size:14px;font-weight:600}
.gal-card span{font-size:12px;color:var(--muted)}

.bento{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}
.bento-photo{background:var(--well);border-radius:24px;padding:12px;display:flex;flex-direction:column}
.bento-photo img{width:100%;height:100%;min-height:290px;object-fit:cover;border-radius:16px}
.bento-review{background:var(--well);border-radius:24px;padding:34px 30px;display:flex;flex-direction:column;justify-content:space-between}
.stars{font-size:15px;letter-spacing:2px;color:#f59e0b;margin-bottom:14px}
.bento-review blockquote{font-size:21px;font-weight:500;letter-spacing:-.015em;line-height:1.38;margin-bottom:22px}
.bento-review footer strong{display:block;font-size:15px}
.bento-review footer span{font-size:13px;color:var(--muted)}

.book-well{background:var(--well);border-radius:28px;padding:36px;display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
.qf{margin-bottom:14px}
.qf label{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px}
.qf input,.qf select,.qf textarea{width:100%;padding:12px 14px;font:inherit;font-size:15px;border:1px solid var(--hairline);border-radius:12px;background:var(--canvas);color:var(--ink)}
.qf textarea{min-height:74px;resize:vertical}
.q-out{background:var(--canvas);border-radius:20px;padding:24px}
.q-out h3{font-size:20px;font-weight:700;letter-spacing:-.015em;margin-bottom:6px}
.q-out .qs{font-size:13.5px;color:var(--muted);margin-bottom:14px}
.q-prev{background:var(--well);border-radius:14px;padding:14px;font-size:13.5px;white-space:pre-wrap;line-height:1.5;margin-bottom:18px}
.q-acts{display:flex;flex-wrap:wrap;gap:10px}
.q-wa{flex:1;min-width:170px;text-align:center;background:var(--blue);color:#fff;padding:13px 20px;border-radius:999px;font-weight:600;font-size:15px}
.q-wa:hover{background:var(--blue-h)}
.q-mail{text-align:center;background:var(--well);color:var(--ink);border:1px solid var(--hairline);padding:13px 18px;border-radius:999px;font-weight:600;font-size:14.5px}

footer.ap-foot{max-width:1080px;margin:0 auto;padding:28px 22px 84px;border-top:1px solid var(--hairline);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:12.5px;color:var(--muted)}
.mob-bar{position:fixed;bottom:12px;left:12px;right:12px;z-index:90;background:rgba(29,29,31,.92);backdrop-filter:blur(14px);border-radius:999px;padding:6px;display:none;gap:6px}
.mob-bar a{flex:1;text-align:center;font-size:13.5px;font-weight:600;padding:10px;border-radius:999px}
.mb-c{color:#fff;background:rgba(255,255,255,.12)}
.mb-w{color:#fff;background:var(--blue)}

@media(max-width:860px){
  .nav-links{display:none}
  .hero{padding:46px 18px 28px}
  .hero-specs,.gal-grid{grid-template-columns:repeat(2,1fr)}
  .pkg-grid,.bento,.book-well{grid-template-columns:1fr}
  .book-well{padding:24px 20px}
  .mob-bar{display:flex}
}
</style>
</head>
<body>
${previewBarHtml}
<header class="nav">
  <div class="nav-in">
    <a class="brand" href="#top">Wish Wash</a>
    <nav class="nav-links">
      <a href="#packages">Packages</a>
      <a href="#gallery">Gallery</a>
      <a href="#book">Book Online</a>
      <a href="tel:${site.phoneTel}">${site.phoneDisplay}</a>
    </nav>
    <a class="nav-cta" href="#book">Book Valet</a>
  </div>
</header>

<section id="top" class="hero">
  <div class="eyebrow">Wish Wash Valeting &amp; Detailing · Because You Wish, We Wash</div>
  <h1>Showroom clean.<br>Right at your door.</h1>
  <p class="hero-lead">More than 12 years of mobile car valeting &amp; detailing in London. Pure onboard water, own power supply, and clear transparent pricing from £43.</p>
  <div class="hero-acts">
    <a class="btn-blue" href="#packages">View Packages (From £43)</a>
    <a class="btn-link" href="${waQuick}" target="_blank" rel="noopener">WhatsApp +44 7763 453883 ›</a>
  </div>

  <div class="hero-media">
    <img src="${r("ww-taycan-wash.jpg")}" alt="Wish Wash hand-washing a black Porsche Taycan on a London driveway">
  </div>
  <div class="hero-specs">
    <div class="spec-pill"><small>Experience</small><strong>12+ Years</strong></div>
    <div class="spec-pill"><small>Onboard Setup</small><strong>Pure Water &amp; Power</strong></div>
    <div class="spec-pill"><small>Clear Pricing</small><strong>£43 to £80</strong></div>
    <div class="spec-pill"><small>Convenience</small><strong>Home or Office</strong></div>
  </div>
  <div class="brands-strip">
    <span>Selected professional-grade car care chemistry used on every visit:</span>
    <div class="brands-list"><span>Gtechniq</span><span>Infinity Wax</span><span>Chemical Guys</span><span>Ultragloss SiO2</span></div>
  </div>
</section>

<section id="packages" class="sec">
  <div class="sec-head">
    <h2>Three clear packages.</h2>
    <p>Switch vehicle size for exact pricing, then tap any package to pre-fill your WhatsApp booking.</p>
  </div>

  <div class="seg-wrap">
    <div class="seg" role="tablist" aria-label="Vehicle size">
      <button type="button" class="active" data-size="std">Standard / Hatchback</button>
      <button type="button" data-size="suv">Large SUV / 4×4</button>
    </div>
  </div>

  <div class="pkg-grid">
    ${packages
      .map(
        (p, idx) => `<article class="pkg-card${idx === 1 ? " featured" : ""}">
      <span class="pkg-tag">${p.tag}</span>
      <h3>${p.name}</h3>
      <div class="pkg-price" data-std="${p.stdPrice}" data-suv="${p.suvPrice}">${p.stdPrice}</div>
      <div class="pkg-subprice">Full range ${p.range} depending on size</div>
      <p class="pkg-desc">${p.summary}</p>
      <ul class="pkg-list">${p.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
      <button type="button" class="pkg-btn" data-pkg="${p.name} (${p.range})">Select ${p.name}</button>
    </article>`
      )
      .join("")}
  </div>
</section>

<section id="gallery" class="sec" style="padding-top:16px">
  <div class="sec-head">
    <h2>Pure water. Selected craft.</h2>
    <p>Real exterior snow-foam washes and spotless cabin detailing across London.</p>
  </div>
  <div class="gal-grid">
    ${gallery
      .map(
        (g) => `<figure class="gal-card"><img src="${g.img}" alt="${g.title}" loading="lazy"><figcaption><strong>${g.title}</strong><span>${g.sub}</span></figcaption></figure>`
      )
      .join("")}
  </div>
  <div class="bento">
    <div class="bento-photo">
      <img src="${r("ww-cabin-dark.jpg")}" alt="Spotless interior detailed by Wish Wash" loading="lazy">
    </div>
    <div class="bento-review">
      <div>
        <div class="stars">★★★★★</div>
        <blockquote>“Simple to book — I’ve had many a car cleaned, this was exceptional. The standard is higher than I’ve ever seen, my car is brand new again. I will now remain a long term customer.”</blockquote>
      </div>
      <footer>
        <strong>S. Ottmann</strong>
        <span>Verified London Customer · Wish Wash Valeting &amp; Detailing</span>
      </footer>
    </div>
  </div>
</section>

<section id="book" class="sec" style="padding-top:16px">
  <div class="sec-head">
    <h2>Book in 20 seconds.</h2>
    <p>Pick your package, car size, and London postcode — sends a ready-to-confirm WhatsApp directly to +44 7763 453883.</p>
  </div>
  <div class="book-well">
    <div>
      <div class="qf"><label for="qJob">Package</label><select id="qJob">${site.quoteJobs.map((j) => `<option>${j}</option>`).join("")}</select></div>
      <div class="qf"><label for="qSec">${site.quoteSecondaryLabel}</label><select id="qSec">${site.quoteSecondaryOptions.map((o) => `<option>${o}</option>`).join("")}</select></div>
      <div class="qf"><label for="qPost">London Postcode</label><input id="qPost" type="text" placeholder="e.g. SW6, W4, N1" maxlength="16"></div>
      <div class="qf"><label for="qNotes">Preferred Date &amp; Time</label><textarea id="qNotes" placeholder="e.g. Friday morning at home driveway..."></textarea></div>
    </div>
    <div class="q-out">
      <h3>Your WhatsApp Booking</h3>
      <p class="qs">Tap below to send straight to Wish Wash (+44 7763 453883).</p>
      <div id="qPreview" class="q-prev"></div>
      <div class="q-acts">
        <a id="qWa" class="q-wa" target="_blank" rel="noopener" href="${waQuick}">Book on WhatsApp →</a>
        <a id="qMail" class="q-mail" href="mailto:${site.email}">Send by Email</a>
      </div>
    </div>
  </div>
</section>

<footer class="ap-foot">
  <span>© 2026 Wish Wash Valeting &amp; Detailing · Because You Wish, We Wash · Own Pure Water &amp; Power</span>
  <span><a href="tel:${site.phoneTel}">${site.phoneDisplay}</a> · <a href="mailto:${site.email}">${site.email}</a></span>
</footer>

<div class="mob-bar">
  <a class="mb-c" href="tel:${site.phoneTel}">Call</a>
  <a class="mb-w" href="#book">Book Valet (From £43)</a>
</div>

<script>
(function(){
  var qJob = document.getElementById('qJob'), qSec = document.getElementById('qSec'), qPost = document.getElementById('qPost'), qNotes = document.getElementById('qNotes'), qPrev = document.getElementById('qPreview'), qWa = document.getElementById('qWa'), qMail = document.getElementById('qMail');

  function syncQ(){
    var p = qPost.value.trim() ? qPost.value.trim().toUpperCase() : 'London';
    var n = qNotes.value.trim() ? qNotes.value.trim() : 'Please let me know your earliest available date and time.';
    var msg = 'Hi Wish Wash,\\nPackage: ' + qJob.value + '\\nVehicle Size: ' + qSec.value + '\\nPostcode: ' + p + '\\nPreferred Slot: ' + n;
    qPrev.textContent = msg;
    qWa.href = 'https://wa.me/${site.waDigits}?text=' + encodeURIComponent(msg);
    qMail.href = 'mailto:${site.email}?subject=' + encodeURIComponent('Mobile Valet Booking: ' + qJob.value + ' (' + p + ')') + '&body=' + encodeURIComponent(msg);
  }
  [qJob, qSec, qPost, qNotes].forEach(function(el){ el.addEventListener('input', syncQ); el.addEventListener('change', syncQ); });
  syncQ();

  Array.prototype.forEach.call(document.querySelectorAll('[data-size]'), function(btn){
    btn.addEventListener('click', function(){
      var sz = btn.getAttribute('data-size');
      Array.prototype.forEach.call(document.querySelectorAll('[data-size]'), function(b){ b.classList.toggle('active', b === btn); });
      Array.prototype.forEach.call(document.querySelectorAll('.pkg-price'), function(el){
        el.textContent = sz === 'suv' ? el.getAttribute('data-suv') : el.getAttribute('data-std');
      });
      qSec.selectedIndex = sz === 'suv' ? 2 : 0;
      syncQ();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-pkg]'), function(btn){
    btn.addEventListener('click', function(){
      var val = btn.getAttribute('data-pkg');
      for (var i = 0; i < qJob.options.length; i++) {
        if (qJob.options[i].value.toLowerCase().indexOf(val.toLowerCase().slice(0, 10)) !== -1) { qJob.selectedIndex = i; break; }
      }
      syncQ();
      document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
    });
  });
  ${claimScriptJs}
})();
</script>
</body>
</html>`;
}
