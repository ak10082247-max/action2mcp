/**
 * Official MotionSites MCP "Custom Spaces" Ready-Made HTML Template
 * Adapted verbatim with 100% REAL studio photography from Fresha, real £ prices,
 * real verified client reviews, and direct WhatsApp booking concierge.
 */

const ASSET_ORIGIN = "https://london-previews.ak10082247.workers.dev";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMotionSitesCustomSpacesStudio(studio, { clean = false } = {}) {
  const photos = studio.photos.map((p) => `${ASSET_ORIGIN}${p}`);
  // Ensure at least 6 slides in the marquee loop cleanly
  const marqueePhotos = photos.length >= 6 ? photos : [...photos, ...photos].slice(0, 6);
  const directWa = `https://wa.me/${studio.waDigits}?text=${encodeURIComponent(`Hi ${studio.name}, I'd love to book an appointment — do you have availability this week?`)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${studio.name} ${studio.street} ${studio.postcode} London`)}`;

  const servicesHtml = studio.services
    .map(
      (srv) => `
      <div class="srv-row">
        <div class="srv-left">
          <div class="srv-name">${esc(srv.name)}</div>
          <div class="srv-dur">${esc(srv.dur)}</div>
        </div>
        <div class="srv-right">
          <span class="srv-price">${esc(srv.price)}</span>
          <button type="button" class="srv-pick" data-srv="${esc(srv.name)} (${esc(srv.price)})">+ Select</button>
        </div>
      </div>`
    )
    .join("");

  const reviewsHtml = studio.reviews.length
    ? `
    <section class="reviews" id="reviews">
      <div class="sec-in">
        <div class="sec-head">
          <p class="sec-kicker">VERIFIED REVIEWS</p>
          <h2>${esc(studio.rating)} ★ across ${esc(studio.reviewCount.toLocaleString("en-GB"))} visits.</h2>
        </div>
        <div class="rev-grid">
          ${studio.reviews
            .map(
              (rv) => `
            <blockquote class="rev-card">
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

  const previewPill = clean
    ? ""
    : `
  <aside class="pv-pill" id="previewPill" aria-label="Website preview badge">
    <span class="pv-dot"></span>
    <span class="pv-txt">Draft for <strong>${esc(studio.shortName)}</strong></span>
    <button type="button" class="pv-go" id="openClaimBtn">Go Live · £199</button>
    <button type="button" class="pv-x" id="closePillBtn" aria-label="Dismiss">×</button>
  </aside>
  <div class="cm-bg" id="claimModal" hidden>
    <div class="cm-box" role="dialog" aria-modal="true">
      <button type="button" class="cm-x" id="closeClaimBtn" aria-label="Close">×</button>
      <p class="cm-k">ONE-TIME LAUNCH · £0/MO HOSTING</p>
      <h3>Put ${esc(studio.name)} live on your own domain in 24h.</h3>
      <p class="cm-p">Built using your real photos, prices, and ${esc(studio.rating)}★ reviews. £199 one-time (no monthly Wix/Squarespace bills, zero sales calls — handled 100% via WhatsApp or email).</p>
      <ul class="cm-ul">
        <li>Connected to your own <strong>.co.uk</strong> domain on free Cloudflare hosting forever</li>
        <li>Any extra photos, full price list &amp; wording tweaks included before launch</li>
        <li>Direct WhatsApp booking so repeat clients book fee-free</li>
      </ul>
      <button type="button" class="cm-pay" id="startCheckoutBtn">Claim &amp; Launch — £199 One-Time →</button>
      <a class="cm-mail" href="mailto:armkhan18@gmail.com?subject=${encodeURIComponent(`Launch ${studio.name} website (£199)`)}">Questions? Email armkhan18@gmail.com</a>
      <p class="cm-st" id="claimStatus"></p>
    </div>
  </div>`;

  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(studio.name)} — ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)}</title>
<meta name="description" content="${esc(studio.heroSub)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;scroll-behavior:smooth}
body{font-family:'Geist',sans-serif;color:#171717;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}
button{font:inherit;cursor:pointer}
.page{min-height:100vh;background:#fff;overflow-x:hidden}
:root{--e:cubic-bezier(0.16,1,0.3,1)}

/* EXACT MOTIONSITES CUSTOM SPACES NAVBAR & DRAWER */
nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:16px;background:rgba(255,255,255,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.brand-l{display:flex;align-items:center;gap:10px}
.brand-txt{font-size:14px;font-weight:600;letter-spacing:-.02em;display:none}
.spacer{width:28px}
.burger{position:absolute;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:5px;background:none;border:0;cursor:pointer;padding:8px}
.burger i{display:block;width:24px;height:1.5px;background:#171717;border-radius:9999px;transition:all .3s;margin:0 auto}
.burger:hover i{width:20px}
.pill{display:none;font-size:14px;font-weight:500;color:#fff;background:#171717;border-radius:9999px;padding:10px 20px;transition:background-color .15s}
.pill:hover{background:#262626}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:60;transition:all .5s var(--e);opacity:0;pointer-events:none}
.overlay.open{opacity:1;pointer-events:auto}
.drawer{position:fixed;inset:0;background:#fff;z-index:70;padding:16px;opacity:0;transform:translateY(100%);pointer-events:none;transition:all .5s var(--e)}
.drawer.open{opacity:1;transform:none;pointer-events:auto}
.dh{display:flex;justify-content:space-between;align-items:center}
.close{position:relative;width:40px;height:40px;border-radius:9999px;border:0;background:none;cursor:pointer}
.close:hover{background:#f5f5f5}
.close i{position:absolute;left:10px;top:50%;width:20px;height:1.5px;background:#171717;border-radius:9999px;transition:all .5s var(--e)}
.close .a{transform:translateY(-3px) rotate(0)}.close .b{transform:translateY(3px) rotate(0)}
.drawer.open .close .a{transform:rotate(45deg)}.drawer.open .close .b{transform:rotate(-45deg)}
.links{padding:48px 8px 0}
.links a{display:block;font-size:30px;line-height:36px;font-weight:500;padding:12px 0;opacity:0;transform:translateX(32px);transition:all .5s var(--e);transition-delay:0s}
.links a:hover{color:#737373}
.drawer.open .links a{opacity:1;transform:none;transition-delay:calc(150ms + var(--i)*60ms)}
.dcta{padding:48px 8px 0}
.dcta a{display:inline-block;font-size:14px;font-weight:500;color:#fff;background:#171717;border-radius:9999px;padding:12px 24px;opacity:0;transform:translateY(16px);transition:all .5s var(--e);transition-delay:0s}
.dcta a:hover{background:#262626}
.drawer.open .dcta a{opacity:1;transform:none;transition-delay:400ms}

/* EXACT MOTIONSITES CUSTOM SPACES HERO & CURVED MARQUEE */
.hero{padding:96px 16px 4px;text-align:center}
h1{font-size:36px;line-height:1.05;font-weight:600;letter-spacing:-.025em;max-width:52rem;margin:0 auto}
.sub{margin:16px auto 0;font-size:16px;line-height:1.625;max-width:38rem;color:#404040}
.mq{position:relative;padding:16px 0;overflow:hidden}
.mask{position:absolute;left:0;right:0;height:80px;pointer-events:none;z-index:10}
.mask svg{display:block;width:100%;height:100%}
.mask.t{top:0}.mask.b{bottom:0}
.track{display:flex;width:max-content;gap:12px;padding:16px 0;user-select:none;-webkit-user-select:none;cursor:grab;will-change:transform;touch-action:pan-y}
.track.drag{cursor:grabbing}
.slide{width:240px;height:320px;flex-shrink:0;border-radius:16px;overflow:hidden;background:#f0eeea}
.slide img{width:100%;height:100%;object-fit:cover;pointer-events:none;display:block}
.bottom{text-align:center;padding:8px 16px 64px;max-width:44rem;margin:0 auto}
.bottom p{font-size:16px;line-height:1.625;color:#262626}
.ctas{margin-top:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.ctas a{font-weight:600;text-decoration:underline;text-underline-offset:4px;text-decoration-color:#a3a3a3;transition:text-decoration-color .15s}
.ctas a:hover{text-decoration-color:#171717}

/* SEAMLESS GEIST SWISS CONTINUATION: SERVICES, REVIEWS & WHATSAPP BOOKING */
.sec-in{max-width:1040px;margin:0 auto;padding:0 20px}
.sec-kicker{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#737373;margin-bottom:10px}
.sec-head{margin-bottom:36px}
.sec-head h2{font-size:clamp(28px,4vw,44px);font-weight:600;letter-spacing:-.03em;line-height:1.08}
.menu-sec{padding:72px 0;border-top:1px solid #e5e5e5}
.srv-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 0;border-bottom:1px solid #ececec}
.srv-name{font-size:18px;font-weight:600;letter-spacing:-.015em}
.srv-dur{font-size:13px;color:#737373;margin-top:3px}
.srv-right{display:flex;align-items:center;gap:16px;flex-shrink:0}
.srv-price{font-size:17px;font-weight:600}
.srv-pick{padding:8px 16px;border-radius:9999px;border:1px solid #d4d4d4;background:#fff;color:#171717;font-size:13px;font-weight:500;transition:all .15s}
.srv-pick:hover{border-color:#171717}
.srv-pick.on{background:#171717;color:#fff;border-color:#171717}

.reviews{padding:72px 0;background:#fafafa;border-top:1px solid #ececec}
.rev-grid{display:grid;grid-template-columns:1fr;gap:20px}
.rev-card{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:28px}
.rev-stars{font-size:14px;letter-spacing:2px;color:#171717;margin-bottom:12px}
.rev-card p{font-size:16px;line-height:1.65;color:#262626}
.rev-card footer{margin-top:16px;font-size:13px;font-weight:500;color:#737373}

.book-sec{padding:80px 0 96px;border-top:1px solid #e5e5e5}
.book-grid{display:grid;grid-template-columns:1fr;gap:40px}
.info-list{display:grid;gap:18px;margin-top:24px;border-top:1px solid #ececec;padding-top:24px}
.info-item small{display:block;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#737373;margin-bottom:4px}
.info-item strong,.info-item a{font-size:15px;font-weight:500}
.info-item a:hover{text-decoration:underline;text-underline-offset:4px}
.book-card{background:#fafafa;border:1px solid #e5e5e5;border-radius:20px;padding:28px}
.fg{margin-bottom:20px}
.fl{display:block;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#737373;margin-bottom:8px}
.sel-box{padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #e5e5e5;font-size:14px;color:#262626}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{padding:8px 14px;border-radius:9999px;border:1px solid #d4d4d4;background:#fff;color:#404040;font-size:13px;font-weight:500}
.chip.on{background:#171717;color:#fff;border-color:#171717}
.inp{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #d4d4d4;background:#fff;font:inherit;font-size:15px}
.inp:focus{outline:none;border-color:#171717}
.wa-go{width:100%;padding:15px 22px;border-radius:9999px;border:0;background:#171717;color:#fff;font-size:15px;font-weight:600;transition:background .15s}
.wa-go:hover{background:#262626}
.wa-note{text-align:center;font-size:12px;color:#737373;margin-top:10px}
.ft{border-top:1px solid #ececec;padding:32px 20px 68px;max-width:1040px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:13px;color:#737373}

/* DISCREET FLOATING PREVIEW PILL (BOTTOM-RIGHT ONLY) */
.pv-pill{position:fixed;right:16px;bottom:16px;z-index:60;display:inline-flex;align-items:center;gap:10px;padding:7px 9px 7px 14px;border-radius:9999px;background:rgba(23,23,23,.92);color:#fff;border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.22);font-size:12px}
.pv-dot{width:7px;height:7px;border-radius:50%;background:#34d399}
.pv-go{padding:6px 12px;border-radius:9999px;border:0;background:#fff;color:#171717;font-size:12px;font-weight:600}
.pv-x{width:24px;height:24px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:14px}
.cm-bg{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:grid;place-items:center;padding:20px}
.cm-bg[hidden]{display:none}
.cm-box{position:relative;width:min(500px,100%);background:#fff;color:#171717;border-radius:20px;padding:32px 28px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
.cm-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:50%;border:1px solid #e5e5e5;background:#fff;font-size:18px}
.cm-k{font-size:11px;font-weight:700;letter-spacing:.14em;color:#737373;margin-bottom:8px}
.cm-box h3{font-size:26px;font-weight:600;letter-spacing:-.025em;line-height:1.15;margin-bottom:12px}
.cm-p{font-size:14px;color:#525252;line-height:1.6;margin-bottom:16px}
.cm-ul{padding-left:18px;font-size:14px;color:#262626;display:grid;gap:8px;margin-bottom:22px}
.cm-pay{width:100%;padding:14px 20px;border-radius:9999px;border:0;background:#171717;color:#fff;font-size:15px;font-weight:600;margin-bottom:10px}
.cm-mail{display:block;text-align:center;padding:11px;border-radius:9999px;border:1px solid #d4d4d4;font-size:13px;font-weight:500}
.cm-st{font-size:13px;color:#dc2626;text-align:center;margin-top:8px;min-height:18px}

@media(min-width:640px){
nav{padding:20px 24px}.brand-txt{display:inline}.pill{display:inline-block}.spacer{display:none}
.drawer{inset:0 0 0 auto;width:100%;max-width:24rem;transform:translateX(100%)}
.hero{padding:112px 24px 4px}h1{font-size:48px}.sub{margin-top:24px;font-size:18px}
.mask{height:100px}.track{gap:16px}.slide{width:320px;height:512px}
.bottom{padding:8px 24px 72px}.bottom p{font-size:18px}.ctas{margin-top:32px;flex-direction:row;gap:32px}
.rev-grid{grid-template-columns:repeat(2,1fr)}
}
@media(min-width:768px){nav{padding:20px 40px}h1{font-size:72px}.sub{font-size:20px}.bottom p{font-size:20px}.book-grid{grid-template-columns:5fr 7fr;gap:56px}}
@media(min-width:1024px){h1{font-size:5.5rem}}
@media(max-width:639px){.pv-txt{display:none}.srv-row{flex-direction:column;align-items:flex-start}.srv-right{width:100%;justify-content:space-between}}
</style></head><body>
<div class="page">
<nav>
<a href="#" class="brand-l">
  <svg width="26" height="26" viewBox="0 0 256 256" fill="#1a1a1a"><path d="M 144 256 L 27.598 256 L 144 139.598 Z M 256 207.5 L 200 256 L 200 56 L 0 56 L 48 0 L 256 0 Z M 0 204.402 L 0 112 L 92.402 112 Z"/></svg>
  <span class="brand-txt">${esc(studio.name)}</span>
</a>
<button class="burger" id="open" aria-label="Open menu"><i></i><i></i></button>
<a class="pill" href="${esc(directWa)}" target="_blank" rel="noopener">Book via WhatsApp</a><div class="spacer"></div>
</nav>

<div class="overlay" id="ov"></div>
<aside class="drawer" id="dr">
<div class="dh">
  <svg width="26" height="26" viewBox="0 0 256 256" fill="#1a1a1a"><path d="M 144 256 L 27.598 256 L 144 139.598 Z M 256 207.5 L 200 256 L 200 56 L 0 56 L 48 0 L 256 0 Z M 0 204.402 L 0 112 L 92.402 112 Z"/></svg>
  <button class="close" id="close" aria-label="Close menu"><i class="a"></i><i class="b"></i></button>
</div>
<div class="links">
  <a href="#gallery" style="--i:0">Gallery</a>
  <a href="#menu" style="--i:1">Menu &amp; Prices</a>
  ${studio.reviews.length ? '<a href="#reviews" style="--i:2">Reviews</a>' : ""}
  <a href="#book" style="--i:3">Book Direct</a>
</div>
<div class="dcta"><a href="${esc(directWa)}" target="_blank" rel="noopener">Book via WhatsApp</a></div>
</aside>

<section class="hero">
  <h1>${esc(studio.heroLine1)}<br>${esc(studio.heroLine2)}</h1>
  <p class="sub">${esc(studio.heroSub)}</p>
</section>

<section class="mq" id="gallery">
  <div class="mask t"><svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path fill="#fff" d="M0 0H1440V50C1440 50 1200 100 720 100C240 100 0 50 0 50V0Z"/></svg></div>
  <div class="track" id="tr"></div>
  <div class="mask b"><svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path fill="#fff" d="M0 100H1440V50C1440 50 1200 0 720 0C240 0 0 50 0 50V100Z"/></svg></div>
</section>

<section class="bottom">
  <p>${esc(studio.bottomStatement)}</p>
  <div class="ctas">
    <a href="#book">Book on WhatsApp</a>
    <a href="#menu">See Menu &amp; Prices</a>
  </div>
</section>

<section class="menu-sec" id="menu">
  <div class="sec-in">
    <div class="sec-head">
      <p class="sec-kicker">POPULAR TREATMENTS &amp; PRICES</p>
      <h2>Direct studio menu.</h2>
    </div>
    ${servicesHtml}
  </div>
</section>

${reviewsHtml}

<section class="book-sec" id="book">
  <div class="sec-in book-grid">
    <div>
      <p class="sec-kicker">DIRECT WHATSAPP CONCIERGE</p>
      <h2 style="font-size:clamp(30px,4vw,46px);font-weight:600;letter-spacing:-.03em;line-height:1.08">Reserve directly —<br>zero booking fees.</h2>
      <div class="info-list">
        <div class="info-item"><small>Address</small><a href="${esc(mapsUrl)}" target="_blank" rel="noopener">${esc(studio.street)}, ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)} ↗</a></div>
        <div class="info-item"><small>Opening Hours</small><strong>${esc(studio.hours)}</strong></div>
        <div class="info-item"><small>WhatsApp / Phone</small><a href="tel:+${esc(studio.waDigits)}">${esc(studio.phoneDisplay)}</a></div>
      </div>
    </div>
    <div class="book-card">
      <div class="fg">
        <span class="fl">Selected Treatments</span>
        <div class="sel-box" id="selBox">Tap + Select on any treatment above (or send a general enquiry)</div>
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
</section>

<footer class="ft">
  <div><strong>${esc(studio.name)}</strong> · ${esc(studio.street)}, London ${esc(studio.postcode)}</div>
  <div>${esc(studio.rating)} ★ (${esc(studio.reviewCount.toLocaleString("en-GB"))} Verified Reviews)</div>
</footer>
</div>

${previewPill}

<script>
(function(){
  var photos=${JSON.stringify(marqueePhotos)};
  var tr=document.getElementById('tr'),html='';
  photos.concat(photos).forEach(function(src){
    html+='<div class="slide"><img src="'+src+'" alt="${esc(studio.name)}" loading="eager" draggable="false"></div>';
  });
  tr.innerHTML=html;
  var off=0,vel=0,drag=false,sx=0,so=0,lx=0,lt=0,SPEED=.8;
  tr.addEventListener('pointerdown',function(e){drag=true;vel=0;tr.setPointerCapture(e.pointerId);sx=lx=e.clientX;so=off;lt=performance.now();tr.classList.add('drag')});
  tr.addEventListener('pointermove',function(e){if(!drag)return;var n=performance.now(),dt=Math.max(n-lt,1);vel=(e.clientX-lx)/dt*16;lx=e.clientX;lt=n;off=so+(e.clientX-sx)});
  function up(){drag=false;tr.classList.remove('drag')}
  tr.addEventListener('pointerup',up);tr.addEventListener('pointercancel',up);
  function tick(){var h=tr.scrollWidth/2;
    if(!drag){if(Math.abs(vel)>.1){off+=vel;vel*=.95}else{vel=0;off-=SPEED}}
    if(h>0){if(off<=-h)off+=h;if(off>0)off-=h}
    tr.style.transform='translate3d('+off+'px,0,0)';requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  var ov=document.getElementById('ov'),dr=document.getElementById('dr');
  function set(o){ov.classList.toggle('open',o);dr.classList.toggle('open',o);document.body.style.overflow=o?'hidden':''}
  document.getElementById('open').onclick=function(){set(true)};
  document.getElementById('close').onclick=function(){set(false)};
  ov.onclick=function(){set(false)};
  document.querySelectorAll('.links a,.dcta a').forEach(function(a){a.addEventListener('click',function(){set(false)})});

  var picked=new Set(),day='This Week',tm='Morning';
  document.querySelectorAll('.srv-pick').forEach(function(b){
    b.addEventListener('click',function(){
      var v=b.getAttribute('data-srv');
      if(picked.has(v))picked.delete(v);else picked.add(v);
      b.classList.toggle('on',picked.has(v));
      b.textContent=picked.has(v)?'✓ Selected':'+ Select';
      document.getElementById('selBox').textContent=picked.size?Array.from(picked).join(' + '):'Tap + Select on any treatment above (or send a general enquiry)';
    });
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
    fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(studio.slug)}})})
      .then(function(r){return r.json()}).then(function(d){if(d&&d.url){location.href=d.url;return}throw new Error((d&&d.error)||'Checkout failed')})
      .catch(function(e){pb.disabled=false;pb.textContent='Claim & Launch — £199 One-Time →';if(st)st.textContent=e.message});
  };
})();
</script></body></html>`;
}
