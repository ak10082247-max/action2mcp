/**
 * Art50Scan Core Engine:
 * True binary multi-container C2PA / JUMBF / IPTC / AI-Prompt inspector
 * + live website CDN C2PA-survival auditor for EU AI Act Article 50 compliance
 * (enforced Aug 2, 2026; legacy Article 50(2) grace-period deadline Dec 2, 2026).
 */

import { normalizeTargetOrigin } from "../edge_helpers.js";
import { isBlockedPrivateHost } from "../schema_fetch.js";

const DEC_2_2026_UTC_MS = Date.UTC(2026, 11, 2, 0, 0, 0);
const C2PA_JUMBF_UUID_HEX = "d8fec3d61b0e483c92975828877ec481";
const MAX_MEDIA_BYTES = 1_600_000;

const KNOWN_ISSUERS = [
  { name: "OpenAI", re: /\b(?:openai|chatgpt|dall[\s-]?e|sora)\b/i },
  { name: "Adobe", re: /\b(?:adobe|firefly|photoshop|content\s+authenticity)\b/i },
  { name: "Google / DeepMind", re: /\b(?:google|deepmind|imagen|synthid|gemini|pixel)\b/i },
  { name: "Truepic", re: /\btruepic\b/i },
  { name: "Microsoft", re: /\b(?:microsoft|designer|bing\s+image)\b/i },
  { name: "Midjourney", re: /\bmidjourney\b/i },
  { name: "Sony", re: /\bsony\b/i },
  { name: "Leica", re: /\bleica\b/i },
  { name: "Nikon", re: /\bnikon\b/i },
  { name: "Canon", re: /\bcanon\b/i },
  { name: "ElevenLabs", re: /\belevenlabs\b/i },
  { name: "Stability AI / ComfyUI", re: /\b(?:stability\s*ai|stable\s*diffusion|comfyui|automatic1111|flux)\b/i },
  { name: "Runway / Kling / Pika", re: /\b(?:runway|kling|pika|luma)\b/i },
];

const DIGITAL_SOURCE_TYPES = [
  "trainedAlgorithmicMedia",
  "compositeWithTrainedAlgorithmicMedia",
  "algorithmicMedia",
  "compositeSynthetic",
  "digitalCapture",
  "compositeCapture",
  "humanEdits",
];

function toHex(bytes, start, len) {
  let out = "";
  const end = Math.min(bytes.length, start + len);
  for (let i = start; i < end; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function readAscii(bytes, start, len) {
  const end = Math.min(bytes.length, start + len);
  let s = "";
  for (let i = start; i < end; i++) {
    const c = bytes[i];
    s += c >= 32 && c <= 126 ? String.fromCharCode(c) : " ";
  }
  return s;
}

function readUint32BE(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function readUint32LE(bytes, offset) {
  if (offset + 4 > bytes.length) return 0;
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    ((bytes[offset + 3] << 24) >>> 0)
  ) >>> 0;
}

export async function sha256BytesHex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function detectContainerFormat(bytes, contentType = "", filename = "") {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPEG";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) return "PNG";
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) return "WEBP";
  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    const brand = readAscii(bytes, 8, 4).trim().toLowerCase();
    if (brand.startsWith("avi")) return "AVIF";
    if (brand.startsWith("hei") || brand.startsWith("mif")) return "HEIC";
    if (brand.startsWith("qt")) return "MOV";
    return "MP4";
  }
  if (bytes.length >= 12 && readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") return "WAV";
  if (bytes.length >= 3 && (readAscii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) return "MP3";
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("svg")) return "SVG";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "JPEG";
  if (ct.includes("png")) return "PNG";
  if (ct.includes("webp")) return "WEBP";
  if (ct.includes("avif")) return "AVIF";
  if (ct.includes("mp4")) return "MP4";
  const ext = String(filename || "").split("?")[0].split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "UNKNOWN";
}

function parseJpegSegments(bytes) {
  const chunks = [];
  let c2paBoxFound = false;
  let exifFound = false;
  let xmpFound = false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS (pixel scan starts)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const segLen = (bytes[offset] << 8) | bytes[offset + 1];
    if (segLen < 2 || offset + segLen > bytes.length) break;
    const dataStart = offset + 2;
    const dataLen = segLen - 2;
    if (marker === 0xe1 || marker === 0xeb || marker === 0xe2 || marker === 0xfe) {
      const head = readAscii(bytes, dataStart, Math.min(dataLen, 36));
      if (marker === 0xe1) {
        if (head.startsWith("Exif")) exifFound = true;
        if (head.includes("ns.adobe.com/xap") || head.includes("xmp")) xmpFound = true;
      }
      if (marker === 0xeb) {
        // APP11 JPEG XT / JUMBF container (used by C2PA)
        const sliceHex = toHex(bytes, dataStart, Math.min(dataLen, 48));
        if (head.includes("JP") || head.includes("jumb") || head.includes("c2pa") || sliceHex.includes(C2PA_JUMBF_UUID_HEX)) {
          c2paBoxFound = true;
        }
      }
      chunks.push({
        container: "JPEG",
        marker: `0xFF${marker.toString(16).toUpperCase().padStart(2, "0")}`,
        size: dataLen,
        text: readAscii(bytes, dataStart, Math.min(dataLen, 32768)),
      });
    }
    offset += segLen;
  }
  return { chunks, c2paBoxFound, exifFound, xmpFound };
}

function parsePngChunks(bytes) {
  const chunks = [];
  const pngTextEntries = {};
  let c2paBoxFound = false;
  let exifFound = false;
  let xmpFound = false;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const len = readUint32BE(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    const dataStart = offset + 8;
    if (dataStart + len + 4 > bytes.length) break;
    if (type === "caBX") {
      c2paBoxFound = true;
      chunks.push({
        container: "PNG",
        marker: "caBX",
        size: len,
        text: readAscii(bytes, dataStart, Math.min(len, 65536)),
      });
    } else if (type === "eXIf") {
      exifFound = true;
      chunks.push({
        container: "PNG",
        marker: "eXIf",
        size: len,
        text: readAscii(bytes, dataStart, Math.min(len, 16384)),
      });
    } else if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const slice = bytes.subarray(dataStart, dataStart + Math.min(len, 65536));
      const nullIdx = slice.indexOf(0);
      const key = nullIdx > 0 ? readAscii(slice, 0, nullIdx).trim() : type;
      const valText = readAscii(slice, Math.max(0, nullIdx + 1), slice.length);
      if (key.toLowerCase().includes("xmp") || valText.includes("ns.adobe.com/xap")) xmpFound = true;
      if (key) pngTextEntries[key] = valText.trim().slice(0, 2000);
      chunks.push({
        container: "PNG",
        marker: `${type}:${key}`,
        size: len,
        text: `${key} ${valText}`,
      });
    }
    if (type === "IEND") break;
    offset += 12 + len;
  }
  return { chunks, pngTextEntries, c2paBoxFound, exifFound, xmpFound };
}

function parseWebpChunks(bytes) {
  const chunks = [];
  let c2paBoxFound = false;
  let exifFound = false;
  let xmpFound = false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = readAscii(bytes, offset, 4);
    const size = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    if (dataStart + size > bytes.length) break;
    if (fourcc === "C2PA") c2paBoxFound = true;
    if (fourcc === "EXIF") exifFound = true;
    if (fourcc === "XMP ") xmpFound = true;
    if (fourcc === "C2PA" || fourcc === "EXIF" || fourcc === "XMP ") {
      chunks.push({
        container: "WEBP",
        marker: fourcc.trim(),
        size,
        text: readAscii(bytes, dataStart, Math.min(size, 65536)),
      });
    }
    offset = dataStart + size + (size % 2);
  }
  return { chunks, c2paBoxFound, exifFound, xmpFound };
}

function parseIsobmffBoxes(bytes) {
  const chunks = [];
  let c2paBoxFound = false;
  let exifFound = false;
  let xmpFound = false;
  let offset = 0;
  let guard = 0;
  while (offset + 8 <= bytes.length && guard < 128) {
    guard += 1;
    let size = readUint32BE(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    let headerSize = 8;
    if (size === 1 && offset + 16 <= bytes.length) {
      const hi = readUint32BE(bytes, offset + 8);
      const lo = readUint32BE(bytes, offset + 12);
      size = hi * 4294967296 + lo;
      headerSize = 16;
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    if (size < headerSize || offset + size > bytes.length) break;
    if (type === "uuid" || type === "meta" || type === "udta") {
      const payloadStart = offset + headerSize;
      const payloadLen = Math.min(size - headerSize, 65536);
      const uuidHex = type === "uuid" ? toHex(bytes, payloadStart, 16) : "";
      const txt = readAscii(bytes, payloadStart, payloadLen);
      if (uuidHex === C2PA_JUMBF_UUID_HEX || /jumb|c2pa\.manifest|c2pa\.actions/i.test(txt)) {
        c2paBoxFound = true;
      }
      if (/xmp|ns\.adobe\.com/i.test(txt)) xmpFound = true;
      if (/Exif/i.test(txt)) exifFound = true;
      chunks.push({ container: "ISOBMFF", marker: type, size: size - headerSize, text: txt });
    }
    offset += size;
  }
  return { chunks, c2paBoxFound, exifFound, xmpFound };
}

export function detectCdnHeaders(headersObj = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headersObj || {})) {
    lower[String(k).toLowerCase()] = String(v || "");
  }
  const detected = [];
  let likelyStripsMetadata = false;
  if (lower["cf-polished"] || lower["cf-resized"] || lower["cf-bgj"]) {
    detected.push(`Cloudflare Image Transform (${lower["cf-polished"] || lower["cf-resized"] || "Polish"})`);
    likelyStripsMetadata = true;
  } else if (lower["cf-ray"] || /cloudflare/i.test(lower["server"] || "")) {
    detected.push("Cloudflare CDN");
  }
  if (lower["x-vercel-cache"] || lower["x-nextjs-cache"] || /vercel/i.test(lower["server"] || "")) {
    detected.push("Vercel / Next.js Edge");
  }
  if (lower["x-shopify-stage"] || lower["x-sorting-hat-shopid"] || /shopify/i.test(lower["server"] || "")) {
    detected.push("Shopify CDN");
    likelyStripsMetadata = true;
  }
  if (lower["x-imgix-id"] || /imgix/i.test(lower["server"] || "")) {
    detected.push("Imgix");
    likelyStripsMetadata = true;
  }
  if (/cloudinary/i.test(lower["server"] || "") || lower["x-cld-error"] || lower["x-request-id"]?.includes("cld")) {
    detected.push("Cloudinary");
    likelyStripsMetadata = true;
  }
  if (lower["x-served-by"] && /cache-/i.test(lower["x-served-by"])) {
    detected.push("Fastly CDN");
  }
  return { detected: Array.from(new Set(detected)), likelyStripsMetadata };
}

export async function inspectBinaryMedia(rawBytes, meta = {}) {
  const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes || 0);
  const format = detectContainerFormat(bytes, meta.contentType, meta.filename || meta.url);
  const sha256 = await sha256BytesHex(bytes);

  let parsed = { chunks: [], pngTextEntries: {}, c2paBoxFound: false, exifFound: false, xmpFound: false };
  if (format === "JPEG") parsed = { ...parsed, ...parseJpegSegments(bytes) };
  else if (format === "PNG") parsed = { ...parsed, ...parsePngChunks(bytes) };
  else if (format === "WEBP") parsed = { ...parsed, ...parseWebpChunks(bytes) };
  else if (["MP4", "MOV", "AVIF", "HEIC"].includes(format)) parsed = { ...parsed, ...parseIsobmffBoxes(bytes) };

  const combinedText = parsed.chunks.map((c) => c.text).join("\n");
  // Also scan a bounded prefix/suffix window if container is unknown or audio
  const fallbackText =
    parsed.chunks.length === 0
      ? readAscii(bytes, 0, Math.min(bytes.length, 32768)) +
        (bytes.length > 32768 ? readAscii(bytes, Math.max(0, bytes.length - 16384), 16384) : "")
      : "";
  const corpus = `${combinedText}\n${fallbackText}`;

  const c2paAssertions = [];
  for (const tag of [
    "c2pa.actions",
    "c2pa.ingredient",
    "c2pa.hash.data",
    "c2pa.ai-disclosure",
    "c2pa.training-mining",
    "stds.schema-org.CreativeWork",
    "stds.iptc.photo-metadata",
    "c2pa.signature",
    "c2pa.claim",
  ]) {
    if (corpus.toLowerCase().includes(tag.toLowerCase())) c2paAssertions.push(tag);
  }

  const c2paPresent = Boolean(
    parsed.c2paBoxFound ||
      c2paAssertions.length > 0 ||
      /\b(?:urn:uuid:[0-9a-f-]{36}.*c2pa|c2pa\.manifest|jumb\s*.*c2pa)\b/i.test(corpus),
  );

  const digitalSourceTypes = DIGITAL_SOURCE_TYPES.filter((t) => corpus.includes(t));
  const doNotTrainFlag = /c2pa\.training-mining|notAllowed|doNotTrain|ai_training\s*[:=]\s*false/i.test(corpus);
  const signerIssuers = KNOWN_ISSUERS.filter((i) => i.re.test(corpus)).map((i) => i.name);

  // Leaked AI prompts / generation parameters (ComfyUI, Automatic1111, Midjourney)
  const leakedPrompts = [];
  const entries = parsed.pngTextEntries || {};
  if (entries.parameters) {
    leakedPrompts.push({ source: "Automatic1111 / Forge PNG tEXt", snippet: entries.parameters.slice(0, 600) });
  }
  if (entries.prompt || entries.workflow) {
    leakedPrompts.push({
      source: "ComfyUI Embedded Workflow JSON",
      snippet: (entries.prompt || entries.workflow).slice(0, 600),
    });
  }
  if (entries.Description && /--\w+|seed|midjourney|v\s*\d/i.test(entries.Description)) {
    leakedPrompts.push({ source: "Midjourney PNG Description", snippet: entries.Description.slice(0, 600) });
  }
  if (!leakedPrompts.length && /Negative prompt:|Steps:\s*\d+|CFG scale:|Sampler:/i.test(corpus)) {
    const idx = corpus.search(/Negative prompt:|Steps:\s*\d+|CFG scale:/i);
    leakedPrompts.push({
      source: "Embedded Diffusion Params",
      snippet: corpus.slice(Math.max(0, idx - 180), idx + 320).replace(/\s+/g, " ").trim(),
    });
  }

  const gpsRisk = /GPSLatitude|GPSLongitude|exif:GPS|GPSInfo/i.test(corpus);
  const aiSignalsDetected = Boolean(
    digitalSourceTypes.some((d) => /algorithmic|synthetic/i.test(d)) ||
      leakedPrompts.length > 0 ||
      signerIssuers.some((s) => ["OpenAI", "Adobe", "Google / DeepMind", "Midjourney", "Stability AI / ComfyUI", "ElevenLabs", "Runway / Kling / Pika"].includes(s)),
  );

  const cdnInfo = detectCdnHeaders(meta.headers || {});
  const urlStr = String(meta.url || "");
  const isNextImageProxy = /\/_next\/image\?/i.test(urlStr);
  const isCloudflareImageProxy = /\/cdn-cgi\/image\//i.test(urlStr);
  const isCloudinaryTransform = /res\.cloudinary\.com\/.+\/image\/upload\//i.test(urlStr) && !/fl_keep_iptc/i.test(urlStr);
  const cdnTransformPathDetected = isNextImageProxy || isCloudflareImageProxy || isCloudinaryTransform || cdnInfo.likelyStripsMetadata;

  let article50Status = "NO_PROVENANCE_METADATA";
  if (c2paPresent && (c2paAssertions.length > 0 || digitalSourceTypes.length > 0)) {
    article50Status = "C2PA_PRESENT";
  } else if (c2paPresent) {
    article50Status = "C2PA_BOX_DETECTED";
  } else if (digitalSourceTypes.length > 0) {
    article50Status = "IPTC_ONLY_NO_C2PA";
  } else if (cdnTransformPathDetected) {
    article50Status = "LIKELY_STRIPPED_BY_CDN";
  }

  return {
    url: urlStr || null,
    filename: meta.filename || (urlStr ? urlStr.split("?")[0].split("/").pop() : "asset"),
    format,
    byteLength: bytes.byteLength,
    sha256,
    c2paPresent,
    c2paBoxFound: parsed.c2paBoxFound,
    c2paAssertions,
    digitalSourceTypes,
    doNotTrainFlag,
    signerIssuers,
    exifFound: parsed.exifFound,
    xmpFound: parsed.xmpFound,
    gpsRisk,
    aiSignalsDetected,
    leakedPrompts,
    cdnDetected: [
      ...cdnInfo.detected,
      ...(isNextImageProxy ? ["Next.js /_next/image optimizer (strips C2PA by default)"] : []),
      ...(isCloudflareImageProxy ? ["Cloudflare /cdn-cgi/image transform (requires metadata=keep)"] : []),
      ...(isCloudinaryTransform ? ["Cloudinary image transform (missing fl_keep_iptc)"] : []),
    ],
    cdnTransformPathDetected,
    metadataChunkCount: parsed.chunks.length,
    article50Status,
  };
}

function extractMediaUrlsFromHtml(html, baseOrigin) {
  const found = [];
  const seen = new Set();
  const pushUrl = (raw, role) => {
    const cleaned = String(raw || "").trim().replace(/&amp;/g, "&");
    if (!cleaned || cleaned.startsWith("data:") || cleaned.startsWith("blob:") || cleaned.startsWith("javascript:")) return;
    let abs;
    try {
      abs = new URL(cleaned, baseOrigin);
    } catch {
      return;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
    if (isBlockedPrivateHost(abs.hostname)) return;
    if (/\.svg(?:$|\?)/i.test(abs.pathname) || /favicon|icon-\d+|pixel\.gif|spacer/i.test(abs.pathname)) return;
    const key = abs.toString();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ url: key, role });
  };

  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) {
    pushUrl(m[1], "og_image");
  }
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi)) {
    pushUrl(m[1], "og_image");
  }
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    pushUrl(m[1], "img");
  }
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"'\s,]+)/gi)) {
    pushUrl(m[1], "source");
  }
  return found.slice(0, 8);
}

function inspectHtmlArticle50Disclosures(html) {
  const textSignals = [];
  if (/trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia/i.test(html)) {
    textSignals.push("Schema.org / IPTC DigitalSourceType markup found");
  }
  if (/<meta[^>]+name=["'][^"']*ai[-_]?(?:generated|disclosure|content)[^"']*["']/i.test(html)) {
    textSignals.push("HTML <meta> AI disclosure tag found");
  }
  if (/(?:generated\s+(?:with|by)\s+ai|ai[- ]generated\s+(?:image|media|content|visual)|content\s+credentials|c2pa\s+verified|made\s+with\s+ai)/i.test(html)) {
    textSignals.push("Visible Article 50(4) AI disclosure wording detected on page");
  }
  return {
    hasVisibleDisclosure: textSignals.length > 0,
    signals: textSignals,
  };
}

export function getArticle50DeadlineInfo(nowMs = Date.now()) {
  const daysRemaining = Math.ceil((DEC_2_2026_UTC_MS - nowMs) / 86_400_000);
  return {
    article50EffectiveDate: "2026-08-02",
    legacyMarkingGraceDeadline: "2026-12-02",
    daysUntilLegacyDeadline: daysRemaining,
    deadlineStatus:
      daysRemaining > 0
        ? `${daysRemaining} day(s) left before Dec 2, 2026 Article 50(2) legacy marking grace period closes`
        : "Article 50(2) legacy marking grace period has expired (full enforcement active)",
    maxStatutoryPenalty: "Up to €15,000,000 or 3% of worldwide annual turnover (EU AI Act Art. 99(4))",
  };
}

export async function scanLiveSiteArticle50(rawInput, fetchFn = fetch) {
  const target = normalizeTargetOrigin(rawInput);
  const deadline = getArticle50DeadlineInfo();

  const res = await fetchFn(target.fullUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Art50Scan/1.0; +https://art50-scan.ak10082247.workers.dev)",
      Accept: "text/html,application/xhtml+xml,image/*,video/*,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Target responded with HTTP ${res.status}.`), { httpStatus: 502 });
  }

  const pageHeaders = {};
  res.headers.forEach((v, k) => {
    pageHeaders[k.toLowerCase()] = v;
  });
  const contentType = pageHeaders["content-type"] || "";
  const pageCdn = detectCdnHeaders(pageHeaders);

  // Direct image/video URL mode
  if (/^(?:image|video|audio)\//i.test(contentType)) {
    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab.slice(0, MAX_MEDIA_BYTES));
    const asset = await inspectBinaryMedia(bytes, {
      url: target.fullUrl,
      contentType,
      headers: pageHeaders,
    });
    const score = asset.c2paPresent ? 95 : asset.digitalSourceTypes.length ? 65 : 25;
    return {
      ok: true,
      mode: "direct_media",
      target_url: target.fullUrl,
      hostname: target.hostname,
      scanned_at: new Date().toISOString(),
      deadline,
      readiness_score: score,
      verdict: asset.c2paPresent ? "PASS_C2PA_PRESENT" : "FAIL_NO_C2PA_MANIFEST",
      site_cdn: pageCdn.detected,
      page_disclosure: { hasVisibleDisclosure: false, signals: [] },
      assets_scanned: 1,
      assets_with_c2pa: asset.c2paPresent ? 1 : 0,
      assets_with_iptc_ai: asset.digitalSourceTypes.length ? 1 : 0,
      assets_stripped_by_cdn: asset.cdnTransformPathDetected && !asset.c2paPresent ? 1 : 0,
      assets_with_leaked_prompts: asset.leakedPrompts.length ? 1 : 0,
      assets_with_gps_risk: asset.gpsRisk ? 1 : 0,
      issues: asset.c2paPresent
        ? []
        : [
            {
              severity: "HIGH",
              code: asset.cdnTransformPathDetected ? "CDN_STRIPPED_C2PA" : "MISSING_C2PA_MANIFEST",
              title: asset.cdnTransformPathDetected
                ? "CDN image pipeline likely stripped C2PA Content Credentials"
                : "No C2PA / ISO 22144 machine-readable provenance manifest found",
              remediation:
                "Sign AI-generated assets with C2PA v2.1 (trainedAlgorithmicMedia) and disable lossy CDN metadata stripping.",
            },
          ],
      assets: [asset],
    };
  }

  // Website / SaaS / Agency HTML + live CDN media audit mode
  const html = (await res.text()).slice(0, 350_000);
  const pageDisclosure = inspectHtmlArticle50Disclosures(html);
  const mediaCandidates = extractMediaUrlsFromHtml(html, target.origin);

  const inspectedAssets = (
    await Promise.all(
      mediaCandidates.map(async (cand) => {
        try {
          const mr = await fetchFn(cand.url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Art50Scan/1.0)", Accept: "image/*,*/*;q=0.5" },
            redirect: "follow",
            signal: AbortSignal.timeout(5500),
          });
          if (!mr.ok) return null;
          const mHeaders = {};
          mr.headers.forEach((v, k) => {
            mHeaders[k.toLowerCase()] = v;
          });
          const ab = await mr.arrayBuffer();
          const bytes = new Uint8Array(ab.slice(0, MAX_MEDIA_BYTES));
          const info = await inspectBinaryMedia(bytes, {
            url: cand.url,
            contentType: mHeaders["content-type"] || "",
            headers: mHeaders,
          });
          return { ...info, role: cand.role };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  const assetsWithC2pa = inspectedAssets.filter((a) => a.c2paPresent).length;
  const assetsWithIptcAi = inspectedAssets.filter((a) => a.digitalSourceTypes.length > 0).length;
  const assetsStrippedByCdn = inspectedAssets.filter((a) => a.cdnTransformPathDetected && !a.c2paPresent).length;
  const assetsWithLeakedPrompts = inspectedAssets.filter((a) => a.leakedPrompts.length > 0).length;
  const assetsWithGpsRisk = inspectedAssets.filter((a) => a.gpsRisk).length;
  const allCdnNames = Array.from(
    new Set([...pageCdn.detected, ...inspectedAssets.flatMap((a) => a.cdnDetected || [])]),
  );

  const issues = [];
  if (inspectedAssets.length > 0 && assetsWithC2pa === 0) {
    issues.push({
      severity: "CRITICAL",
      code: "ZERO_C2PA_ASSETS",
      title: `0 of ${inspectedAssets.length} live media assets carry C2PA Content Credentials`,
      remediation:
        "Article 50(2) requires machine-readable provenance markings for AI-generated media. Embed C2PA v2.1 manifests before CDN upload.",
    });
  }
  if (assetsStrippedByCdn > 0) {
    issues.push({
      severity: "HIGH",
      code: "CDN_METADATA_STRIPPING",
      title: `${assetsStrippedByCdn} live asset(s) pass through a CDN/image optimizer that strips C2PA metadata by default`,
      remediation:
        "Configure metadata preservation (Cloudflare metadata=keep, Next.js unoptimized/custom C2PA loader, Cloudinary fl_keep_iptc).",
    });
  }
  if (!pageDisclosure.hasVisibleDisclosure) {
    issues.push({
      severity: "HIGH",
      code: "MISSING_ART50_4_DISCLOSURE",
      title: "No Article 50(4) human-perceptible AI disclosure or Schema.org DigitalSourceType markup detected",
      remediation:
        "Add visible disclosure labels and Schema.org DigitalSourceType metadata for any published AI-generated or manipulated media.",
    });
  }
  if (assetsWithLeakedPrompts > 0) {
    issues.push({
      severity: "MEDIUM",
      code: "LEAKED_AI_PROMPTS",
      title: `${assetsWithLeakedPrompts} live image(s) leak internal AI generation prompts / workflow JSON`,
      remediation:
        "Strip internal PNG tEXt/iTXt prompt chunks before publishing while preserving signed C2PA manifests.",
    });
  }
  if (assetsWithGpsRisk > 0) {
    issues.push({
      severity: "MEDIUM",
      code: "EXIF_GPS_EXPOSURE",
      title: `${assetsWithGpsRisk} live image(s) expose embedded EXIF GPS coordinates`,
      remediation: "Scrub GPS IFD tags losslessly prior to CDN deployment.",
    });
  }

  let score = 100;
  if (inspectedAssets.length > 0 && assetsWithC2pa === 0) score -= 45;
  else if (inspectedAssets.length > 0 && assetsWithC2pa < inspectedAssets.length) score -= 20;
  if (assetsStrippedByCdn > 0) score -= 20;
  if (!pageDisclosure.hasVisibleDisclosure) score -= 20;
  if (assetsWithLeakedPrompts > 0) score -= 10;
  if (assetsWithGpsRisk > 0) score -= 5;
  score = Math.max(5, Math.min(100, score));

  const verdict =
    score >= 80
      ? "READY_LOW_RISK"
      : score >= 50
        ? "PARTIAL_GAPS_ACTION_NEEDED"
        : "AT_RISK_ARTICLE_50_NONCOMPLIANT";

  return {
    ok: true,
    mode: "live_site_cdn_audit",
    target_url: target.fullUrl,
    hostname: target.hostname,
    scanned_at: new Date().toISOString(),
    deadline,
    readiness_score: score,
    verdict,
    site_cdn: allCdnNames,
    page_disclosure: pageDisclosure,
    assets_scanned: inspectedAssets.length,
    assets_with_c2pa: assetsWithC2pa,
    assets_with_iptc_ai: assetsWithIptcAi,
    assets_stripped_by_cdn: assetsStrippedByCdn,
    assets_with_leaked_prompts: assetsWithLeakedPrompts,
    assets_with_gps_risk: assetsWithGpsRisk,
    issues,
    assets: inspectedAssets,
  };
}

export function buildArticle50ComplianceKit(targetInput, tier, scanResult, notes = "") {
  const host = String(scanResult?.hostname || targetInput || "target-site.com").trim();
  const assets = scanResult?.assets || [];
  const cdns = (scanResult?.site_cdn || []).join(", ") || "Generic HTTP / Origin CDN";
  const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csvRows = [
    [
      "asset_url",
      "format",
      "bytes",
      "sha256",
      "article50_status",
      "c2pa_present",
      "assertions",
      "digital_source_types",
      "signers",
      "cdn_detected",
      "leaked_prompt_count",
      "gps_risk",
    ],
  ];
  for (const a of assets) {
    csvRows.push(
      [
        a.url || a.filename,
        a.format,
        a.byteLength,
        a.sha256,
        a.article50Status,
        a.c2paPresent ? "true" : "false",
        (a.c2paAssertions || []).join(";"),
        (a.digitalSourceTypes || []).join(";"),
        (a.signerIssuers || []).join(";"),
        (a.cdnDetected || []).join(";"),
        (a.leakedPrompts || []).length,
        a.gpsRisk ? "true" : "false",
      ].map(csvEsc),
    );
  }

  const executiveMemo = [
    `# EU AI Act Article 50 Technical Compliance & C2PA Audit Memo`,
    ``,
    `- **Target Domain / Asset:** \`${host}\``,
    `- **Scan Timestamp (UTC):** ${scanResult?.scanned_at || new Date().toISOString()}`,
    `- **Readiness Score:** **${scanResult?.readiness_score ?? 0} / 100** (\`${scanResult?.verdict || "UNKNOWN"}\`)`,
    `- **Detected CDN / Pipeline:** ${cdns}`,
    `- **Package Tier:** \`${tier}\``,
    `- **Statutory Context:** EU AI Act Article 50 became enforceable on **August 2, 2026**; legacy Article 50(2) machine-readable marking grace period closes **December 2, 2026** (penalties under Art. 99(4): up to €15,000,000 or 3% of global annual turnover).`,
    notes ? `- **Client Notes:** ${notes}` : "",
    ``,
    `## 1. Live Scan Summary`,
    `- Live media assets inspected: **${scanResult?.assets_scanned ?? 0}**`,
    `- Assets carrying C2PA Content Credentials: **${scanResult?.assets_with_c2pa ?? 0}**`,
    `- Assets likely stripped by CDN/image optimizer: **${scanResult?.assets_stripped_by_cdn ?? 0}**`,
    `- Page-level Article 50(4) disclosure detected: **${scanResult?.page_disclosure?.hasVisibleDisclosure ? "Yes" : "No"}**`,
    `- Assets leaking internal AI prompts: **${scanResult?.assets_with_leaked_prompts ?? 0}**`,
    `- Assets exposing EXIF GPS coordinates: **${scanResult?.assets_with_gps_risk ?? 0}**`,
    ``,
    `## 2. Prioritized Findings & Remediation`,
    ...((scanResult?.issues || []).length
      ? scanResult.issues.map((i, idx) => `${idx + 1}. **[${i.severity}] ${i.title}** — ${i.remediation}`)
      : ["1. No critical gaps detected on sampled live assets; maintain automated CI gating via `.github/workflows/art50-c2pa-gate.yml`."]),
    ``,
    `## 3. Included Implementation Files`,
    `- \`article50-compliance-audit.json\` — Machine-readable SHA-256 provenance evidence log`,
    `- \`asset-provenance-matrix.csv\` — Asset-by-asset C2PA, IPTC, and CDN survival spreadsheet`,
    `- \`cdn-c2pa-preservation-configs.md\` — Drop-in CDN configs so your edge stops stripping C2PA`,
    `- \`.github/workflows/art50-c2pa-gate.yml\` — Automated CI/CD pull-request gate`,
    `- \`c2pa-sign-and-verify-starter.mjs\` — Production Node.js C2PA v2.1 signing & verification pipeline`,
    `- \`article50-disclosure-snippets.html\` — WCAG-accessible Article 50(4) visible disclosure + JSON-LD`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const cdnConfigs = [
    `# CDN & Framework C2PA Preservation Playbook for ${host}`,
    `Detected edge/pipeline: ${cdns}`,
    ``,
    `## 1. Cloudflare Images / Polish (/cdn-cgi/image)`,
    "```nginx",
    "# Preserve C2PA JUMBF & copyright metadata in Cloudflare Image Resizing URLs:",
    "# Replace /cdn-cgi/image/width=1200,quality=85/asset.jpg with:",
    "/cdn-cgi/image/width=1200,quality=85,metadata=keep/asset.jpg",
    "# In Cloudflare Dashboard -> Speed -> Optimization -> Image Optimization -> Polish:",
    "# Set Polish to 'Lossless' or bypass Polish on /ai-media/* via Page/Cache Rules.",
    "```",
    ``,
    `## 2. Next.js / Vercel (/_next/image strips C2PA by default)`,
    "```js",
    "// next.config.mjs — preserve signed C2PA files by serving signed AI assets unoptimized or via a C2PA-aware loader",
    "export default {",
    "  images: {",
    "    unoptimized: true, // or pass unoptimized={true} on <Image /> components displaying C2PA-signed AI assets",
    "  },",
    "};",
    "```",
    ``,
    `## 3. Cloudinary`,
    "```text",
    "# Append fl_keep_iptc (and enable Preserve C2PA / Content Credentials in Cloudinary Upload Presets):",
    "https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,fl_keep_iptc/v1/your-asset.jpg",
    "```",
    ``,
    `## 4. Nginx / Reverse Proxy Verification Header`,
    "```nginx",
    "location ~* ^/media/.*\\.(jpe?g|png|webp|avif|mp4)$ {",
    "  add_header X-Content-Provenance-Policy \"c2pa-v2.1; eu-ai-act-art50\" always;",
    "  # Do NOT pass signed media through image_filter or strip-metadata proxies",
    "}",
    "```",
  ].join("\n");

  const ghWorkflow = [
    `name: EU AI Act Article 50 C2PA Provenance Gate`,
    `on:`,
    `  pull_request:`,
    `    paths:`,
    `      - "public/**"`,
    `      - "assets/**"`,
    `      - "static/**"`,
    `  workflow_dispatch:`,
    `jobs:`,
    `  verify_c2pa_and_live_cdn:`,
    `    runs-on: ubuntu-latest`,
    `    steps:`,
    `      - uses: actions/checkout@v4`,
    `      - uses: actions/setup-node@v4`,
    `        with:`,
    `          node-version: "22"`,
    `      - name: Audit Live Production CDN Survival via Art50Scan`,
    `        run: |`,
    `          RESP=$(curl -sS "https://art50-scan.ak10082247.workers.dev/api/scan?url=${encodeURIComponent(scanResult?.target_url || `https://${host}`)}")`,
    `          echo "$RESP" | jq '{hostname, readiness_score, verdict, assets_scanned, assets_with_c2pa, assets_stripped_by_cdn}'`,
    `          SCORE=$(echo "$RESP" | jq -r '.readiness_score')`,
    `          if [ "$SCORE" -lt 70 ]; then`,
    `            echo "::error::EU AI Act Article 50 readiness score ($SCORE/100) below 70 threshold"`,
    `            exit 1`,
    `          fi`,
  ].join("\n");

  const signingStarter = [
    `// Production EU AI Act Article 50 C2PA v2.1 Signing & Verification Starter`,
    `// Install official C2PA Node SDK: npm install c2pa-node`,
    `import { createC2pa, ManifestBuilder } from "c2pa-node";`,
    `import fs from "node:fs/promises";`,
    ``,
    `export async function signAiAssetForArticle50({ inputPath, outputPath, certPem, privateKeyPem, generatorName = "AI Pipeline" }) {`,
    `  const c2pa = createC2pa({`,
    `    signer: {`,
    `      type: "local",`,
    `      certificate: Buffer.from(certPem),`,
    `      privateKey: Buffer.from(privateKeyPem),`,
    `      algorithm: "es256",`,
    `      tsaUrl: "http://timestamp.digicert.com",`,
    `    },`,
    `  });`,
    `  const manifest = new ManifestBuilder({`,
    `    claim_generator: "${host} Article50 Pipeline/1.0",`,
    `    format: "image/jpeg",`,
    `    assertions: [`,
    `      {`,
    `        label: "c2pa.actions",`,
    `        data: {`,
    `          actions: [`,
    `            {`,
    `              action: "c2pa.created",`,
    `              softwareAgent: generatorName,`,
    `              digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",`,
    `            },`,
    `          ],`,
    `        },`,
    `      },`,
    `    ],`,
    `  });`,
    `  const inputBuffer = await fs.readFile(inputPath);`,
    `  const { signedAsset } = await c2pa.sign({ asset: { buffer: inputBuffer, mimeType: "image/jpeg" }, manifest });`,
    `  await fs.writeFile(outputPath, signedAsset.buffer);`,
    `  return { signed: true, outputPath };`,
    `}`,
  ].join("\n");

  const disclosureHtml = [
    `<!-- EU AI Act Article 50(4) Human-Perceptible AI Disclosure Badge + Schema.org DigitalSourceType -->`,
    `<figure class="art50-media" data-ai-generated="true" itemscope itemtype="https://schema.org/ImageObject">`,
    `  <img src="/media/example-ai-hero.jpg" alt="Illustrative visual generated with AI" itemprop="contentUrl" />`,
    `  <meta itemprop="creditText" content="AI-generated visual (EU AI Act Art. 50 disclosure)" />`,
    `  <figcaption style="font-size:0.8rem;color:#475569;margin-top:0.35rem;" aria-label="AI-generated content disclosure">`,
    `    <strong>AI Disclosure (EU AI Act Art. 50):</strong> Generated or materially modified with AI &middot; C2PA Content Credentials embedded.`,
    `  </figcaption>`,
    `</figure>`,
    `<script type="application/ld+json">`,
    JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "ImageObject",
        contentUrl: `https://${host}/media/example-ai-hero.jpg`,
        digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
        creditText: "AI-generated media marked in accordance with EU AI Act Article 50",
      },
      null,
      2,
    ),
    `</script>`,
  ].join("\n");

  const files = {
    "article50-compliance-audit.json": JSON.stringify(scanResult || { hostname: host }, null, 2),
    "asset-provenance-matrix.csv": csvRows.map((r) => r.join(",")).join("\n"),
    "article50-executive-memo.md": executiveMemo,
    "cdn-c2pa-preservation-configs.md": cdnConfigs,
    ".github/workflows/art50-c2pa-gate.yml": ghWorkflow,
    "c2pa-sign-and-verify-starter.mjs": signingStarter,
    "article50-disclosure-snippets.html": disclosureHtml,
  };

  if (tier && /pro|agency/i.test(String(tier))) {
    files["api-and-multi-site-checklist.md"] = [
      `# Pro Multi-Site & Automated CI / x402 API Verification Guide`,
      ``,
      `- **Single-Call Verification Endpoint:** \`POST https://art50-scan.ak10082247.workers.dev/api/verify-c2pa\` ($0.05 USDC via x402 V2 Base/Solana, or free GET /api/scan for interactive web audits).`,
      `- **Agency Rollout Steps before December 2, 2026:**`,
      `  1. Audit every client production domain & staging CDN with \`/api/scan?url=...\`.`,
      `  2. Enable C2PA preservation rules in Cloudflare/Vercel/Cloudinary/Shopify using \`cdn-c2pa-preservation-configs.md\`.`,
      `  3. Install \`.github/workflows/art50-c2pa-gate.yml\` in every frontend repo.`,
      `  4. Sign newly generated AI assets with \`c2pa-sign-and-verify-starter.mjs\` and attach Article 50(4) badges.`,
      `  5. Archive \`article50-compliance-audit.json\` quarterly for EU market surveillance inquiries.`,
    ].join("\n");
  }

  return {
    domain: host,
    diagnostic: {
      hostname: host,
      readiness_score: scanResult?.readiness_score ?? 0,
      verdict: scanResult?.verdict || "SCANNED",
      assets_scanned: assets.length,
      scanned_at: scanResult?.scanned_at || new Date().toISOString(),
    },
    files,
  };
}
