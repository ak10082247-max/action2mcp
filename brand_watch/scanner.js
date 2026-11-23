/**
 * CautionWatch Strict Extractor:
 * Strictly accepts ONLY TikTok videos carrying the official
 * "Caution: Video flagged for unverified content" / "flagged for unverified content"
 * moderation label (via warnInfo, labelTop, contentDesc, riskInfos, video_label, or verified submission).
 */

import { REPO_CAUTION_VIDEOS } from "./seed_caution.js";

const ALLOWED_TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"]);
const UNVERIFIED_CAUTION_RE = /(?:caution:\s*)?(?:video\s+)?flagged\s+for\s+unverified\s+content/i;

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

const TOP_LEVEL_IGNORED_KEYS = new Set([
  "text", "desc", "description", "title", "video_description", "voice_to_text", "voiceToText",
  "transcript", "comments", "hashtags", "hashtag_names", "suggestedWords",
  "diversificationLabels", "author", "authorMeta", "channel", "music",
  "musicMeta", "challenges", "textExtra", "effectStickers", "content_desc", "content_desc_extra",
]);
const NESTED_IGNORED_KEYS = new Set([
  "comments", "hashtags", "hashtag_names", "suggestedWords", "diversificationLabels",
  "author", "authorMeta", "channel", "music", "musicMeta", "challenges", "effectStickers",
  "content_desc", "content_desc_extra",
]);
const WARNING_KEY_RE = /(?:warn|caution|risk|flag|moderation|notice|banner|badge|label|mask|anchor|penalty|verify)/i;

function parseMiscInfoCaution(rawMisc) {
  let obj = rawMisc;
  if (typeof rawMisc === "string") {
    const trimmed = rawMisc.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const ktf = obj.ktf_info;
  if (!ktf || typeof ktf !== "object") return null;
  if (ktf.show_warning === false) return null;
  const warnTemplate = String(ktf.warning_text || ktf.message_text_on_share || "").trim();
  if (!UNVERIFIED_CAUTION_RE.test(warnTemplate)) return null;
  const label = String(ktf.caution_label || "Caution:").trim();
  const formatted = (warnTemplate.includes("%s") ? warnTemplate.replace("%s", label) : warnTemplate)
    .replace(/\s+/g, " ")
    .trim();
  return formatted || "Caution: Video flagged for unverified content.";
}

function collectCandidateWarningStrings(rawItem) {
  const out = [];
  const root = rawItem?.aweme_detail || rawItem?.itemStruct || rawItem?.itemInfo?.itemStruct || rawItem || {};
  const seen = new Set();
  const pushText = (field, text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    const key = `${field}:${clean}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ field, text: clean });
    }
  };
  const scanNode = (field, val, depth = 0) => {
    if (!val || depth > 5) return;
    if (field === "misc_info") {
      const ktfText = parseMiscInfoCaution(val);
      if (ktfText) {
        pushText("misc_info.ktf_info", ktfText);
        return;
      }
      if (typeof val === "string" && val.trim().startsWith("{")) return;
      if (typeof val === "object" && !Array.isArray(val) && val.ktf_info !== undefined) return;
    }
    if (typeof val === "string") {
      if (field === "cautionText" && val.trim().startsWith("{")) {
        const ktfText = parseMiscInfoCaution(val);
        if (ktfText) {
          pushText("misc_info.ktf_info", ktfText);
          return;
        }
      }
      pushText(field, val);
    } else if (Array.isArray(val)) {
      for (const el of val) scanNode(field, el, depth + 1);
    } else if (typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        if (NESTED_IGNORED_KEYS.has(k)) continue;
        if (typeof v === "string") {
          if (["text", "content", "label", "title", "desc", "warning", "msg", "reason"].includes(k) || WARNING_KEY_RE.test(k)) {
            pushText(field, v);
          }
        } else if (v && typeof v === "object") {
          scanNode(field, v, depth + 1);
        }
      }
    }
  };
  for (const field of ["misc_info", "warnInfo", "warningInfo", "riskInfos", "risk_infos", "labelTop", "label_top", "label_top_text", "contentDesc", "video_label", "videoLabel", "video_labels", "cautionLabel", "warningText", "moderationInfo", "flagInfo", "maskInfo", "mask_infos", "warning", "anchors", "badges"]) {
    if (root[field] !== undefined) scanNode(field, root[field]);
    if (rawItem?.[field] !== undefined) scanNode(field, rawItem[field]);
  }
  for (const [k, v] of Object.entries(root)) {
    if (!TOP_LEVEL_IGNORED_KEYS.has(k) && WARNING_KEY_RE.test(k)) {
      scanNode(k, v);
    }
  }
  return out;
}

function extractContentDescFallback(root) {
  const raw = root?.content_desc;
  let arr = raw;
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (Array.isArray(arr)) {
    return arr.map((x) => String(x || "").trim()).filter(Boolean).join(" ").trim();
  }
  return "";
}

/**
 * Strictly extracts normalized Caution-flagged TikTok record ONLY if warning metadata
 * matches "Video flagged for unverified content". Returns null for clean/unrelated videos.
 */
export function extractUnverifiedCautionRecord(rawItem, sourceProvider = "scraper_api") {
  if (!rawItem || typeof rawItem !== "object") return null;
  const root = rawItem.aweme_detail || rawItem.itemStruct || rawItem.itemInfo?.itemStruct || rawItem;
  const candidates = collectCandidateWarningStrings(rawItem);
  const hit = candidates.find((c) => UNVERIFIED_CAUTION_RE.test(c.text));
  if (!hit) return null;

  const videoId = String(root.id || root.aweme_id || root.video_id || root.videoId || "").trim();
  const rawCandidateUrl = String(root.webVideoUrl || root.url || root.share_url || "").trim();
  const urlHandleMatch = rawCandidateUrl.match(/tiktok\.com\/@([^/?#]+)/i);
  const authorMeta = root.authorMeta || root.author || root.channel || {};
  let rawUser = String(
    authorMeta.unique_id ||
      authorMeta.name ||
      authorMeta.username ||
      authorMeta.uniqueId ||
      root.author_username ||
      (root.authorUsername && root.authorUsername !== "unknown" ? root.authorUsername : "") ||
      root.handle ||
      (urlHandleMatch ? urlHandleMatch[1] : "") ||
      "",
  )
    .trim()
    .replace(/^@+/, "");
  if (rawUser.toLowerCase() === "unknown" && urlHandleMatch?.[1]) {
    rawUser = urlHandleMatch[1].trim().replace(/^@+/, "");
  }
  const authorHandle = rawUser ? `@${rawUser}` : "";
  const canonicalFallback = videoId && rawUser ? `https://www.tiktok.com/@${rawUser}/video/${videoId}` : videoId ? `https://www.tiktok.com/video/${videoId}` : "";
  let rawUrl = rawCandidateUrl || canonicalFallback;
  if (/^https?:\/\/[^/]*tiktok\.com\/@[^/?#]+\/video\/\d+/i.test(rawUrl)) {
    rawUrl = rawUrl.split("?")[0];
  } else if (!rawUrl && canonicalFallback) {
    rawUrl = canonicalFallback;
  }
  if (!videoId && !rawUrl) return null;

  const hashtags = (Array.isArray(root.hashtags) ? root.hashtags : Array.isArray(root.hashtag_names) ? root.hashtag_names : Array.isArray(root.cha_list) ? root.cha_list : [])
    .map((h) => (typeof h === "string" ? h : h?.name || h?.title || h?.cha_name || ""))
    .map((x) => String(x).trim().replace(/^#/, ""))
    .filter(Boolean);

  const videoMeta = root.videoMeta || root.video || {};
  const coverStr =
    typeof videoMeta.cover === "string"
      ? videoMeta.cover
      : Array.isArray(videoMeta.cover?.url_list) && videoMeta.cover.url_list[0]
        ? videoMeta.cover.url_list[0]
        : Array.isArray(videoMeta.origin_cover?.url_list) && videoMeta.origin_cover.url_list[0]
          ? videoMeta.origin_cover.url_list[0]
          : "";
  const thumb = String(
    root.thumbnailUrl ||
      root.thumbnail_url ||
      videoMeta.coverUrl ||
      coverStr ||
      authorMeta.avatar ||
      "",
  ).trim() || null;

  const extractedId = videoId || (rawUrl.match(/\/video\/(\d+)/) || [])[1] || rawUrl.slice(-24);
  const resolvedAuthorName = String(
    (root.authorName && root.authorName !== "Unknown creator" ? root.authorName : "") ||
      authorMeta.nickName ||
      authorMeta.nickname ||
      authorMeta.name ||
      rawUser ||
      "Unknown creator",
  ).trim();
  const desc = String(
    root.text || root.desc || root.description || root.video_description || root.title || extractContentDescFallback(root) || "",
  )
    .trim()
    .slice(0, 600);
  const resolvedMatchedField =
    hit.field === "cautionText" && root.matchedField ? String(root.matchedField).trim() : hit.field;

  return {
    id: String(extractedId),
    videoId: String(extractedId),
    sourceType: String(root.sourceType || sourceProvider),
    url: rawUrl,
    playerUrl: /^\d+$/.test(String(extractedId)) ? `https://www.tiktok.com/player/v1/${extractedId}` : null,
    authorUsername: authorHandle || String(authorMeta.nickName || authorMeta.nickname || "unknown"),
    authorName: resolvedAuthorName,
    authorUrl: rawUser ? `https://www.tiktok.com/@${rawUser}` : "",
    description: desc,
    voiceToText: String(root.voice_to_text || root.voiceToText || root.transcript || "").trim().slice(0, 1200),
    hashtags,
    thumbnailUrl: thumb,
    cautionText: hit.text,
    matchedField: resolvedMatchedField,
    brandTag: String(root.brandTag || root.query || "").trim().slice(0, 120),
    capturedAt: String(root.capturedAt || root.createTimeISO || new Date().toISOString()),
  };
}

export async function resolveTikTokOembed(rawUrl, fetchFn = fetch) {
  const { cleanUrl } = validateTikTokVideoUrl(rawUrl);
  const oembedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
  const res = await fetchFn(oembedEndpoint, {
    headers: { "User-Agent": "KuroxCautionWatch/1.0", Accept: "application/json" },
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
  const videoId = String(data.embed_product_id || (idMatch ? idMatch[1] : "")).trim();
  const authorUrl = String(data.author_url || "").trim();
  const handleMatch = authorUrl.match(/tiktok\.com\/(@[^/?#]+)/i) || cleanUrl.match(/tiktok\.com\/(@[^/?#]+)/i);
  return {
    ok: true,
    url: cleanUrl,
    videoId,
    playerUrl: videoId ? `https://www.tiktok.com/player/v1/${videoId}` : null,
    authorName: String(data.author_name || "").trim(),
    authorUsername: handleMatch ? handleMatch[1] : String(data.author_name || "").trim(),
    authorUrl,
    description: String(data.title || "").trim(),
    thumbnailUrl: String(data.thumbnail_url || "").trim() || null,
  };
}

export async function loadCautionFeedEntries(kv, limit = 100) {
  const seen = new Set();
  const entries = [];
  if (kv && typeof kv.get === "function") {
    try {
      const rawIdx = await kv.get("bw:caution:index");
      const ids = rawIdx ? JSON.parse(rawIdx) : [];
      if (Array.isArray(ids) && ids.length > 0) {
        const loaded = await Promise.all(
          ids.slice(0, limit).map(async (id) => {
            try {
              const raw = await kv.get(`bw:caution:item:${id}`);
              return raw ? JSON.parse(raw) : null;
            } catch {
              return null;
            }
          }),
        );
        for (const item of loaded.filter(Boolean)) {
          if (!item?.id || seen.has(item.id)) continue;
          if (!UNVERIFIED_CAUTION_RE.test(String(item.cautionText || ""))) continue;
          seen.add(item.id);
          entries.push(item);
        }
      }
    } catch {
      // Fall through cleanly to bundled repo entries if any
    }
  }
  for (const repoItem of REPO_CAUTION_VIDEOS || []) {
    if (repoItem?.id && !seen.has(repoItem.id) && UNVERIFIED_CAUTION_RE.test(String(repoItem.cautionText || ""))) {
      seen.add(repoItem.id);
      entries.push(repoItem);
    }
  }
  return entries.slice(0, limit);
}

const STOPWORDS = new Set([
  "watch", "what", "happened", "after", "following", "this", "that", "with", "from", "have", "will",
  "your", "they", "them", "been", "were", "when", "where", "which", "about", "into", "more", "some",
  "video", "tiktok", "flagged", "unverified", "content", "caution", "before", "gets", "deleted",
]);

export function buildCautionTagCatalog(entries = []) {
  const tagMap = new Map();
  const bump = (rawTag, type) => {
    const clean = String(rawTag || "").trim();
    if (!clean || clean.length < 2) return;
    const key = clean.toLowerCase();
    const cur = tagMap.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      tagMap.set(key, { tag: clean, type, count: 1 });
    }
  };

  for (const v of entries || []) {
    if (!v || typeof v !== "object") continue;
    for (const h of v.hashtags || []) {
      const cleanH = String(h || "").trim().replace(/^#+/, "");
      if (cleanH) bump(`#${cleanH}`, "hashtag");
    }
    const handle = String(v.authorUsername || "").trim();
    if (handle && handle.toLowerCase() !== "unknown") {
      bump(handle.startsWith("@") ? handle : `@${handle}`, "creator");
    }
    const bt = String(v.brandTag || "").trim();
    if (bt && !bt.toLowerCase().startsWith("apify:") && !bt.toLowerCase().startsWith("local_json")) {
      bump(bt, "topic");
    }
    const textBlob = `${v.description || ""} ${v.voiceToText || ""}`;
    const properMatches = textBlob.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+\b/g) || [];
    for (const phrase of properMatches.slice(0, 5)) {
      if (!STOPWORDS.has(phrase.toLowerCase())) bump(phrase.trim(), "topic");
    }
    const lowerWords = textBlob
      .replace(/#[A-Za-z0-9_]+/g, " ")
      .replace(/[^A-Za-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()));
    for (const w of new Set(lowerWords.slice(0, 8))) {
      const low = w.toLowerCase();
      if (!tagMap.has(low) && !tagMap.has(`#${low}`)) {
        bump(w, "keyword");
      }
    }
  }

  const typeRank = { hashtag: 0, creator: 1, topic: 2, keyword: 3 };
  const searchable_tags = Array.from(tagMap.values())
    .sort((a, b) => b.count - a.count || (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9) || a.tag.localeCompare(b.tag))
    .slice(0, 40);

  const autofill_suggestions = searchable_tags.map((t) => t.tag);
  return { searchable_tags, autofill_suggestions };
}

export async function runCautionOnlyScan(rawQuery, kv = null) {
  const query = String(rawQuery || "").trim().slice(0, 120);
  const qLow = query.toLowerCase();
  const qBare = qLow.replace(/^[#@]+/, "");
  const allCaution = await loadCautionFeedEntries(kv, 100);
  const catalog = buildCautionTagCatalog(allCaution);
  const filtered =
    !qLow || qLow === "tiktok"
      ? allCaution
      : allCaution.filter((v) => {
          const hay = `${v.description || ""} ${v.voiceToText || ""} ${v.authorUsername || ""} ${v.authorName || ""} ${(v.hashtags || []).map((h) => `#${h} ${h}`).join(" ")} ${v.brandTag || ""}`.toLowerCase();
          return hay.includes(qLow) || (qBare.length >= 2 && hay.includes(qBare));
        });

  return {
    ok: true,
    strict_filter: "Caution: Video flagged for unverified content ONLY",
    query: query || "all_flagged_videos",
    scanned_at: new Date().toISOString(),
    total_stored_caution_videos: allCaution.length,
    matched_count: filtered.length,
    searchable_tags: catalog.searchable_tags,
    autofill_suggestions: catalog.autofill_suggestions,
    caution_videos: filtered,
  };
}

export function buildCautionDossier(targetBrand, tier, scanResult, contactNotes = "") {
  const brand = String(targetBrand || scanResult?.query || "Target Watch").trim().slice(0, 120);
  const videos = scanResult?.caution_videos || [];
  const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvRows = [["video_id", "author_username", "caution_label", "matched_field", "description", "voice_to_text", "url", "thumbnail_url", "captured_at"]];
  for (const v of videos) {
    csvRows.push(
      [v.videoId, v.authorUsername, v.cautionText, v.matchedField, v.description, v.voiceToText, v.url, v.thumbnailUrl || "", v.capturedAt || ""].map(csvEsc),
    );
  }
  const briefMd = [
    `# CautionWatch Evidence Dossier: ${brand}`,
    `Filter Mode: STRICT — "Caution: Video flagged for unverified content" ONLY`,
    `Generated: ${new Date().toISOString()}`,
    `Tier: ${tier}`,
    contactNotes ? `Notes: ${contactNotes}` : "",
    "",
    `Matched Flagged Videos: ${videos.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    domain: brand,
    diagnostic: { brand, matched_count: videos.length, scanned_at: scanResult?.scanned_at || new Date().toISOString() },
    files: {
      "flagged-caution-videos.json": JSON.stringify(videos, null, 2),
      "flagged-caution-videos.csv": csvRows.map((r) => r.join(",")).join("\n"),
      "takedown-escalation-brief.md": briefMd,
    },
  };
}
