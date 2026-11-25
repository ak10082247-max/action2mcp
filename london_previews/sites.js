/**
 * London Fast Sites — v2 Bespoke Interactive Architecture
 * Built applying high-craft motion & editorial design principles:
 *  1) 100vh Daylight/Architectural Hero with draggable 3D Concave Showcase Carousel + glass detail sheet
 *  2) Scroll-choreographed split-tone headline with inline photo pill + upward-curving fanned service arc
 *  3) Scroll-expanding rounded clip-path portal into the interactive 30s WhatsApp/Email quote builder
 *  4) Obsidian kinetic horizontal manifesto ribbon + spring-pop verified review/credential cards
 *  - Bespoke 1080p London editorial photography per business (/assets/<slug>-hero.jpg & -detail.jpg)
 *  - Zero generic dark-purple AI-slop templates; <0.2s edge load; 100% mobile-responsive + reduced-motion safe
 */

import { renderAtElectricCustomSpaces } from "./templates/custom_spaces_at_electric.js";
import { renderThermwiseModernAgency } from "./templates/modern_agency_thermwise.js";
import { renderWashologyVeyra } from "./templates/veyra_washology.js";
import { renderWishWashAppleGallery } from "./templates/apple_wish_wash.js";

export const ASSET_ORIGIN = "https://london-previews.ak10082247.workers.dev";

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const LONDON_SITES = {
  "at-electric": {
    slug: "at-electric",
    name: "AT Electric Contractors Ltd",
    wordmark: "AT Electric.",
    shortName: "AT Electric",
    domain: "atelectric.co.uk",
    currentSpeed: "GoDaddy template (© 2022, typos, no quote form)",
    phoneDisplay: "07590 056206",
    phoneTel: "+447590056206",
    waDigits: "447590056206",
    email: "info@atelectric.co.uk",
    area: "North West & Central London",
    statusTop: "Accepting London Jobs",
    statusSub: "NICEIC Reg #616575000",
    locationSub: "NW & Central London",
    heroImg: "/assets/at-electric-hero.jpg",
    detailImg: "/assets/at-electric-detail.jpg",
    eyebrow: "NICEIC APPROVED · TRUSTMARK · JIB & ECS",
    heroLine1: "Qualified London",
    heroLine2: "Electricians",
    heroQuoteLead: "Direct NICEIC-approved contractors helping London homeowners, landlords, and shop owners ",
    heroQuoteBold: "wire, test, and certify safely",
    heroQuoteTail: " — with zero call-centre middlemen.",
    signatureText: "AT Electric · Reg 616575000",
    theme: {
      heroGrad: "linear-gradient(180deg, #dce6f2 0%, #eef2f7 56%, #f8f6f1 100%)",
      heroInk: "#0b1221",
      heroMuted: "#475569",
      heroBorder: "rgba(11,18,33,0.12)",
      ctaBg: "#0b1221",
      ctaInk: "#ffffff",
      accent: "#d97706",
      accentSoft: "#fef3c7",
      accentSoftInk: "#92400e",
      portalBg: "linear-gradient(155deg, #0f172a 0%, #1e293b 55%, #172033 100%)",
      portalAccent: "#f59e0b",
      ribbonAccent: "#fbbf24",
    },
    splitHeadline: [
      { muted: "From", strong: "fault check", pill: true, muted2: "to", strong2: "NICEIC sign-off" },
      { strong: "wired", muted: "for", strong2: "London homes & shops" },
    ],
    splitSub: "Every inspection, consumer unit upgrade, and commercial fit-out tested and certified directly by our own qualified team.",
    portalCornerLeft: "Zero agency middlemen",
    portalCornerRight: "Direct electrician quotes in 30 seconds",
    ribbonText: "NICEIC #616575000 ✦ TRUSTMARK ✦ THREE-PHASE & EICR ✦ NW & CENTRAL LONDON ✦",
    services: [
      {
        tag: "Compliance",
        title: "Landlord EICR Certificates",
        price: "Fast Turnaround",
        img: "hero",
        desc: "Thorough Electrical Installation Condition Reports for landlords, HMOs, and commercial properties with clear remedial quotes if anything needs attention.",
        bullets: ["Full circuit & earth-fault testing", "Digital NICEIC certificate issued fast", "Remedial repairs handled directly"],
      },
      {
        tag: "Domestic",
        title: "Consumer Units & Home Wiring",
        price: "18th Edition",
        img: "detail",
        desc: "Safe fuse board upgrades, architectural lighting, brushed-brass switches, sockets, and complete domestic rewires across North West & Central London.",
        bullets: ["Domestic Installer & Part P compliant", "Clean, respectful Victorian flat work", "Free written quote upfront"],
      },
      {
        tag: "Commercial",
        title: "Offices, Retail & Three-Phase",
        price: "Out-of-Hours Ready",
        img: "hero",
        desc: "Three-phase installations, commercial distribution boards, shop-fit lighting, and ongoing maintenance planned around your trading hours.",
        bullets: ["Three-phase installation & testing", "Retail unit & office electrical fit-outs", "Minimal disruption to trading"],
      },
      {
        tag: "Urgent",
        title: "Fault Finding & Call-Outs",
        price: "Rapid Local Team",
        img: "detail",
        desc: "Tripping RCDs, dead circuits, or sudden power faults traced systematically and resolved safely without guesswork.",
        bullets: ["Direct qualified electrician response", "Transparent pricing before work starts", "North West & Central London"],
      },
    ],
    quoteTitle: "Get a 30-Second Electrical or EICR Quote",
    quoteLead: "Pick your job type and London postcode — pre-fills a direct WhatsApp or email straight to our engineer.",
    quoteJobs: [
      "Landlord EICR Certificate",
      "Fault Finding / Tripping Fuse Board",
      "Consumer Unit / Fuse Box Upgrade",
      "Commercial / Retail / Three-Phase Work",
      "Lighting / Sockets / Rewiring",
      "Emergency Electrical Call-Out",
    ],
    quoteSecondaryLabel: "Property Type",
    quoteSecondaryOptions: ["Flat / House (Domestic)", "Landlord / Rental Property", "Shop / Retail Unit", "Office / Commercial Site"],
    areas: ["Camden", "Kilburn", "Hampstead", "West Hampstead", "Willesden", "Wembley", "Hendon", "Finchley", "Paddington", "Marylebone", "Soho", "Westminster"],
    reviews: [
      {
        sticker: "NICEIC #616575000",
        author: "NICEIC Approved Contractor",
        meta: "Domestic & Commercial Assessed",
        quote: "Independently assessed to the highest UK electrical safety standards covering both domestic homes and commercial installations.",
      },
      {
        sticker: "TRUSTMARK",
        author: "Government-Endorsed Quality",
        meta: "Registered Competent Person",
        quote: "Verified technical competence, fair trading practices, and full Part P compliance on every certificate and upgrade.",
      },
      {
        sticker: "JIB & ECS",
        author: "Direct Local Contractors",
        meta: "North West & Central London",
        quote: "Deal straight with qualified London electricians from initial quote through to final circuit testing and certification.",
      },
    ],
    footerNote: "© 2026 AT Electric Contractors Ltd · NICEIC Approved Contractor #616575000 · 07590 056206 · info@atelectric.co.uk",
  },

  "washology": {
    slug: "washology",
    name: "Washology Mobile Detailing",
    wordmark: "Washology.",
    shortName: "Washology",
    domain: "washologymv.co.uk",
    currentSpeed: "21.5s Wix load (1.64 MB, no WhatsApp or quote builder)",
    phoneDisplay: "07388 725375",
    phoneTel: "+447388725375",
    waDigits: "447388725375",
    email: "Wesley@washologymv.co.uk",
    area: "North London & Surrounding Areas",
    statusTop: "Booking Mobile Slots",
    statusSub: "Home or Workplace",
    locationSub: "North London, UK",
    heroImg: "/assets/washology-hero.jpg",
    detailImg: "/assets/washology-detail.jpg",
    eyebrow: "MOBILE VALETING & DETAILING · NORTH LONDON",
    heroLine1: "Mirror Gloss,",
    heroLine2: "At Your Door",
    heroQuoteLead: "North London's highly rated mobile detailer helping busy drivers achieve ",
    heroQuoteBold: "showroom paintwork and deep cabin resets",
    heroQuoteTail: " right on their own driveway.",
    signatureText: "Wesley — Washology",
    theme: {
      heroGrad: "linear-gradient(180deg, #cddff5 0%, #e5eef8 55%, #f7f6f2 100%)",
      heroInk: "#0c1017",
      heroMuted: "#4b5563",
      heroBorder: "rgba(12,16,23,0.12)",
      ctaBg: "#0c1017",
      ctaInk: "#ffffff",
      accent: "#9f7836",
      accentSoft: "#f5eddc",
      accentSoftInk: "#71521d",
      portalBg: "linear-gradient(155deg, #101318 0%, #1d222b 55%, #12151b 100%)",
      portalAccent: "#d4af6a",
      ribbonAccent: "#d4af6a",
    },
    splitHeadline: [
      { muted: "From", strong: "driveway", pill: true, muted2: "to", strong2: "mirror gloss" },
      { strong: "crafted", muted: "by", strong2: "hand in North London" },
    ],
    splitSub: "From a crisp 30-minute refresh to meticulous 5-hour multi-stage paint correction and ceramic coating — using finest-grade, eco-conscious products.",
    portalCornerLeft: "30 min to 5 hour bespoke care",
    portalCornerRight: "Direct WhatsApp booking with Wesley",
    ribbonText: "DEEP CLEANS ✦ PAINT CORRECTION ✦ CERAMIC COATINGS ✦ NORTH LONDON ✦ 5.0 ★ RATED ✦",
    services: [
      {
        tag: "Most Popular",
        title: "Mobile Deep Clean",
        price: "Home or Workplace",
        img: "hero",
        desc: "Thorough safe exterior wash and complete interior reset bringing daily drivers back to crisp, spotless condition without leaving your driveway.",
        bullets: ["Safe scratch-free multi-stage wash", "Full cabin vacuum, trim & glass finish", "30-minute refresh to full deep clean"],
      },
      {
        tag: "Gloss Boost",
        title: "Paint Enhancement",
        price: "Single-Stage Polish",
        img: "detail",
        desc: "Machine refinement that removes light haze and wash marring, restoring rich depth and crisp reflections before locking in protection.",
        bullets: ["Full paint decontamination & clay bar", "Single-stage machine gloss polish", "Hydrophobic sealant protection"],
      },
      {
        tag: "Restoration",
        title: "Multi-Stage Paint Correction",
        price: "Swirl & Defect Removal",
        img: "hero",
        desc: "Meticulous multi-hour machine compounding and jewelling to safely level swirl marks, oxidation, and deeper clear-coat defects.",
        bullets: ["Multi-hour precision machine work", "Safe paint depth assessment", "Showroom-ready finish for ceramic"],
      },
      {
        tag: "Protection",
        title: "Ceramic Coating",
        price: "Hydrophobic Shield",
        img: "detail",
        desc: "Finest-grade ceramic protection delivering tight water beading, intense gloss, and year-round resistance to London road film and UV.",
        bullets: ["Tight crystal hydrophobic beading", "Easier, safer maintenance washes", "Applied cleanly at your property"],
      },
    ],
    quoteTitle: "Book Your North London Detail in 30 Seconds",
    quoteLead: "Pick your package and vehicle size — opens a clean pre-filled WhatsApp straight to Wesley on 07388 725375.",
    quoteJobs: [
      "Mobile Deep Clean",
      "Paint Enhancement",
      "Multi-Stage Paint Correction",
      "Ceramic Coating Package",
      "Regular Maintenance Valet",
    ],
    quoteSecondaryLabel: "Vehicle Size",
    quoteSecondaryOptions: ["Small / Hatchback", "Saloon / Coupe / Estate", "SUV / 4x4 / MPV", "Performance / Prestige"],
    areas: ["Barnet", "Finchley", "Enfield", "Muswell Hill", "Crouch End", "Highgate", "Hampstead", "Southgate", "Totteridge", "Mill Hill", "Islington", "Hertfordshire Borders"],
    reviews: [
      {
        sticker: "5.0 ★ VERIFIED",
        author: "Sarah P.",
        meta: "North London Client",
        quote: "Wesley was friendly and efficient and washed it like it was his own car, with attention and detail. Highly recommend Washology for a thorough and quality car wash!",
      },
      {
        sticker: "5.0 ★ VERIFIED",
        author: "Zoe F.",
        meta: "North London Client",
        quote: "Washology truly exceeded my expectations — their customer service was exceptional, from streamlined communication to accommodating my schedule.",
      },
      {
        sticker: "5.0 ★ VERIFIED",
        author: "Stephan H.",
        meta: "North London Client",
        quote: "Excellent service. Arrived bang on time and did a fantastic job. I used to think that I kept my car clean but Wesley has put me to shame... I'll definitely use Washology in future.",
      },
    ],
    footerNote: "© 2026 Washology Mobile Valeting & Detailing · North London · 07388 725375 · Wesley@washologymv.co.uk",
  },

  "thermwise": {
    slug: "thermwise",
    name: "Thermwise Limited",
    wordmark: "Thermwise.",
    shortName: "Thermwise",
    domain: "thermwise.co.uk",
    currentSpeed: "8.8s Wix load (1.85 MB, no WhatsApp or callback form)",
    phoneDisplay: "020 3962 0533",
    phoneTel: "+442039620533",
    waDigits: "",
    email: "info@thermwise.co.uk",
    area: "North, West & Central London + Herts",
    statusTop: "Engineers On Standby 24/7",
    statusSub: "Gas Safe Reg #597272",
    locationSub: "N, W & Central London",
    heroImg: "/assets/thermwise-hero.jpg",
    detailImg: "/assets/thermwise-detail.jpg",
    eyebrow: "24/7 PLUMBING, BOILERS & GAS · FAMILY-RUN",
    heroLine1: "At Your Door",
    heroLine2: "Within The Hour",
    heroQuoteLead: "A family-run London heating and plumbing team with 8,000+ completed jobs — ",
    heroQuoteBold: "our own Gas Safe engineers, never middlemen",
    heroQuoteTail: ", backed by a 12-month guarantee.",
    signatureText: "Thermwise · Gas Safe #597272",
    theme: {
      heroGrad: "linear-gradient(180deg, #d7e8fa 0%, #ecf2f9 55%, #fcfaf5 100%)",
      heroInk: "#0d2137",
      heroMuted: "#475a6e",
      heroBorder: "rgba(13,33,55,0.12)",
      ctaBg: "#c94a27",
      ctaInk: "#ffffff",
      accent: "#c94a27",
      accentSoft: "#fdece7",
      accentSoftInk: "#932f14",
      portalBg: "linear-gradient(155deg, #0b1f33 0%, #13314f 55%, #0d233a 100%)",
      portalAccent: "#f26a44",
      ribbonAccent: "#f59e0b",
    },
    splitHeadline: [
      { muted: "From", strong: "cold boiler", pill: true, muted2: "to", strong2: "warm home" },
      { strong: "fixed", muted: "by", strong2: "our own engineers" },
    ],
    splitSub: "Over 7 years serving North, West & Central London. From a 2 AM boiler breakdown to a fixed-price new installation, one local team handles it start to finish.",
    portalCornerLeft: "Gas Safe #597272 · 12-month guarantee",
    portalCornerRight: "24/7 emergency dispatch on 020 3962 0533",
    ribbonText: "GAS SAFE #597272 ✦ 8,000+ LONDON JOBS ✦ 24/7 EMERGENCY ✦ 12-MONTH GUARANTEE ✦",
    services: [
      {
        tag: "24/7 Emergency",
        title: "Boiler Breakdown & Repair",
        price: "Within the Hour",
        img: "hero",
        desc: "No heating, no hot water, fault codes, or pressure drops diagnosed fast day or night across North, West & Central London.",
        bullets: ["24/7 emergency engineers on call", "All major boiler brands repaired", "12-month workmanship guarantee"],
      },
      {
        tag: "Fixed Price",
        title: "New Boiler Installations",
        price: "Upfront Fixed Quote",
        img: "detail",
        desc: "Honest fixed-price boiler replacements properly sized for London homes, installed neatly with full Gas Safe notification.",
        bullets: ["Clear fixed quote with zero surprises", "System flush & neat copper pipework", "Gas Safe #597272 certified"],
      },
      {
        tag: "Gas Safe",
        title: "Gas Leaks, Hobs & CP12",
        price: "Home & Landlord",
        img: "hero",
        desc: "Urgent gas leak tracing, cooker and hob installations, and annual Landlord Gas Safety Certificates.",
        bullets: ["Rapid gas leak investigation", "Landlord CP12 certificates", "Registered Gas Safe engineers"],
      },
      {
        tag: "Plumbing & Heating",
        title: "Leaks, Radiators & Drainage",
        price: "Same-Day Service",
        img: "detail",
        desc: "Burst pipes, dripping taps, toilets, cold radiators, hot water cylinders, blockages, and domestic electrical fixes.",
        bullets: ["Fast leak isolation & repair", "Radiator balancing & valves", "Clean, tidy family-run team"],
      },
    ],
    quoteTitle: "Request an Emergency Engineer or Fixed Boiler Quote",
    quoteLead: "Need help right now? Tap to call 020 3962 0533 — or build a priority callback request below in 30 seconds.",
    quoteJobs: [
      "24/7 Boiler Breakdown (No Heat / Hot Water)",
      "Urgent Water Leak / Burst Pipe",
      "Fixed-Price New Boiler Quote",
      "Gas Safety Certificate (CP12) / Gas Check",
      "Radiators / Central Heating Repair",
      "Plumbing / Taps / Toilet / Blockage",
    ],
    quoteSecondaryLabel: "How Urgent Is This?",
    quoteSecondaryOptions: ["Emergency — Need Engineer Today", "Within 24–48 Hours", "This Week (Flexible)", "Just Looking for a Fixed Quote"],
    areas: ["Barnet", "Brent", "Camden", "Ealing", "Hammersmith", "Harrow", "Hillingdon", "Islington", "Westminster", "Kensington", "Watford", "Hertfordshire"],
    reviews: [
      {
        sticker: "4.3 ★ GOOGLE",
        author: "Hundreds of London Homes",
        meta: "8,000+ Jobs Completed",
        quote: "Trusted across North, West & Central London for fast emergency callouts, tidy boiler installs, and straightforward honest pricing.",
      },
      {
        sticker: "FAMILY-RUN",
        author: "Our Own Engineers Only",
        meta: "7+ Years in Business",
        quote: "Unlike national agencies that pass your job to whoever is free, Thermwise sends our own vetted engineers from start to finish.",
      },
      {
        sticker: "12-MONTH WARRANTY",
        author: "Gas Safe Registered #597272",
        meta: "Guaranteed Workmanship",
        quote: "Every boiler repair, gas safety check, and heating installation comes with our written 12-month workmanship guarantee.",
      },
    ],
    footerNote: "© 2026 Thermwise Limited · Gas Safe Registered #597272 · 020 3962 0533 · info@thermwise.co.uk",
  },

  "wish-wash": {
    slug: "wish-wash",
    name: "Wish Wash Valeting & Detailing",
    wordmark: "Wish Wash.",
    shortName: "Wish Wash",
    domain: "wish-wash.co.uk",
    currentSpeed: "4.8s Wix load (1.33 MB, no inline booking form)",
    phoneDisplay: "+44 7763 453883",
    phoneTel: "+447763453883",
    waDigits: "447763453883",
    email: "info@wish-wash.co.uk",
    area: "London — Home or Office Driveway",
    statusTop: "Mobile Van Ready",
    statusSub: "Own Water & Power",
    locationSub: "London, UK",
    heroImg: "/assets/wish-wash-hero.jpg",
    detailImg: "/assets/wish-wash-detail.jpg",
    eyebrow: "12+ YEARS MOBILE VALETING · TRANSPARENT FROM £43",
    heroLine1: "Showroom Clean,",
    heroLine2: "Zero Hassle",
    heroQuoteLead: "Over 12 years bringing fully self-contained mobile valeting to London doorsteps — ",
    heroQuoteBold: "own water, own power, clear prices from £43",
    heroQuoteTail: ", zero mess left behind.",
    signatureText: "Wish Wash · 12+ Years",
    theme: {
      heroGrad: "linear-gradient(180deg, #3b96f3 0%, #86c7fb 56%, #e4f3ff 100%)",
      heroInk: "#091d34",
      heroMuted: "#1f3e5f",
      heroBorder: "rgba(9,29,52,0.14)",
      ctaBg: "#091d34",
      ctaInk: "#ffffff",
      accent: "#0d9488",
      accentSoft: "#ccfbf1",
      accentSoftInk: "#115e59",
      portalBg: "linear-gradient(155deg, #0b2d4d 0%, #0e4a73 55%, #092640 100%)",
      portalAccent: "#2dd4bf",
      ribbonAccent: "#38bdf8",
    },
    splitHeadline: [
      { muted: "From", strong: "road grime", pill: true, muted2: "to", strong2: "showroom fresh" },
      { strong: "washed", muted: "on", strong2: "your own driveway" },
    ],
    splitSub: "Clear upfront packages from £43 to £80 with pH-neutral snow foam, 3-bucket safe wash, Ultragloss SiO2 protection, and deep cabin care.",
    portalCornerLeft: "Own water & power onboard",
    portalCornerRight: "Tap a package · Book on WhatsApp in 20s",
    ribbonText: "EXTERIOR £43–£49 ✦ MINI VALET PLUS £59–£69 ✦ DETAIL SiO2 £70–£80 ✦ 12+ YEARS LONDON ✦",
    services: [
      {
        tag: "Essential",
        title: "Exterior Wash & Protect",
        price: "£43 – £49",
        img: "hero",
        desc: "Safe hand wash and protective wax finish designed for spotless regular upkeep without risking drive-through scratches.",
        bullets: ["Pre-wash rinse & dedicated wheel wash", "Microfibre mitt hand wash & soft towel dry", "Wax protection, glass clean & tyre dressing"],
      },
      {
        tag: "Most Popular",
        title: "Mini Valet Plus",
        price: "£59 – £69",
        img: "detail",
        desc: "Complete Exterior Wash & Protect paired with a deep interior reset covering mats, carpets, seats, boot, and dashboard.",
        bullets: ["Full Exterior Wash & Protect included", "Deep interior vacuum (mats, seats & boot)", "Dashboard, plastics & inside windows"],
      },
      {
        tag: "Showroom Gloss",
        title: "Detail Exterior (SiO2)",
        price: "£70 – £80",
        img: "hero",
        desc: "Enthusiast-grade safe wash with pH-neutral snow foam, 3-bucket method, Ultragloss SiO2 coating, and ceramic tyre shine.",
        bullets: ["Deep pre-wash & pH-neutral snow foam bath", "3-bucket hand wash + wheel protection", "Ultragloss SiO2 glass/paint + ceramic tyres"],
      },
      {
        tag: "Restoration",
        title: "Upholstery & Machine Polish",
        price: "Custom Quote",
        img: "detail",
        desc: "Deep seat and carpet stain extraction, interior refreshment, and machine polishing tailored to your vehicle.",
        bullets: ["Deep fabric & leather cabin care", "Machine gloss enhancement", "Zero tap or plug needed from you"],
      },
    ],
    quoteTitle: "Book Your Mobile Valet Slot in 20 Seconds",
    quoteLead: "Pick your package and vehicle size below — opens a ready-to-send WhatsApp directly to +44 7763 453883.",
    quoteJobs: [
      "Exterior Wash & Protect (£43–£49)",
      "Mini Valet Plus (£59–£69)",
      "Detail Exterior SiO2 (£70–£80)",
      "Deep Interior / Upholstery Clean",
      "Machine Polishing / Full Detail",
    ],
    quoteSecondaryLabel: "Vehicle Size",
    quoteSecondaryOptions: ["Small / Standard Car", "Saloon / Estate", "Large SUV / 4x4 / 7-Seater", "Van / Commercial"],
    areas: ["Central London", "West London", "North London", "South London", "East London", "Home Driveways", "Office Car Parks"],
    reviews: [
      {
        sticker: "5.0 ★ LONG-TERM CLIENT",
        author: "S. Ottmann",
        meta: "Verified London Customer",
        quote: "Simple to book — I've had many a car cleaned, this was exceptional. The standard is higher than I've ever seen, my car is brand new again. I will now remain a long term customer.",
      },
      {
        sticker: "12+ YEARS",
        author: "Decades of Safe Craft",
        meta: "Selected Premium Chemistry",
        quote: "Over 12 years perfecting safe wash techniques and selecting paint-safe SiO2 products for genuine showroom results every visit.",
      },
      {
        sticker: "100% SELF-CONTAINED",
        author: "Own Water & Power Supply",
        meta: "Home or Office Convenience",
        quote: "Carry on with your workday or weekend — our mobile van arrives fully equipped with onboard water and electricity.",
      },
    ],
    footerNote: "© 2026 Wish Wash Valeting & Detailing · London · +44 7763 453883 · info@wish-wash.co.uk",
  },

  "visuals-detailing": {
    slug: "visuals-detailing",
    name: "Visuals Valeting & Detailing",
    wordmark: "Visuals.",
    shortName: "Visuals Detailing",
    domain: "visualsdetailing.co.uk",
    currentSpeed: "5.8–13.2s Wix load (1.30 MB, no quote calculator)",
    phoneDisplay: "+44 7859 743762",
    phoneTel: "+447859743762",
    waDigits: "447859743762",
    email: "visualsdetailing@gmail.com",
    area: "London, Surrey & Home Counties",
    statusTop: "5.0 ★ Driveway Detailing",
    statusSub: "Valets From £35 · 7 Areas",
    locationSub: "London & Surrey",
    heroImg: "/assets/visuals-detailing-hero.jpg",
    detailImg: "/assets/visuals-detailing-detail.jpg",
    eyebrow: "5.0 ★ RATED · OWN POWER & WATER · 7 COUNTIES",
    heroLine1: "Showroom Finish,",
    heroLine2: "On Your Drive",
    heroQuoteLead: "From £35 maintenance valets to Stage 2 paint correction and wheels-off ceramic coatings — ",
    heroQuoteBold: "nothing to set up and nowhere to drive",
    heroQuoteTail: " across London, Surrey & the Home Counties.",
    signatureText: "Visuals · 5.0 ★ Rated",
    theme: {
      heroGrad: "linear-gradient(180deg, #dde7df 0%, #edf1ea 56%, #f6f2ea 100%)",
      heroInk: "#13261d",
      heroMuted: "#475c51",
      heroBorder: "rgba(19,38,29,0.12)",
      ctaBg: "#17382b",
      ctaInk: "#f7f4ec",
      accent: "#9c7a3c",
      accentSoft: "#f3ebd9",
      accentSoftInk: "#6d5322",
      portalBg: "linear-gradient(155deg, #10291f 0%, #1b4332 55%, #122d22 100%)",
      portalAccent: "#d4b06a",
      ribbonAccent: "#d4b06a",
    },
    splitHeadline: [
      { muted: "From", strong: "dull paint", pill: true, muted2: "to", strong2: "concours depth" },
      { strong: "finished", muted: "at", strong2: "your front door" },
    ],
    splitSub: "Own onboard power and water across 7 counties — bringing multi-stage paint correction, wheels-off ceramic coatings, and £35+ maintenance valets straight to your driveway.",
    portalCornerLeft: "Own power & water · Zero garage visits",
    portalCornerRight: "Instant WhatsApp driveway quote across 7 counties",
    ribbonText: "5.0 ★ RATED ✦ VALETS FROM £35 ✦ STAGE 1 & 2 CORRECTION ✦ WHEELS-OFF CERAMIC ✦ LONDON & SURREY ✦",
    services: [
      {
        tag: "From £35",
        title: "Everyday Care & Valets",
        price: "From £35",
        img: "hero",
        desc: "Safe driveway maintenance washes through to full interior deep cleans — keeping daily cars effortlessly sharp at home or work.",
        bullets: ["Safe snow foam & scratch-free wash", "Full interior deep clean options", "Own power & water onboard"],
      },
      {
        tag: "Protection",
        title: "Wheels-Off Ceramic & Leather",
        price: "Pro Chemistry",
        img: "detail",
        desc: "Paint enhancement, wheels-off ceramic coating, and dedicated leather protection using the same pro chemistry as our restorations.",
        bullets: ["Wheels-off alloy & caliper ceramic", "Interior leather & trim protection", "Deep hydrophobic gloss"],
      },
      {
        tag: "Restoration",
        title: "Stage 1 & 2 Paint Correction",
        price: "Mirror Gloss",
        img: "hero",
        desc: "Precision single-stage enhancement or deeper Stage 2 machine correction levelling swirls, hazing, and surface blemishes.",
        bullets: ["Stage 1 gloss refinement", "Stage 2 deeper defect removal", "Ideal for new-car or pre-sale prep"],
      },
      {
        tag: "Tailored Add-Ons",
        title: "Bespoke Detailing Upgrades",
        price: "Mix & Match",
        img: "detail",
        desc: "Add glass rain-repellent coating, engine bay dressing, pet hair removal, or fabric protection to any driveway visit.",
        bullets: ["Tailored add-on options", "Multi-car household slots", "7 areas across London & Home Counties"],
      },
    ],
    quoteTitle: "Get Your Instant Driveway Quote",
    quoteLead: "Choose your package and county below — opens a pre-filled WhatsApp straight to +44 7859 743762.",
    quoteJobs: [
      "Maintenance Wash / Everyday Valet (from £35)",
      "Full Interior & Exterior Deep Clean",
      "Stage 1 Paint Enhancement",
      "Stage 2 Multi-Stage Paint Correction",
      "Wheels-Off Ceramic Coating & Leather Protection",
    ],
    quoteSecondaryLabel: "Your County / Area",
    quoteSecondaryOptions: ["London / Hounslow", "Surrey", "Berkshire", "Buckinghamshire", "Hampshire / Hertfordshire"],
    areas: ["London", "Hounslow", "Surrey", "Berkshire", "Buckinghamshire", "Hampshire", "Hertfordshire"],
    reviews: [
      {
        sticker: "5.0 ★ RATED",
        author: "London & Surrey Drivers",
        meta: "7 Areas Covered",
        quote: "Consistently 5-star rated from weekly driveway maintenance washes through to full multi-stage paint restorations.",
      },
      {
        sticker: "NO GARAGE NEEDED",
        author: "Own Power & Water Onboard",
        meta: "100% Self-Contained",
        quote: "We never ask for your tap or extension lead — everything needed for a showroom finish arrives cleanly on your driveway.",
      },
      {
        sticker: "CONCOURS CRAFT",
        author: "Stage 1, Stage 2 & Wheels-Off",
        meta: "Pro-Grade Ceramic Systems",
        quote: "True machine paint correction and wheels-off ceramic protection carried out patiently right outside your front door.",
      },
    ],
    footerNote: "© 2026 Visuals Valeting & Detailing · London & Surrey · +44 7859 743762 · visualsdetailing@gmail.com",
  },
};

function buildPreviewBarHtml(site, clean) {
  if (clean) return "";
  return `<div id="previewBanner" class="pv-bar" role="region" aria-label="Website preview banner">
  <div class="pv-inner">
    <div class="pv-copy">
      <span class="pv-pill">LIVE PREVIEW</span>
      <span>Built for <strong>${escapeHtml(site.name)}</strong> · Replaces ${escapeHtml(site.currentSpeed)} · <strong>£199 one-time</strong> (£0/mo hosting, 100% text/email handover).</span>
    </div>
    <div class="pv-actions">
      <button type="button" class="pv-buy" data-action="claim-site" data-slug="${escapeHtml(site.slug)}">Claim &amp; Go Live — £199</button>
      <button type="button" class="pv-close" data-action="hide-banner" aria-label="Hide preview banner">Hide</button>
    </div>
  </div>
</div>`;
}

function buildClaimScriptJs(slug) {
  return `
  document.addEventListener('click', function(ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!b) return;
    var act = b.getAttribute('data-action');
    if (act === 'hide-banner') {
      var bar = document.getElementById('previewBanner');
      if (bar) bar.style.display = 'none';
      return;
    }
    if (act === 'claim-site') {
      var orig = b.textContent;
      b.disabled = true;
      b.textContent = 'Opening Stripe £199...';
      fetch('/api/checkout?slug=' + encodeURIComponent(${JSON.stringify(slug)}) + '&format=json')
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d && d.url) { window.location.href = d.url; }
          else { b.disabled = false; b.textContent = orig; alert((d && d.error) || 'Checkout unavailable — reply YES via WhatsApp or email to claim.'); }
        })
        .catch(function(){ b.disabled = false; b.textContent = orig; alert('Network error — reply YES via WhatsApp or email to claim.'); });
    }
  });`;
}

export function renderClientSiteHtml(site, { clean = false, origin = ASSET_ORIGIN } = {}) {
  const previewBarHtml = buildPreviewBarHtml(site, clean);
  const claimScriptJs = buildClaimScriptJs(site.slug);

  if (site.slug === "at-electric") {
    return renderAtElectricCustomSpaces(site, { clean, origin, previewBarHtml, claimScriptJs });
  }
  if (site.slug === "thermwise") {
    return renderThermwiseModernAgency(site, { clean, origin, previewBarHtml, claimScriptJs });
  }
  if (site.slug === "washology") {
    return renderWashologyVeyra(site, { clean, origin, previewBarHtml, claimScriptJs });
  }
  if (site.slug === "wish-wash") {
    return renderWishWashAppleGallery(site, { clean, origin, previewBarHtml, claimScriptJs });
  }

  const t = site.theme;
  const heroPhoto = `${origin}${site.heroImg}`;
  const detailPhoto = `${origin}${site.detailImg}`;
  const waHref = site.waDigits
    ? `https://wa.me/${site.waDigits}?text=${encodeURIComponent(`Hi ${site.shortName}, I'd like a quick quote please.`)}`
    : `mailto:${encodeURIComponent(site.email)}?subject=${encodeURIComponent(`Quote Request — ${site.shortName}`)}`;
  const primaryContactLabel = site.waDigits ? "WhatsApp Quote" : "Request Callback";

  // Build 6 rich interactive showcase cards for BOTH the 3D concave hero cylinder AND the fanned scroll arc
  const carouselCards = [
    {
      id: 0,
      kind: "photo",
      img: heroPhoto,
      tag: site.services[0].tag,
      title: site.services[0].title,
      price: site.services[0].price,
      desc: site.services[0].desc,
      bullets: site.services[0].bullets,
    },
    {
      id: 1,
      kind: "photo",
      img: detailPhoto,
      tag: site.services[1].tag,
      title: site.services[1].title,
      price: site.services[1].price,
      desc: site.services[1].desc,
      bullets: site.services[1].bullets,
    },
    {
      id: 2,
      kind: "photo",
      img: heroPhoto,
      tag: site.services[2].tag,
      title: site.services[2].title,
      price: site.services[2].price,
      desc: site.services[2].desc,
      bullets: site.services[2].bullets,
    },
    {
      id: 3,
      kind: "photo",
      img: detailPhoto,
      tag: site.services[3].tag,
      title: site.services[3].title,
      price: site.services[3].price,
      desc: site.services[3].desc,
      bullets: site.services[3].bullets,
    },
    {
      id: 4,
      kind: "photo",
      img: heroPhoto,
      tag: site.reviews[0].sticker,
      title: site.reviews[0].author,
      price: site.reviews[0].meta,
      desc: site.reviews[0].quote,
      bullets: [`Serving ${site.area}`, `Direct contact: ${site.phoneDisplay}`, "Zero call-centre middlemen"],
    },
    {
      id: 5,
      kind: "photo",
      img: detailPhoto,
      tag: site.statusTop,
      title: `${site.shortName} Direct`,
      price: site.statusSub,
      desc: site.splitSub,
      bullets: site.areas.slice(0, 3).map((a) => `Covering ${a} & surrounds`),
    },
  ];

  const previewBar = clean
    ? ""
    : `<div id="previewBanner" class="pv-bar" role="region" aria-label="Website preview banner">
  <div class="pv-inner">
    <div class="pv-copy">
      <span class="pv-pill">LIVE PREVIEW</span>
      <span>Built for <strong>${escapeHtml(site.name)}</strong> · Replaces ${escapeHtml(site.currentSpeed)} · <strong>£199 one-time</strong> (£0/mo hosting, 100% text/email handover).</span>
    </div>
    <div class="pv-actions">
      <button type="button" class="pv-buy" data-action="claim-site" data-slug="${escapeHtml(site.slug)}">Claim &amp; Go Live — £199</button>
      <button type="button" class="pv-close" data-action="hide-banner" aria-label="Hide preview banner">Hide</button>
    </div>
  </div>
</div>`;

  const c3dCardsHtml = carouselCards
    .map(
      (c, i) => `<button type="button" class="c3d-card" data-idx="${i}" data-action="open-card" aria-label="Inspect ${escapeHtml(c.title)}">
      <img src="${escapeHtml(c.img)}" alt="${escapeHtml(c.title)}" loading="eager" decoding="async">
      <div class="c3d-scrim"></div>
      <div class="c3d-top">
        <span class="c3d-tag">${escapeHtml(c.tag)}</span>
        <span class="c3d-price">${escapeHtml(c.price)}</span>
      </div>
      <div class="c3d-foot">
        <strong>${escapeHtml(c.title)}</strong>
        <span>Tap to inspect ↗</span>
      </div>
    </button>`
    )
    .join("");

  const arcCardsHtml = carouselCards
    .map(
      (c, i) => `<button type="button" class="arc-card" data-arc-idx="${i}" data-idx="${i}" data-action="open-card" aria-label="Open ${escapeHtml(c.title)}">
      <div class="arc-media">
        <img src="${escapeHtml(c.img)}" alt="${escapeHtml(c.title)}" loading="lazy" decoding="async">
        <span class="arc-badge">${escapeHtml(c.tag)}</span>
      </div>
      <div class="arc-body">
        <div class="arc-row"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml(c.price)}</span></div>
        <p>${escapeHtml(c.desc.slice(0, 92))}…</p>
      </div>
    </button>`
    )
    .join("");

  const s1 = site.splitHeadline[0];
  const s2 = site.splitHeadline[1];

  const reviewsHtml = site.reviews
    .map(
      (r, idx) => `<article class="obs-card" data-pop style="--tilt:${idx === 0 ? "-2deg" : idx === 1 ? "1.6deg" : "-1.2deg"}">
      <span class="obs-sticker">${escapeHtml(r.sticker)}</span>
      <p class="obs-quote">“${escapeHtml(r.quote)}”</p>
      <div class="obs-author"><strong>${escapeHtml(r.author)}</strong><span>${escapeHtml(r.meta)}</span></div>
    </article>`
    )
    .join("");

  const areasHtml = site.areas.map((a) => `<span class="area-pill">${escapeHtml(a)}</span>`).join("");
  const jobOptionsHtml = site.quoteJobs.map((j) => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join("");
  const secOptionsHtml = site.quoteSecondaryOptions.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(site.name)} | ${escapeHtml(site.area)}</title>
<meta name="description" content="${escapeHtml(site.splitSub)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --hero-grad: ${t.heroGrad};
    --hero-ink: ${t.heroInk};
    --hero-muted: ${t.heroMuted};
    --hero-border: ${t.heroBorder};
    --cta-bg: ${t.ctaBg};
    --cta-ink: ${t.ctaInk};
    --accent: ${t.accent};
    --accent-soft: ${t.accentSoft};
    --accent-soft-ink: ${t.accentSoftInk};
    --portal-bg: ${t.portalBg};
    --portal-accent: ${t.portalAccent};
    --ribbon-accent: ${t.ribbonAccent};
    --ink: #0b1221;
    --muted: #64748b;
    --line: #e2e8f0;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: #ffffff;
    color: var(--ink);
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  a { color: inherit; }
  button { font-family: inherit; }

  /* Preview handover strip */
  .pv-bar {
    position: sticky; top: 0; z-index: 120;
    background: #0b101b; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.14);
    font-size: 12.5px; line-height: 1.38;
  }
  .pv-inner {
    max-width: 1240px; margin: 0 auto; padding: 9px 18px;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  }
  .pv-copy { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pv-pill {
    background: #f59e0b; color: #0b101b; font-weight: 800; font-size: 10px;
    letter-spacing: 0.08em; padding: 3px 7px; border-radius: 999px;
  }
  .pv-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .pv-buy {
    background: #10b981; color: #052e16; border: 0; border-radius: 999px;
    padding: 7px 14px; font-weight: 800; font-size: 12.5px; cursor: pointer;
    transition: transform .15s ease, filter .15s ease;
  }
  .pv-buy:hover { transform: translateY(-1px); filter: brightness(1.06); }
  .pv-close {
    background: transparent; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.22);
    border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer;
  }

  /* SECTION 1: 100vh ARCHITECTURAL HERO + 3D CONCAVE CAROUSEL */
  .hero {
    position: relative;
    min-height: 94vh;
    background: var(--hero-grad);
    color: var(--hero-ink);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    padding-bottom: 34px;
  }
  .topbar {
    position: relative; z-index: 30;
    max-width: 1280px; width: 100%; margin: 0 auto;
    padding: 24px 32px 0;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 16px;
  }
  .wordmark {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 28px; line-height: 1; text-decoration: none; letter-spacing: -0.01em;
    justify-self: start;
  }
  .meta-cols {
    display: flex; gap: 28px; align-items: flex-start;
    font-size: 12px; line-height: 1.35;
  }
  .meta-col .m-k { display: flex; align-items: center; gap: 6px; color: var(--hero-muted); font-weight: 500; }
  .meta-col .m-v { font-weight: 700; color: var(--hero-ink); margin-top: 2px; }
  .dot-live {
    width: 7px; height: 7px; border-radius: 50%; background: #10b981;
    box-shadow: 0 0 0 4px rgba(16,185,129,0.22); display: inline-block;
  }
  .vnav {
    justify-self: end; display: flex; flex-direction: column; align-items: flex-end;
    gap: 3px; font-size: 13px; font-weight: 600;
  }
  .vnav a {
    text-decoration: none; color: var(--hero-ink); opacity: 0.78;
    transition: opacity .18s ease, transform .18s ease;
  }
  .vnav a:hover { opacity: 1; transform: translateX(-2px); }

  /* 3D Concave Cylinder Stage */
  .stage-wrap {
    position: relative; z-index: 20;
    width: 100%; height: 390px;
    display: flex; align-items: center; justify-content: center;
    perspective: 1350px;
    margin: 12px 0 4px;
    cursor: grab;
    user-select: none;
    touch-action: pan-y;
  }
  .stage-wrap.dragging { cursor: grabbing; }
  .c3d-ring {
    position: relative;
    width: 310px; height: 224px;
    transform-style: preserve-3d;
    will-change: transform;
  }
  .c3d-card {
    position: absolute; inset: 0; width: 100%; height: 100%;
    padding: 0; border: 1px solid rgba(255,255,255,0.55); border-radius: 18px;
    overflow: hidden; background: #0f172a; color: #ffffff;
    box-shadow: 0 24px 52px rgba(11,18,33,0.18), 0 4px 14px rgba(11,18,33,0.08);
    cursor: pointer; text-align: left; backface-visibility: hidden;
    transition: border-color .2s ease;
  }
  .c3d-card:hover { border-color: #ffffff; }
  .c3d-card img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    transition: transform .5s cubic-bezier(.22,1,.36,1);
  }
  .c3d-card:hover img { transform: scale(1.05); }
  .c3d-scrim {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(8,12,20,0.45) 0%, rgba(8,12,20,0.08) 45%, rgba(8,12,20,0.82) 100%);
  }
  .c3d-top {
    position: relative; z-index: 2; padding: 13px 14px;
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
  }
  .c3d-tag {
    background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.3); color: #ffffff;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    padding: 4px 9px; border-radius: 999px;
  }
  .c3d-price {
    background: rgba(11,18,33,0.72); color: #ffffff;
    font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 999px;
  }
  .c3d-foot {
    position: absolute; left: 14px; right: 14px; bottom: 13px; z-index: 2;
    display: flex; flex-direction: column; gap: 2px;
  }
  .c3d-foot strong { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; line-height: 1.15; }
  .c3d-foot span { font-size: 11.5px; color: rgba(255,255,255,0.8); }
  .drag-hint {
    position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--hero-muted); background: rgba(255,255,255,0.58); backdrop-filter: blur(8px);
    padding: 4px 12px; border-radius: 999px; border: 1px solid var(--hero-border);
    pointer-events: none;
  }

  /* Hero Bottom Corners */
  .hero-bottom {
    position: relative; z-index: 30;
    max-width: 1280px; width: 100%; margin: 0 auto;
    padding: 0 32px;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 28px;
  }
  .hero-left { max-width: 580px; }
  .eyebrow {
    font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--hero-muted); margin-bottom: 10px;
  }
  .hero-h1 {
    font-family: 'Syne', system-ui, sans-serif;
    font-size: clamp(2.35rem, 5.1vw, 4.35rem);
    font-weight: 700; line-height: 1.01; letter-spacing: -0.03em; margin: 0 0 22px;
  }
  .hero-ctas { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .pill-primary {
    display: inline-flex; align-items: center; gap: 10px;
    background: var(--cta-bg); color: var(--cta-ink); text-decoration: none;
    padding: 8px 8px 8px 20px; border-radius: 999px; font-weight: 700; font-size: 14.5px;
    border: 0; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease;
    box-shadow: 0 10px 24px rgba(11,18,33,0.16);
  }
  .pill-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(11,18,33,0.22); }
  .pill-circle {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.16); display: inline-flex; align-items: center; justify-content: center;
    font-size: 14px;
  }
  .pill-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.65); backdrop-filter: blur(8px);
    color: var(--hero-ink); text-decoration: none;
    padding: 12px 18px; border-radius: 999px; font-weight: 700; font-size: 14px;
    border: 1px solid var(--hero-border);
  }
  .pill-ghost:hover { background: rgba(255,255,255,0.92); }
  .hero-right { max-width: 310px; text-align: right; }
  .hero-quote {
    margin: 0 0 12px; font-size: 14.5px; line-height: 1.5; color: var(--hero-muted);
  }
  .hero-quote strong { color: var(--hero-ink); font-weight: 700; }
  .sig {
    font-family: 'Instrument Serif', Georgia, serif; font-style: italic;
    font-size: 22px; color: var(--hero-ink); opacity: 0.85;
  }

  /* SECTION 2: STUDIO WHITE SPLIT-TONE HEADLINE + FANNED ARC CHOREOGRAPHY */
  .choreo-sec {
    position: relative;
    background: #ffffff;
    min-height: 155vh;
  }
  .choreo-sticky {
    position: sticky; top: 0;
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: space-between; align-items: center;
    padding: 84px 24px 28px;
    overflow: hidden;
  }
  .split-head-wrap {
    max-width: 920px; text-align: center;
    transition: opacity .35s ease, filter .35s ease, transform .35s ease;
  }
  .split-h2 {
    font-family: 'Syne', system-ui, sans-serif;
    font-size: clamp(1.95rem, 4.3vw, 3.65rem);
    font-weight: 700; line-height: 1.14; letter-spacing: -0.03em; margin: 0 0 18px;
  }
  .split-h2 .m { color: #94a3b8; font-weight: 600; }
  .split-h2 .s { color: #0b1221; }
  .inline-pill-img {
    display: inline-block; vertical-align: -0.18em;
    width: clamp(54px, 6.2vw, 84px); height: clamp(36px, 4.2vw, 54px);
    object-fit: cover; border-radius: 12px; margin: 0 6px;
    box-shadow: 0 10px 24px rgba(11,18,33,0.16);
    border: 2px solid #ffffff; transform: rotate(-3deg);
    transition: transform .3s ease;
  }
  .split-head-wrap:hover .inline-pill-img { transform: rotate(2deg) scale(1.06); }
  .split-sub {
    max-width: 560px; margin: 0 auto 24px;
    font-size: 15px; color: #64748b; line-height: 1.6;
  }
  .dark-pill {
    display: inline-flex; align-items: center; gap: 10px;
    background: #0b1221; color: #ffffff; text-decoration: none;
    padding: 13px 24px; border-radius: 999px; font-weight: 700; font-size: 14.5px;
    box-shadow: 0 12px 26px rgba(11,18,33,0.16);
    transition: transform .18s ease;
  }
  .dark-pill:hover { transform: translateY(-2px); }

  /* Fanned Upward-Curving Bottom Arc (Coastal Cards pattern) */
  .arc-stage {
    position: relative; width: 100%; max-width: 1280px; height: 295px;
    margin-top: 28px;
  }
  .arc-card {
    position: absolute; left: 50%; bottom: 10px;
    width: 245px; padding: 0; border-radius: 18px; overflow: hidden;
    background: #ffffff; border: 1px solid #e2e8f0; color: #0b1221;
    box-shadow: 0 20px 46px rgba(15,23,42,0.11);
    text-align: left; cursor: pointer;
    transform-origin: center 140%;
    will-change: transform;
    transition: box-shadow .25s ease, border-color .25s ease;
  }
  .arc-card:hover {
    z-index: 25 !important;
    border-color: #0b1221;
    box-shadow: 0 28px 60px rgba(15,23,42,0.22);
  }
  .arc-media { position: relative; height: 132px; overflow: hidden; background: #0f172a; }
  .arc-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .arc-badge {
    position: absolute; top: 10px; left: 10px;
    background: rgba(11,18,33,0.78); backdrop-filter: blur(6px); color: #ffffff;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 4px 8px; border-radius: 999px;
  }
  .arc-body { padding: 13px 14px 15px; }
  .arc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin-bottom: 5px; }
  .arc-row strong { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; line-height: 1.2; }
  .arc-row span { font-size: 11px; font-weight: 700; color: var(--accent); white-space: nowrap; }
  .arc-body p { margin: 0; font-size: 12px; color: #64748b; line-height: 1.4; }

  /* SECTION 3: SCROLL-EXPANDING CLIP-PATH PORTAL + INTERACTIVE 30S QUOTE STUDIO */
  .portal-outer {
    background: #ffffff;
    padding: 20px 0 0;
  }
  .portal-shell {
    background: var(--portal-bg);
    color: #ffffff;
    padding: 84px 24px 92px;
    clip-path: inset(0% 3% 0% 3% round 32px);
    transition: clip-path .15s linear;
    will-change: clip-path;
  }
  .portal-inner { max-width: 1100px; margin: 0 auto; }
  .portal-corners {
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    margin-bottom: 34px; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;
    color: rgba(255,255,255,0.72); font-weight: 700;
  }
  .portal-corners span {
    display: inline-flex; align-items: center; gap: 8px;
  }
  .portal-corners .star { color: var(--portal-accent); }
  .portal-head { max-width: 680px; margin: 0 auto 38px; text-align: center; }
  .portal-head h2 {
    font-family: 'Syne', sans-serif; font-size: clamp(1.9rem, 3.8vw, 3rem);
    line-height: 1.08; letter-spacing: -0.025em; margin: 0 0 12px;
  }
  .portal-head p { margin: 0; color: rgba(255,255,255,0.76); font-size: 16px; }

  .quote-deck {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.16);
    backdrop-filter: blur(16px);
    border-radius: 24px;
    padding: 30px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 28px;
    box-shadow: 0 32px 72px rgba(0,0,0,0.34);
    transform-style: preserve-3d;
    transition: transform .25s ease-out;
  }
  .q-field { margin-bottom: 14px; }
  .q-field label {
    display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase; color: rgba(255,255,255,0.78); margin-bottom: 6px;
  }
  .q-field input, .q-field select, .q-field textarea {
    width: 100%; padding: 12px 14px; font: inherit; font-size: 15px;
    border: 1px solid rgba(255,255,255,0.18); border-radius: 12px;
    background: rgba(9,13,22,0.58); color: #ffffff;
  }
  .q-field select option { background: #0f172a; color: #ffffff; }
  .q-field textarea { min-height: 76px; resize: vertical; }
  .q-card {
    background: #ffffff; color: #0b1221; border-radius: 18px; padding: 24px;
    display: flex; flex-direction: column;
  }
  .q-card h3 { font-family: 'Syne', sans-serif; font-size: 19px; margin: 0 0 6px; }
  .q-card .q-sub { font-size: 13.5px; color: #64748b; margin: 0 0 14px; }
  .q-msg {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 14px; font-size: 13.5px; white-space: pre-wrap; color: #0b1221;
    margin-bottom: 18px; flex: 1;
  }
  .q-btns { display: flex; flex-wrap: wrap; gap: 10px; }
  .q-wa {
    flex: 1; min-width: 170px; text-align: center; text-decoration: none;
    background: #0b1221; color: #ffffff; padding: 13px 18px; border-radius: 999px;
    font-weight: 700; font-size: 14.5px; transition: transform .15s ease;
  }
  .q-wa:hover { transform: translateY(-1px); }
  .q-mail {
    text-align: center; text-decoration: none;
    background: #f1f5f9; color: #0b1221; border: 1px solid #cbd5e1;
    padding: 13px 18px; border-radius: 999px; font-weight: 700; font-size: 14px;
  }

  /* SECTION 4: OBSIDIAN KINETIC RIBBON + SPRING-POP REVIEW STICKERS + FOOTER */
  .obsidian {
    background: #06080d;
    color: #f8fafc;
    padding: 78px 0 92px;
    overflow: hidden;
  }
  .ribbon-wrap {
    border-top: 1px solid rgba(255,255,255,0.1);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding: 22px 0;
    margin-bottom: 64px;
    overflow: hidden;
  }
  .ribbon-track {
    display: flex; gap: 36px; white-space: nowrap;
    font-family: 'Syne', sans-serif;
    font-size: clamp(2.2rem, 6.2vw, 4.9rem);
    font-weight: 800; letter-spacing: -0.02em;
    color: #ffffff;
    will-change: transform;
  }
  .ribbon-track span.hl { color: var(--ribbon-accent); }
  .obs-inner { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
  .obs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 54px; }
  .obs-card {
    position: relative;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 26px 24px;
    display: flex; flex-direction: column;
    opacity: 0; transform: translateY(28px) scale(0.95) rotate(var(--tilt));
    transition: opacity .65s cubic-bezier(0.34, 1.56, 0.64, 1), transform .65s cubic-bezier(0.34, 1.56, 0.64, 1), border-color .2s ease;
  }
  .obs-card.in { opacity: 1; transform: translateY(0) scale(1) rotate(var(--tilt)); }
  .obs-card:hover { transform: translateY(-5px) scale(1.01) rotate(0deg); border-color: rgba(255,255,255,0.34); }
  .obs-sticker {
    align-self: flex-start;
    background: var(--ribbon-accent); color: #06080d;
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 5px 11px; border-radius: 999px; margin-bottom: 16px;
  }
  .obs-quote { margin: 0 0 20px; font-size: 15px; line-height: 1.58; color: rgba(248,250,252,0.88); }
  .obs-author { margin-top: auto; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; }
  .obs-author strong { display: block; font-size: 14.5px; color: #ffffff; }
  .obs-author span { font-size: 12.5px; color: #94a3b8; }

  .areas-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 42px; }
  .area-pill {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    color: #e2e8f0; padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 500;
  }
  .final-cta {
    text-align: center; padding: 40px 24px 0;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .final-cta h3 {
    font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(2rem, 4.5vw, 3.3rem);
    font-weight: 400; margin: 0 0 18px;
  }
  .final-btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-bottom: 34px; }
  .btn-light {
    display: inline-flex; align-items: center; gap: 8px;
    background: #ffffff; color: #06080d; text-decoration: none;
    padding: 13px 24px; border-radius: 999px; font-weight: 700; font-size: 14.5px;
  }
  .btn-dark-out {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; color: #ffffff; border: 1px solid rgba(255,255,255,0.28);
    text-decoration: none; padding: 13px 22px; border-radius: 999px; font-weight: 600; font-size: 14.5px;
  }
  .foot-copy { font-size: 12.5px; color: #64748b; }

  /* Frosted Glass Service Detail Sheet Modal */
  .sheet-backdrop {
    position: fixed; inset: 0; z-index: 150;
    background: rgba(6,8,13,0.62); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; padding: 20px;
  }
  .sheet-backdrop.open { display: flex; }
  .sheet-box {
    max-width: 560px; width: 100%; background: #ffffff; color: #0b1221;
    border-radius: 22px; overflow: hidden; box-shadow: 0 36px 84px rgba(0,0,0,0.42);
    animation: sheetIn .28s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes sheetIn { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: none; } }
  .sheet-media { position: relative; height: 220px; background: #0f172a; }
  .sheet-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sheet-x {
    position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; border-radius: 50%;
    border: 0; background: rgba(11,18,33,0.76); color: #ffffff; font-size: 18px; cursor: pointer;
  }
  .sheet-body { padding: 24px 26px 26px; }
  .sheet-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .sheet-tag {
    background: var(--accent-soft); color: var(--accent-soft-ink);
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 4px 10px; border-radius: 999px;
  }
  .sheet-price { font-size: 14px; font-weight: 800; color: #0b1221; }
  .sheet-body h3 { font-family: 'Syne', sans-serif; font-size: 24px; margin: 0 0 10px; }
  .sheet-body p { margin: 0 0 14px; font-size: 14.5px; color: #475569; }
  .sheet-body ul { margin: 0 0 20px; padding-left: 18px; font-size: 14px; color: #0b1221; }
  .sheet-body li { margin-bottom: 5px; }
  .sheet-cta {
    width: 100%; background: #0b1221; color: #ffffff; border: 0; border-radius: 999px;
    padding: 13px 20px; font-weight: 700; font-size: 15px; cursor: pointer;
  }

  /* Mobile Sticky Bar */
  .sticky-mob {
    position: fixed; bottom: 12px; left: 12px; right: 12px; z-index: 100;
    background: rgba(11,18,33,0.92); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.16); border-radius: 999px;
    padding: 6px; display: none; gap: 6px; box-shadow: 0 16px 36px rgba(0,0,0,0.32);
  }
  .sticky-mob a {
    flex: 1; text-align: center; text-decoration: none; font-weight: 700; font-size: 13.5px;
    padding: 10px 12px; border-radius: 999px;
  }
  .sm-call { color: #ffffff; background: rgba(255,255,255,0.1); }
  .sm-quote { color: #06080d; background: #ffffff; }

  @media (max-width: 900px) {
    .topbar { grid-template-columns: 1fr auto; padding: 18px 20px 0; }
    .meta-cols { display: none; }
    .hero-bottom { flex-direction: column; align-items: flex-start; padding: 0 20px; gap: 18px; }
    .hero-right { text-align: left; max-width: 100%; }
    .stage-wrap { height: 310px; }
    .c3d-ring { width: 250px; height: 184px; }
    .choreo-sec { min-height: auto; }
    .choreo-sticky { position: static; min-height: auto; padding: 64px 18px 52px; }
    .arc-stage {
      height: auto; display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 28px;
    }
    .arc-card { position: static; width: 100%; transform: none !important; }
    .portal-shell { clip-path: none !important; padding: 60px 18px 68px; border-radius: 24px 24px 0 0; }
    .quote-deck { grid-template-columns: 1fr; padding: 20px; transform: none !important; }
    .obs-grid { grid-template-columns: 1fr; }
    .obs-card { opacity: 1; transform: none; }
    .sticky-mob { display: flex; }
    body { padding-bottom: 74px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .obs-card { opacity: 1; transform: none; transition: none; }
    .portal-shell { clip-path: none !important; }
  }
</style>
</head>
<body>
${previewBar}

<!-- SECTION 1: 100VH ARCHITECTURAL HERO + INTERACTIVE 3D CONCAVE CAROUSEL -->
<section id="top" class="hero">
  <header class="topbar">
    <a class="wordmark" href="#top">${escapeHtml(site.wordmark)}</a>
    <div class="meta-cols">
      <div class="meta-col">
        <div class="m-k"><span class="dot-live"></span> ${escapeHtml(site.statusTop)}</div>
        <div class="m-v">${escapeHtml(site.statusSub)}</div>
      </div>
      <div class="meta-col">
        <div class="m-k">Serving</div>
        <div class="m-v">${escapeHtml(site.locationSub)}</div>
      </div>
    </div>
    <nav class="vnav" aria-label="Primary navigation">
      <a href="#services">Services</a>
      <a href="#quote">Quick Quote</a>
      <a href="#reviews">Reviews</a>
      <a href="tel:${escapeHtml(site.phoneTel)}">${escapeHtml(site.phoneDisplay)}</a>
    </nav>
  </header>

  <div id="c3dStage" class="stage-wrap" aria-label="Interactive 3D showcase carousel">
    <div id="c3dRing" class="c3d-ring">${c3dCardsHtml}</div>
    <div class="drag-hint">Drag to rotate · Click any card ↗</div>
  </div>

  <div class="hero-bottom">
    <div class="hero-left">
      <div class="eyebrow">${escapeHtml(site.eyebrow)}</div>
      <h1 class="hero-h1">${escapeHtml(site.heroLine1)}<br>${escapeHtml(site.heroLine2)}</h1>
      <div class="hero-ctas">
        <a class="pill-primary" href="#quote"><span>${escapeHtml(primaryContactLabel)}</span><span class="pill-circle">↗</span></a>
        <a class="pill-ghost" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)}</a>
      </div>
    </div>
    <div class="hero-right">
      <p class="hero-quote">${escapeHtml(site.heroQuoteLead)}<strong>${escapeHtml(site.heroQuoteBold)}</strong>${escapeHtml(site.heroQuoteTail)}</p>
      <div class="sig">${escapeHtml(site.signatureText)}</div>
    </div>
  </div>
</section>

<!-- SECTION 2: PINNED SPLIT-TONE HEADLINE + FANNED CURVED ARC SHOWCASE -->
<section id="services" class="choreo-sec">
  <div class="choreo-sticky">
    <div id="splitHead" class="split-head-wrap">
      <h2 class="split-h2">
        <span class="m">${escapeHtml(s1.muted)}</span>
        <span class="s">${escapeHtml(s1.strong)}</span>
        <img class="inline-pill-img" src="${escapeHtml(detailPhoto)}" alt="${escapeHtml(site.shortName)} craft preview">
        <span class="m">${escapeHtml(s1.muted2)}</span>
        <span class="s">${escapeHtml(s1.strong2)}</span><br>
        <span class="s">${escapeHtml(s2.strong)}</span>
        <span class="m">${escapeHtml(s2.muted)}</span>
        <span class="s">${escapeHtml(s2.strong2)}</span>
      </h2>
      <p class="split-sub">${escapeHtml(site.splitSub)}</p>
      <a class="dark-pill" href="#quote">${escapeHtml(primaryContactLabel)} →</a>
    </div>

    <div id="arcStage" class="arc-stage">${arcCardsHtml}</div>
  </div>
</section>

<!-- SECTION 3: SCROLL-EXPANDING PORTAL + INTERACTIVE 30S QUOTE BUILDER -->
<div id="quote" class="portal-outer">
  <section id="portalShell" class="portal-shell">
    <div class="portal-inner">
      <div class="portal-corners">
        <span><span class="star">✦</span> ${escapeHtml(site.portalCornerLeft)}</span>
        <span>${escapeHtml(site.portalCornerRight)} <span class="star">✦</span></span>
      </div>
      <div class="portal-head">
        <h2>${escapeHtml(site.quoteTitle)}</h2>
        <p>${escapeHtml(site.quoteLead)}</p>
      </div>
      <div id="quoteDeck" class="quote-deck">
        <div>
          <div class="q-field">
            <label for="qJob">Service Needed</label>
            <select id="qJob">${jobOptionsHtml}</select>
          </div>
          <div class="q-field">
            <label for="qSec">${escapeHtml(site.quoteSecondaryLabel)}</label>
            <select id="qSec">${secOptionsHtml}</select>
          </div>
          <div class="q-field">
            <label for="qPost">London Postcode</label>
            <input id="qPost" type="text" placeholder="e.g. NW6, W4, N12" maxlength="16">
          </div>
          <div class="q-field">
            <label for="qNotes">Quick Details (optional)</label>
            <textarea id="qNotes" placeholder="Preferred day/time or brief details..."></textarea>
          </div>
        </div>
        <div class="q-card">
          <h3>Your Ready-to-Send Enquiry</h3>
          <p class="q-sub">Updates live — tap once to send straight to ${escapeHtml(site.shortName)}.</p>
          <div id="qPreview" class="q-msg"></div>
          <div class="q-btns">
            ${
              site.waDigits
                ? `<a id="qWaBtn" class="q-wa" target="_blank" rel="noopener" href="${escapeHtml(waHref)}">Send via WhatsApp →</a>`
                : `<a id="qCallBtn" class="q-wa" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)} →</a>`
            }
            <a id="qMailBtn" class="q-mail" href="mailto:${escapeHtml(site.email)}">Send by Email</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- SECTION 4: OBSIDIAN KINETIC RIBBON + SPRING-POP REVIEWS + MINIMAL FOOTER -->
<section id="reviews" class="obsidian">
  <div class="ribbon-wrap" aria-hidden="true">
    <div id="ribbonTrack" class="ribbon-track">
      <span>${escapeHtml(site.ribbonText)}</span>
      <span class="hl">${escapeHtml(site.ribbonText)}</span>
      <span>${escapeHtml(site.ribbonText)}</span>
    </div>
  </div>

  <div class="obs-inner">
    <div class="obs-grid">${reviewsHtml}</div>

    <div class="areas-row">${areasHtml}</div>

    <div class="final-cta">
      <h3>Ready when you are — direct across ${escapeHtml(site.area)}.</h3>
      <div class="final-btns">
        ${
          site.waDigits
            ? `<a class="btn-light" target="_blank" rel="noopener" href="${escapeHtml(waHref)}">WhatsApp ${escapeHtml(site.phoneDisplay)} ↗</a>`
            : `<a class="btn-light" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)} ↗</a>`
        }
        <a class="btn-dark-out" href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>
      </div>
      <div class="foot-copy">${escapeHtml(site.footerNote)}</div>
    </div>
  </div>
</section>

<!-- FROSTED-GLASS CARD DETAIL MODAL -->
<div id="cardSheet" class="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
  <div class="sheet-box">
    <div class="sheet-media">
      <img id="sheetImg" src="" alt="">
      <button type="button" class="sheet-x" data-action="close-sheet" aria-label="Close">×</button>
    </div>
    <div class="sheet-body">
      <div class="sheet-meta">
        <span id="sheetTag" class="sheet-tag"></span>
        <span id="sheetPrice" class="sheet-price"></span>
      </div>
      <h3 id="sheetTitle"></h3>
      <p id="sheetDesc"></p>
      <ul id="sheetBullets"></ul>
      <button type="button" id="sheetQuoteBtn" class="sheet-cta" data-action="sheet-to-quote">Select for 30-Second Quote →</button>
    </div>
  </div>
</div>

<!-- MOBILE FLOATING ACTION PILL -->
<div class="sticky-mob">
  <a class="sm-call" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)}</a>
  <a class="sm-quote" href="#quote">${escapeHtml(primaryContactLabel)} ↗</a>
</div>

<script>
(function () {
  var cfg = ${JSON.stringify({
    slug: site.slug,
    shortName: site.shortName,
    email: site.email,
    waDigits: site.waDigits,
    secLabel: site.quoteSecondaryLabel,
    cards: carouselCards,
  })};

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = function () { return window.innerWidth <= 900; };

  /* 1. INTERACTIVE 3D CONCAVE CAROUSEL WITH DRAG INERTIA */
  var stage = document.getElementById("c3dStage");
  var ring = document.getElementById("c3dRing");
  var c3dCards = ring ? Array.prototype.slice.call(ring.querySelectorAll(".c3d-card")) : [];
  var angle = 0;
  var velocity = 0.08;
  var dragging = false;
  var didDrag = false;
  var startX = 0;
  var lastX = 0;

  var currentRadius = 390;

  function layoutCylinder() {
    if (!c3dCards.length) return;
    var count = c3dCards.length;
    var step = 360 / count;
    currentRadius = isMobile() ? 275 : 390;
    for (var i = 0; i < count; i++) {
      var a = i * step;
      c3dCards[i].style.transform = "rotateY(" + a + "deg) translateZ(" + currentRadius + "px)";
    }
  }
  layoutCylinder();
  window.addEventListener("resize", layoutCylinder);

  if (stage && ring) {
    stage.addEventListener("pointerdown", function (e) {
      dragging = true;
      didDrag = false;
      startX = e.clientX;
      lastX = e.clientX;
      stage.classList.add("dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      if (Math.abs(e.clientX - startX) > 6) didDrag = true;
      angle += dx * 0.28;
      velocity = dx * 0.22;
      lastX = e.clientX;
    });
    window.addEventListener("pointerup", function () {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("dragging");
    });
  }

  /* 2. SCROLL-LINKED ARC CHOREOGRAPHY + CLIP-PATH PORTAL + KINETIC RIBBON */
  var choreoSec = document.getElementById("services");
  var splitHead = document.getElementById("splitHead");
  var arcCards = Array.prototype.slice.call(document.querySelectorAll(".arc-card"));
  var portalShell = document.getElementById("portalShell");
  var ribbonTrack = document.getElementById("ribbonTrack");
  var currentScrollP = 0;

  function updateChoreography() {
    if (!isMobile() && choreoSec && arcCards.length) {
      var rect = choreoSec.getBoundingClientRect();
      var total = Math.max(1, choreoSec.offsetHeight - window.innerHeight);
      var targetP = Math.max(0, Math.min(1, -rect.top / total));
      currentScrollP += (targetP - currentScrollP) * 0.12;

      if (splitHead && !reduced) {
        var blurPx = Math.max(0, (0.18 - currentScrollP) * 28);
        var fade = Math.min(1, 0.35 + currentScrollP * 3.8);
        splitHead.style.filter = "blur(" + blurPx.toFixed(2) + "px)";
        splitHead.style.opacity = fade.toFixed(3);
      }

      var n = arcCards.length;
      for (var i = 0; i < n; i++) {
        var norm = (i - (n - 1) / 2) / ((n - 1) / 2); // -1 to +1
        var spread = 0.65 + currentScrollP * 0.52;
        var shiftX = norm * 470 * spread - (currentScrollP - 0.5) * 160;
        var arcY = Math.pow(norm, 2) * 86 + (1 - currentScrollP) * 24;
        var rot = norm * 14 * (0.75 + currentScrollP * 0.4);
        var sc = 0.94 + (1 - Math.abs(norm)) * 0.08;
        arcCards[i].style.transform =
          "translate3d(calc(-50% + " + shiftX.toFixed(1) + "px), " + arcY.toFixed(1) + "px, 0) rotate(" + rot.toFixed(2) + "deg) scale(" + sc.toFixed(3) + ")";
        arcCards[i].style.zIndex = String(10 - Math.round(Math.abs(norm) * 5));
      }
    }

    if (!isMobile() && portalShell && !reduced) {
      var pr = portalShell.getBoundingClientRect();
      var pp = Math.max(0, Math.min(1, (window.innerHeight - pr.top) / (window.innerHeight * 0.72)));
      var side = (1 - pp) * 5.5;
      var rad = (1 - pp) * 34;
      portalShell.style.clipPath = "inset(0% " + side.toFixed(2) + "% 0% " + side.toFixed(2) + "% round " + rad.toFixed(1) + "px)";
    }

    if (ribbonTrack && !reduced) {
      var rr = ribbonTrack.getBoundingClientRect();
      var rp = (window.innerHeight - rr.top) / (window.innerHeight + rr.height);
      var tx = -rp * 320;
      ribbonTrack.style.transform = "translate3d(" + tx.toFixed(1) + "px, 0, 0)";
    }
  }

  function tick() {
    if (ring) {
      if (!dragging) {
        if (!reduced) {
          angle -= 0.09;
          angle += velocity;
          velocity *= 0.94;
        }
      }
      ring.style.transform = "translateZ(-" + currentRadius + "px) rotateX(-3deg) rotateY(" + angle.toFixed(2) + "deg)";
    }
    updateChoreography();
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  /* 3. SPRING-POP REVIEW CARDS VIA INTERSECTION OBSERVER */
  var popEls = document.querySelectorAll("[data-pop]");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (ent) {
        if (ent.isIntersecting) ent.target.classList.add("in");
      });
    }, { threshold: 0.18 });
    popEls.forEach(function (el) { io.observe(el); });
  } else {
    popEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* 4. LIVE QUOTE BUILDER */
  var jobEl = document.getElementById("qJob");
  var secEl = document.getElementById("qSec");
  var postEl = document.getElementById("qPost");
  var notesEl = document.getElementById("qNotes");
  var prevEl = document.getElementById("qPreview");
  var waBtn = document.getElementById("qWaBtn");
  var mailBtn = document.getElementById("qMailBtn");

  function refreshQuote() {
    if (!jobEl || !secEl || !prevEl) return;
    var post = (postEl && postEl.value.trim()) ? postEl.value.trim().toUpperCase() : "London";
    var notes = (notesEl && notesEl.value.trim()) ? notesEl.value.trim() : "Please let me know your earliest availability and price.";
    var msg = "Hi " + cfg.shortName + ",\\n" +
      "Service: " + jobEl.value + "\\n" +
      cfg.secLabel + ": " + secEl.value + "\\n" +
      "Postcode: " + post + "\\n" +
      "Notes: " + notes;
    prevEl.textContent = msg;
    if (waBtn && cfg.waDigits) {
      waBtn.href = "https://wa.me/" + cfg.waDigits + "?text=" + encodeURIComponent(msg);
    }
    if (mailBtn) {
      mailBtn.href = "mailto:" + encodeURIComponent(cfg.email) +
        "?subject=" + encodeURIComponent("Quote Request: " + jobEl.value + " (" + post + ")") +
        "&body=" + encodeURIComponent(msg);
    }
  }
  [jobEl, secEl, postEl, notesEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener("input", refreshQuote);
    el.addEventListener("change", refreshQuote);
  });
  refreshQuote();

  /* 5. FROSTED-GLASS CARD SHEET & ACTIONS */
  var sheet = document.getElementById("cardSheet");
  var activeCardTitle = "";

  function openSheet(idx) {
    var c = cfg.cards[idx];
    if (!c || !sheet) return;
    activeCardTitle = c.title;
    document.getElementById("sheetImg").src = c.img;
    document.getElementById("sheetImg").alt = c.title;
    document.getElementById("sheetTag").textContent = c.tag;
    document.getElementById("sheetPrice").textContent = c.price;
    document.getElementById("sheetTitle").textContent = c.title;
    document.getElementById("sheetDesc").textContent = c.desc;
    var ul = document.getElementById("sheetBullets");
    ul.innerHTML = "";
    (c.bullets || []).forEach(function (b) {
      var li = document.createElement("li");
      li.textContent = b;
      ul.appendChild(li);
    });
    sheet.classList.add("open");
  }

  function closeSheet() {
    if (sheet) sheet.classList.remove("open");
  }

  if (sheet) {
    sheet.addEventListener("click", function (ev) {
      if (ev.target === sheet) closeSheet();
    });
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeSheet();
  });

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!btn) return;
    var act = btn.getAttribute("data-action");
    if (act === "hide-banner") {
      var b = document.getElementById("previewBanner");
      if (b) b.style.display = "none";
      return;
    }
    if (act === "open-card") {
      if (didDrag && btn.classList.contains("c3d-card")) { didDrag = false; return; }
      openSheet(parseInt(btn.getAttribute("data-idx") || "0", 10));
      return;
    }
    if (act === "close-sheet") {
      closeSheet();
      return;
    }
    if (act === "sheet-to-quote") {
      closeSheet();
      if (jobEl && activeCardTitle) {
        var matched = false;
        for (var i = 0; i < jobEl.options.length; i++) {
          if (jobEl.options[i].value.toLowerCase().indexOf(activeCardTitle.toLowerCase().slice(0, 10)) !== -1) {
            jobEl.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          var o = document.createElement("option");
          o.value = activeCardTitle;
          o.textContent = activeCardTitle;
          jobEl.appendChild(o);
          jobEl.value = activeCardTitle;
        }
        refreshQuote();
      }
      var qTarget = document.getElementById("quote");
      if (qTarget) qTarget.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (act === "claim-site") {
      var origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Opening Stripe £199...";
      fetch("/api/checkout?slug=" + encodeURIComponent(cfg.slug) + "&format=json")
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.url) {
            window.location.href = d.url;
          } else {
            btn.disabled = false;
            btn.textContent = origText;
            alert((d && d.error) || "Checkout unavailable right now — reply YES via WhatsApp or email to claim.");
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = origText;
          alert("Network error — reply YES via WhatsApp or email to claim.");
        });
    }
  });
})();
</script>
</body>
</html>`;
}
