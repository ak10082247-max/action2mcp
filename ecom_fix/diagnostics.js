/**
 * Play B: Shopify & WooCommerce "Google Shopping & Revenue-Leak" Diagnostics & Store Fix Kit Compiler.
 */

import { normalizeTargetOrigin } from "../edge_helpers.js";

const LD_JSON_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const LINK_RE = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const SCRIPTTAG_RE = /asyncLoad[\s\S]{0,1200}?var\s+urls\s*=\s*\[([\s\S]*?)\]/i;

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseJsonLdProducts(html) {
  const products = [];
  for (const m of html.matchAll(LD_JSON_RE)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
      for (const n of nodes) {
        const types = [].concat(n?.["@type"] || []).map(String);
        if (types.includes("Product")) products.push(n);
      }
    } catch {
      continue;
    }
  }
  return products;
}

export function auditProductSchemaAndHtml({ productHtml, expectedPrice, expectedSku, productUrl }) {
  const issues = [];
  const jsonLdProducts = parseJsonLdProducts(productHtml || "");
  if (jsonLdProducts.length === 0) {
    issues.push({ field: "Product JSON-LD", issue: "Missing <script type='application/ld+json'> Product block — Google Shopping rich snippets disabled", url: productUrl });
    return { valid: false, issues, found: null };
  }
  const prod = jsonLdProducts[0];
  const offers = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
  if (!offers || typeof offers !== "object") {
    issues.push({ field: "offers", issue: "Product JSON-LD missing required 'offers' object", url: productUrl });
  } else {
    if (offers.price === undefined || offers.price === "") {
      issues.push({ field: "offers.price", issue: "Missing required Google Merchant offers.price", url: productUrl });
    } else if (expectedPrice !== undefined && expectedPrice !== null) {
      const ldNum = Number.parseFloat(String(offers.price).replace(/[^0-9.]/g, ""));
      const apiNum = Number.parseFloat(String(expectedPrice).replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(ldNum) && !Number.isNaN(apiNum) && Math.abs(ldNum - apiNum) > 0.05) {
        issues.push({
          field: "offers.price",
          issue: `Price mismatch: JSON-LD says ${ldNum} while live catalog API reports ${apiNum} (triggers Google Merchant Center disapproval)`,
          url: productUrl,
        });
      }
    }
    if (!offers.priceCurrency) {
      issues.push({ field: "offers.priceCurrency", issue: "Missing required offers.priceCurrency (e.g. USD/GBP)", url: productUrl });
    }
    if (!offers.availability) {
      issues.push({ field: "offers.availability", issue: "Missing required offers.availability (InStock / OutOfStock)", url: productUrl });
    }
  }
  if (!prod.sku && !prod.gtin && !prod.mpn && !offers?.sku && expectedSku) {
    issues.push({ field: "sku", issue: "Missing product SKU / GTIN / MPN identifier in Product JSON-LD", url: productUrl });
  }
  return { valid: issues.length === 0, issues, found: prod };
}

export async function analyzeEcommerceStore(rawDomainOrUrl, fetchFn = fetch) {
  const { origin, hostname } = normalizeTargetOrigin(rawDomainOrUrl);
  let baseUrl = `https://${hostname}`;
  let platform = "generic";
  let currency = "USD";
  let storeName = hostname;
  let sampleProduct = null;

  let homeHtml = "";
  try {
    const hr = await fetchFn(`${baseUrl}/`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; EcomFixAudit/1.0)" }, signal: AbortSignal.timeout(8000) });
    if (hr.url) {
      const finalOrigin = new URL(hr.url).origin;
      baseUrl = finalOrigin;
    }
    if (hr.ok) homeHtml = (await hr.text()).slice(0, 350000);
  } catch {}

  // Detect Shopify /products.json
  try {
    const sr = await fetchFn(`${baseUrl}/products.json?limit=3`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
    if (sr.ok) {
      const sj = await sr.json().catch(() => null);
      if (sj && Array.isArray(sj.products) && sj.products.length > 0) {
        platform = "shopify";
        const p = sj.products[0];
        const v = (p.variants || [])[0] || {};
        sampleProduct = {
          title: p.title,
          handle: p.handle,
          url: `${baseUrl}/products/${p.handle}`,
          price: v.price || null,
          sku: v.sku || p.handle,
        };
      }
    }
  } catch {}

  // Detect WooCommerce /wp-json/wc/store/v1/products
  if (platform === "generic") {
    try {
      const wr = await fetchFn(`${baseUrl}/wp-json/wc/store/v1/products?per_page=3`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(7000) });
      if (wr.ok) {
        const wj = await wr.json().catch(() => null);
        if (Array.isArray(wj) && wj.length > 0) {
          platform = "woocommerce";
          const p = wj[0];
          const pr = p.prices || {};
          const minor = Number(pr.currency_minor_unit ?? 2);
          currency = pr.currency_code || "USD";
          const livePrice = pr.price ? Number(pr.price) / 10 ** minor : null;
          sampleProduct = {
            title: p.name,
            handle: p.slug,
            url: p.permalink || `${baseUrl}/product/${p.slug}`,
            price: livePrice,
            sku: p.sku || p.slug,
          };
        }
      }
    } catch {}
  }

  const titleMatch = homeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) storeName = stripTags(titleMatch[1]).slice(0, 80);

  if (homeHtml.includes("Shopify.currency")) {
    const cm = homeHtml.match(/"active"\s*:\s*"([A-Z]{3})"/);
    if (cm) currency = cm[1];
  }

  let productIssues = [];
  if (sampleProduct?.url) {
    try {
      const pr = await fetchFn(sampleProduct.url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(7000) });
      if (pr.ok) {
        const pHtml = (await pr.text()).slice(0, 350000);
        const audited = auditProductSchemaAndHtml({
          productHtml: pHtml,
          expectedPrice: sampleProduct.price,
          expectedSku: sampleProduct.sku,
          productUrl: sampleProduct.url,
        });
        productIssues = audited.issues;
      }
    } catch {}
  }

  // Deprecated Shopify ScriptTag check (March 1, 2027 kill date)
  const scriptTags = [];
  const stMatch = homeHtml.match(SCRIPTTAG_RE);
  if (stMatch) {
    const rawList = stMatch[1];
    for (const um of rawList.matchAll(/["']([^"']+)["']/g)) {
      scriptTags.push(um[1].replace(/\\\//g, "/"));
    }
  }

  // Quick sample nav 404 probe (up to 4 same-origin collection/nav links)
  const brokenLinks = [];
  const hostBare = new URL(baseUrl).hostname.replace(/^www\./, "").toLowerCase();
  const candNav = [];
  const seenNav = new Set();
  for (const m of homeHtml.matchAll(LINK_RE)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.hostname.replace(/^www\./, "").toLowerCase() !== hostBare) continue;
      if (!/(\/collections\/|\/products\/|\/pages\/|\/shop)/i.test(u.pathname)) continue;
      const clean = u.toString();
      if (!seenNav.has(clean)) {
        seenNav.add(clean);
        candNav.push({ url: clean, pathname: u.pathname, label: stripTags(m[2]).slice(0, 60) || u.pathname });
      }
      if (candNav.length >= 4) break;
    } catch {}
  }
  for (const nav of candNav) {
    try {
      const nr = await fetchFn(nav.url, { method: "GET", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) });
      if (nr.status === 404 || nr.status === 410 || nr.status >= 500) {
        brokenLinks.push({ url: nav.url, pathname: nav.pathname, label: nav.label, status: nr.status });
      }
    } catch {}
  }

  const allIssues = [
    ...productIssues.map((x) => `${x.field}: ${x.issue}`),
    ...brokenLinks.map((b) => `Broken store link '${b.label}' (${b.pathname}) -> HTTP ${b.status}`),
    ...(scriptTags.length > 0 ? [`Detected ${scriptTags.length} legacy Shopify ScriptTag(s) scheduled for deprecation March 1, 2027`] : []),
  ];

  return {
    domain: hostBare,
    origin,
    base_url: baseUrl,
    platform,
    store_name: storeName,
    currency,
    sample_product: sampleProduct,
    schema_issues: productIssues,
    broken_links: brokenLinks,
    deprecated_script_tags: scriptTags,
    issues: allIssues,
  };
}

export function buildStoreFixBundle(diag, tier = "fix_pack") {
  const domain = diag.domain || "mystore.com";
  const currency = diag.currency || "USD";
  const isWoo = diag.platform === "woocommerce";

  const shopifyLiquid = `{%- comment -%}
  Google Merchant & Shopping Valid Product JSON-LD Snippet for ${domain}
  Upload/paste into Snippets/product-schema-fix.liquid and include with {% render 'product-schema-fix' %} inside sections/main-product.liquid
{%- endcomment -%}
{% if product %}
{% assign current_variant = product.selected_or_first_available_variant %}
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "@id": {{ shop.url | append: product.url | json }},
  "name": {{ product.title | json }},
  "url": {{ shop.url | append: product.url | json }},
  "image": [{% if product.featured_image %}{{ product.featured_image | image_url: width: 1200 | prepend: "https:" | json }}{% endif %}],
  "description": {{ product.description | strip_html | truncate: 500 | json }},
  "sku": {{ current_variant.sku | default: product.id | json }},
  {% if current_variant.barcode != blank %}"gtin": {{ current_variant.barcode | json }},{% endif %}
  "brand": { "@type": "Brand", "name": {{ product.vendor | default: shop.name | json }} },
  "offers": {
    "@type": "Offer",
    "url": {{ shop.url | append: current_variant.url | json }},
    "priceCurrency": {{ cart.currency.iso_code | default: "${currency}" | json }},
    "price": {{ current_variant.price | divided_by: 100.0 }},
    "itemCondition": "https://schema.org/NewCondition",
    "availability": "https://schema.org/{% if current_variant.available %}InStock{% else %}OutOfStock{% endif %}",
    "seller": { "@type": "Organization", "name": {{ shop.name | json }} }
  }
}
</script>
{% endif %}
`;

  const wooPhp = `<?php
/**
 * Google Merchant & Shopping Valid Product JSON-LD Snippet for ${domain}
 * Add via Code Snippets plugin or child-theme functions.php
 */
add_action('wp_head', function () {
    if (!function_exists('is_product') || !is_product()) return;
    global $product;
    if (!$product instanceof WC_Product) return;
    $schema = [
        '@context' => 'https://schema.org/',
        '@type' => 'Product',
        'name' => $product->get_name(),
        'url' => get_permalink($product->get_id()),
        'sku' => $product->get_sku() ?: (string) $product->get_id(),
        'brand' => ['@type' => 'Brand', 'name' => get_bloginfo('name')],
        'offers' => [
            '@type' => 'Offer',
            'priceCurrency' => get_woocommerce_currency() ?: '${currency}',
            'price' => wc_get_price_to_display($product),
            'availability' => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            'url' => get_permalink($product->get_id()),
        ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES) . '</script>' . "\\n";
}, 20);
`;

  const brokenList = diag.broken_links && diag.broken_links.length ? diag.broken_links : [{ pathname: "/collections/sale-archive", url: `https://${domain}/collections/sale-archive`, status: 404, label: "Broken Collection Link" }];
  const redirectsCsv = [
    "Redirect from,Redirect to",
    ...brokenList.map((b) => `"${b.pathname}","/collections/all"`),
  ].join("\n") + "\n";

  const auditRows = ["category,target,finding,severity"];
  for (const si of diag.schema_issues || []) {
    auditRows.push(`"Google Shopping Schema","${si.url || diag.sample_product?.url || domain}","${String(si.issue || "").replace(/"/g, '""')}","high"`);
  }
  for (const bl of diag.broken_links || []) {
    auditRows.push(`"Broken Navigation Link","${bl.url}","HTTP ${bl.status} (${String(bl.label || "").replace(/"/g, '""')})","high"`);
  }
  for (const st of diag.deprecated_script_tags || []) {
    auditRows.push(`"Shopify ScriptTag Deprecation (Mar 1 2027)","${st}","Replace legacy ScriptTag with Shopify Theme App Extension","medium"`);
  }
  if (auditRows.length === 1) {
    auditRows.push(`"Google Shopping & Redirect Hygiene","https://${domain}","Store-specific Liquid/Woo schema + redirect CSV ready for installation","info"`);
  }

  const installGuide = [
    `# Store Fix Kit Installation Guide — ${diag.store_name || domain}`,
    `Detected platform: **${diag.platform}** | Currency: **${currency}** | Tier: **${tier === "pro_kit" ? "Store Fix Kit Pro ($25 Deal, was $79)" : "Store Fix Bundle ($10 Deal, was $49)"}**`,
    ``,
    `## 1. Fix Google Shopping Product Rich Results (2 Minutes)`,
    isWoo
      ? `- Install **01-woocommerce-product-schema.php** inside **Code Snippets -> Add New** (Frontend only) or your child theme \`functions.php\`.`
      : `- Upload **01-product-schema.liquid** into Shopify Admin -> **Online Store -> Themes -> Edit Code -> Snippets -> Add a new snippet** named \`product-schema-fix\`.\n- Inside \`sections/main-product.liquid\`, add \`{% render 'product-schema-fix' %}\` at the bottom and click **Save**.`,
    `- Validate live in Google's Rich Results Test (` + "`https://search.google.com/test/rich-results`" + `).`,
    ``,
    `## 2. Import Broken Link Redirects`,
    `- In Shopify Admin -> **Content -> Menus -> URL Redirects -> Import URL redirects**, upload **02-shopify-url-redirects.csv**.`,
    ``,
    `## 3. Migrate Legacy Shopify ScriptTags (Before March 1, 2027)`,
    ...(diag.deprecated_script_tags?.length ? diag.deprecated_script_tags.map((u) => `- Detected legacy script: \`${u}\` — upgrade app embed to Shopify App Embeds (Online Store 2.0).`) : [`- No blocking legacy ScriptTags detected on the homepage probe (audit full theme checkout scripts if applicable).`]),
    ``,
  ].join("\n");

  const files = {
    [isWoo ? "01-woocommerce-product-schema.php" : "01-product-schema.liquid"]: isWoo ? wooPhp : shopifyLiquid,
    "02-shopify-url-redirects.csv": redirectsCsv,
    "03-revenue-leak-audit.csv": auditRows.join("\n") + "\n",
    "04-INSTALL-GUIDE.md": installGuide,
  };
  if (tier === "pro_kit") {
    files["05-pro-store-diagnostic.json"] = JSON.stringify({ tier: "pro_25", domain, platform: diag.platform, currency, diagnostic: diag }, null, 2);
  }
  return files;
}
