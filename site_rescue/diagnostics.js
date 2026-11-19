/**
 * Play A: Local Business "Dead Booking Link & SSL Cliff" Diagnostics & Recovery Pack Compiler.
 * Runs cleanly inside Cloudflare Workers with SSRF protection and deterministic fix bundles.
 */

import { normalizeTargetOrigin } from "../edge_helpers.js";

const BOOKING_LINK_RE = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const BOOKING_KW = /(book|appoint|consult|schedule|calendly|fresha|cliniko|janeapp|contact|reserve|enquir|intake)/i;
const LD_JSON_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const LOCAL_BIZ_TYPES = new Set([
  "LocalBusiness",
  "Dentist",
  "MedicalClinic",
  "Physician",
  "LegalService",
  "Attorney",
  "RealEstateAgent",
  "HealthAndBeautyBusiness",
  "VeterinaryCare",
  "MedicalBusiness",
  "ProfessionalService",
]);

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasLocalBusinessSchema(html) {
  const matches = html.matchAll(LD_JSON_RE);
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
      for (const item of items) {
        const types = [].concat(item?.["@type"] || []);
        if (types.some((t) => LOCAL_BIZ_TYPES.has(String(t)))) return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export function extractBookingCandidateUrls(html, baseOrigin) {
  const seen = new Set();
  const out = [];
  const originHost = new URL(baseOrigin).hostname.replace(/^www\./, "").toLowerCase();
  for (const m of html.matchAll(BOOKING_LINK_RE)) {
    const rawHref = String(m[1] || "").trim();
    const label = stripTags(m[2] || "");
    if (!rawHref || /^(mailto:|tel:|javascript:)/i.test(rawHref)) continue;
    if (!BOOKING_KW.test(rawHref) && !BOOKING_KW.test(label)) continue;
    try {
      const u = new URL(rawHref, baseOrigin);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      const h = u.hostname.replace(/^www\./, "").toLowerCase();
      // Probe same-domain links + known booking platforms cleanly
      const knownBooking = /(calendly\.com|fresha\.com|cliniko\.com|janeapp\.com|acuityscheduling\.com|setmore\.com|zocdoc\.com)/i.test(h);
      if (h !== originHost && !knownBooking) continue;
      const clean = u.toString();
      if (!seen.has(clean)) {
        seen.add(clean);
        out.push({ url: clean, pathname: u.pathname || "/", label: label.slice(0, 80) || u.pathname });
      }
    } catch {
      continue;
    }
    if (out.length >= 6) break;
  }
  return out;
}

export async function analyzeLocalBusinessSite(rawDomainOrUrl, fetchFn = fetch, hintMeta = {}) {
  const { origin, hostname } = normalizeTargetOrigin(rawDomainOrUrl);
  const httpsUrl = `https://${hostname}/`;
  const httpUrl = `http://${hostname}/`;

  let html = "";
  let finalUrl = httpsUrl;
  let homepageStatus = 0;
  let homepageError = null;
  let httpsRedirectOk = false;

  try {
    const httpRes = await fetchFn(httpUrl, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "SiteRescueAudit/1.0" },
      signal: AbortSignal.timeout(7000),
    });
    const loc = httpRes.headers.get("location") || "";
    httpsRedirectOk = httpRes.status >= 300 && httpRes.status < 400 && loc.toLowerCase().startsWith("https://");
  } catch {
    httpsRedirectOk = false;
  }

  try {
    const res = await fetchFn(httpsUrl, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteRescueAudit/1.0)", Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(9000),
    });
    homepageStatus = res.status;
    finalUrl = res.url || httpsUrl;
    if (res.ok) html = (await res.text()).slice(0, 300000);
  } catch (err) {
    homepageError = String(err?.message || err);
  }

  const hasSchema = html ? hasLocalBusinessSchema(html) : false;
  const bookingCandidates = html ? extractBookingCandidateUrls(html, finalUrl) : [];
  const brokenLinks = [];

  for (const cand of bookingCandidates) {
    try {
      const lr = await fetchFn(cand.url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteRescueAudit/1.0)" },
        signal: AbortSignal.timeout(6000),
      });
      if (lr.status === 404 || lr.status === 410 || lr.status >= 500) {
        brokenLinks.push({ url: cand.url, pathname: cand.pathname, label: cand.label, status: lr.status });
      }
    } catch (err) {
      brokenLinks.push({ url: cand.url, pathname: cand.pathname, label: cand.label, status: 520, error: String(err?.message || "Connection error") });
    }
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const businessName = hintMeta.businessName || (titleMatch ? stripTags(titleMatch[1]).slice(0, 90) : hostname);

  const issues = [];
  if (homepageError) issues.push(`HTTPS connection / SSL handshake failure on ${httpsUrl}: ${homepageError}`);
  if (hintMeta.ssl_days_remaining !== undefined && hintMeta.ssl_days_remaining !== null && String(hintMeta.ssl_days_remaining) !== "") {
    const d = Number(hintMeta.ssl_days_remaining);
    if (!Number.isNaN(d) && d <= 14) {
      issues.push(d <= 0 ? `SSL certificate expired (${d} days remaining)` : `SSL certificate expires in ${d} day(s) — Chrome 'Not Private' warning cliff`);
    }
  }
  for (const b of brokenLinks) {
    issues.push(`Broken booking/contact CTA '${b.label}' (${b.url}) returned HTTP ${b.status}`);
  }
  if (!httpsRedirectOk && homepageStatus > 0) issues.push("Missing HTTP -> HTTPS 301 permanent redirect");
  if (!hasSchema && homepageStatus > 0) issues.push("Missing Google LocalBusiness JSON-LD schema");

  return {
    domain: hostname,
    origin,
    final_url: finalUrl,
    business_name: businessName,
    homepage_status: homepageStatus,
    homepage_error: homepageError,
    https_redirect_ok: httpsRedirectOk,
    has_localbusiness_schema: hasSchema,
    checked_booking_links: bookingCandidates.length,
    broken_links: brokenLinks,
    hint_broken_url: hintMeta.brokenUrl || "",
    ssl_days_remaining: hintMeta.ssl_days_remaining ?? null,
    issues,
  };
}

export function buildSiteRecoveryBundle(diag, tier = "pack") {
  const domain = diag.domain || "example.com";
  const biz = diag.business_name || domain;
  const brokenList = [...(diag.broken_links || [])];
  if (diag.hint_broken_url && !brokenList.some((b) => b.url === diag.hint_broken_url)) {
    try {
      const pu = new URL(diag.hint_broken_url);
      brokenList.push({ url: diag.hint_broken_url, pathname: pu.pathname || "/book-online", label: "Booking / Contact CTA", status: 404 });
    } catch {
      brokenList.push({ url: diag.hint_broken_url, pathname: "/book-online", label: "Booking / Contact CTA", status: 404 });
    }
  }
  const redirectTargets = brokenList.length > 0 ? brokenList : [{ url: `https://${domain}/book-online`, pathname: "/book-online", label: "Sample Broken Booking Path", status: 404 }];

  const csvRows = ["broken_url,broken_path,anchor_label,observed_http_status,recommended_redirect_target,action"];
  for (const b of redirectTargets) {
    const cleanLabel = String(b.label || "").replace(/"/g, '""');
    csvRows.push(`"${b.url}","${b.pathname}","${cleanLabel}",${b.status},"https://${domain}/contact","Add 301 redirect in .htaccess / Nginx / host panel"`);
  }
  if (!diag.https_redirect_ok) {
    csvRows.push(`"http://${domain}/","/","HTTP -> HTTPS","missing_301","https://${domain}/","Enable Always Use HTTPS / 301 redirect"`);
  }

  const htaccessRules = [
    "# Custom Site Recovery Redirects for " + domain,
    "RewriteEngine On",
    "# Force HTTPS for all visitors",
    "RewriteCond %{HTTPS} !=on",
    `RewriteRule ^(.*)$ https://${domain}/$1 [R=301,L]`,
    "",
    "# Repair Broken Booking / Contact URLs",
    ...redirectTargets.map((b) => `Redirect 301 ${b.pathname} /contact`),
    "",
  ].join("\n");

  const nginxRules = [
    `# Nginx Server Redirect Snippet for ${domain}`,
    ...redirectTargets.map((b) => `location = ${b.pathname} {\n    return 301 https://${domain}/contact;\n}`),
    "",
  ].join("\n");

  const localBusinessJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: biz,
      url: `https://${domain}`,
      potentialAction: {
        "@type": "ReserveAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `https://${domain}/contact`,
          actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
        },
        name: "Book Appointment",
      },
    },
    null,
    2,
  );

  const handoffTxt = [
    `====================================================================`,
    `CUSTOM SITE RECOVERY PACK — ${biz.toUpperCase()} (${domain})`,
    `Tier: ${tier === "priority" ? "Priority Async Site Recovery ($149)" : "Custom Site Recovery Pack ($49)"}`,
    `====================================================================`,
    ``,
    `1. WHAT WAS DETECTED`,
    ...(diag.issues && diag.issues.length ? diag.issues.map((i) => `   - ${i}`) : [`   - Ready for HTTPS enforcement, booking URL redirect hygiene, and LocalBusiness schema.`]),
    ``,
    `2. 3-STEP HANDOFF FOR YOUR WEB HOST OR IT SUPPORT`,
    `   Step A (Stop 404 Booking Drop-Offs): Open 03-redirects.htaccess (Apache/cPanel) or 03-nginx-redirects.conf`,
    `          and paste the 301 rules so visitors clicking dead links land immediately on /contact.`,
    `   Step B (Lock SSL / HTTPS): Follow 05-ssl-renewal-checklist.md to renew AutoSSL/Let's Encrypt or proxy via`,
    `          Cloudflare SSL Strict + Always Use HTTPS so browsers never show a red security warning.`,
    `   Step C (Restore Google Maps / Local Pack Trust): Paste 04-localbusiness-schema.jsonld inside your`,
    `          site's <head> wrapper inside a <script type="application/ld+json"> tag.`,
    ``,
    tier === "priority" ? `PRIORITY ASYNC CONCIERGE INCLUDED: Reply or email ak10082247@gmail.com with your receipt session_id for human patch verification.\n` : "",
  ].join("\n");

  const sslChecklist = [
    `# SSL & HTTPS Cliff Recovery Checklist (${domain})`,
    ``,
    `- Detected SSL days remaining hint: ${diag.ssl_days_remaining !== null ? diag.ssl_days_remaining : "Run local OpenSSL / host panel check"}`,
    ``,
    `## Instant Renewal Steps`,
    `1. **cPanel / Shared Host (Bluehost, GoDaddy, SiteGround, Namecheap):**`,
    `   - Open **SSL/TLS Status** -> select \`${domain}\` + \`www.${domain}\` -> click **Run AutoSSL**.`,
    `2. **WordPress Managed Hosts (WP Engine, Kinsta, Flywheel):**`,
    `   - Domains -> SSL -> Toggle **Renew Certificate** and **Force HTTPS**.`,
    `3. **Nginx / Certbot VPS:**`,
    `   \`\`\`bash`,
    `   sudo certbot renew --dry-run && sudo certbot renew && sudo systemctl reload nginx`,
    `   \`\`\``,
    `4. **Cloudflare Edge Shield (Zero-Downtime Backup):**`,
    `   - SSL/TLS -> Encryption mode **Full (strict)** -> Edge Certificates -> Enable **Always Use HTTPS**.`,
    ``,
  ].join("\n");

  const files = {
    "01-EXEC-SUMMARY-FOR-IT.txt": handoffTxt,
    "02-broken-links-audit.csv": csvRows.join("\n") + "\n",
    "03-redirects.htaccess": htaccessRules,
    "03-nginx-redirects.conf": nginxRules,
    "04-localbusiness-schema.jsonld": localBusinessJsonLd,
    "05-ssl-renewal-checklist.md": sslChecklist,
  };
  if (tier === "priority") {
    files["06-priority-recovery-manifest.json"] = JSON.stringify({ tier: "priority_149", domain, business_name: biz, diagnostic: diag }, null, 2);
  }
  return files;
}
