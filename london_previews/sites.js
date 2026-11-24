/**
 * Bespoke, human-crafted, blazing-fast (<25KB, <0.1s) local London business
 * website previews. Each business uses its own authentic visual palette,
 * typography, real verified business facts, real areas/accreditations, and
 * an interactive WhatsApp/email quote estimator. Zero generic AI-slop templates.
 */

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
    shortName: "AT Electric",
    domain: "atelectric.co.uk",
    currentSpeed: "GoDaddy template (© 2022, typos, no quote form)",
    phoneDisplay: "07590 056206",
    phoneTel: "+447590056206",
    waDigits: "447590056206",
    email: "info@atelectric.co.uk",
    area: "North West & Central London",
    badge: "NICEIC Approved Contractor · Reg 616575000",
    theme: {
      bg: "#faf9f5",
      surface: "#ffffff",
      surfaceAlt: "#f2efe8",
      ink: "#14191f",
      muted: "#535c68",
      border: "#dfd9cd",
      heroBg: "#14191f",
      heroInk: "#faf9f5",
      heroMuted: "#c5cbd3",
      accent: "#d97706",
      accentInk: "#ffffff",
      accentSoft: "#fef3c7",
      accentSoftInk: "#92400e",
      headFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: "6px",
    },
    eyebrow: "NICEIC Approved · TrustMark · JIB & ECS Registered",
    headline: "Qualified domestic & commercial electricians across North West and Central London.",
    subhead:
      "EICR landlord certificates, fault finding, three-phase installations, lighting, and emergency call-outs for homes, offices, and retail units — directly from our own NICEIC-approved team.",
    trustStrip: [
      { k: "NICEIC Reg", v: "616575000" },
      { k: "Accreditation", v: "TrustMark & JIB/ECS" },
      { k: "Coverage", v: "NW & Central London" },
      { k: "Sectors", v: "Homes, Retail & Offices" },
    ],
    servicesTitle: "Electrical Services",
    servicesLead: "Every job tested, certified, and carried out by fully qualified electricians — no call-centre middlemen.",
    services: [
      {
        tag: "Compliance",
        title: "Landlord EICR Certificates",
        price: "Fast Turnaround",
        desc: "Electrical Installation Condition Reports for residential landlords, HMOs, and commercial premises with clear remedial quotes if required.",
        bullets: ["Full circuit & earth-fault testing", "Digital NICEIC certificate issued", "Remedial repairs handled directly"],
      },
      {
        tag: "Domestic",
        title: "Home Wiring, Lighting & Consumer Units",
        price: "Free Written Quote",
        desc: "Safe fuse board upgrades (18th Edition), rewiring, indoor/outdoor lighting design, sockets, and domestic fault finding across NW & Central London.",
        bullets: ["Domestic Installer registered", "Clean, tidy workmanship", "Part P compliant sign-off"],
      },
      {
        tag: "Commercial",
        title: "Offices, Retail Units & Three-Phase",
        price: "Out-of-Hours Available",
        desc: "Three-phase power installations, commercial distribution boards, shop-fit lighting, and ongoing maintenance for London businesses.",
        bullets: ["Three-phase installation & testing", "Retail & office electrical fit-outs", "Minimal trading disruption"],
      },
      {
        tag: "Urgent",
        title: "Fault Finding & Emergency Call-Outs",
        price: "Rapid Local Dispatch",
        desc: "Tripping RCDs, dead circuits, burning smells, or sudden power loss diagnosed methodically and repaired safely.",
        bullets: ["Direct electrician response", "Transparent upfront pricing", "North West & Central London"],
      },
    ],
    quoteTitle: "Get a Fast Electrical or EICR Quote",
    quoteLead: "Pick your job type and postcode below — opens a pre-filled WhatsApp or email straight to our engineer.",
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
    reviewsTitle: "Credentials & Peace of Mind",
    reviews: [
      {
        author: "NICEIC Approved Contractor",
        meta: "Registration #616575000",
        quote: "Assessed to the highest industry standards covering both domestic and commercial electrical installations across London.",
      },
      {
        author: "TrustMark Government-Endorsed",
        meta: "Registered Competent Person",
        quote: "Verified technical competence, trading practices, and customer protection on every domestic installation and certificate.",
      },
      {
        author: "JIB & ECS Certified Engineers",
        meta: "Direct Local Contractors",
        quote: "You deal directly with qualified North West London electricians from initial quote through to final testing and certification.",
      },
    ],
    footerNote: "© 2026 AT Electric Contractors Ltd · NICEIC Approved Contractor (616575000) · North West & Central London",
  },

  "washology": {
    slug: "washology",
    name: "Washology Mobile Detailing",
    shortName: "Washology",
    domain: "washologymv.co.uk",
    currentSpeed: "21.5s Wix load (1.64 MB, no WhatsApp or quote builder)",
    phoneDisplay: "07388 725375",
    phoneTel: "+447388725375",
    waDigits: "447388725375",
    email: "Wesley@washologymv.co.uk",
    area: "North London & Surrounding Areas",
    badge: "North London's Highly Rated Mobile Detailer",
    theme: {
      bg: "#f7f6f2",
      surface: "#ffffff",
      surfaceAlt: "#efede6",
      ink: "#121417",
      muted: "#525860",
      border: "#e2dfd6",
      heroBg: "#111316",
      heroInk: "#f8f7f4",
      heroMuted: "#b9bec7",
      accent: "#b58b45",
      accentInk: "#ffffff",
      accentSoft: "#f6efe1",
      accentSoftInk: "#7c5c22",
      headFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: "8px",
    },
    eyebrow: "Mobile Valeting & Detailing · Home or Workplace · North London",
    headline: "Showroom car care brought straight to your driveway or workplace.",
    subhead:
      "From a crisp 30-minute deep refresh to meticulous 4–5 hour paint correction and ceramic coating — delivered across North London using finest-grade, eco-conscious products.",
    trustStrip: [
      { k: "Service", v: "100% Mobile to You" },
      { k: "Sessions", v: "30 Min to 5 Hours" },
      { k: "Products", v: "Finest Grade & Eco" },
      { k: "Base", v: "North London & Beyond" },
    ],
    servicesTitle: "Valeting & Detailing Packages",
    servicesLead: "Choose the level of care your vehicle needs — from regular upkeep to full multi-stage gloss restoration.",
    services: [
      {
        tag: "Most Popular",
        title: "Mobile Deep Clean",
        price: "Home or Workplace",
        desc: "Thorough exterior safe wash and meticulous interior reset designed to bring daily drivers back to crisp, fresh condition.",
        bullets: ["Safe multi-stage exterior wash", "Full cabin vacuum, trim & glass care", "Zero waiting or garage drop-offs"],
      },
      {
        tag: "Gloss Boost",
        title: "Paint Enhancement",
        price: "Single-Stage Polish",
        desc: "Machine refinement that removes light wash marring and haze, restoring deep clarity and crisp reflections before protection.",
        bullets: ["Full decontamination & clay bar", "Single-stage machine gloss polish", "Durable hydrophobic sealant"],
      },
      {
        tag: "Restoration",
        title: "Multi-Stage Paint Correction",
        price: "Swirl & Defect Removal",
        desc: "Precision multi-stage machine compounding and finishing to level swirl marks, oxidation, and deeper paint defects.",
        bullets: ["Dedicated multi-hour machine work", "Safe paint depth assessment", "Prepared for ceramic protection"],
      },
      {
        tag: "Protection",
        title: "Ceramic Coating",
        price: "Long-Term Shield",
        desc: "Professional-grade ceramic protection locking in deep gloss while repelling road grime, UV fade, and rain for easy maintenance washes.",
        bullets: ["High-grade ceramic chemistry", "Extreme water beading & gloss", "Protects paintwork year-round"],
      },
    ],
    quoteTitle: "Book or Price Your Mobile Detail in 30 Seconds",
    quoteLead: "Select your package and vehicle size — sends a clean pre-filled WhatsApp message straight to Wesley on 07388 725375.",
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
    reviewsTitle: "What North London Drivers Say",
    reviews: [
      {
        author: "Sarah P.",
        meta: "Verified Client · 5.0 ★",
        quote: "Wesley was friendly and efficient and washed it like it was his own car, with attention and detail. Highly recommend Washology for a thorough and quality car wash!",
      },
      {
        author: "Zoe F.",
        meta: "Verified Client · 5.0 ★",
        quote: "Washology truly exceeded my expectations — their customer service was exceptional, from streamlined communication to accommodating my schedule.",
      },
      {
        author: "Stephan H.",
        meta: "Verified Client · 5.0 ★",
        quote: "Excellent service. Arrived bang on time and did a fantastic job. I used to think that I kept my car clean but Wesley has put me to shame... I'll definitely use Washology in future.",
      },
    ],
    footerNote: "© 2026 Washology Mobile Valeting & Detailing · North London · 07388 725375 · Wesley@washologymv.co.uk",
  },

  "thermwise": {
    slug: "thermwise",
    name: "Thermwise Limited",
    shortName: "Thermwise",
    domain: "thermwise.co.uk",
    currentSpeed: "8.8s Wix load (1.85 MB, no WhatsApp or callback form)",
    phoneDisplay: "020 3962 0533",
    phoneTel: "+442039620533",
    waDigits: "",
    email: "info@thermwise.co.uk",
    area: "North, West & Central London + Hertfordshire",
    badge: "Gas Safe Registered #597272 · 24/7 Engineers",
    theme: {
      bg: "#fdfbf7",
      surface: "#ffffff",
      surfaceAlt: "#f3efe7",
      ink: "#102133",
      muted: "#4d5d6e",
      border: "#ddd6c9",
      heroBg: "#0f2942",
      heroInk: "#fdfbf7",
      heroMuted: "#c4d4e3",
      accent: "#c94a27",
      accentInk: "#ffffff",
      accentSoft: "#fdece7",
      accentSoftInk: "#932f14",
      headFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: "6px",
    },
    eyebrow: "24/7 Emergency Plumbing, Boilers & Gas · Family-Run · No Middlemen",
    headline: "London's heating & plumbing engineers, at your door within the hour.",
    subhead:
      "Boiler breakdowns, fixed-price boiler installations, gas safety certificates, leaks, and heating repairs across North, West & Central London — handled strictly by our own Gas Safe engineers.",
    trustStrip: [
      { k: "Gas Safe Reg", v: "#597272" },
      { k: "Track Record", v: "8,000+ Jobs Done" },
      { k: "Experience", v: "7+ Years Family-Run" },
      { k: "Warranty", v: "12-Month Guarantee" },
    ],
    servicesTitle: "One Local Team for Your Whole Home",
    servicesLead: "Unlike agencies that pass your job to whoever is free, Thermwise sends our own engineers from diagnosis to sign-off.",
    services: [
      {
        tag: "24/7 Emergency",
        title: "Emergency Boiler Breakdown & Repair",
        price: "Within the Hour",
        desc: "No heating, no hot water, fault codes, or pressure drops diagnosed fast day or night across North, West & Central London.",
        bullets: ["24/7 emergency callout engineers", "All major boiler brands serviced", "12-month workmanship guarantee"],
      },
      {
        tag: "Fixed Price",
        title: "New Boiler Installations",
        price: "Fixed Quote Upfront",
        desc: "Honest fixed-price boiler replacements sized properly for your home, installed neatly with full Gas Safe registration.",
        bullets: ["Clear upfront fixed quotation", "Old unit removed & flushed", "Gas Safe #597272 notified"],
      },
      {
        tag: "Gas Safe",
        title: "Gas Leaks, Cookers & CP12 Certificates",
        price: "Homeowners & Landlords",
        desc: "Urgent gas leak tracing, hob and cooker installations, and annual Landlord Gas Safety Certificates.",
        bullets: ["Emergency gas leak response", "Landlord CP12 inspections", "Gas Safe registered engineers"],
      },
      {
        tag: "Plumbing & Heating",
        title: "Leaks, Pipes, Radiators & Blockages",
        price: "Same-Day Service",
        desc: "Burst pipes, dripping taps, toilets, cold radiators, hot water cylinders, drainage blockages, and domestic electrics.",
        bullets: ["Fast leak isolation & repair", "Radiator balancing & valves", "Clean, respectful home engineers"],
      },
    ],
    quoteTitle: "Request an Emergency Engineer or Fixed Boiler Quote",
    quoteLead: "Need someone urgently? Tap to call 020 3962 0533 now — or send your issue & postcode below for a priority callback.",
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
    reviewsTitle: "Why 8,000+ London Homes Choose Thermwise",
    reviews: [
      {
        author: "4.3 ★ on Google",
        meta: "Hundreds of London Customers",
        quote: "Backed by hundreds of verified London homeowner and landlord reviews across North, West, and Central London.",
      },
      {
        author: "Our Own Engineers — Zero Middlemen",
        meta: "Family-Run for 7+ Years",
        quote: "When you call Thermwise, you speak directly to our family-run dispatch team — never a national call centre subcontracting your home.",
      },
      {
        author: "12-Month Guarantee on Workmanship",
        meta: "Gas Safe Registered #597272",
        quote: "Every boiler repair, installation, and plumbing fix is backed by our written 12-month guarantee for complete peace of mind.",
      },
    ],
    footerNote: "© 2026 Thermwise Limited · Gas Safe Registered #597272 · 020 3962 0533 · info@thermwise.co.uk",
  },

  "wish-wash": {
    slug: "wish-wash",
    name: "Wish Wash Valeting & Detailing",
    shortName: "Wish Wash",
    domain: "wish-wash.co.uk",
    currentSpeed: "4.8s Wix load (1.33 MB, no inline booking form)",
    phoneDisplay: "+44 7763 453883",
    phoneTel: "+447763453883",
    waDigits: "447763453883",
    email: "info@wish-wash.co.uk",
    area: "London — Home or Office Driveway",
    badge: "12+ Years Experience · Own Water & Power",
    theme: {
      bg: "#f5f8fb",
      surface: "#ffffff",
      surfaceAlt: "#eaf1f7",
      ink: "#0f2236",
      muted: "#4f6478",
      border: "#d5e0ea",
      heroBg: "#0d3457",
      heroInk: "#ffffff",
      heroMuted: "#bdd3e8",
      accent: "#0d9488",
      accentInk: "#ffffff",
      accentSoft: "#ccfbf1",
      accentSoftInk: "#115e59",
      headFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      bodyFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: "10px",
    },
    eyebrow: "12+ Years Mobile Valeting · Own Water & Power Supply · London",
    headline: "Showroom mobile car valeting & detailing at your doorstep.",
    subhead:
      "We come straight to your home or office fully equipped with our own water and power supply — transparent package pricing from £43 with zero hassle and zero mess.",
    trustStrip: [
      { k: "Experience", v: "12+ Years" },
      { k: "Setup Needed", v: "None (Own Water & Power)" },
      { k: "Pricing", v: "Clear From £43" },
      { k: "Location", v: "Home or Office" },
    ],
    servicesTitle: "Transparent Valeting & Detailing Packages",
    servicesLead: "No guesswork — pick the exact package you want below and tap to book your preferred date on WhatsApp.",
    services: [
      {
        tag: "Essential",
        title: "Exterior Wash & Protect",
        price: "£43 – £49",
        desc: "Safe hand wash and protective wax finish ideal for regular upkeep without risking drive-through scratches.",
        bullets: ["Pre-wash rinse & wheel wash", "Microfibre mitt hand wash & soft towel dry", "Protective wax, glass clean & tyre dressing"],
      },
      {
        tag: "Most Popular",
        title: "Mini Valet Plus",
        price: "£59 – £69",
        desc: "Complete exterior wash & wax paired with a thorough cabin reset covering carpets, seats, boot, and dashboard.",
        bullets: ["Full Exterior Wash & Protect included", "Deep interior vacuum (mats, carpets, seats, boot)", "Dashboard, plastics & interior windows cleaned"],
      },
      {
        tag: "Showroom Gloss",
        title: "Detail Exterior (SiO2)",
        price: "£70 – £80",
        desc: "Enthusiast-grade safe wash featuring snow foam, 3-bucket method, and Ultragloss SiO2 ceramic-infused exterior protection.",
        bullets: ["Deep pre-wash rinse & pH-neutral snow foam", "3-bucket hand wash + wheel protection", "Ultragloss SiO2 glass/paint + ceramic tyre shine"],
      },
      {
        tag: "Deep Restoration",
        title: "Upholstery & Machine Polishing",
        price: "Custom Quote",
        desc: "Deep seat/carpet stain extraction, odour removal, and machine polishing tailored to your vehicle's paint condition.",
        bullets: ["Hot-water interior upholstery extraction", "Machine gloss enhancement", "Own onboard power & water"],
      },
    ],
    quoteTitle: "Book Your Mobile Valet Slot in 20 Seconds",
    quoteLead: "Choose your package and car size below — opens a pre-filled WhatsApp message directly to +44 7763 453883.",
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
    reviewsTitle: "Customer Feedback",
    reviews: [
      {
        author: "S. Ottmann",
        meta: "Verified Long-Term Customer · 5.0 ★",
        quote: "Simple to book — I've had many a car cleaned, this was exceptional. The standard is higher than I've ever seen, my car is brand new again. I cannot recommend this company enough, I will now remain a long term customer.",
      },
      {
        author: "12+ Years Hands-On Experience",
        meta: "Premium Selected Products",
        quote: "Over a decade refining safe wash methods and selecting paint-safe chemistry so your vehicle gets genuine showroom results every visit.",
      },
      {
        author: "100% Self-Contained Van",
        meta: "Own Water & Electricity",
        quote: "Park at home or work and carry on with your day — we bring our own water tank and power supply with zero mess left behind.",
      },
    ],
    footerNote: "© 2026 Wish Wash Valeting & Detailing · London · +44 7763 453883 · info@wish-wash.co.uk",
  },

  "visuals-detailing": {
    slug: "visuals-detailing",
    name: "Visuals Valeting & Detailing",
    shortName: "Visuals Detailing",
    domain: "visualsdetailing.co.uk",
    currentSpeed: "5.8–13.2s Wix load (1.30 MB, no quote calculator)",
    phoneDisplay: "+44 7859 743762",
    phoneTel: "+447859743762",
    waDigits: "447859743762",
    email: "visualsdetailing@gmail.com",
    area: "London, Surrey & 5 Surrounding Counties",
    badge: "5.0 ★ Rated · Mobile From £35 · Own Power & Water",
    theme: {
      bg: "#f4f1ea",
      surface: "#ffffff",
      surfaceAlt: "#eae4d7",
      ink: "#15231c",
      muted: "#4d5c54",
      border: "#d8d0c0",
      heroBg: "#17382b",
      heroInk: "#f7f4ec",
      heroMuted: "#c2d4ca",
      accent: "#9c7a3c",
      accentInk: "#ffffff",
      accentSoft: "#f3ebd9",
      accentSoftInk: "#6d5322",
      headFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      radius: "6px",
    },
    eyebrow: "5.0 ★ Mobile Car Detailing · Own Power & Water · London & Surrey",
    headline: "Showroom finish delivered directly to your driveway.",
    subhead:
      "Valets from £35, Stage 1 & Stage 2 paint correction, and wheels-off ceramic coating across London, Surrey, and the Home Counties — we bring our own power and water, so there's nothing to set up and nowhere to drive.",
    trustStrip: [
      { k: "Rating", v: "5.0 ★ Customer Rated" },
      { k: "Valets From", v: "£35 at Your Door" },
      { k: "Equipment", v: "Own Power & Water" },
      { k: "Coverage", v: "7 Areas Covered" },
    ],
    servicesTitle: "Three Ways We Look After Your Car",
    servicesLead: "Every visit is tailored around your vehicle and carried out cleanly on your own driveway or workplace.",
    services: [
      {
        tag: "From £35",
        title: "Everyday Care & Maintenance Valets",
        price: "From £35",
        desc: "Regular maintenance washes through to full interior deep cleans — keeping daily drivers spotless without leaving home.",
        bullets: ["Safe snow foam & hand wash", "Full interior deep clean options", "Own power & water onboard"],
      },
      {
        tag: "Protection & Finish",
        title: "Paint Enhancement & Ceramic Coating",
        price: "Wheels-Off Options",
        desc: "Machine paint enhancement, wheels-off ceramic coating, and dedicated leather protection using pro-grade chemistry.",
        bullets: ["Wheels-off ceramic coating", "Interior leather protection", "Deep hydrophobic gloss"],
      },
      {
        tag: "Restoration",
        title: "Stage 1 & Stage 2 Paint Correction",
        price: "Tailored Quote",
        desc: "Multi-stage machine correction removing swirls, dullness, and surface defects to restore crisp mirror depth.",
        bullets: ["Stage 1 single-step refinement", "Stage 2 deeper defect correction", "Ideal pre-sale or new-car prep"],
      },
      {
        tag: "Add-Ons",
        title: "Targeted Detailing Upgrades",
        price: "Mix & Match",
        desc: "Combine glass rain-repellent coatings, engine bay dressing, pet hair removal, or fabric protection with any booking.",
        bullets: ["Custom add-on menu", "Multi-car household discounts", "Flexible driveway scheduling"],
      },
    ],
    quoteTitle: "Get Your Instant Driveway Quote",
    quoteLead: "Pick your package and county below — pre-fills a direct WhatsApp message to +44 7859 743762 with zero back-and-forth.",
    quoteJobs: [
      "Maintenance Wash / Everyday Valet (from £35)",
      "Full Interior & Exterior Deep Clean",
      "Stage 1 Paint Enhancement",
      "Stage 2 Multi-Stage Paint Correction",
      "Wheels-Off Ceramic Coating & Leather Protection",
    ],
    quoteSecondaryLabel: "Your Location",
    quoteSecondaryOptions: ["London / Hounslow", "Surrey", "Berkshire", "Buckinghamshire", "Hampshire / Hertfordshire"],
    areas: ["London", "Hounslow", "Surrey", "Berkshire", "Buckinghamshire", "Hampshire", "Hertfordshire"],
    reviewsTitle: "Built Around Convenience & Craft",
    reviews: [
      {
        author: "5.0 ★ Rated Across London & Surrey",
        meta: "Verified Driveway Detailing",
        quote: "Consistent 5-star feedback from everyday commuters and prestige car owners across all 7 coverage areas.",
      },
      {
        author: "Zero Garage Hassle",
        meta: "Own Power & Water Supply",
        quote: "We never ask for your tap or extension lead — our fully equipped mobile unit arrives ready to deliver showroom results on your driveway.",
      },
      {
        author: "Pro-Grade Correction & Coating Chemistry",
        meta: "Stage 1, Stage 2 & Wheels-Off Ceramic",
        quote: "The same pro-grade polishing compounds and ceramic coatings trusted on multi-stage restorations, applied right at your door.",
      },
    ],
    footerNote: "© 2026 Visuals Valeting & Detailing · London & Surrey · +44 7859 743762 · visualsdetailing@gmail.com",
  },
};

export function renderClientSiteHtml(site, { clean = false } = {}) {
  const t = site.theme;
  const waHref = site.waDigits
    ? `https://wa.me/${site.waDigits}?text=${encodeURIComponent(`Hi ${site.shortName}, I'd like a quick quote please.`)}`
    : `mailto:${encodeURIComponent(site.email)}?subject=${encodeURIComponent(`Quote Request — ${site.shortName}`)}`;
  const primaryContactLabel = site.waDigits ? "WhatsApp Quote" : "Request Callback";

  const previewBar = clean
    ? ""
    : `<div id="previewBanner" class="pv-bar" role="region" aria-label="Website preview banner">
  <div class="pv-inner">
    <div class="pv-copy">
      <span class="pv-pill">LIVE PREVIEW</span>
      <span>Built for <strong>${escapeHtml(site.name)}</strong> · Loads in <strong>&lt;0.1s</strong> (replaces ${escapeHtml(site.currentSpeed)}) · <strong>£199 one-time</strong>, £0/mo hosting, 100% text/email handover.</span>
    </div>
    <div class="pv-actions">
      <button type="button" class="pv-buy" data-action="claim-site" data-slug="${escapeHtml(site.slug)}">Claim &amp; Go Live — £199</button>
      <button type="button" class="pv-close" data-action="hide-banner" aria-label="Hide preview banner">Hide</button>
    </div>
  </div>
</div>`;

  const servicesHtml = site.services
    .map(
      (s) => `<article class="svc-card">
      <div class="svc-top">
        <span class="svc-tag">${escapeHtml(s.tag)}</span>
        <span class="svc-price">${escapeHtml(s.price)}</span>
      </div>
      <h3>${escapeHtml(s.title)}</h3>
      <p>${escapeHtml(s.desc)}</p>
      <ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
      <button type="button" class="svc-pick" data-action="pick-service" data-service="${escapeHtml(s.title)}">Select for Quick Quote →</button>
    </article>`
    )
    .join("");

  const trustHtml = site.trustStrip
    .map(
      (item) => `<div class="trust-cell">
      <div class="trust-k">${escapeHtml(item.k)}</div>
      <div class="trust-v">${escapeHtml(item.v)}</div>
    </div>`
    )
    .join("");

  const reviewsHtml = site.reviews
    .map(
      (r) => `<blockquote class="rev-card">
      <p>“${escapeHtml(r.quote)}”</p>
      <footer><strong>${escapeHtml(r.author)}</strong><span>${escapeHtml(r.meta)}</span></footer>
    </blockquote>`
    )
    .join("");

  const areasHtml = site.areas.map((a) => `<span class="area-chip">${escapeHtml(a)}</span>`).join("");

  const jobOptionsHtml = site.quoteJobs.map((j) => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join("");
  const secOptionsHtml = site.quoteSecondaryOptions.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(site.name)} | ${escapeHtml(site.area)}</title>
<meta name="description" content="${escapeHtml(site.subhead)}">
<style>
  :root {
    --bg: ${t.bg};
    --surface: ${t.surface};
    --surface-alt: ${t.surfaceAlt};
    --ink: ${t.ink};
    --muted: ${t.muted};
    --border: ${t.border};
    --hero-bg: ${t.heroBg};
    --hero-ink: ${t.heroInk};
    --hero-muted: ${t.heroMuted};
    --accent: ${t.accent};
    --accent-ink: ${t.accentInk};
    --accent-soft: ${t.accentSoft};
    --accent-soft-ink: ${t.accentSoftInk};
    --radius: ${t.radius};
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: ${t.bodyFont};
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 68px;
  }
  h1, h2, h3 { font-family: ${t.headFont}; line-height: 1.18; margin: 0; letter-spacing: -0.015em; }
  a { color: inherit; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }

  .pv-bar {
    position: sticky; top: 0; z-index: 90;
    background: #111827; color: #f9fafb; border-bottom: 2px solid #f59e0b;
    font-size: 13px; line-height: 1.4;
  }
  .pv-inner {
    max-width: 1120px; margin: 0 auto; padding: 10px 16px;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  }
  .pv-copy { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pv-pill {
    background: #f59e0b; color: #111827; font-weight: 800; font-size: 10px;
    letter-spacing: 0.08em; padding: 3px 7px; border-radius: 4px;
  }
  .pv-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .pv-buy {
    background: #10b981; color: #052e16; border: 0; border-radius: 5px;
    padding: 7px 13px; font-weight: 800; font-size: 13px; cursor: pointer;
  }
  .pv-buy:hover { filter: brightness(1.06); }
  .pv-close {
    background: transparent; color: #d1d5db; border: 1px solid #4b5563;
    border-radius: 5px; padding: 6px 10px; font-size: 12px; cursor: pointer;
  }

  .nav {
    background: var(--hero-bg); color: var(--hero-ink);
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .nav-inner {
    display: flex; align-items: center; justify-content: space-between;
    gap: 14px; padding: 16px 20px; max-width: 1080px; margin: 0 auto;
  }
  .brand { font-family: ${t.headFont}; font-weight: 700; font-size: 19px; text-decoration: none; }
  .brand small { display: block; font-family: ${t.bodyFont}; font-size: 11px; color: var(--hero-muted); font-weight: 500; margin-top: 2px; }
  .nav-links { display: flex; align-items: center; gap: 18px; font-size: 14px; }
  .nav-links a { text-decoration: none; color: var(--hero-muted); }
  .nav-links a:hover { color: var(--hero-ink); }
  .nav-cta {
    background: var(--accent); color: var(--accent-ink) !important;
    padding: 9px 15px; border-radius: var(--radius); font-weight: 700; white-space: nowrap;
  }

  .hero {
    background: var(--hero-bg); color: var(--hero-ink);
    padding: 54px 0 48px;
  }
  .hero-grid { display: grid; grid-template-columns: 1.35fr 0.85fr; gap: 36px; align-items: start; }
  .eyebrow {
    display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--hero-ink);
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
    padding: 5px 11px; border-radius: 999px; margin-bottom: 18px;
  }
  .hero h1 { font-size: clamp(30px, 4.4vw, 46px); margin-bottom: 16px; }
  .hero-sub { font-size: 17px; color: var(--hero-muted); max-width: 600px; margin: 0 0 26px; }
  .hero-btns { display: flex; flex-wrap: wrap; gap: 12px; }
  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--accent); color: var(--accent-ink); text-decoration: none;
    padding: 13px 22px; border-radius: var(--radius); font-weight: 700; font-size: 15px; border: 0; cursor: pointer;
  }
  .btn-primary:hover { filter: brightness(1.06); }
  .btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: rgba(255,255,255,0.08); color: var(--hero-ink); text-decoration: none;
    padding: 13px 20px; border-radius: var(--radius); font-weight: 600; font-size: 15px;
    border: 1px solid rgba(255,255,255,0.22);
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.14); }

  .hero-card {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    border-radius: var(--radius); padding: 22px;
  }
  .hero-card h2 { font-size: 18px; margin-bottom: 10px; color: var(--hero-ink); }
  .hero-card p { margin: 0 0 14px; font-size: 14px; color: var(--hero-muted); }
  .direct-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.12); font-size: 14px;
  }
  .direct-row span { color: var(--hero-muted); }
  .direct-row strong, .direct-row a { color: var(--hero-ink); font-weight: 700; text-decoration: none; }

  .trust-strip { background: var(--surface); border-bottom: 1px solid var(--border); }
  .trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
  .trust-cell { padding: 18px 16px; border-right: 1px solid var(--border); }
  .trust-cell:last-child { border-right: 0; }
  .trust-k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; }
  .trust-v { font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 3px; }

  section.block { padding: 56px 0; }
  section.alt { background: var(--surface-alt); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .sec-head { max-width: 680px; margin-bottom: 28px; }
  .sec-head h2 { font-size: clamp(24px, 3.2vw, 34px); margin-bottom: 8px; }
  .sec-head p { margin: 0; color: var(--muted); font-size: 16px; }

  .svc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
  .svc-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 24px; display: flex; flex-direction: column;
  }
  .svc-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; }
  .svc-tag {
    background: var(--accent-soft); color: var(--accent-soft-ink);
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 4px 9px; border-radius: 4px;
  }
  .svc-price { font-size: 14px; font-weight: 800; color: var(--ink); }
  .svc-card h3 { font-size: 20px; margin-bottom: 8px; }
  .svc-card p { margin: 0 0 14px; color: var(--muted); font-size: 14.5px; }
  .svc-card ul { margin: 0 0 18px; padding-left: 18px; color: var(--ink); font-size: 14px; }
  .svc-card li { margin-bottom: 5px; }
  .svc-pick {
    margin-top: auto; align-self: flex-start;
    background: transparent; color: var(--ink); border: 1px solid var(--border);
    padding: 8px 13px; border-radius: var(--radius); font-size: 13.5px; font-weight: 700; cursor: pointer;
  }
  .svc-pick:hover { border-color: var(--ink); background: var(--surface-alt); }

  .quote-box {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start;
  }
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 5px; color: var(--ink); }
  .field input, .field select, .field textarea {
    width: 100%; padding: 11px 12px; font: inherit; font-size: 15px;
    border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); color: var(--ink);
  }
  .field textarea { min-height: 76px; resize: vertical; }
  .quote-summary {
    background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 22px;
  }
  .quote-summary h3 { font-size: 19px; margin-bottom: 8px; }
  .quote-summary p { font-size: 14px; color: var(--muted); margin: 0 0 16px; }
  .msg-preview {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 13px; font-size: 13.5px; white-space: pre-wrap; color: var(--ink); margin-bottom: 16px;
  }
  .quote-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .btn-outline {
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--surface); color: var(--ink); border: 1px solid var(--ink);
    padding: 12px 18px; border-radius: var(--radius); font-weight: 700; font-size: 14px; text-decoration: none; cursor: pointer;
  }

  .rev-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .rev-card {
    margin: 0; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px; display: flex; flex-direction: column;
  }
  .rev-card p { margin: 0 0 16px; font-size: 14.5px; color: var(--ink); }
  .rev-card footer { margin-top: auto; border-top: 1px solid var(--border); padding-top: 12px; }
  .rev-card footer strong { display: block; font-size: 14px; }
  .rev-card footer span { font-size: 12.5px; color: var(--muted); }

  .areas-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .area-chip {
    background: var(--surface); border: 1px solid var(--border);
    padding: 7px 13px; border-radius: 999px; font-size: 13.5px; font-weight: 600;
  }

  .site-footer {
    border-top: 1px solid var(--border); padding: 28px 0 40px;
    font-size: 13.5px; color: var(--muted);
  }
  .sticky-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 80;
    background: var(--hero-bg); border-top: 1px solid rgba(255,255,255,0.16);
    padding: 10px 14px; display: none; gap: 10px;
  }
  .sticky-bar a {
    flex: 1; text-align: center; text-decoration: none; font-weight: 700;
    font-size: 14px; padding: 11px 10px; border-radius: var(--radius);
  }
  .sticky-call { background: rgba(255,255,255,0.12); color: #ffffff; border: 1px solid rgba(255,255,255,0.22); }
  .sticky-wa { background: var(--accent); color: var(--accent-ink); }

  @media (max-width: 820px) {
    .hero-grid, .svc-grid, .quote-box, .rev-grid { grid-template-columns: 1fr; }
    .trust-grid { grid-template-columns: repeat(2, 1fr); }
    .trust-cell { border-bottom: 1px solid var(--border); }
    .nav-links .hide-sm { display: none; }
    .sticky-bar { display: flex; }
  }
</style>
</head>
<body>
${previewBar}

<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="#top">${escapeHtml(site.name)}<small>${escapeHtml(site.badge)}</small></a>
    <nav class="nav-links" aria-label="Primary">
      <a class="hide-sm" href="#services">Services</a>
      <a class="hide-sm" href="#quote">Quick Quote</a>
      <a class="hide-sm" href="#areas">Areas</a>
      <a class="nav-cta" href="tel:${escapeHtml(site.phoneTel)}">${escapeHtml(site.phoneDisplay)}</a>
    </nav>
  </div>
</header>

<main id="top">
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <div class="eyebrow">${escapeHtml(site.eyebrow)}</div>
        <h1>${escapeHtml(site.headline)}</h1>
        <p class="hero-sub">${escapeHtml(site.subhead)}</p>
        <div class="hero-btns">
          <a class="btn-primary" href="#quote">${escapeHtml(primaryContactLabel)} →</a>
          <a class="btn-ghost" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)}</a>
        </div>
      </div>
      <aside class="hero-card">
        <h2>Direct Local Contact</h2>
        <p>Speak straight to the team serving ${escapeHtml(site.area)} — fast quotes, clear scheduling, zero runaround.</p>
        <div class="direct-row"><span>Telephone</span><a href="tel:${escapeHtml(site.phoneTel)}">${escapeHtml(site.phoneDisplay)}</a></div>
        <div class="direct-row"><span>Email</span><a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a></div>
        <div class="direct-row"><span>Coverage</span><strong>${escapeHtml(site.area)}</strong></div>
      </aside>
    </div>
  </section>

  <div class="trust-strip">
    <div class="wrap trust-grid">${trustHtml}</div>
  </div>

  <section id="services" class="block">
    <div class="wrap">
      <div class="sec-head">
        <h2>${escapeHtml(site.servicesTitle)}</h2>
        <p>${escapeHtml(site.servicesLead)}</p>
      </div>
      <div class="svc-grid">${servicesHtml}</div>
    </div>
  </section>

  <section id="quote" class="block alt">
    <div class="wrap">
      <div class="sec-head">
        <h2>${escapeHtml(site.quoteTitle)}</h2>
        <p>${escapeHtml(site.quoteLead)}</p>
      </div>
      <div class="quote-box">
        <div>
          <div class="field">
            <label for="qJob">Service Needed</label>
            <select id="qJob">${jobOptionsHtml}</select>
          </div>
          <div class="field">
            <label for="qSec">${escapeHtml(site.quoteSecondaryLabel)}</label>
            <select id="qSec">${secOptionsHtml}</select>
          </div>
          <div class="field">
            <label for="qPost">London Postcode</label>
            <input id="qPost" type="text" placeholder="e.g. NW6, W4, N12" maxlength="16">
          </div>
          <div class="field">
            <label for="qNotes">Quick Details (optional)</label>
            <textarea id="qNotes" placeholder="Preferred day/time or brief details..."></textarea>
          </div>
        </div>
        <div class="quote-summary">
          <h3>Your Ready-to-Send Enquiry</h3>
          <p>Everything below updates live — tap once to send directly to ${escapeHtml(site.shortName)}.</p>
          <div id="qPreview" class="msg-preview"></div>
          <div class="quote-actions">
            ${
              site.waDigits
                ? `<a id="qWaBtn" class="btn-primary" target="_blank" rel="noopener" href="${escapeHtml(waHref)}">Send via WhatsApp →</a>`
                : `<a id="qCallBtn" class="btn-primary" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)} →</a>`
            }
            <a id="qMailBtn" class="btn-outline" href="mailto:${escapeHtml(site.email)}">Send by Email</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="wrap">
      <div class="sec-head">
        <h2>${escapeHtml(site.reviewsTitle)}</h2>
      </div>
      <div class="rev-grid">${reviewsHtml}</div>
    </div>
  </section>

  <section id="areas" class="block alt">
    <div class="wrap">
      <div class="sec-head">
        <h2>Areas We Cover</h2>
        <p>Local coverage across ${escapeHtml(site.area)}.</p>
      </div>
      <div class="areas-list">${areasHtml}</div>
    </div>
  </section>
</main>

<footer class="site-footer">
  <div class="wrap">${escapeHtml(site.footerNote)}</div>
</footer>

<div class="sticky-bar">
  <a class="sticky-call" href="tel:${escapeHtml(site.phoneTel)}">Call ${escapeHtml(site.phoneDisplay)}</a>
  <a class="sticky-wa" href="#quote">${escapeHtml(primaryContactLabel)}</a>
</div>

<script>
(function () {
  var cfg = ${JSON.stringify({
    slug: site.slug,
    shortName: site.shortName,
    email: site.email,
    waDigits: site.waDigits,
    secLabel: site.quoteSecondaryLabel,
  })};

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

  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!btn) return;
    var act = btn.getAttribute("data-action");
    if (act === "hide-banner") {
      var b = document.getElementById("previewBanner");
      if (b) b.style.display = "none";
      return;
    }
    if (act === "pick-service") {
      var svc = btn.getAttribute("data-service") || "";
      if (jobEl && svc) {
        var found = false;
        for (var i = 0; i < jobEl.options.length; i++) {
          if (jobEl.options[i].value.toLowerCase().indexOf(svc.toLowerCase().slice(0, 12)) !== -1) {
            jobEl.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) {
          var opt = document.createElement("option");
          opt.value = svc;
          opt.textContent = svc;
          jobEl.appendChild(opt);
          jobEl.value = svc;
        }
        refreshQuote();
      }
      var qSecEl = document.getElementById("quote");
      if (qSecEl) qSecEl.scrollIntoView({ behavior: "smooth" });
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
