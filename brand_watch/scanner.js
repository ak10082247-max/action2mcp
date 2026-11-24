/**
 * CautionWatch Strict Extractor:
 * Strictly accepts ONLY TikTok videos carrying the official
 * "Caution: Video flagged for unverified content" / "flagged for unverified content"
 * moderation label (via warnInfo, labelTop, contentDesc, riskInfos, video_label, or verified submission).
 */

import { REPO_CAUTION_VIDEOS } from "./seed_caution.js";

const ALLOWED_TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"]);
const UNVERIFIED_CAUTION_RE = /(?:caution:\s*)?(?:video\s+)?flagged\s+for\s+unverified\s+content/i;
const INACCURATE_CAUTION_RE = /(?:caution:\s*may\s+contain\s+inaccurate\s+information|check\s+your\s+sources\s+before\s+sharing|sharing\s+is\s+limited\s+to\s+one\s+chat\s+at\s+a\s+time)/i;
export const ANY_CAUTION_MISINFO_RE = /(?:(?:caution:\s*)?(?:video\s+)?flagged\s+for\s+unverified\s+content|caution:\s*may\s+contain\s+inaccurate\s+information|check\s+your\s+sources\s+before\s+sharing|sharing\s+is\s+limited\s+to\s+one\s+chat\s+at\s+a\s+time)/i;

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

export function validateTikTokHandle(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    throw Object.assign(new Error("TikTok account @handle is required."), { httpStatus: 400 });
  }
  let candidate = "";
  if (/^https?:\/\//i.test(input) || /^(?:www\.|m\.|vt\.|vm\.)?tiktok\.com\//i.test(input)) {
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      throw Object.assign(new Error("Invalid TikTok profile URL format."), { httpStatus: 400 });
    }
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_TIKTOK_HOSTS.has(host)) {
      throw Object.assign(new Error("Host must be a valid tiktok.com domain."), { httpStatus: 403 });
    }
    const match = parsed.pathname.match(/\/@([A-Za-z0-9_.]{2,35})/);
    if (!match) {
      throw Object.assign(new Error("Could not extract a @handle from the TikTok URL."), { httpStatus: 400 });
    }
    candidate = match[1];
  } else {
    candidate = input.replace(/^@+/, "").split(/[/?#\s]/)[0].trim();
  }
  if (!/^[A-Za-z0-9_.]{2,35}$/.test(candidate) || !/[A-Za-z0-9]/.test(candidate)) {
    throw Object.assign(new Error("Invalid TikTok @handle format. Enter a valid handle such as @maskedtruthmt."), { httpStatus: 400 });
  }
  const handle = candidate.toLowerCase();
  return {
    handle,
    displayHandle: `@${handle}`,
    profileUrl: `https://www.tiktok.com/@${handle}`,
  };
}

export const DEFAULT_MONITORED_ACCOUNTS = [
  {
    handle: "maskedtruthmt",
    displayHandle: "@maskedtruthmt",
    profileUrl: "https://www.tiktok.com/@maskedtruthmt",
    secUid: "MS4wLjABAAAA4e-S2p91SKsAejwZszUQxOb-YWR3zMqunn7mIVEqLFpi0DU7dduxfZ0Z52DPMWgr",
    status: "inspected",
    videosInspected: 59,
    cautionFoundCount: 7,
    brandTag: "Anthony Joshua / Viral Claims",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T18:10:00.000Z",
    lastInspectedAt: "2026-11-24T12:38:00.000Z",
  },
  {
    handle: "zaikinternational",
    displayHandle: "@zaikinternational",
    profileUrl: "https://www.tiktok.com/@zaikinternational",
    status: "inspected",
    videosInspected: 1,
    cautionFoundCount: 1,
    brandTag: "Exposed / Check Sources Caution",
    source: "apify_aweme_consolidated",
    reportedAt: "2026-11-24T12:38:00.000Z",
    lastInspectedAt: "2026-11-24T12:38:00.000Z",
  },
  {
    handle: "godwin_je",
    displayHandle: "@godwin_je",
    profileUrl: "https://www.tiktok.com/@godwin_je",
    status: "inspected",
    videosInspected: 1,
    cautionFoundCount: 1,
    brandTag: "Anthony Joshua Case Watch",
    source: "apify_aweme_consolidated",
    reportedAt: "2026-11-24T12:38:00.000Z",
    lastInspectedAt: "2026-11-24T12:38:00.000Z",
  },
  {
    handle: "tragicallyromantic",
    displayHandle: "@tragicallyromantic",
    profileUrl: "https://www.tiktok.com/@tragicallyromantic",
    status: "inspected",
    videosInspected: 1,
    cautionFoundCount: 1,
    brandTag: "Emergency Alert System Hoax",
    source: "apify_aweme_consolidated",
    reportedAt: "2026-11-24T12:38:00.000Z",
    lastInspectedAt: "2026-11-24T12:38:00.000Z",
  },
  {
    handle: "james_a_williams_",
    displayHandle: "@james_a_williams_",
    profileUrl: "https://www.tiktok.com/@james_a_williams_",
    status: "inspected",
    videosInspected: 1,
    cautionFoundCount: 1,
    brandTag: "Emergency Alert System Hoax",
    source: "apify_aweme_consolidated",
    reportedAt: "2026-11-24T12:38:00.000Z",
    lastInspectedAt: "2026-11-24T12:38:00.000Z",
  },
  {
    handle: "renatalaria022",
    displayHandle: "@renatalaria022",
    profileUrl: "https://www.tiktok.com/@renatalaria022",
    status: "inspected",
    videosInspected: 1,
    cautionFoundCount: 1,
    brandTag: "Emergency Alert System Hoax",
    source: "apify_aweme_consolidated",
    reportedAt: "2026-11-24T12:38:00.000Z",
    lastInspectedAt: "2026-11-24T12:38:00.000Z",
  },
  {
    handle: "maskedtruthnews",
    displayHandle: "@maskedtruthnews",
    profileUrl: "https://www.tiktok.com/@maskedtruthnews",
    status: "inspected",
    videosInspected: 161,
    cautionFoundCount: 0,
    brandTag: "Unverified News Claims",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T19:35:00.000Z",
    lastInspectedAt: "2026-11-23T19:49:18.000Z",
  },
  {
    handle: "unmasked_truth101",
    displayHandle: "@unmasked_truth101",
    profileUrl: "https://www.tiktok.com/@unmasked_truth101",
    status: "inspected",
    videosInspected: 123,
    cautionFoundCount: 0,
    brandTag: "Viral Rumor Watch",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T19:35:00.000Z",
    lastInspectedAt: "2026-11-23T19:49:18.000Z",
  },
  {
    handle: "th3.mask3d.truth",
    displayHandle: "@th3.mask3d.truth",
    profileUrl: "https://www.tiktok.com/@th3.mask3d.truth",
    status: "inspected",
    videosInspected: 101,
    cautionFoundCount: 0,
    brandTag: "Viral Rumor Watch",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T19:35:00.000Z",
    lastInspectedAt: "2026-11-23T19:49:18.000Z",
  },
  {
    handle: "vfortruths",
    displayHandle: "@vfortruths",
    profileUrl: "https://www.tiktok.com/@vfortruths",
    status: "inspected",
    videosInspected: 28,
    cautionFoundCount: 0,
    brandTag: "Unverified Claims Watch",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T19:35:00.000Z",
    lastInspectedAt: "2026-11-23T19:49:18.000Z",
  },
  {
    handle: "masterysoulreality",
    displayHandle: "@masterysoulreality",
    profileUrl: "https://www.tiktok.com/@masterysoulreality",
    status: "inspected",
    videosInspected: 8,
    cautionFoundCount: 0,
    brandTag: "Viral Claims Watch",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T20:05:00.000Z",
    lastInspectedAt: "2026-11-23T20:07:20.000Z",
  },
  {
    handle: ".masked.truth",
    displayHandle: "@.masked.truth",
    profileUrl: "https://www.tiktok.com/@.masked.truth",
    status: "inspected",
    videosInspected: 6,
    cautionFoundCount: 0,
    brandTag: "Viral Claims Watch",
    source: "apify_aweme_profile_scan",
    reportedAt: "2026-11-23T20:05:00.000Z",
    lastInspectedAt: "2026-11-23T20:07:20.000Z",
  },
];

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
  const ktf = obj.ktf_info && typeof obj.ktf_info === "object" ? obj.ktf_info : null;
  const tns = obj.tns_im_info && typeof obj.tns_im_info === "object" ? obj.tns_im_info : null;
  const shareLimited = Boolean(
    ktf && (ktf.label_category === 1 || /sharing\s+is\s+limited\s+to\s+one\s+chat/i.test(String(ktf.label_title || ""))),
  );

  // 1. Primary strict tag: "Caution: Video flagged for unverified content."
  if (ktf && ktf.show_warning !== false) {
    const warnTemplate = String(ktf.warning_text || ktf.message_text_on_share || "").trim();
    if (UNVERIFIED_CAUTION_RE.test(warnTemplate)) {
      const label = String(ktf.caution_label || "Caution:").trim();
      const formatted = (warnTemplate.includes("%s") ? warnTemplate.replace("%s", label) : warnTemplate)
        .replace(/\s+/g, " ")
        .trim();
      return {
        text: formatted || "Caution: Video flagged for unverified content.",
        matchedField: "misc_info.ktf_info",
        cautionCategory: "unverified_content",
        shareLimited,
      };
    }
    // 2. Active KTF warning banner ("Check your sources before sharing")
    if (ktf.show_warning === true && warnTemplate) {
      const label = String(ktf.caution_label || "Caution:").trim();
      const formatted = (warnTemplate.includes("%s") ? warnTemplate.replace("%s", label) : `${label} ${warnTemplate}`)
        .replace(/\s+/g, " ")
        .trim();
      return {
        text: formatted,
        matchedField: "misc_info.ktf_info",
        cautionCategory: "inaccurate_info",
        shareLimited,
      };
    }
  }

  // 3. Sister TikTok misinformation Caution tag: tns_im_info ("Caution: May contain inaccurate information.")
  if (tns) {
    const tnsLabel = String(tns.caution_label || "").trim();
    const tnsThumb = String(tns.thumbnail_label || "").trim();
    if (/^caution$/i.test(tnsLabel) && /inaccurate\s+information/i.test(tnsThumb)) {
      const suffix = shareLimited ? " (Sharing limited to 1 chat)" : "";
      return {
        text: `Caution: May contain inaccurate information.${suffix}`,
        matchedField: shareLimited ? "misc_info.ktf_info+tns_im_info" : "misc_info.tns_im_info",
        cautionCategory: "inaccurate_info",
        shareLimited,
      };
    }
  }
  return null;
}

export function extractStitchDuetParentIds(rawItem) {
  if (!rawItem || typeof rawItem !== "object") return [];
  const root = unwrapAwemeRoot(rawItem);
  const parents = new Set();
  for (const key of ["duet_from_id", "stitch_from_id", "duetFromId", "stitchFromId", "original_item_id", "react_from_id"]) {
    for (const src of [root, rawItem]) {
      const v = String(src?.[key] || "").trim();
      if (v && v !== "0" && /^\d{15,21}$/.test(v)) parents.add(v);
    }
  }
  return Array.from(parents);
}

function unwrapAwemeRoot(rawItem) {
  if (!rawItem || typeof rawItem !== "object") return {};
  for (const key of ["aweme_detail", "aweme_info", "itemStruct"]) {
    const val = rawItem[key];
    if (val && typeof val === "object" && !Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === "object") return parsed;
      } catch {
        // ignore malformed wrapper
      }
    }
  }
  if (rawItem.itemInfo?.itemStruct && typeof rawItem.itemInfo.itemStruct === "object") {
    return rawItem.itemInfo.itemStruct;
  }
  return rawItem;
}

function collectCandidateWarningStrings(rawItem) {
  const out = [];
  const root = unwrapAwemeRoot(rawItem);
  const seen = new Set();
  const pushText = (field, text, extra = {}) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    const key = `${field}:${clean}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ field, text: clean, ...extra });
    }
  };
  const scanNode = (field, val, depth = 0) => {
    if (!val || depth > 5) return;
    if (field === "misc_info") {
      const ktfHit = parseMiscInfoCaution(val);
      if (ktfHit) {
        pushText(ktfHit.matchedField, ktfHit.text, {
          cautionCategory: ktfHit.cautionCategory,
          shareLimited: ktfHit.shareLimited,
        });
        return;
      }
      if (typeof val === "string" && val.trim().startsWith("{")) return;
      if (typeof val === "object" && !Array.isArray(val) && (val.ktf_info !== undefined || val.tns_im_info !== undefined)) return;
    }
    if (typeof val === "string") {
      if (field === "cautionText" && val.trim().startsWith("{")) {
        const ktfHit = parseMiscInfoCaution(val);
        if (ktfHit) {
          pushText(ktfHit.matchedField, ktfHit.text, {
            cautionCategory: ktfHit.cautionCategory,
            shareLimited: ktfHit.shareLimited,
          });
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
 * matches TikTok's official misinformation Caution tags:
 *   1) "Caution: Video flagged for unverified content." (cautionCategory: "unverified_content")
 *   2) "Caution: May contain inaccurate information." / "Check your sources before sharing" /
 *      "Sharing is limited to one chat at a time" (cautionCategory: "inaccurate_info")
 * Returns null for clean videos, standard AI-generated labels, and generic injury disclaimers.
 */
export function extractUnverifiedCautionRecord(rawItem, sourceProvider = "scraper_api") {
  if (!rawItem || typeof rawItem !== "object") return null;
  const root = unwrapAwemeRoot(rawItem);
  const candidates = collectCandidateWarningStrings(rawItem);
  const hit =
    candidates.find((c) => UNVERIFIED_CAUTION_RE.test(c.text)) ||
    candidates.find((c) => ANY_CAUTION_MISINFO_RE.test(c.text));
  if (!hit) return null;

  const cautionCategory =
    hit.cautionCategory ||
    (UNVERIFIED_CAUTION_RE.test(hit.text) ? "unverified_content" : "inaccurate_info");
  const shareLimited = Boolean(
    hit.shareLimited ||
      root.shareLimited ||
      /sharing\s+(?:is\s+)?limited\s+to\s+(?:one|1)\s+chat/i.test(hit.text),
  );

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
      : Array.isArray(videoMeta.origin_cover?.url_list) && videoMeta.origin_cover.url_list[0]
        ? videoMeta.origin_cover.url_list[0]
        : Array.isArray(videoMeta.cover?.url_list) && videoMeta.cover.url_list[0]
          ? videoMeta.cover.url_list[0]
          : "";
  const thumb = String(
    root.thumbnailUrl ||
      root.thumbnail_url ||
      videoMeta.coverUrl ||
      coverStr ||
      authorMeta.avatar ||
      "",
  ).trim() || null;

  const claInfos = videoMeta?.cla_info?.caption_infos || root?.cla_info?.caption_infos || videoMeta?.subtitleInfos || [];
  const subtitleUrl =
    String(
      root.subtitleUrl ||
        (Array.isArray(claInfos) && claInfos[0] ? claInfos[0].url || claInfos[0].Url || (claInfos[0].url_list || [])[0] : "") ||
        "",
    ).trim() || null;

  const secUid = String(root.secUid || authorMeta.sec_uid || authorMeta.secUid || "").trim() || null;
  const parentIds = extractStitchDuetParentIds(rawItem);

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
    secUid,
    description: desc,
    voiceToText: String(root.voice_to_text || root.voiceToText || root.transcript || "").trim().slice(0, 1200),
    subtitleUrl,
    hashtags,
    thumbnailUrl: thumb,
    cautionText: hit.text,
    cautionCategory,
    shareLimited,
    parentVideoIds: parentIds,
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
        const kvCap = Math.min(limit, 18);
        const loaded = await Promise.all(
          ids.slice(0, kvCap).map(async (id) => {
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
          if (!ANY_CAUTION_MISINFO_RE.test(String(item.cautionText || ""))) continue;
          if (!item.cautionCategory) {
            item.cautionCategory = UNVERIFIED_CAUTION_RE.test(String(item.cautionText || ""))
              ? "unverified_content"
              : "inaccurate_info";
          }
          seen.add(item.id);
          entries.push(item);
        }
      }
    } catch {
      // Fall through cleanly to bundled repo entries if any
    }
  }
  const byId = new Map();
  for (const e of entries) byId.set(e.id, e);
  for (const repoItem of REPO_CAUTION_VIDEOS || []) {
    if (!repoItem?.id || !ANY_CAUTION_MISINFO_RE.test(String(repoItem.cautionText || ""))) continue;
    const existing = byId.get(repoItem.id);
    if (existing) {
      if (!existing.voiceToText && repoItem.voiceToText) existing.voiceToText = repoItem.voiceToText;
      if (!existing.subtitleUrl && repoItem.subtitleUrl) existing.subtitleUrl = repoItem.subtitleUrl;
      if (!existing.secUid && repoItem.secUid) existing.secUid = repoItem.secUid;
      if (!existing.thumbnailUrl && repoItem.thumbnailUrl) existing.thumbnailUrl = repoItem.thumbnailUrl;
      if (!existing.description && repoItem.description) existing.description = repoItem.description;
      if (!existing.shareLimited && repoItem.shareLimited) existing.shareLimited = true;
      continue;
    }
    const normalized = {
      ...repoItem,
      cautionCategory:
        repoItem.cautionCategory ||
        (UNVERIFIED_CAUTION_RE.test(String(repoItem.cautionText || "")) ? "unverified_content" : "inaccurate_info"),
    };
    seen.add(repoItem.id);
    byId.set(repoItem.id, normalized);
    entries.push(normalized);
  }
  // Sort primary "Flagged Unverified Content" clips first, then newest inaccurate/share-limited clips
  entries.sort((a, b) => {
    const rankA = a.cautionCategory === "unverified_content" ? 0 : a.shareLimited ? 1 : 2;
    const rankB = b.cautionCategory === "unverified_content" ? 0 : b.shareLimited ? 1 : 2;
    return rankA - rankB || String(b.capturedAt || "").localeCompare(String(a.capturedAt || ""));
  });
  return entries.slice(0, limit);
}

export async function loadMonitoredAccounts(kv = null, cautionEntries = null, limit = 100) {
  const entries = Array.isArray(cautionEntries) ? cautionEntries : await loadCautionFeedEntries(kv, 100);
  const byHandle = new Map();
  for (const v of entries) {
    const rawUser = String(v?.authorUsername || "").trim().replace(/^@+/, "").toLowerCase();
    if (!rawUser || rawUser === "unknown") continue;
    if (!byHandle.has(rawUser)) byHandle.set(rawUser, []);
    byHandle.get(rawUser).push(v);
  }

  const accountMap = new Map();
  const upsertAccount = (rawAcct) => {
    if (!rawAcct || typeof rawAcct !== "object") return;
    const handle = String(rawAcct.handle || rawAcct.username || rawAcct.displayHandle || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    if (!handle || handle === "unknown") return;
    const prev = accountMap.get(handle) || {};
    const matched = byHandle.get(handle) || [];
    const videosInspected = Math.max(
      Number(rawAcct.videosInspected || 0),
      Number(prev.videosInspected || 0),
      matched.length,
    );
    const cautionFoundCount = Math.max(
      Number(rawAcct.cautionFoundCount || 0),
      Number(prev.cautionFoundCount || 0),
      matched.length,
    );
    accountMap.set(handle, {
      handle,
      displayHandle: `@${handle}`,
      profileUrl: `https://www.tiktok.com/@${handle}`,
      status: rawAcct.status || prev.status || (videosInspected > 0 ? "inspected" : "queued"),
      videosInspected,
      cautionFoundCount,
      matchedVideoIds: matched.map((v) => v.videoId || v.id),
      brandTag: String(rawAcct.brandTag || prev.brandTag || "").trim(),
      notes: String(rawAcct.notes || prev.notes || "").trim(),
      source: String(rawAcct.source || prev.source || "user_reported_handle"),
      reportedAt: rawAcct.reportedAt || prev.reportedAt || new Date().toISOString(),
      lastInspectedAt: rawAcct.lastInspectedAt || prev.lastInspectedAt || null,
    });
  };

  for (const def of DEFAULT_MONITORED_ACCOUNTS) {
    upsertAccount(def);
  }

  if (kv) {
    try {
      const idxRaw = await kv.get("bw:accounts:index");
      const ids = idxRaw ? JSON.parse(idxRaw) : [];
      for (const h of ids.slice(0, Math.min(limit, 18))) {
        const itemRaw = await kv.get(`bw:account:item:${String(h).toLowerCase()}`);
        if (itemRaw) {
          upsertAccount(JSON.parse(itemRaw));
        }
      }
    } catch {
      // Fall back to default accounts cleanly
    }
  }

  for (const [handle, matched] of byHandle.entries()) {
    if (!accountMap.has(handle)) {
      upsertAccount({
        handle,
        status: "inspected",
        videosInspected: matched.length,
        cautionFoundCount: matched.length,
        brandTag: matched[0]?.brandTag || "Caution Archive Creator",
        source: "caution_archive_derived",
        reportedAt: matched[0]?.capturedAt || new Date().toISOString(),
        lastInspectedAt: matched[0]?.capturedAt || new Date().toISOString(),
      });
    }
  }

  return Array.from(accountMap.values())
    .sort(
      (a, b) =>
        b.cautionFoundCount - a.cautionFoundCount ||
        (a.status === "queued" ? -1 : 0) - (b.status === "queued" ? -1 : 0) ||
        b.videosInspected - a.videosInspected ||
        a.handle.localeCompare(b.handle),
    )
    .slice(0, limit);
}

export async function inspectTikTokAccountLive(handleInfo, env = {}, fetchFn = fetch, options = {}) {
  const cleanHandle = String(handleInfo?.handle || handleInfo || "").trim().replace(/^@+/, "").toLowerCase();
  const profileUrl = `https://www.tiktok.com/@${cleanHandle}`;
  const maxVideos = Math.min(Math.max(Number(options.maxVideos || 50), 1), 150);
  const waitSec = Math.min(Math.max(Number(options.waitForFinish ?? 25), 0), 60);
  const brandTag = String(options.brandTag || `@${cleanHandle}`).trim();

  const apifyToken = String(env?.APIFY_TOKEN || "").trim();
  const ghPat = String(env?.GH_PAT || "").trim();

  let liveApifyRan = false;
  let apifyStatus = "not_configured";
  let apifyRunId = null;
  let inspectedCount = 0;
  const cautionRecords = [];
  const seenIds = new Set();

  if (apifyToken) {
    try {
      const runUrl = `https://api.apify.com/v2/acts/xtdata~tiktok-scraper/runs?token=${encodeURIComponent(apifyToken)}&waitForFinish=${waitSec}&memory=512&maxTotalChargeUsd=0.04`;
      const runRes = await fetchFn(runUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          type: "USER",
          region: "GB",
          url: profileUrl,
          keywords: [],
          maxItems: maxVideos,
          isUnlimited: false,
          sortType: 0,
          publishTime: "ALL_TIME",
        }),
        signal: AbortSignal.timeout((waitSec + 8) * 1000),
      });
      if (runRes.ok) {
        const runPayload = await runRes.json();
        const runData = runPayload?.data || {};
        apifyRunId = runData.id || null;
        apifyStatus = String(runData.status || "RUNNING");
        const datasetId = runData.defaultDatasetId;
        if (datasetId && (apifyStatus === "SUCCEEDED" || apifyStatus === "RUNNING" || apifyStatus === "TIMED-OUT")) {
          const dsUrl = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(apifyToken)}&clean=true&format=json`;
          const dsRes = await fetchFn(dsUrl, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(12000),
          });
          if (dsRes.ok) {
            const rawItems = await dsRes.json();
            if (Array.isArray(rawItems)) {
              liveApifyRan = true;
              inspectedCount = rawItems.length;
              for (const raw of rawItems) {
                const rec = extractUnverifiedCautionRecord(raw, "apify_account_inspector");
                if (rec && !seenIds.has(rec.id)) {
                  seenIds.add(rec.id);
                  if (!rec.brandTag || rec.brandTag.startsWith("apify:")) rec.brandTag = brandTag;
                  cautionRecords.push(rec);
                }
              }
            }
          }
        }
      } else {
        apifyStatus = `http_${runRes.status}`;
      }
    } catch (err) {
      apifyStatus = `error:${String(err?.message || err).slice(0, 80)}`;
    }
  }

  let dispatchedWorkflow = false;
  if (ghPat && (!liveApifyRan || inspectedCount === 0)) {
    try {
      const ghRes = await fetchFn(
        "https://api.github.com/repos/ak10082247-max/action2mcp/actions/workflows/brand_watch_caution_cron.yml/dispatches",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghPat}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "CautionWatch-Worker/1.0",
          },
          body: JSON.stringify({
            ref: "main",
            inputs: {
              run_live: "true",
              provider: "apify",
              extra_profile: cleanHandle,
              profiles_only: "true",
              max_items: String(maxVideos),
              extra_args: "--no-ssr-enrich --no-harvest-free",
            },
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      dispatchedWorkflow = ghRes.status === 204 || ghRes.ok;
    } catch {
      dispatchedWorkflow = false;
    }
  }

  return {
    handle: cleanHandle,
    displayHandle: `@${cleanHandle}`,
    profileUrl,
    liveApifyRan,
    apifyStatus,
    apifyRunId,
    inspectedCount,
    cautionRecords,
    dispatchedWorkflow,
  };
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

export async function runCautionOnlyScan(rawQuery, kv = null, rawCategory = "all") {
  const query = String(rawQuery || "").trim().slice(0, 120);
  const category = ["unverified_content", "inaccurate_info"].includes(String(rawCategory || "").toLowerCase())
    ? String(rawCategory).toLowerCase()
    : "all";
  const qLow = query.toLowerCase();
  const qBare = qLow.replace(/^[#@]+/, "");
  const allCaution = await loadCautionFeedEntries(kv, 100);
  const monitoredAccounts = await loadMonitoredAccounts(kv, allCaution, 100);
  const totalVideosInspected = monitoredAccounts.reduce((acc, a) => acc + Number(a.videosInspected || 0), 0);
  const catalog = buildCautionTagCatalog(allCaution);
  const existingSugLow = new Set(catalog.autofill_suggestions.map((s) => s.toLowerCase()));
  for (const acct of monitoredAccounts) {
    if (acct.displayHandle && !existingSugLow.has(acct.displayHandle.toLowerCase())) {
      existingSugLow.add(acct.displayHandle.toLowerCase());
      catalog.autofill_suggestions.push(acct.displayHandle);
    }
  }
  const unverifiedCount = allCaution.filter((v) => v.cautionCategory === "unverified_content").length;
  const inaccurateCount = allCaution.filter((v) => v.cautionCategory === "inaccurate_info").length;

  const byCategory =
    category === "all"
      ? allCaution
      : allCaution.filter((v) => v.cautionCategory === category);

  const filtered =
    !qLow || qLow === "tiktok"
      ? byCategory
      : byCategory.filter((v) => {
          const hay = `${v.description || ""} ${v.voiceToText || ""} ${v.authorUsername || ""} ${v.authorName || ""} ${(v.hashtags || []).map((h) => `#${h} ${h}`).join(" ")} ${v.brandTag || ""} ${v.cautionText || ""}`.toLowerCase();
          return hay.includes(qLow) || (qBare.length >= 2 && hay.includes(qBare));
        });

  return {
    ok: true,
    strict_filter: "Caution: Video flagged for unverified content & May contain inaccurate information ONLY",
    query: query || "all_flagged_videos",
    category,
    category_counts: {
      all: allCaution.length,
      unverified_content: unverifiedCount,
      inaccurate_info: inaccurateCount,
    },
    scanned_at: new Date().toISOString(),
    total_stored_caution_videos: allCaution.length,
    matched_count: filtered.length,
    total_monitored_accounts: monitoredAccounts.length,
    total_videos_inspected: totalVideosInspected,
    self_updating: {
      enabled: true,
      schedule: "Cloudflare Cron (every 6h) + GitHub Actions Cron (every 12h) + On-Demand @Handle Trigger",
      ui_auto_refresh_seconds: 30,
      total_monitored_accounts: monitoredAccounts.length,
      total_videos_inspected: totalVideosInspected,
    },
    monitored_accounts: monitoredAccounts,
    searchable_tags: catalog.searchable_tags,
    autofill_suggestions: catalog.autofill_suggestions,
    caution_videos: filtered,
  };
}

export async function fetchWebVttTranscript(subtitleUrl, fetchFn = fetch) {
  if (!subtitleUrl || typeof subtitleUrl !== "string" || !/^https?:\/\//i.test(subtitleUrl)) return "";
  try {
    const res = await fetchFn(subtitleUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const vtt = await res.text();
    const lines = vtt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && l !== "WEBVTT" && !/^\d+$/.test(l) && !/-->/.test(l));
    return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 1200);
  } catch {
    return "";
  }
}

const DEBUNK_SUFFIXES = ["scam", "fake", "hoax", "exposed", "warning"];

export async function runScheduledCautionDiscovery(env = {}, fetchFn = fetch) {
  const kv = env?.FUNNEL_KV || null;
  const scrapeCreatorsKey = String(env?.SCRAPECREATORS_API_KEY || "").trim();
  const ensembleToken = String(env?.ENSEMBLEDATA_TOKEN || "").trim();
  const apifyToken = String(env?.APIFY_TOKEN || "").trim();
  const resendKey = String(env?.RESEND_API_KEY || "").trim();
  const webhookUrl = String(env?.B2B_WEBHOOK_URL || "").trim();

  // 1. Load active leads, monitored repeat-offender accounts & queued stitch/duet parent IDs from KV
  const leads = [];
  if (kv) {
    try {
      const idx = JSON.parse((await kv.get("bw:leads:index")) || "[]");
      for (const id of idx.slice(0, 12)) {
        const raw = await kv.get(`bw:lead:item:${id}`);
        if (raw) leads.push(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }
  const allCaution = await loadCautionFeedEntries(kv, 60);
  const accounts = await loadMonitoredAccounts(kv, allCaution, 30);
  const repeatOffenders = accounts.filter((a) => Number(a.cautionFoundCount || 0) > 0).slice(0, 6);

  // Self-learning query queue: combine Stitch/Duet debunk queries, learned Caution hashtags, and subscriber brand+debunk terms
  const discoveryQueries = ["#stitch fake news", "#stitch debunk", "emergency alert system hoax", "anthony joshua not following the script"];
  const seenQ = new Set(discoveryQueries.map((x) => x.toLowerCase()));
  const pushQuery = (q) => {
    const clean = String(q || "").trim();
    if (clean.length >= 3 && !seenQ.has(clean.toLowerCase())) {
      seenQ.add(clean.toLowerCase());
      discoveryQueries.push(clean);
    }
  };
  for (const lead of leads.slice(0, 4)) {
    const kws = String(lead.keywords || "").split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
    if (kws[0]) pushQuery(`${kws[0]} ${DEBUNK_SUFFIXES[0]}`);
  }
  const learnedCatalog = buildCautionTagCatalog(allCaution);
  for (const tagObj of (learnedCatalog.searchable_tags || []).filter((t) => t.type === "hashtag" && !["#fyp", "#foryou"].includes(t.tag.toLowerCase())).slice(0, 4)) {
    pushQuery(tagObj.tag);
  }

  let queuedParentIds = [];
  if (kv) {
    try {
      const parsedParents = JSON.parse((await kv.get("bw:parent_queue")) || "[]");
      if (Array.isArray(parsedParents)) queuedParentIds = parsedParents.filter((x) => /^\d{15,22}$/.test(String(x))).slice(0, 4);
    } catch {
      queuedParentIds = [];
    }
  }

  const rawItems = [];
  let providerUsed = "none";

  // 2. Poll ScrapeCreators (if configured), else EnsembleData (50 free units/day), else Apify (xtdata~tiktok-scraper)
  if (scrapeCreatorsKey) {
    providerUsed = "scrapecreators";
    for (const q of discoveryQueries.slice(0, 4)) {
      try {
        const res = await fetchFn(
          `https://api.scrapecreators.com/v1/tiktok/search/keyword?query=${encodeURIComponent(q)}`,
          { headers: { "x-api-key": scrapeCreatorsKey, Accept: "application/json" }, signal: AbortSignal.timeout(12000) },
        );
        if (res.ok) {
          const data = await res.json();
          const list = data?.search_item_list || data?.data || data?.aweme_list || [];
          if (Array.isArray(list)) rawItems.push(...list);
        }
      } catch {
        // continue
      }
    }
    for (const acct of repeatOffenders.slice(0, 3)) {
      try {
        const res = await fetchFn(
          `https://api.scrapecreators.com/v3/tiktok/profile/videos?handle=${encodeURIComponent(acct.handle)}`,
          { headers: { "x-api-key": scrapeCreatorsKey, Accept: "application/json" }, signal: AbortSignal.timeout(12000) },
        );
        if (res.ok) {
          const data = await res.json();
          const list = data?.aweme_list || data?.data || [];
          if (Array.isArray(list)) rawItems.push(...list);
        }
      } catch {
        // continue
      }
    }
    for (const pid of queuedParentIds.slice(0, 3)) {
      try {
        const res = await fetchFn(
          `https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(`https://www.tiktok.com/video/${pid}`)}`,
          { headers: { "x-api-key": scrapeCreatorsKey, Accept: "application/json" }, signal: AbortSignal.timeout(12000) },
        );
        if (res.ok) {
          const data = await res.json();
          const item = data?.aweme_detail || data?.data || data;
          if (item && typeof item === "object") rawItems.push(item);
        }
      } catch {
        // continue
      }
    }
  } else if (ensembleToken) {
    providerUsed = "ensembledata";
    for (const q of discoveryQueries.slice(0, 3)) {
      try {
        const res = await fetchFn(
          `https://ensembledata.com/apis/tt/keyword/search?name=${encodeURIComponent(q)}&period=1&sorting=0&token=${encodeURIComponent(ensembleToken)}`,
          { signal: AbortSignal.timeout(12000) },
        );
        if (res.ok) {
          const data = await res.json();
          const list = data?.data?.data || data?.data?.aweme_list || data?.data || [];
          if (Array.isArray(list)) rawItems.push(...list);
        }
      } catch {
        // continue
      }
    }
    for (const acct of repeatOffenders.slice(0, 2)) {
      try {
        const res = await fetchFn(
          `https://ensembledata.com/apis/tt/user/posts?username=${encodeURIComponent(acct.handle)}&depth=1&token=${encodeURIComponent(ensembleToken)}`,
          { signal: AbortSignal.timeout(12000) },
        );
        if (res.ok) {
          const data = await res.json();
          const list = data?.data?.data || data?.data?.aweme_list || data?.data || [];
          if (Array.isArray(list)) rawItems.push(...list);
        }
      } catch {
        // continue
      }
    }
    for (const pid of queuedParentIds.slice(0, 2)) {
      try {
        const res = await fetchFn(
          `https://ensembledata.com/apis/tt/post/info?url=${encodeURIComponent(`https://www.tiktok.com/video/${pid}`)}&token=${encodeURIComponent(ensembleToken)}`,
          { signal: AbortSignal.timeout(12000) },
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];
          rawItems.push(...list);
        }
      } catch {
        // continue
      }
    }
  } else if (apifyToken) {
    providerUsed = "apify";
    try {
      const res = await fetchFn(
        `https://api.apify.com/v2/acts/xtdata~tiktok-scraper/runs?token=${encodeURIComponent(apifyToken)}&waitForFinish=25&memory=512&maxTotalChargeUsd=0.03`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "SEARCH",
            region: "GB",
            url: "",
            keywords: discoveryQueries.slice(0, 4),
            maxItems: 25,
            isUnlimited: false,
            sortType: 0,
            publishTime: "ALL_TIME",
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (res.ok) {
        const runJson = await res.json();
        const dsId = runJson?.data?.defaultDatasetId;
        if (dsId) {
          const dsRes = await fetchFn(
            `https://api.apify.com/v2/datasets/${encodeURIComponent(dsId)}/items?token=${encodeURIComponent(apifyToken)}&clean=false&limit=30`,
            { signal: AbortSignal.timeout(10000) },
          );
          if (dsRes.ok) {
            const list = await dsRes.json();
            if (Array.isArray(list)) rawItems.push(...list);
          }
        }
      }
    } catch {
      // handled gracefully when balance is 0
    }
  }

  // 3. Extract Caution records, capture Stitch/Duet parent trail IDs & cache WebVTT transcripts
  const discoveredRecords = [];
  const stitchParentIds = new Set();
  for (const raw of rawItems) {
    for (const pid of extractStitchDuetParentIds(raw)) stitchParentIds.add(pid);
    const rec = extractUnverifiedCautionRecord(raw, `cf_cron_${providerUsed}`);
    if (!rec) continue;
    if (!rec.voiceToText && rec.subtitleUrl) {
      rec.voiceToText = await fetchWebVttTranscript(rec.subtitleUrl, fetchFn);
    }
    discoveredRecords.push(rec);
  }

  if (kv && stitchParentIds.size > 0) {
    try {
      const prev = JSON.parse((await kv.get("bw:parent_queue")) || "[]");
      const mergedParents = Array.from(new Set([...Array.from(stitchParentIds), ...prev])).slice(0, 100);
      await kv.put("bw:parent_queue", JSON.stringify(mergedParents));
    } catch {
      // ignore
    }
  }

  // 4. Persist newly discovered Caution clips to KV & fire direct Resend / Webhook alerts to matched leads
  let alertsSent = 0;
  if (kv && discoveredRecords.length > 0) {
    try {
      const existingIds = JSON.parse((await kv.get("bw:caution:index")) || "[]");
      const existingSet = new Set(existingIds);
      const newlyAdded = [];
      for (const rec of discoveredRecords.slice(0, 12)) {
        await kv.put(`bw:caution:item:${rec.id}`, JSON.stringify(rec), { expirationTtl: 180 * 86400 });
        if (!existingSet.has(rec.id)) {
          newlyAdded.push(rec);
          existingSet.add(rec.id);
        }
      }
      const nextIds = [...discoveredRecords.map((r) => r.id), ...existingIds.filter((id) => !discoveredRecords.some((r) => r.id === id))].slice(0, 200);
      await kv.put("bw:caution:index", JSON.stringify(nextIds));

      for (const rec of newlyAdded) {
        const hay = `${rec.description} ${rec.voiceToText} ${rec.authorUsername} ${(rec.hashtags || []).join(" ")}`.toLowerCase();
        for (const lead of leads) {
          const terms = String(lead.keywords || "").split(/[,;\n]+/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
          const hits = terms.filter((t) => hay.includes(t));
          if (!hits.length) continue;
          if (resendKey && lead.email) {
            await fetchFn("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: String(env?.RESEND_FROM_EMAIL || "CautionWatch Live Alerts <onboarding@resend.dev>").trim(),
                to: [lead.email],
                subject: `[CautionWatch Live Alert] Flagged TikTok matching ${hits.join(", ")}`,
                text: `CautionWatch detected a new TikTok Caution clip:\nLabel: ${rec.cautionText}\nCategory: ${rec.cautionCategory || "unverified_content"}\nCreator: ${rec.authorUsername}\nURL: ${rec.url}\nCaption: ${rec.description}\nTranscript: ${rec.voiceToText}\n`,
              }),
              signal: AbortSignal.timeout(5000),
            }).catch(() => {});
            alertsSent += 1;
          }
          const leadHookMatch = String(lead.notes || "").match(/https?:\/\/[^\s"'<>]+/i);
          const targetWebhook = leadHookMatch ? leadHookMatch[0] : webhookUrl;
          if (targetWebhook) {
            await fetchFn(targetWebhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "caution_live_alert", matched_terms: hits, lead_id: lead.lead_id, video: rec }),
              signal: AbortSignal.timeout(5000),
            }).catch(() => {});
            alertsSent += 1;
          }
        }
      }
    } catch {
      // ignore KV errors
    }
  }

  return {
    ok: true,
    provider: providerUsed,
    queries_checked: discoveryQueries.length,
    raw_items_scanned: rawItems.length,
    caution_found: discoveredRecords.length,
    stitch_duet_parents_queued: stitchParentIds.size,
    alerts_sent: alertsSent,
    ran_at: new Date().toISOString(),
  };
}

export function buildCautionDossier(targetBrand, tier, scanResult, contactNotes = "") {
  const brand = String(targetBrand || scanResult?.query || "Target Watch").trim().slice(0, 120);
  const videos = scanResult?.caution_videos || [];
  const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvRows = [
    ["video_id", "author_username", "caution_category", "share_limited", "caution_label", "matched_field", "description", "voice_to_text", "url", "thumbnail_url", "captured_at"],
  ];
  for (const v of videos) {
    csvRows.push(
      [
        v.videoId,
        v.authorUsername,
        v.cautionCategory || "unverified_content",
        v.shareLimited ? "true" : "false",
        v.cautionText,
        v.matchedField,
        v.description,
        v.voiceToText,
        v.url,
        v.thumbnailUrl || "",
        v.capturedAt || "",
      ].map(csvEsc),
    );
  }
  const briefMd = [
    `# CautionWatch Evidence Dossier: ${brand}`,
    `Filter Mode: STRICT — Official TikTok Misinformation Caution Tags ("Flagged for unverified content" & "May contain inaccurate information") ONLY`,
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
