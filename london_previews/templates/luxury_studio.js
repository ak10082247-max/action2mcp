/**
 * Luxury London Studio Flagship Renderer (Aesthetics / Brow & Lash / Beauty / Barber)
 * Combines MotionSites editorial choreography + MotionSites unwatermarked ambient hero video
 * + Architectural Digest / GQ bespoke photography + live London clock + interactive
 * treatment selector & 1-tap WhatsApp booking concierge.
 *
 * ZERO top preview banner — only a subtle, dismissible floating corner pill (removed on ?clean=1).
 */

const ASSET_ORIGIN = "https://london-previews.ak10082247.workers.dev";

// Unwatermarked MotionSites free ambient hero background videos (fetched via get_background_video)
const MOTIONSITES_VIDEOS = {
  aesthetics: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/6b0bd33e-2a03-471d-b61d-3d49f25ca16f.mp4", // Golden Stairwell
  barber: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_102608_5fa1187d-9ac6-44fb-82ab-54376200abc0.mp4", // Dark Floating Garden
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMenuForSubNiche(subNiche) {
  if (subNiche === "brows_lashes") {
    return [
      {
        id: "brows",
        label: "Brow Architecture",
        items: [
          { name: "Signature Bespoke Brow Sculpt & Tint", dur: "40 min", price: "£48", desc: "Custom brow mapping, precision wax & tweeze shaping, hybrid tint, and soothing botanical finish." },
          { name: "Luxury Brow Lamination & Keratin Gloss", dur: "55 min", price: "£68", desc: "Soft editorial lift with nourishing keratin infusion, precision styling, and tailored tint." },
          { name: "Microblading / Powder Brow Consultation", dur: "30 min", price: "Complimentary", desc: "One-to-one pigment matching, symmetry design, and bespoke semi-permanent treatment plan." },
          { name: "Express Brow Tidy & Conditioning Oil", dur: "20 min", price: "£28", desc: "Maintenance reshape between full appointments for clean, natural arches." },
        ],
      },
      {
        id: "lashes",
        label: "Lash Artistry",
        items: [
          { name: "Korean Lash Lift & Peptide Tint", dur: "60 min", price: "£72", desc: "Gentle root-to-tip curl using peptide-rich lotions for glossy, weightless lifted lashes lasting 6–8 weeks." },
          { name: "Classic Silk Individual Lashes", dur: "90 min", price: "£85", desc: "Tailored 1:1 wispy placement designed around your natural eye geometry for refined fullness." },
          { name: "Soft Editorial Hybrid Set", dur: "105 min", price: "£98", desc: "Featherlight blend of classic and handmade fans for effortless textured definition." },
          { name: "2–3 Week Lash Infill", dur: "60 min", price: "£55", desc: "Gentle cleanse, outgrown lash removal, and fresh symmetric rebalancing." },
        ],
      },
      {
        id: "packages",
        label: "Atelier Pairings",
        items: [
          { name: "The Complete Eye Framing Ritual", dur: "90 min", price: "£125", desc: "Luxury Brow Lamination paired with Korean Lash Lift & Peptide Tint in one unhurried session." },
          { name: "Bridal & Event Prep Duo", dur: "75 min", price: "£105", desc: "Signature Brow Sculpt, Lash Lift, and cooling rose-quartz under-eye recovery mask." },
        ],
      },
    ];
  }

  if (subNiche === "nails_beauty") {
    return [
      {
        id: "nails",
        label: "BIAB & Manicures",
        items: [
          { name: "Russian E-File BIAB Manicure", dur: "60 min", price: "£52", desc: "Immaculate cuticle detail, strengthening builder-in-a-bottle overlay, and sheer neutral or gel finish." },
          { name: "Signature Gel Manicure", dur: "45 min", price: "£38", desc: "Precision nail shaping, gentle cuticle care, high-gloss gel polish, and warm botanical oil massage." },
          { name: "Luxury Spa Gel Pedicure", dur: "60 min", price: "£55", desc: "Warm mineral soak, callus refinement, exfoliating balm, foot massage, and mirror-shine gel colour." },
          { name: "BIAB Infill & Fresh Gloss", dur: "60 min", price: "£48", desc: "Safe rebalance, cuticle refresh, and seamless new shade application." },
        ],
      },
      {
        id: "brows",
        label: "Brows & Lashes",
        items: [
          { name: "Signature Brow Sculpt & Tint", dur: "35 min", price: "£42", desc: "Tailored brow framing, precision wax/thread, and bespoke shade tint." },
          { name: "Keratin Lash Lift & Tint", dur: "55 min", price: "£65", desc: "Natural root lift and deep glossy tint with conditioning peptide serum." },
          { name: "Brow Lamination & Shape", dur: "50 min", price: "£60", desc: "Full, feathered, brushed-up arches set with nourishing botanical keratin." },
        ],
      },
      {
        id: "beauty",
        label: "Skin & Finishing",
        items: [
          { name: "Glass-Skin Express Glow Facial", dur: "45 min", price: "£68", desc: "Enzyme exfoliation, hyaluronic infusion, and lymphatic sculpt for instant luminosity." },
          { name: "Full Luxury Mani-Pedi Pairing", dur: "105 min", price: "£96", desc: "Combined BIAB Manicure and Spa Gel Pedicure in one uninterrupted appointment." },
        ],
      },
    ];
  }

  if (subNiche === "hair_salon") {
    return [
      {
        id: "cutting",
        label: "Cutting & Styling",
        items: [
          { name: "Bespoke Cut & Editorial Blow-Dry", dur: "60 min", price: "£75", desc: "Tailored consultation, relaxing scalp cleanse, precision cut, and polished signature blow-dry." },
          { name: "Restyle & Conditioning Ritual", dur: "75 min", price: "£90", desc: "Transformative shape design paired with an intensive bond-repair botanical mask." },
          { name: "Signature Luxury Blow-Dry", dur: "45 min", price: "£48", desc: "Smooth, bouncy, or undone editorial finish designed to hold effortlessly for days." },
        ],
      },
      {
        id: "colour",
        label: "Colour & Gloss",
        items: [
          { name: "Dimensional Balayage & Gloss", dur: "150 min", price: "£185", desc: "Hand-painted sunlit depth, bespoke root melt, bond builder, and mirror-shine toner." },
          { name: "Full Head Highlights & Cut", dur: "150 min", price: "£175", desc: "Fine micro-weaves for luminous multi-tonal movement finished with a tailored cut." },
          { name: "Botanical Gloss & Tone Refresh", dur: "45 min", price: "£65", desc: "Ammonia-free translucent gloss to revive warmth, cool brassiness, and restore silkiness." },
        ],
      },
      {
        id: "treatments",
        label: "Restorative Care",
        items: [
          { name: "Keratin Smoothing Ritual", dur: "120 min", price: "£195", desc: "Humidity-proof frizz control and glass-like softness lasting up to 12 weeks." },
          { name: "Scalp Detox & Peptide Mask", dur: "35 min", price: "£45", desc: "Stimulating steam cleanse and deep lipid replenishment for fine or colour-treated hair." },
        ],
      },
    ];
  }

  if (subNiche === "barber") {
    return [
      {
        id: "cuts",
        label: "Cuts & Fades",
        items: [
          { name: "Signature Skin Fade & Style", dur: "45 min", price: "£34", desc: "Zero-gap seamless fade, bespoke scissor work on top, hot towel finish, and crisp razor line-up." },
          { name: "Executive Scissor Cut & Wash", dur: "45 min", price: "£36", desc: "Consultation, invigorating wash, precision tailored scissor cut, and matte styling finish." },
          { name: "Taper Fade & Textured Crop", dur: "40 min", price: "£32", desc: "Clean temple and nape taper blended naturally into structured texture." },
          { name: "Precision Buzz & Line-Up", dur: "25 min", price: "£22", desc: "Even clipper finish with foil razor detailing around the hairline and neck." },
        ],
      },
      {
        id: "beard",
        label: "Beard & Hot Towel",
        items: [
          { name: "Hot Towel Beard Sculpt & Steam", dur: "30 min", price: "£24", desc: "Eucalyptus steam towels, balanced clipper & scissor shaping, straight-razor cheek lines, and cedar oil." },
          { name: "Traditional Straight-Razor Wet Shave", dur: "35 min", price: "£30", desc: "Rich badger-brush lather, two-pass cut-throat shave, cold stone compress, and soothing balm." },
          { name: "Express Beard Trim & Sharpener", dur: "20 min", price: "£18", desc: "Crisp maintenance tidy and razor neck cleanup between full appointments." },
        ],
      },
      {
        id: "packages",
        label: "The Rituals",
        items: [
          { name: "The Signature Cut & Beard Sculpt", dur: "65 min", price: "£50", desc: "Our flagship pairing — Skin Fade or Scissor Cut combined with Hot Towel Beard Sculpt." },
          { name: "The Full London Gentleman", dur: "80 min", price: "£65", desc: "Bespoke Cut, Hot Towel Straight-Razor Shave, charcoal detox mask, and head massage." },
        ],
      },
    ];
  }

  // Default: aesthetics / clinical skin
  return [
    {
      id: "facials",
      label: "Clinical Skin",
      items: [
        { name: "Signature Glass-Skin Sculpt Facial", dur: "60 min", price: "£95", desc: "Deep enzymatic cleanse, lymphatic drainage massage, custom peptide serums, and LED phototherapy." },
        { name: "Medical Microneedling & Exosomes", dur: "60 min", price: "£165", desc: "Collagen-inducing skin renewal targeting fine lines, texture, and luminous tone clarity." },
        { name: "Hydro-Glow Resurfacing Facial", dur: "50 min", price: "£110", desc: "Gentle vortex exfoliation, pore decongestion, and deeply hydrating hyaluronic infusion." },
        { name: "Bespoke Skin Consultation", dur: "30 min", price: "Complimentary", desc: "Comprehensive clinical skin assessment and personalised treatment roadmap." },
      ],
    },
    {
      id: "advanced",
      label: "Advanced Aesthetics",
      items: [
        { name: "Bio-Remodelling Skin Booster", dur: "45 min", price: "£240", desc: "Deep dermal hydration treatment restoring elasticity, bounce, and natural radiance." },
        { name: "IPL / Laser Skin Rejuvenation", dur: "45 min", price: "£120", desc: "Targeted light therapy for pigmentation, redness, and smooth long-term hair reduction." },
        { name: "Bio-Revitalising Chemical Peel", dur: "40 min", price: "£90", desc: "Controlled medical-grade resurfacing with minimal downtime for brighter, clearer skin." },
      ],
    },
    {
      id: "brows",
      label: "Brows & Finishing",
      items: [
        { name: "Bespoke Brow Architecture & Tint", dur: "40 min", price: "£48", desc: "Tailored facial mapping, precision sculpting, and natural hybrid shade." },
        { name: "Korean Lash Lift & Peptide Gloss", dur: "60 min", price: "£72", desc: "Lifted, glossy natural lashes fortified with botanical peptides." },
      ],
    },
  ];
}

function getEditorialCopy(studio) {
  if (studio.theme === "barber") {
    return {
      eyebrow: "THE CRAFT",
      headline: `Unhurried barbering, razor-clean precision — right in the heart of ${studio.neighbourhood}.`,
      body: `Every chair appointment at ${studio.name} starts with an honest consultation around your hair growth, head shape, and routine. No rushed 12-minute factory cuts, no booking-app markups — just consistent craft at ${studio.street}.`,
      specs: [
        { k: "01 / Precision", v: "Tailored fades, scissor craft & crisp razor line-ups" },
        { k: "02 / Direct Chair Booking", v: "Message directly on WhatsApp — zero booking app fees" },
        { k: "03 / Neighbourhood", v: `${studio.street}, ${studio.neighbourhood} ${studio.postcode}` },
      ],
      img1: `${ASSET_ORIGIN}/assets/studio/barber-fade.jpg`,
      cap1: "01 — Precision Fade & Scissor Craft",
      img2: `${ASSET_ORIGIN}/assets/studio/barber-ritual.jpg`,
      cap2: "02 — Japanese Steel & Hot Towel Rituals",
      heroImg: `${ASSET_ORIGIN}/assets/studio/barber-hero.jpg`,
      ctaLabel: "Reserve Your Chair",
      menuLabel: "Grooming Menu",
      conciergeTitle: "Lock in your chair directly on WhatsApp.",
      conciergeSub: "Select your service and preferred time below. Your message opens pre-filled straight to our shop WhatsApp — confirmed fast with zero middleman fees.",
      videoUrl: MOTIONSITES_VIDEOS.barber,
    };
  }

  return {
    eyebrow: "THE ATELIER",
    headline: `Quiet luxury, clinical precision, and unhurried one-to-one care in ${studio.neighbourhood}.`,
    body: `${studio.name} was created as a calm sanctuary away from noisy high-street chains. Every appointment at ${studio.street} is tailored around your natural features — with direct WhatsApp concierge booking and zero third-party platform fees.`,
    specs: [
      { k: "01 / One-to-One Care", v: "Private unhurried appointments tailored to your natural features" },
      { k: "02 / Direct Concierge", v: "Book directly on WhatsApp — zero Treatwell or Fresha commission" },
      { k: "03 / Location", v: `${studio.street}, ${studio.neighbourhood} ${studio.postcode}` },
    ],
    img1: `${ASSET_ORIGIN}/assets/studio/aesthetics-facial.jpg`,
    cap1: "01 — Restorative Skin & Botanical Rituals",
    img2: `${ASSET_ORIGIN}/assets/studio/aesthetics-brows.jpg`,
    cap2: "02 — Editorial Brows, Lashes & Natural Luminosity",
    heroImg: `${ASSET_ORIGIN}/assets/studio/aesthetics-hero.jpg`,
    ctaLabel: "Book an Appointment",
    menuLabel: "Treatment Menu",
    conciergeTitle: "Reserve directly on WhatsApp — confirmed in minutes.",
    conciergeSub: "Tap your preferred treatments and ideal time window below. It opens a pre-filled WhatsApp straight to the studio — no accounts, no booking fees.",
    videoUrl: MOTIONSITES_VIDEOS.aesthetics,
  };
}

export function renderLuxuryStudioHtml(studio, { clean = false } = {}) {
  const isBarber = studio.theme === "barber";
  const ed = getEditorialCopy(studio);
  const menuTabs = getMenuForSubNiche(studio.subNiche);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${studio.name} ${studio.street} ${studio.postcode} London`)}`;
  const directWa = `https://wa.me/${studio.waDigits}?text=${encodeURIComponent(`Hi ${studio.shortName}, I'd love to book an appointment — do you have availability this week?`)}`;
  const telHref = `tel:+${studio.waDigits}`;

  // Palette variables
  const themeVars = isBarber
    ? `
      --bg: #0c0b09;
      --surface: #141210;
      --surface-elev: #1b1814;
      --ink: #f4efe6;
      --muted: #9e9588;
      --accent: #c8a46b;
      --accent-ink: #120f0a;
      --line: rgba(244, 239, 230, 0.11);
      --line-strong: rgba(244, 239, 230, 0.22);
      --concierge-bg: #13110e;
      --concierge-card: rgba(255, 255, 255, 0.04);
      --concierge-ink: #f4efe6;
      --concierge-muted: #a39a8d;
      --body-font: 'Space Grotesk', system-ui, -apple-system, sans-serif;
    `
    : `
      --bg: #f5f0e8;
      --surface: #fcf9f4;
      --surface-elev: #ffffff;
      --ink: #1a1613;
      --muted: #655b51;
      --accent: #9c7a4c;
      --accent-ink: #fcf9f4;
      --line: rgba(26, 22, 19, 0.10);
      --line-strong: rgba(26, 22, 19, 0.22);
      --concierge-bg: #171310;
      --concierge-card: rgba(255, 255, 255, 0.05);
      --concierge-ink: #f8f3eb;
      --concierge-muted: #b2a79a;
      --body-font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    `;

  const menuTabsHtml = menuTabs
    .map(
      (tab, idx) =>
        `<button type="button" class="menu-tab${idx === 0 ? " is-active" : ""}" data-tab="${esc(tab.id)}">${esc(tab.label)}</button>`
    )
    .join("");

  const menuPanelsHtml = menuTabs
    .map(
      (tab, idx) => `
      <div class="menu-panel${idx === 0 ? " is-active" : ""}" data-panel="${esc(tab.id)}">
        ${tab.items
          .map(
            (item) => `
          <div class="service-row">
            <div class="service-main">
              <div class="service-title-line">
                <h3>${esc(item.name)}</h3>
                <span class="service-dur">${esc(item.dur)}</span>
              </div>
              <p class="service-desc">${esc(item.desc)}</p>
            </div>
            <div class="service-action">
              <span class="service-price">${esc(item.price)}</span>
              <button type="button" class="select-btn" data-service="${esc(item.name)} (${esc(item.price)})">+ Select</button>
            </div>
          </div>`
          )
          .join("")}
      </div>`
    )
    .join("");

  const quickPills = menuTabs
    .flatMap((t) => t.items.slice(0, 2))
    .slice(0, 5)
    .map(
      (item) =>
        `<button type="button" class="pill-choice quick-srv" data-service="${esc(item.name)} (${esc(item.price)})">${esc(item.name)}</button>`
    )
    .join("");

  const previewFloatingUi = clean
    ? ""
    : `
  <aside class="preview-pill" id="previewPill" aria-label="Bespoke website preview notice">
    <span class="pill-dot"></span>
    <span class="pill-label">Draft for <strong>${esc(studio.shortName)}</strong></span>
    <button type="button" class="pill-cta" id="openClaimBtn">Claim &amp; Go Live · £199</button>
    <button type="button" class="pill-close" id="closePillBtn" aria-label="Dismiss preview badge">×</button>
  </aside>

  <div class="claim-backdrop" id="claimModal" hidden>
    <div class="claim-dialog" role="dialog" aria-modal="true" aria-labelledby="claimHeading">
      <button type="button" class="claim-x" id="closeClaimBtn" aria-label="Close">×</button>
      <p class="claim-eyebrow">BESPOKE LAUNCH · ZERO MONTHLY FEES</p>
      <h2 id="claimHeading">Put ${esc(studio.name)} live in 24 hours.</h2>
      <p class="claim-copy">Built specifically for <strong>${esc(studio.name)}</strong> (${esc(studio.street)}, ${esc(studio.postcode)}). Keep it at <strong>£199 one-time</strong> instead of £1,500 agency fees — everything is handled purely over WhatsApp or email with zero sales calls.</p>
      <ul class="claim-list">
        <li>Your exact photos, real prices, opening hours &amp; wording updated before launch</li>
        <li>Connected to your own <strong>.co.uk</strong> domain on <strong>£0/month</strong> Cloudflare hosting forever</li>
        <li>Direct WhatsApp booking concierge — stop losing 20–35% commission to Treatwell/Fresha</li>
        <li>Clean production HTML file included with zero preview badge</li>
      </ul>
      <div class="claim-actions">
        <button type="button" class="claim-pay-btn" id="startCheckoutBtn">Launch My Website — £199 One-Time →</button>
        <a class="claim-alt-btn" href="mailto:armkhan18@gmail.com?subject=${encodeURIComponent(`Launch website for ${studio.name} (£199)`)}">Questions? Email armkhan18@gmail.com</a>
      </div>
      <p class="claim-status" id="claimStatus"></p>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(studio.name)} — ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)}</title>
<meta name="description" content="${esc(studio.tagline)} Located at ${esc(studio.street)}, ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)}. Book directly on WhatsApp.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    ${themeVars}
    --serif: 'Cormorant Garamond', Georgia, serif;
    --radius: 22px;
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--body-font);
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
  }
  a { color: inherit; text-decoration: none; }
  img { display: block; max-width: 100%; }
  button { font: inherit; cursor: pointer; }

  .container {
    width: 100%;
    max-width: 1288px;
    padding-inline: 24px;
    margin: 0 auto;
  }

  /* ===== EDITORIAL FLOATING NAV ===== */
  .site-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
    padding: 18px 0;
    transition: background 0.35s ease, border-color 0.35s ease, backdrop-filter 0.35s ease;
    border-bottom: 1px solid transparent;
    color: #f8f4ee;
  }
  .site-nav.is-scrolled {
    background: ${isBarber ? "rgba(12, 11, 9, 0.86)" : "rgba(252, 249, 244, 0.90)"};
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-bottom-color: var(--line);
    color: var(--ink);
  }
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .brand-wordmark {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.015em;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .brand-loc {
    font-family: var(--body-font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.72;
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 30px;
    font-size: 13px;
    letter-spacing: 0.04em;
  }
  .nav-links a { opacity: 0.84; transition: opacity 0.2s; }
  .nav-links a:hover { opacity: 1; }
  .clock-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid currentColor;
    opacity: 0.78;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6ee7b7;
    box-shadow: 0 0 8px #6ee7b7;
  }
  .nav-wa {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(10px);
    transition: transform 0.25s ease, background 0.25s ease;
  }
  .site-nav.is-scrolled .nav-wa {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .nav-wa:hover { transform: translateY(-1px); }

  /* ===== HERO SECTION ===== */
  .hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 120px 0 72px;
    color: #faf6f0;
    overflow: hidden;
    background: #120f0c;
  }
  .hero-media {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }
  .hero-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transform: scale(1.03);
    animation: gentleBreath 22s ease-in-out infinite alternate;
  }
  @keyframes gentleBreath {
    from { transform: scale(1.02); }
    to { transform: scale(1.08); }
  }
  .hero-video-ambient {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: ${isBarber ? "0.14" : "0.15"};
    mix-blend-mode: ${isBarber ? "screen" : "soft-light"};
    pointer-events: none;
  }
  .hero-scrim {
    position: absolute;
    inset: 0;
    background: ${
      isBarber
        ? "linear-gradient(108deg, rgba(10,9,7,0.86) 0%, rgba(10,9,7,0.56) 52%, rgba(10,9,7,0.34) 100%), linear-gradient(180deg, rgba(10,9,7,0.55) 0%, transparent 28%, rgba(10,9,7,0.78) 100%)"
        : "linear-gradient(108deg, rgba(20,16,13,0.76) 0%, rgba(20,16,13,0.44) 50%, rgba(20,16,13,0.18) 100%), linear-gradient(180deg, rgba(20,16,13,0.48) 0%, transparent 30%, rgba(20,16,13,0.72) 100%)"
    };
  }
  .hero-content {
    position: relative;
    z-index: 2;
    margin-top: auto;
    margin-bottom: auto;
    padding: 28px 0 42px;
  }
  .hero-copy-wrap {
    max-width: 720px;
  }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${isBarber ? "#dec291" : "#ebe0d0"};
    margin-bottom: 22px;
  }
  .kicker::before {
    content: "";
    width: 28px;
    height: 1px;
    background: currentColor;
    opacity: 0.7;
  }
  .hero h1 {
    font-family: var(--serif);
    font-size: clamp(50px, 6.8vw, 96px);
    font-weight: 300;
    line-height: 0.96;
    letter-spacing: -0.025em;
    margin: 0 0 26px;
    color: #fffdf9;
  }
  .hero h1 em {
    font-style: italic;
    font-weight: 400;
    color: ${isBarber ? "#d6b47b" : "#f2dfc4"};
  }
  .hero-lead {
    font-size: clamp(16px, 1.35vw, 18px);
    line-height: 1.65;
    color: rgba(250, 246, 240, 0.86);
    max-width: 560px;
    margin: 0 0 36px;
  }
  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 15px 30px;
    border-radius: 999px;
    background: ${isBarber ? "#c8a46b" : "#faf6f0"};
    color: #16120e;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.28);
  }
  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 15px 26px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.09);
    color: #faf6f0;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(10px);
    transition: background 0.25s ease, transform 0.25s ease;
  }
  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-2px);
  }

  .hero-meta-bar {
    position: relative;
    z-index: 2;
    border-top: 1px solid rgba(255, 255, 255, 0.18);
    padding-top: 22px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }
  .meta-col small {
    display: block;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(250, 246, 240, 0.58);
    margin-bottom: 5px;
  }
  .meta-col strong, .meta-col a {
    font-size: 14px;
    font-weight: 500;
    color: #faf6f0;
  }
  .meta-col a:hover { text-decoration: underline; text-underline-offset: 4px; }

  /* ===== SECTION 2: EDITORIAL SPREAD ===== */
  .section { padding: 112px 0; }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.20em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 18px;
  }
  .eyebrow::before {
    content: "";
    width: 22px;
    height: 1px;
    background: var(--accent);
  }
  .editorial-grid {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    gap: 64px;
    align-items: start;
  }
  .editorial-copy h2 {
    font-family: var(--serif);
    font-size: clamp(36px, 4vw, 54px);
    font-weight: 400;
    line-height: 1.08;
    letter-spacing: -0.02em;
    margin: 0 0 22px;
  }
  .editorial-copy p {
    color: var(--muted);
    font-size: 16px;
    line-height: 1.72;
    margin: 0 0 36px;
  }
  .spec-list { border-top: 1px solid var(--line); }
  .spec-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px 0;
    border-bottom: 1px solid var(--line);
  }
  .spec-item span {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .spec-item strong {
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }

  .editorial-photos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 26px;
    align-items: start;
  }
  .photo-card {
    margin: 0;
  }
  .photo-card.is-offset { margin-top: 56px; }
  .photo-frame {
    aspect-ratio: 3 / 4;
    border-radius: 18px;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .photo-card:hover .photo-frame img { transform: scale(1.045); }
  .photo-card figcaption {
    margin-top: 14px;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ===== SECTION 3: INTERACTIVE TREATMENT MENU ===== */
  .menu-section { padding: 32px 0 112px; }
  .menu-shell {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 28px;
    padding: clamp(28px, 5vw, 60px);
  }
  .menu-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 36px;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--line);
  }
  .menu-head h2 {
    font-family: var(--serif);
    font-size: clamp(36px, 4.2vw, 56px);
    font-weight: 400;
    line-height: 1.04;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .menu-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .menu-tab {
    padding: 10px 20px;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  .menu-tab.is-active {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .menu-panel { display: none; }
  .menu-panel.is-active { display: block; }
  .service-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 24px 0;
    border-bottom: 1px solid var(--line);
  }
  .service-row:last-child { border-bottom: none; padding-bottom: 4px; }
  .service-title-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 6px;
  }
  .service-title-line h3 {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 500;
    line-height: 1.18;
    margin: 0;
  }
  .service-dur {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .service-desc {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
    max-width: 620px;
  }
  .service-action {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-shrink: 0;
  }
  .service-price {
    font-family: var(--serif);
    font-size: 24px;
    font-weight: 500;
    white-space: nowrap;
  }
  .select-btn {
    padding: 9px 18px;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: var(--ink);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s ease;
  }
  .select-btn:hover { border-color: var(--ink); }
  .select-btn.is-selected {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  .menu-note {
    margin: 28px 0 0;
    font-size: 13px;
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }

  /* ===== SECTION 4: WHATSAPP BOOKING CONCIERGE ===== */
  .concierge-section {
    background: var(--concierge-bg);
    color: var(--concierge-ink);
    padding: 108px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .concierge-grid {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    gap: 60px;
    align-items: start;
  }
  .concierge-left h2 {
    font-family: var(--serif);
    font-size: clamp(38px, 4.4vw, 58px);
    font-weight: 300;
    line-height: 1.05;
    margin: 0 0 20px;
    letter-spacing: -0.02em;
  }
  .concierge-left p {
    color: var(--concierge-muted);
    font-size: 16px;
    line-height: 1.7;
    margin: 0 0 36px;
  }
  .studio-info-box {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding-top: 26px;
    display: grid;
    gap: 18px;
  }
  .info-row small {
    display: block;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 4px;
  }
  .info-row a, .info-row strong {
    font-size: 15px;
    font-weight: 500;
    color: var(--concierge-ink);
  }
  .info-row a:hover { text-decoration: underline; text-underline-offset: 4px; }

  .concierge-card {
    background: var(--concierge-card);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 24px;
    padding: clamp(26px, 4vw, 42px);
  }
  .field-group { margin-bottom: 24px; }
  .field-label {
    display: block;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--concierge-muted);
    margin-bottom: 11px;
    font-weight: 600;
  }
  .selected-summary {
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.10);
    font-size: 14px;
    color: var(--concierge-ink);
    margin-bottom: 12px;
  }
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pill-choice {
    padding: 9px 15px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: transparent;
    color: rgba(248, 243, 235, 0.84);
    font-size: 13px;
    transition: all 0.2s ease;
  }
  .pill-choice:hover { border-color: rgba(255, 255, 255, 0.45); }
  .pill-choice.is-active {
    background: #c8a46b;
    color: #15110c;
    border-color: #c8a46b;
    font-weight: 600;
  }
  .text-input {
    width: 100%;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.05);
    color: #faf6f0;
    font: inherit;
    font-size: 15px;
  }
  .text-input::placeholder { color: rgba(255, 255, 255, 0.40); }
  .text-input:focus { outline: none; border-color: #c8a46b; }
  .wa-submit {
    width: 100%;
    padding: 17px 24px;
    border-radius: 999px;
    border: none;
    background: ${isBarber ? "#c8a46b" : "#f5efe6"};
    color: #16120e;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .wa-submit:hover { transform: translateY(-2px); opacity: 0.95; }
  .wa-footnote {
    text-align: center;
    font-size: 12px;
    color: var(--concierge-muted);
    margin: 12px 0 0;
  }

  /* ===== FOOTER ===== */
  .site-footer {
    background: var(--concierge-bg);
    color: var(--concierge-muted);
    border-top: 1px solid rgba(255, 255, 255, 0.09);
    padding: 42px 0 56px;
    font-size: 13px;
  }
  .footer-inner {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .footer-brand {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--concierge-ink);
  }

  /* ===== DISCREET FLOATING PREVIEW PILL (BOTTOM-RIGHT ONLY) ===== */
  .preview-pill {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 60;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 14px;
    border-radius: 999px;
    background: rgba(18, 16, 14, 0.86);
    color: #f7f3ed;
    border: 1px solid rgba(255, 255, 255, 0.16);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28);
    font-size: 12px;
  }
  .pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #34d399;
    flex-shrink: 0;
  }
  .pill-label { opacity: 0.88; white-space: nowrap; }
  .pill-cta {
    padding: 6px 12px;
    border-radius: 999px;
    border: none;
    background: #c8a46b;
    color: #14100b;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .pill-close {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.10);
    color: #f7f3ed;
    font-size: 14px;
    line-height: 1;
    display: grid;
    place-items: center;
  }

  /* ===== CLAIM MODAL ===== */
  .claim-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(10, 9, 8, 0.72);
    backdrop-filter: blur(10px);
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .claim-backdrop[hidden] { display: none; }
  .claim-dialog {
    position: relative;
    width: min(520px, 100%);
    background: #171411;
    color: #f7f3ed;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 24px;
    padding: 36px 32px 30px;
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
  }
  .claim-x {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: transparent;
    color: #f7f3ed;
    font-size: 18px;
  }
  .claim-eyebrow {
    margin: 0 0 10px;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: #c8a46b;
    font-weight: 600;
  }
  .claim-dialog h2 {
    font-family: var(--serif);
    font-size: 36px;
    font-weight: 400;
    line-height: 1.08;
    margin: 0 0 14px;
  }
  .claim-copy {
    font-size: 14px;
    color: #b7aca0;
    margin: 0 0 18px;
    line-height: 1.6;
  }
  .claim-list {
    margin: 0 0 24px;
    padding-left: 18px;
    font-size: 14px;
    color: #e6dfd5;
    display: grid;
    gap: 8px;
  }
  .claim-actions { display: grid; gap: 10px; }
  .claim-pay-btn {
    padding: 15px 22px;
    border-radius: 999px;
    border: none;
    background: #c8a46b;
    color: #14100b;
    font-size: 15px;
    font-weight: 600;
  }
  .claim-alt-btn {
    text-align: center;
    padding: 12px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    font-size: 13px;
    color: #e6dfd5;
  }
  .claim-status { font-size: 13px; color: #f59e0b; margin: 10px 0 0; min-height: 18px; text-align: center; }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 960px) {
    .nav-links, .clock-pill { display: none; }
    .editorial-grid, .concierge-grid { grid-template-columns: 1fr; gap: 44px; }
    .hero-meta-bar { grid-template-columns: 1fr; gap: 14px; }
    .photo-card.is-offset { margin-top: 0; }
  }
  @media (max-width: 640px) {
    .container { padding-inline: 18px; }
    .brand-wordmark { font-size: 20px; }
    .brand-loc { display: none; }
    .nav-wa { padding: 8px 14px; font-size: 12px; flex-shrink: 0; }
    .hero { padding: 98px 0 88px; }
    .hero h1 { font-size: 42px; }
    .kicker { font-size: 10px; letter-spacing: 0.14em; flex-wrap: wrap; }
    .hero-ctas { flex-direction: column; align-items: stretch; }
    .btn-primary, .btn-ghost { justify-content: center; }
    .editorial-photos { grid-template-columns: 1fr; gap: 22px; }
    .service-row { flex-direction: column; align-items: flex-start; gap: 14px; }
    .service-action { width: 100%; justify-content: space-between; }
    .section { padding: 72px 0; }
    .concierge-section { padding: 76px 0; }
    .preview-pill { left: 12px; right: 12px; bottom: 12px; justify-content: space-between; }
    .pill-label { display: none; }
  }
</style>
</head>
<body>

  <header class="site-nav" id="siteNav">
    <div class="container nav-inner">
      <a href="#" class="brand-wordmark">
        <span>${esc(studio.name)}</span>
        <span class="brand-loc">${esc(studio.neighbourhood)}</span>
      </a>
      <nav class="nav-links" aria-label="Primary navigation">
        <a href="#studio">The Studio</a>
        <a href="#treatments">${esc(ed.menuLabel)}</a>
        <a href="#book">Book Direct</a>
        <span class="clock-pill"><span class="live-dot"></span><span id="londonClock">London</span></span>
      </nav>
      <a class="nav-wa" href="${esc(directWa)}" target="_blank" rel="noopener">WhatsApp ↗</a>
    </div>
  </header>

  <section class="hero">
    <div class="hero-media" aria-hidden="true">
      <img class="hero-photo" src="${esc(ed.heroImg)}" alt="${esc(studio.name)} interior in ${esc(studio.neighbourhood)}, London" loading="eager">
      <video class="hero-video-ambient" autoplay muted loop playsinline preload="metadata" poster="${esc(ed.heroImg)}">
        <source src="${esc(ed.videoUrl)}" type="video/mp4">
      </video>
      <div class="hero-scrim"></div>
    </div>

    <div class="container hero-content">
      <div class="hero-copy-wrap">
        <div class="kicker">${esc(studio.heroKicker)}</div>
        <h1>${esc(studio.heroLine1)}<br><em>${esc(studio.heroItalic)}</em> ${esc(studio.heroLine2)}</h1>
        <p class="hero-lead">${esc(studio.heroLead)}</p>
        <div class="hero-ctas">
          <a class="btn-primary" href="#book">${esc(ed.ctaLabel)} →</a>
          <a class="btn-ghost" href="#treatments">Explore ${esc(ed.menuLabel)}</a>
        </div>
      </div>
    </div>

    <div class="container hero-meta-bar">
      <div class="meta-col">
        <small>01 / Location</small>
        <a href="${esc(mapsUrl)}" target="_blank" rel="noopener">${esc(studio.street)}, ${esc(studio.neighbourhood)} ${esc(studio.postcode)} ↗</a>
      </div>
      <div class="meta-col">
        <small>02 / Direct WhatsApp</small>
        <a href="${esc(directWa)}" target="_blank" rel="noopener">${esc(studio.phoneDisplay)} · Message Direct</a>
      </div>
      <div class="meta-col">
        <small>03 / Experience</small>
        <strong>Private Appointments · Zero Booking App Fees</strong>
      </div>
    </div>
  </section>

  <section class="section" id="studio">
    <div class="container editorial-grid">
      <div class="editorial-copy">
        <p class="eyebrow">${esc(ed.eyebrow)}</p>
        <h2>${esc(ed.headline)}</h2>
        <p>${esc(ed.body)}</p>
        <div class="spec-list">
          ${ed.specs
            .map(
              (s) => `
          <div class="spec-item">
            <span>${esc(s.k)}</span>
            <strong>${esc(s.v)}</strong>
          </div>`
            )
            .join("")}
        </div>
      </div>

      <div class="editorial-photos">
        <figure class="photo-card">
          <div class="photo-frame">
            <img src="${esc(ed.img1)}" alt="${esc(ed.cap1)}" loading="lazy">
          </div>
          <figcaption>${esc(ed.cap1)}</figcaption>
        </figure>
        <figure class="photo-card is-offset">
          <div class="photo-frame">
            <img src="${esc(ed.img2)}" alt="${esc(ed.cap2)}" loading="lazy">
          </div>
          <figcaption>${esc(ed.cap2)}</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <section class="menu-section" id="treatments">
    <div class="container">
      <div class="menu-shell">
        <div class="menu-head">
          <div>
            <p class="eyebrow">CURATED MENU</p>
            <h2>${esc(ed.menuLabel)}</h2>
          </div>
          <div class="menu-tabs" role="tablist">
            ${menuTabsHtml}
          </div>
        </div>

        ${menuPanelsHtml}

        <div class="menu-note">
          <span>Tap <strong>+ Select</strong> on any treatment to pre-fill your WhatsApp booking request below.</span>
          <a href="#book" style="color:var(--accent);font-weight:600;">Continue to Booking ↓</a>
        </div>
      </div>
    </div>
  </section>

  <section class="concierge-section" id="book">
    <div class="container concierge-grid">
      <div class="concierge-left">
        <p class="eyebrow">DIRECT CONCIERGE</p>
        <h2>${esc(ed.conciergeTitle)}</h2>
        <p>${esc(ed.conciergeSub)}</p>

        <div class="studio-info-box">
          <div class="info-row">
            <small>Studio Address</small>
            <a href="${esc(mapsUrl)}" target="_blank" rel="noopener">${esc(studio.street)}, ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)} (Open in Maps ↗)</a>
          </div>
          <div class="info-row">
            <small>WhatsApp &amp; Phone</small>
            <a href="${esc(telHref)}">${esc(studio.phoneDisplay)}</a>
          </div>
          <div class="info-row">
            <small>Booking Policy</small>
            <strong>Direct studio confirmation · No platform surcharges</strong>
          </div>
        </div>
      </div>

      <div class="concierge-card">
        <div class="field-group">
          <span class="field-label">01 / Selected Treatments</span>
          <div class="selected-summary" id="selectedSummary">Tap one or more treatments below (or select from the menu above)</div>
          <div class="pill-row">${quickPills}</div>
        </div>

        <div class="field-group">
          <span class="field-label">02 / Preferred Day</span>
          <div class="pill-row" id="dayRow">
            <button type="button" class="pill-choice is-active" data-day="This Week">This Week</button>
            <button type="button" class="pill-choice" data-day="Tomorrow">Tomorrow</button>
            <button type="button" class="pill-choice" data-day="This Weekend">This Weekend</button>
            <button type="button" class="pill-choice" data-day="Flexible">Flexible</button>
          </div>
        </div>

        <div class="field-group">
          <span class="field-label">03 / Preferred Time</span>
          <div class="pill-row" id="timeRow">
            <button type="button" class="pill-choice is-active" data-time="Morning (10am–1pm)">Morning</button>
            <button type="button" class="pill-choice" data-time="Afternoon (1pm–5pm)">Afternoon</button>
            <button type="button" class="pill-choice" data-time="Evening (5pm–8pm)">Evening</button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="clientName">04 / Your Name</label>
          <input class="text-input" id="clientName" type="text" placeholder="e.g. Sophia" autocomplete="name">
        </div>

        <button type="button" class="wa-submit" id="sendWaBtn">Send Booking Request on WhatsApp ↗</button>
        <p class="wa-footnote">Opens WhatsApp directly to ${esc(studio.name)} (${esc(studio.phoneDisplay)})</p>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">${esc(studio.name)}</div>
      <div>${esc(studio.street)}, ${esc(studio.neighbourhood)}, London ${esc(studio.postcode)}</div>
      <div>© 2026 ${esc(studio.name)} · All rights reserved</div>
    </div>
  </footer>

  ${previewFloatingUi}

<script>
(function() {
  var WA_DIGITS = ${JSON.stringify(studio.waDigits)};
  var STUDIO_NAME = ${JSON.stringify(studio.name)};
  var SLUG = ${JSON.stringify(studio.slug)};

  // Live London clock
  function updateClock() {
    var el = document.getElementById("londonClock");
    if (!el) return;
    try {
      var fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
      el.textContent = fmt.format(new Date()) + " London";
    } catch (e) { el.textContent = "London"; }
  }
  updateClock();
  setInterval(updateClock, 30000);

  // Scroll nav state
  var nav = document.getElementById("siteNav");
  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 48) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Menu category tabs
  document.querySelectorAll(".menu-tab").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var target = btn.getAttribute("data-tab");
      document.querySelectorAll(".menu-tab").forEach(function(b) { b.classList.toggle("is-active", b === btn); });
      document.querySelectorAll(".menu-panel").forEach(function(p) {
        p.classList.toggle("is-active", p.getAttribute("data-panel") === target);
      });
    });
  });

  // Shared service selection state between Menu and WhatsApp Concierge
  var selected = new Set();
  var prefDay = "This Week";
  var prefTime = "Morning (10am-1pm)";

  function syncSelectionUi() {
    var summary = document.getElementById("selectedSummary");
    if (summary) {
      summary.textContent = selected.size
        ? Array.from(selected).join(" + ")
        : "Tap one or more treatments below (or select from the menu above)";
    }
    document.querySelectorAll(".select-btn").forEach(function(b) {
      var on = selected.has(b.getAttribute("data-service"));
      b.classList.toggle("is-selected", on);
      b.textContent = on ? "✓ Selected" : "+ Select";
    });
    document.querySelectorAll(".quick-srv").forEach(function(b) {
      b.classList.toggle("is-active", selected.has(b.getAttribute("data-service")));
    });
  }

  function toggleService(val) {
    if (selected.has(val)) selected.delete(val);
    else selected.add(val);
    syncSelectionUi();
  }

  document.querySelectorAll(".select-btn, .quick-srv").forEach(function(btn) {
    btn.addEventListener("click", function() {
      toggleService(btn.getAttribute("data-service"));
    });
  });

  document.querySelectorAll("#dayRow .pill-choice").forEach(function(btn) {
    btn.addEventListener("click", function() {
      prefDay = btn.getAttribute("data-day");
      document.querySelectorAll("#dayRow .pill-choice").forEach(function(b) { b.classList.toggle("is-active", b === btn); });
    });
  });

  document.querySelectorAll("#timeRow .pill-choice").forEach(function(btn) {
    btn.addEventListener("click", function() {
      prefTime = btn.getAttribute("data-time");
      document.querySelectorAll("#timeRow .pill-choice").forEach(function(b) { b.classList.toggle("is-active", b === btn); });
    });
  });

  var sendBtn = document.getElementById("sendWaBtn");
  if (sendBtn) {
    sendBtn.addEventListener("click", function() {
      var name = (document.getElementById("clientName")?.value || "").trim();
      var chosen = selected.size ? Array.from(selected).join(", ") : "an appointment";
      var msg = "Hi " + STUDIO_NAME + ", " + (name ? "I'm " + name + " and " : "")
        + "I'd love to book " + chosen + ". Preferred timing: " + prefDay + " (" + prefTime + "). Do you have availability?";
      window.open("https://wa.me/" + WA_DIGITS + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    });
  }

  // Discreet preview pill & £199 Stripe Checkout modal
  var pill = document.getElementById("previewPill");
  var modal = document.getElementById("claimModal");
  var closePill = document.getElementById("closePillBtn");
  var openClaim = document.getElementById("openClaimBtn");
  var closeClaim = document.getElementById("closeClaimBtn");
  var payBtn = document.getElementById("startCheckoutBtn");
  var statusEl = document.getElementById("claimStatus");

  if (closePill && pill) closePill.addEventListener("click", function() { pill.style.display = "none"; });
  if (openClaim && modal) openClaim.addEventListener("click", function() { modal.hidden = false; });
  if (closeClaim && modal) closeClaim.addEventListener("click", function() { modal.hidden = true; });
  if (modal) modal.addEventListener("click", function(e) { if (e.target === modal) modal.hidden = true; });

  if (payBtn) {
    payBtn.addEventListener("click", function() {
      payBtn.disabled = true;
      payBtn.textContent = "Opening secure £199 Stripe Checkout...";
      if (statusEl) statusEl.textContent = "";
      fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: SLUG })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.url) { window.location.href = d.url; return; }
        throw new Error((d && d.error) || "Could not start checkout.");
      })
      .catch(function(err) {
        payBtn.disabled = false;
        payBtn.textContent = "Launch My Website — £199 One-Time →";
        if (statusEl) statusEl.textContent = err.message || "Checkout unavailable. Please email armkhan18@gmail.com.";
      });
    });
  }
})();
</script>
</body>
</html>`;
}
