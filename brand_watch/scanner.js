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
  "text", "desc", "title", "video_description", "voice_to_text", "voiceToText",
  "transcript", "comments", "hashtags", "hashtag_names", "suggestedWords",
  "diversificationLabels", "author", "authorMeta", "channel", "music",
  "musicMeta", "challenges", "textExtra", "effectStickers",
]);
const NESTED_IGNORED_KEYS = new Set([
  "comments", "hashtags", "hashtag_names", "suggestedWords", "diversificationLabels",
  "author", "authorMeta", "channel", "music", "musicMeta", "challenges", "effectStickers",
]);
const WARNING_KEY_RE = /(?:warn|caution|risk|flag|moderation|notice|banner|badge|label|mask|anchor|penalty|verify)/i;

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
    if (typeof val === "string") {
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
  for (const field of ["warnInfo", "warningInfo", "riskInfos", "risk_infos", "labelTop", "contentDesc", "video_label", "videoLabel", "cautionLabel", "warningText", "moderationInfo", "flagInfo", "maskInfo", "warning", "anchors", "badges"]) {
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
  const authorMeta = root.authorMeta || root.author || root.channel || {};
  const rawUser = String(
    authorMeta.name || authorMeta.username || authorMeta.uniqueId || root.author_username || root.handle || "",
  )
    .trim()
    .replace(/^@+/, "");
  const authorHandle = rawUser ? `@${rawUser}` : "";
  const rawUrl = String(
    root.webVideoUrl ||
      root.url ||
      (videoId && rawUser ? `https://www.tiktok.com/@${rawUser}/video/${videoId}` : "") ||
      (videoId ? `https://www.tiktok.com/video/${videoId}` : ""),
  ).trim();
  if (!videoId && !rawUrl) return null;

  const hashtags = (Array.isArray(root.hashtags) ? root.hashtags : Array.isArray(root.hashtag_names) ? root.hashtag_names : [])
    .map((h) => (typeof h === "string" ? h : h?.name || h?.title || ""))
    .map((x) => String(x).trim().replace(/^#/, ""))
    .filter(Boolean);

  const videoMeta = root.videoMeta || root.video || {};
  const thumb = String(
    root.thumbnailUrl ||
      root.thumbnail_url ||
      videoMeta.coverUrl ||
      videoMeta.cover ||
      (Array.isArray(videoMeta.cover?.url_list) ? videoMeta.cover.url_list[0] : "") ||
      authorMeta.avatar ||
      "",
  ).trim() || null;

  const extractedId = videoId || (rawUrl.match(/\/video\/(\d+)/) || [])[1] || rawUrl.slice(-24);
  return {
    id: String(extractedId),
    videoId: String(extractedId),
    sourceType: sourceProvider,
    url: rawUrl,
    playerUrl: /^\d+$/.test(String(extractedId)) ? `https://www.tiktok.com/player/v1/${extractedId}` : null,
    authorUsername: authorHandle || String(authorMeta.nickName || authorMeta.nickname || "unknown"),
    authorName: String(authorMeta.nickName || authorMeta.nickname || authorMeta.name || rawUser || "Unknown creator").trim(),
    authorUrl: rawUser ? `https://www.tiktok.com/@${rawUser}` : "",
    description: String(root.text || root.desc || root.video_description || root.title || "").trim().slice(0, 600),
    voiceToText: String(root.voice_to_text || root.voiceToText || root.transcript || "").trim().slice(0, 1200),
    hashtags,
    thumbnailUrl: thumb,
    cautionText: hit.text,
    matchedField: hit.field,
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

export async function runCautionOnlyScan(rawQuery, kv = null) {
  const query = String(rawQuery || "").trim().slice(0, 120);
  const qLow = query.toLowerCase();
  const allCaution = await loadCautionFeedEntries(kv, 100);
  const filtered =
    !qLow || qLow === "tiktok"
      ? allCaution
      : allCaution.filter((v) =>
          `${v.description || ""} ${v.voiceToText || ""} ${v.authorUsername || ""} ${v.authorName || ""} ${(v.hashtags || []).join(" ")} ${v.brandTag || ""}`
            .toLowerCase()
            .includes(qLow),
        );

  return {
    ok: true,
    strict_filter: "Caution: Video flagged for unverified content ONLY",
    query: query || "all_flagged_videos",
    scanned_at: new Date().toISOString(),
    total_stored_caution_videos: allCaution.length,
    matched_count: filtered.length,
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
