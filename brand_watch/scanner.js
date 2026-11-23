/**
 * BrandWatch Extraction Engine:
 * Combines Google Fact Check Explorer, Google News Rumor/Hoax RSS,
 * public urlscan.io TikTok index, official TikTok oEmbed resolution,
 * and KV-backed App Caution Watch submissions (zero CAPTCHA bypass).
 */

const ALLOWED_TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"]);

const CAUTION_CUE_RULES = [
  { label: "unverified claim cue", weight: 22, re: /\b(unverified|caution|flagged|fact[\s-]?check|misleading)\b/i },
  { label: "scripted/staged conspiracy hook", weight: 20, re: /(not following the script|scripted|maskedtruth|staged|they don'?t want you to see|before (?:it|they) delete)/i },
  { label: "impersonation / fake announcement", weight: 22, re: /\b(deepfake|ai[\s-]?generated|altered video|fake|hoax|impersonat|scam)\b/i },
  { label: "physical harm / dangerous act cue", weight: 18, re: /(could result in you or others getting hurt|leaked|exposed|caught on camera|arrested|retired)/i },
  { label: "financial / crypto bait", weight: 16, re: /\b(airdrop|giveaway|claim now|dm me|double your|guaranteed return)\b/i },
];

export function decodeXmlEntities(raw) {
  return String(raw || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

export function validateTikTokVideoUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) throw Object.assign(new Error("TikTok video URL is required."), { httpStatus: 400 });
  const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw Object.assign(new Error("Invalid TikTok URL format."), { httpStatus: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw Object.assign(new Error("Only http/https TikTok URLs are permitted."), { httpStatus: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_TIKTOK_HOSTS.has(host)) {
    throw Object.assign(new Error("Host must be a valid tiktok.com domain."), { httpStatus: 403 });
  }
  const cleanUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  return { cleanUrl, host, pathname: parsed.pathname };
}

export function scoreCaptionRisk(text, extraTags = []) {
  const hay = `${String(text || "")} ${[].concat(extraTags || []).join(" ")}`.trim();
  let riskScore = 0;
  const matchedCues = [];
  for (const rule of CAUTION_CUE_RULES) {
    if (rule.re.test(hay)) {
      riskScore += rule.weight;
      matchedCues.push(rule.label);
    }
  }
  riskScore = Math.min(100, riskScore);
  const riskTier = riskScore >= 50 ? "high" : riskScore >= 20 ? "elevated" : "low";
  return { riskScore, riskTier, matchedCues };
}

export async function fetchGoogleFactChecks(query, fetchFn = fetch, limit = 10) {
  const cleanQ = String(query || "tiktok").trim().slice(0, 120) || "tiktok";
  const url = `https://toolbox.google.com/factcheck/api/search?query=${encodeURIComponent(cleanQ)}&num_results=${Math.min(20, Math.max(1, limit))}`;
  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": "KuroxBrandWatch/1.0", Accept: "application/json,text/plain,*/*" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    let txt = await res.text();
    if (txt.startsWith(")]}'")) {
      const nl = txt.indexOf("\n");
      txt = nl >= 0 ? txt.slice(nl + 1) : txt.slice(4);
    }
    const data = JSON.parse(txt);
    const rows = data?.[0]?.[1];
    if (!Array.isArray(rows)) return [];
    const out = [];
    for (const row of rows.slice(0, limit)) {
      const core = row?.[0];
      if (!Array.isArray(core)) continue;
      const claimText = String(core[0] || "").trim();
      const claimants = Array.isArray(core[1]) ? core[1].map((x) => String(x || "").trim()).filter(Boolean) : [];
      const firstRev = Array.isArray(core[3]) && Array.isArray(core[3][0]) ? core[3][0] : null;
      const pubMeta = Array.isArray(firstRev?.[0]) ? firstRev[0] : [];
      const publisher = String(pubMeta[0] || pubMeta[1] || "Fact-Checker").trim();
      const reviewUrl = String(firstRev?.[1] || "").trim();
      const verdict = String(firstRev?.[3] || "Reviewed").trim();
      const reviewTitle = String(firstRev?.[8] || claimText).trim();
      const tsSec = Number(firstRev?.[2] || core[2] || 0);
      const publishedAt = Number.isFinite(tsSec) && tsSec > 0 ? new Date(tsSec * 1000).toISOString() : null;
      const tiktokMatch = JSON.stringify(row).match(/https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i);
      out.push({
        sourceType: "google_factcheck",
        claimText: claimText.slice(0, 280),
        claimant: claimants[0] || null,
        publisher,
        verdict,
        reviewTitle: reviewTitle.slice(0, 220),
        reviewUrl,
        thumbnailUrl: typeof row?.[1] === "string" ? row[1] : null,
        linkedTikTokUrl: tiktokMatch ? tiktokMatch[0] : null,
        publishedAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchGoogleNewsRumors(query, fetchFn = fetch, limit = 8) {
  const cleanQ = String(query || "").trim().slice(0, 100);
  const fullQ = cleanQ
    ? `"${cleanQ}" (tiktok OR "unverified" OR hoax OR fake OR deepfake OR impersonation)`
    : '("unverified content" OR "altered video" OR hoax) tiktok';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(fullQ)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": "KuroxBrandWatch/1.0", Accept: "application/rss+xml,application/xml,text/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
      if (items.length >= limit) break;
      const block = m[1] || "";
      const title = decodeXmlEntities((block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
      const link = decodeXmlEntities((block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "");
      const pubDate = decodeXmlEntities((block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "");
      const source = decodeXmlEntities((block.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || "");
      if (!title || !link) continue;
      items.push({ sourceType: "news_rumor", title: title.slice(0, 220), url: link, pubDate, source: source || "Google News" });
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchUrlscanTikTokUrls(brandQuery, fetchFn = fetch, limit = 6) {
  const tok = String(brandQuery || "")
    .replace(/[^a-zA-Z0-9 _@-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.toLowerCase() !== "tiktok")
    .slice(0, 2);
  const q = tok.length
    ? `page.domain:tiktok.com AND page.url:"/video/" AND (${tok.map((t) => `"${t}"`).join(" OR ")})`
    : `page.domain:tiktok.com AND page.url:"/video/"`;
  const url = `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(q)}&size=18`;
  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": "KuroxBrandWatch/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const seen = new Set();
    const urls = [];
    for (const row of data.results || []) {
      const rawU = String(row?.page?.url || row?.task?.url || "").trim();
      const m = rawU.match(/https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[^/?#]+\/video\/\d+/i);
      if (!m) continue;
      const canonical = m[0].replace(/^http:/i, "https://").replace(/\/\/m\.tiktok\.com/i, "//www.tiktok.com");
      if (!seen.has(canonical)) {
        seen.add(canonical);
        urls.push(canonical);
        if (urls.length >= limit) break;
      }
    }
    return urls;
  } catch {
    return [];
  }
}

export async function resolveTikTokOembed(rawUrl, fetchFn = fetch) {
  const { cleanUrl } = validateTikTokVideoUrl(rawUrl);
  const oembedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
  const res = await fetchFn(oembedEndpoint, {
    headers: { "User-Agent": "KuroxBrandWatch/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`TikTok oEmbed returned HTTP ${res.status} (clip unavailable or private)`), {
      httpStatus: res.status === 404 ? 404 : 502,
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!data || (!data.title && !data.author_name && !data.html)) {
    throw Object.assign(new Error("TikTok oEmbed returned empty metadata"), { httpStatus: 422 });
  }
  const idMatch = cleanUrl.match(/\/video\/(\d+)/) || String(data.html || "").match(/\/player\/v1\/(\d+)/);
  const videoId = data.embed_product_id || (idMatch ? idMatch[1] : null);
  const authorUrl = String(data.author_url || "").trim();
  const handleMatch = authorUrl.match(/tiktok\.com\/(@[^/?#]+)/i) || cleanUrl.match(/tiktok\.com\/(@[^/?#]+)/i);
  const captionRisk = scoreCaptionRisk(`${data.title || ""} ${data.author_name || ""}`);
  return {
    ok: true,
    sourceType: "tiktok_oembed",
    url: cleanUrl,
    videoId,
    playerUrl: videoId ? `https://www.tiktok.com/player/v1/${videoId}` : null,
    authorName: String(data.author_name || "").trim(),
    handle: handleMatch ? handleMatch[1] : null,
    authorUrl,
    title: String(data.title || "").trim(),
    thumbnailUrl: String(data.thumbnail_url || "").trim() || null,
    captionRisk,
  };
}

export async function loadQueueEntries(kv, limit = 25) {
  if (!kv || typeof kv.get !== "function") return [];
  try {
    const rawIdx = await kv.get("bw:queue:index");
    const ids = rawIdx ? JSON.parse(rawIdx) : [];
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const slice = ids.slice(0, limit);
    const loaded = await Promise.all(
      slice.map(async (id) => {
        try {
          const item = await kv.get(`bw:queue:item:${id}`);
          return item ? JSON.parse(item) : null;
        } catch {
          return null;
        }
      }),
    );
    return loaded.filter(Boolean);
  } catch {
    return [];
  }
}

export async function runBrandRumorScan(rawQuery, fetchFn = fetch, kv = null) {
  const query = String(rawQuery || "").trim().slice(0, 120);
  const fcQuery = query || "tiktok";
  const [factChecks, newsRumors, indexedUrls, queuedItems] = await Promise.all([
    fetchGoogleFactChecks(fcQuery, fetchFn, 10),
    fetchGoogleNewsRumors(query, fetchFn, 8),
    fetchUrlscanTikTokUrls(query, fetchFn, 5),
    loadQueueEntries(kv, 25),
  ]);

  // Also resolve any TikTok URLs embedded inside fact-checks alongside urlscan results
  const extraUrls = factChecks.map((f) => f.linkedTikTokUrl).filter(Boolean);
  const candidateUrls = [...new Set([...extraUrls, ...indexedUrls])].slice(0, 4);
  const oembedSettled = await Promise.allSettled(candidateUrls.map((u) => resolveTikTokOembed(u, fetchFn)));
  const tiktokClips = oembedSettled.filter((r) => r.status === "fulfilled").map((r) => r.value);

  const qLow = query.toLowerCase();
  const matchedWatchlist = qLow
    ? queuedItems.filter((it) => `${it.title || ""} ${it.handle || ""} ${it.brandTag || ""} ${it.cautionLabel || ""}`.toLowerCase().includes(qLow))
    : queuedItems;

  return {
    ok: true,
    query: query || "tiktok (global feed)",
    scanned_at: new Date().toISOString(),
    coverage_notice:
      "TikTok public oEmbed & Research APIs do not expose an internal 'Caution: unverified content' query filter. This monitor combines live Google Fact Check Explorer debunks, Google News hoax/unverified tracking, urlscan.io indexed TikTok URLs resolved via official TikTok oEmbed, and operator/community-verified Caution Watch entries.",
    counts: {
      caution_watchlist: matchedWatchlist.length,
      fact_checks: factChecks.length,
      news_rumors: newsRumors.length,
      tiktok_oembeds: tiktokClips.length,
    },
    caution_watchlist: matchedWatchlist,
    fact_checks: factChecks,
    news_rumors: newsRumors,
    tiktok_clips: tiktokClips,
  };
}

export function buildBrandWatchDossier(targetBrand, tier, scanResult, contactNotes = "") {
  const brand = String(targetBrand || scanResult?.query || "Target Brand").trim().slice(0, 120);
  const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvRows = [["source_type", "label_or_verdict", "handle_or_publisher", "title_or_claim", "url", "date"]];
  for (const w of scanResult?.caution_watchlist || []) {
    csvRows.push([w.sourceType || "caution_watch", w.cautionLabel || "Caution Flagged", w.handle || w.authorName || "", w.title || "", w.url || "", w.submittedAt || ""].map(csvEsc));
  }
  for (const fc of scanResult?.fact_checks || []) {
    csvRows.push([fc.sourceType, fc.verdict, fc.publisher, fc.claimText || fc.reviewTitle, fc.reviewUrl, fc.publishedAt || ""].map(csvEsc));
  }
  for (const n of scanResult?.news_rumors || []) {
    csvRows.push([n.sourceType, "News Signal", n.source, n.title, n.url, n.pubDate || ""].map(csvEsc));
  }
  for (const c of scanResult?.tiktok_clips || []) {
    csvRows.push([c.sourceType, `CaptionRisk:${c.captionRisk?.riskTier || "low"}`, c.handle || c.authorName, c.title, c.url, ""].map(csvEsc));
  }

  const briefMd = [
    `# BrandWatch Risk & Unverified-Content Dossier: ${brand}`,
    `Generated: ${new Date().toISOString()}`,
    `Package Tier: ${tier}`,
    contactNotes ? `Client Notes: ${contactNotes}` : "",
    "",
    `## Summary Counts`,
    `- Verified App Caution Submissions: ${(scanResult?.caution_watchlist || []).length}`,
    `- Fact-Check Debunk Records: ${(scanResult?.fact_checks || []).length}`,
    `- Breaking Rumor / Hoax News Hits: ${(scanResult?.news_rumors || []).length}`,
    `- Indexed TikTok Clips (Live oEmbed): ${(scanResult?.tiktok_clips || []).length}`,
    "",
    `## Escalation & Takedown Next Steps`,
    `1. Review flagged @handles and exact video IDs in flagged-claims-and-videos.csv.`,
    `2. Submit platform impersonation / misinformation / safety reports citing verified URLs + Fact-Check links.`,
    `3. Email your B2B case ID & target handles to armkhan18@gmail.com for ongoing watch automation.`,
  ]
    .filter(Boolean)
    .join("\n");

  const playbookTxt = [
    "BrandWatch B2B Monitoring & Reporting Playbook",
    "==============================================",
    "1. Pair automated ClaimReview + Google News rumor polling with the 1-click Caution Bookmarklet during PR spikes.",
    "2. Archive oEmbed JSON snapshots and fact-check URLs before creators delete disputed posts.",
    "3. Route executive impersonation / AI-altered video claims via official TikTok IP & Impersonation reporting portals.",
  ].join("\n");

  return {
    domain: brand,
    diagnostic: {
      brand,
      counts: scanResult?.counts || {},
      scanned_at: scanResult?.scanned_at || new Date().toISOString(),
    },
    files: {
      "brand-watch-dossier.json": JSON.stringify(scanResult, null, 2),
      "flagged-claims-and-videos.csv": csvRows.map((r) => r.join(",")).join("\n"),
      "takedown-and-pr-brief.md": briefMd,
      "monitoring-playbook.txt": playbookTxt,
    },
  };
}
