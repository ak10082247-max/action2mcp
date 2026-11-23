#!/usr/bin/env python3
"""
CautionWatch Strict Poller ("Caution: Video flagged for unverified content" ONLY).

Discovers candidate TikTok posts via Option A scraper APIs (EnsembleData, RapidAPI,
or Apify), strictly filters payloads for "Video flagged for unverified content"
in warnInfo/labelTop/contentDesc/riskInfos/video_label, saves fallback records to
brand_watch/flagged_videos.json & brand_watch/seed_caution.js, syncs to the Worker
via POST /api/ingest-caution, and dispatches deduped subscriber alerts when
description, voice_to_text, author_username, or hashtags match a watched keyword.

Safety guarantees:
- Strictly zero unflagged/clean/AI-labeled/general-news videos pass the filter.
- Refuses to spend Apify/EnsembleData/RapidAPI credits unless `--live` is passed.
"""
from __future__ import annotations

import argparse
import concurrent.futures
from datetime import datetime, timezone
import ipaddress
import json
import os
import re
import socket
import sys
import urllib.parse
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from outreach_common import (  # noqa: E402
    http_fetch,
    http_get_json,
    load_json_state,
    load_workspace_env,
    resolve_smtp_credentials,
    save_json_state,
    send_smtp_email,
)

BRAND_WATCH_URL = os.environ.get(
    "BRAND_WATCH_URL",
    "https://brand-watch.ak10082247.workers.dev",
).rstrip("/")
FLAGGED_JSON_PATH = os.path.join(REPO_ROOT, "brand_watch", "flagged_videos.json")
SEED_JS_PATH = os.path.join(REPO_ROOT, "brand_watch", "seed_caution.js")
ALERT_STATE_PATH = os.path.join(REPO_ROOT, "data", "caution_alert_state.json")

UNVERIFIED_CAUTION_RE = re.compile(
    r"(?:caution:\s*)?(?:video\s+)?flagged\s+for\s+unverified\s+content",
    re.IGNORECASE,
)

DEFAULT_DISCOVERY_QUERIES = [
    "anthony joshua not following the script",
    "they showed anthony joshua what happens",
    "not following the script",
    "cloned celebrity video proof",
    "celebrity faked death proof",
    "celebrity death hoax tiktok",
    "staged video exposed",
    "fake breaking news footage",
    "before this gets deleted",
    "they tried to delete this video",
    "leaked insider audio exposed",
    "deepfake voice scandal leaked",
    "rigged election ballot video",
    "martial law declared tonight",
    "emergency broadcast tonight alert",
    "ww3 started today breaking",
    "yellowstone eruption live footage",
    "hidden under ice antarctica",
    "nasa leaked alien footage",
    "ufo landing footage real",
    "airplane UFO spotted from window",
    "giant skeleton discovered proof",
    "ancient giant bones unearthed",
    "miracle cancer cure secret",
    "doctors wont tell you secret cure",
    "poison in tap water warning",
    "chemtrails toxic spraying proof",
    "simulated moon landing proof",
    "shadow government leaked footage",
    "vaccine microchip truth exposed",
    "earthquake warning tonight live",
    "tsunami alert breaking live",
    "fake hurricane tornado footage",
    "tiktok flagged this unverified",
    "flagged for unverified content",
    "caution video flagged for unverified",
    "#maskedtruth",
    "#maskedtruthmt",
    "#notfollowingthescript",
    "#unverifiedcontent",
    "#censoredtruth",
    "#beforeitsdeleted",
    "#exposedtruth",
    "#deepfakeexposed",
    "#fakebreakingnews",
]

DEFAULT_SUSPECT_PROFILES = [
    "maskedtruthnews",
    "unmasked_truth101",
    "th3.mask3d.truth",
    "vfortruths",
    "masterysoulreality",
    "we.are.changee",
    ".masked.truth",
    "maskedtruthmt",
]

WARNING_FIELDS = (
    "misc_info",
    "warnInfo",
    "warningInfo",
    "riskInfos",
    "risk_infos",
    "labelTop",
    "label_top",
    "label_top_text",
    "contentDesc",
    "video_label",
    "videoLabel",
    "video_labels",
    "cautionLabel",
    "warningText",
    "moderationInfo",
    "flagInfo",
    "maskInfo",
    "mask_infos",
    "warning",
    "anchors",
    "badges",
)

WARNING_SUBKEYS = ("text", "content", "label", "title", "desc", "warning", "msg", "reason")
TOP_LEVEL_IGNORED_KEYS = {
    "text", "desc", "description", "title", "video_description", "voice_to_text", "voiceToText",
    "transcript", "comments", "hashtags", "hashtag_names", "suggestedWords",
    "diversificationLabels", "author", "authorMeta", "channel", "music",
    "musicMeta", "challenges", "textExtra", "effectStickers", "content_desc", "content_desc_extra",
}
NESTED_IGNORED_KEYS = {
    "comments", "hashtags", "hashtag_names", "suggestedWords", "diversificationLabels",
    "author", "authorMeta", "channel", "music", "musicMeta", "challenges", "effectStickers",
    "content_desc", "content_desc_extra",
}
WARNING_KEY_RE = re.compile(
    r"(?:warn|caution|risk|flag|moderation|notice|banner|badge|label|mask|anchor|penalty|verify)",
    re.IGNORECASE,
)


def _extract_root(raw_item: dict) -> dict:
    if not isinstance(raw_item, dict):
        return {}
    for key in ("aweme_detail", "aweme_info", "itemStruct"):
        val = raw_item.get(key)
        if isinstance(val, dict):
            return val
        if isinstance(val, str) and val.strip().startswith("{"):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
    item_info = raw_item.get("itemInfo")
    if isinstance(item_info, dict) and isinstance(item_info.get("itemStruct"), dict):
        return item_info["itemStruct"]
    return raw_item


def _parse_misc_info_caution(raw_misc) -> str | None:
    obj = raw_misc
    if isinstance(raw_misc, str):
        trimmed = raw_misc.strip()
        if not trimmed.startswith("{"):
            return None
        try:
            obj = json.loads(trimmed)
        except Exception:
            return None
    if not isinstance(obj, dict):
        return None
    ktf = obj.get("ktf_info")
    if not isinstance(ktf, dict):
        return None
    if ktf.get("show_warning") is False:
        return None
    warn_tmpl = str(ktf.get("warning_text") or ktf.get("message_text_on_share") or "").strip()
    if not UNVERIFIED_CAUTION_RE.search(warn_tmpl):
        return None
    label = str(ktf.get("caution_label") or "Caution:").strip()
    formatted = (warn_tmpl.replace("%s", label) if "%s" in warn_tmpl else warn_tmpl)
    formatted = re.sub(r"\s+", " ", formatted).strip()
    return formatted or "Caution: Video flagged for unverified content."


def _extract_content_desc_fallback(root: dict) -> str:
    raw = root.get("content_desc")
    if isinstance(raw, str) and raw.strip().startswith("["):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = None
    if isinstance(raw, list):
        return " ".join(str(x or "").strip() for x in raw if str(x or "").strip()).strip()
    return ""


def _collect_warning_strings(raw_item: dict) -> list[tuple[str, str]]:
    root = _extract_root(raw_item)
    candidates: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def push_text(field: str, text: str) -> None:
        cleaned = str(text or "").strip()
        if cleaned and (field, cleaned) not in seen:
            seen.add((field, cleaned))
            candidates.append((field, cleaned))

    def scan_node(field: str, value, depth: int = 0) -> None:
        if value is None or depth > 5:
            return
        if field == "misc_info":
            ktf_text = _parse_misc_info_caution(value)
            if ktf_text:
                push_text("misc_info.ktf_info", ktf_text)
                return
            if isinstance(value, str) and value.strip().startswith("{"):
                return
            if isinstance(value, dict) and "ktf_info" in value:
                return
        if isinstance(value, str):
            if field == "cautionText" and value.strip().startswith("{"):
                ktf_text = _parse_misc_info_caution(value)
                if ktf_text:
                    push_text("misc_info.ktf_info", ktf_text)
                    return
            push_text(field, value)
        elif isinstance(value, list):
            for entry in value:
                scan_node(field, entry, depth + 1)
        elif isinstance(value, dict):
            for k, subval in value.items():
                if k in NESTED_IGNORED_KEYS:
                    continue
                if isinstance(subval, str):
                    if k in WARNING_SUBKEYS or WARNING_KEY_RE.search(k):
                        push_text(field, subval)
                elif isinstance(subval, (dict, list)):
                    scan_node(field, subval, depth + 1)

    for field in WARNING_FIELDS:
        if field in root:
            scan_node(field, root.get(field))
        if isinstance(raw_item, dict) and field in raw_item:
            scan_node(field, raw_item.get(field))
    for k, v in root.items():
        if k not in TOP_LEVEL_IGNORED_KEYS and WARNING_KEY_RE.search(str(k)):
            scan_node(str(k), v)
    return candidates


def is_unverified_caution_match(raw_item: dict) -> tuple[str, str] | None:
    """Return (matched_field, caution_text) ONLY if raw_item carries the unverified Caution label."""
    if not isinstance(raw_item, dict):
        return None
    for field, text in _collect_warning_strings(raw_item):
        if UNVERIFIED_CAUTION_RE.search(text):
            return field, text
    return None


def extract_caution_record(
    raw_item: dict,
    source_provider: str = "scraper_api",
    query_tag: str = "",
) -> dict | None:
    """Strictly convert raw TikTok item to normalized CautionWatch record, or None if not Caution-unverified."""
    match = is_unverified_caution_match(raw_item)
    if not match:
        return None
    matched_field, caution_text = match
    root = _extract_root(raw_item)

    video_id = str(
        root.get("id")
        or root.get("aweme_id")
        or root.get("video_id")
        or root.get("videoId")
        or ""
    ).strip()

    raw_candidate_url = str(root.get("webVideoUrl") or root.get("url") or root.get("share_url") or "").strip()
    url_handle_match = re.search(r"tiktok\.com/@([^/?#]+)", raw_candidate_url, re.IGNORECASE)
    url_handle = url_handle_match.group(1).strip().lstrip("@") if url_handle_match else ""

    author_meta = root.get("authorMeta") or root.get("author") or root.get("channel") or {}
    if not isinstance(author_meta, dict):
        author_meta = {}
    candidate_user = str(
        author_meta.get("unique_id")
        or author_meta.get("name")
        or author_meta.get("username")
        or author_meta.get("uniqueId")
        or root.get("author_username")
        or (root.get("authorUsername") if str(root.get("authorUsername") or "").lower() != "unknown" else "")
        or root.get("handle")
        or url_handle
        or ""
    ).strip().lstrip("@")
    if candidate_user.lower() == "unknown" and url_handle:
        candidate_user = url_handle
    raw_user = candidate_user

    canonical_fallback = (
        f"https://www.tiktok.com/@{raw_user}/video/{video_id}"
        if video_id and raw_user
        else (f"https://www.tiktok.com/video/{video_id}" if video_id else "")
    )
    raw_url = raw_candidate_url or canonical_fallback
    if re.match(r"^https?://[^/]*tiktok\.com/@[^/?#]+/video/\d+", raw_url, re.IGNORECASE):
        raw_url = raw_url.split("?")[0]
    elif not raw_url and canonical_fallback:
        raw_url = canonical_fallback

    if not video_id and raw_url:
        m = re.search(r"/video/(\d+)", raw_url)
        if m:
            video_id = m.group(1)

    if not video_id or not raw_url:
        return None

    author_handle = f"@{raw_user}" if raw_user else str(author_meta.get("nickName") or author_meta.get("nickname") or "unknown")
    author_name = str(
        (root.get("authorName") if root.get("authorName") != "Unknown creator" else "")
        or author_meta.get("nickName")
        or author_meta.get("nickname")
        or author_meta.get("name")
        or raw_user
        or "Unknown creator"
    ).strip()

    raw_tags = root.get("hashtags")
    if not isinstance(raw_tags, list):
        raw_tags = root.get("hashtag_names") if isinstance(root.get("hashtag_names"), list) else root.get("cha_list") if isinstance(root.get("cha_list"), list) else []
    hashtags: list[str] = []
    for tag in raw_tags:
        val = tag if isinstance(tag, str) else (tag.get("name") or tag.get("title") or tag.get("cha_name") or "") if isinstance(tag, dict) else ""
        cleaned = str(val).strip().lstrip("#")
        if cleaned and cleaned not in hashtags:
            hashtags.append(cleaned)

    video_meta = root.get("videoMeta") or root.get("video") or {}
    if not isinstance(video_meta, dict):
        video_meta = {}
    cover = video_meta.get("coverUrl") or video_meta.get("cover") or ""
    if isinstance(cover, dict):
        url_list = cover.get("url_list") or []
        cover = url_list[0] if url_list else ""
    if not cover and isinstance(video_meta.get("origin_cover"), dict):
        origin_list = video_meta["origin_cover"].get("url_list") or []
        cover = origin_list[0] if origin_list else ""
    thumb = str(
        root.get("thumbnailUrl")
        or root.get("thumbnail_url")
        or cover
        or author_meta.get("avatar")
        or ""
    ).strip() or None

    desc = str(
        root.get("text")
        or root.get("desc")
        or root.get("description")
        or root.get("video_description")
        or root.get("title")
        or _extract_content_desc_fallback(root)
        or ""
    ).strip()[:600]
    voice = str(
        root.get("voice_to_text")
        or root.get("voiceToText")
        or root.get("transcript")
        or ""
    ).strip()[:1200]

    captured_at = str(
        root.get("capturedAt")
        or root.get("createTimeISO")
        or datetime.now(timezone.utc).isoformat()
    )
    resolved_matched_field = (
        str(root.get("matchedField") or "").strip()
        if matched_field == "cautionText" and root.get("matchedField")
        else matched_field
    )

    return {
        "id": str(video_id),
        "videoId": str(video_id),
        "sourceType": str(root.get("sourceType") or source_provider),
        "url": raw_url,
        "playerUrl": f"https://www.tiktok.com/player/v1/{video_id}" if video_id.isdigit() else None,
        "authorUsername": author_handle,
        "authorName": author_name,
        "authorUrl": f"https://www.tiktok.com/@{raw_user}" if raw_user else "",
        "description": desc,
        "voiceToText": voice,
        "hashtags": hashtags,
        "thumbnailUrl": thumb,
        "cautionText": caution_text,
        "matchedField": resolved_matched_field,
        "brandTag": str(root.get("brandTag") or root.get("query") or query_tag or "").strip()[:120],
        "capturedAt": captured_at,
    }


def load_flagged_videos(path: str = FLAGGED_JSON_PATH) -> list[dict]:
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.loads(fh.read())
        return [x for x in data if isinstance(x, dict) and UNVERIFIED_CAUTION_RE.search(str(x.get("cautionText", "")))] if isinstance(data, list) else []
    except Exception:
        return []


def write_flagged_artifacts(
    records: list[dict],
    json_path: str = FLAGGED_JSON_PATH,
    seed_js_path: str = SEED_JS_PATH,
) -> None:
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    os.makedirs(os.path.dirname(seed_js_path), exist_ok=True)
    strict_only = [
        r for r in records
        if isinstance(r, dict) and UNVERIFIED_CAUTION_RE.search(str(r.get("cautionText", "")))
    ]
    serialized = json.dumps(strict_only, indent=2, ensure_ascii=False)
    with open(json_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(serialized + "\n")
    seed_banner = (
        "// Auto-generated by scripts/poll_tiktok_caution.py\n"
        "// Strictly contains ONLY TikTok clips verified to carry 'Caution: Video flagged for unverified content'.\n"
        f"export const REPO_CAUTION_VIDEOS = {serialized};\n"
    )
    with open(seed_js_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(seed_banner)


def _normalize_existing_record(rec: dict) -> dict:
    out = dict(rec)
    caution = str(out.get("cautionText") or "")
    if caution.strip().startswith("{"):
        parsed = _parse_misc_info_caution(caution)
        if parsed:
            out["cautionText"] = parsed
            out["matchedField"] = "misc_info.ktf_info"
    u = str(out.get("url") or "")
    if re.match(r"^https?://[^/]*tiktok\.com/@[^/?#]+/video/\d+", u, re.IGNORECASE) and "?" in u:
        out["url"] = u.split("?")[0]
    return out


def merge_caution_records(existing: list[dict], incoming: list[dict], limit: int = 500) -> tuple[list[dict], list[dict]]:
    by_id: dict[str, dict] = {}
    ordered_ids: list[str] = []
    added: list[dict] = []

    for rec in existing:
        vid = str(rec.get("id") or rec.get("videoId") or "").strip()
        if vid and vid not in by_id:
            by_id[vid] = _normalize_existing_record(rec)
            ordered_ids.append(vid)

    new_ids: list[str] = []
    for rec in incoming:
        vid = str(rec.get("id") or rec.get("videoId") or "").strip()
        if not vid or not UNVERIFIED_CAUTION_RE.search(str(rec.get("cautionText", ""))):
            continue
        if vid not in by_id:
            added.append(rec)
            new_ids.append(vid)
        else:
            # Preserve richer fallback metadata and prefer cleaner URL/cautionText/author
            merged = dict(by_id[vid])
            for k, v in rec.items():
                cur = merged.get(k)
                if k == "cautionText" and isinstance(cur, str) and cur.strip().startswith("{") and isinstance(v, str) and not v.strip().startswith("{"):
                    merged[k] = v
                elif k == "matchedField" and cur in ("misc_info", "cautionText") and v == "misc_info.ktf_info":
                    merged[k] = v
                elif k == "url" and isinstance(cur, str) and "?" in cur and isinstance(v, str) and "?" not in v:
                    merged[k] = v
                elif k == "authorUsername" and (not cur or str(cur).lower() == "unknown") and v and str(v).lower() != "unknown":
                    merged[k] = v
                elif k == "authorName" and (not cur or cur == "Unknown creator") and v and v != "Unknown creator":
                    merged[k] = v
                elif v and not cur:
                    merged[k] = v
            by_id[vid] = merged
            continue
        by_id[vid] = rec

    merged_list = [by_id[vid] for vid in (new_ids + ordered_ids)[:limit]]
    return merged_list, added


def _resolve_ingest_token() -> str:
    return (
        os.environ.get("DASHBOARD_INGEST_TOKEN")
        or os.environ.get("KUROX_SIGNING_SECRET")
        or ""
    ).strip()


def fetch_subscriber_leads(worker_base: str = BRAND_WATCH_URL) -> list[dict]:
    token = _resolve_ingest_token()
    if not token:
        return []
    try:
        data = http_get_json(
            f"{worker_base}/api/leads",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        leads = data.get("leads") if isinstance(data, dict) else []
        return [l for l in leads if isinstance(l, dict)]
    except Exception:
        return []


def collect_discovery_queries(leads: list[dict], extra_queries: list[str] | None = None, cap: int = 48) -> list[str]:
    queries: list[str] = []
    seen: set[str] = set()

    def add_q(q: str) -> None:
        cleaned = q.strip()
        low = cleaned.lower()
        if cleaned and len(cleaned) >= 2 and low not in seen:
            seen.add(low)
            queries.append(cleaned)

    for lead in leads:
        raw_kw = str(lead.get("keywords") or "")
        for part in re.split(r"[,;\n]+", raw_kw):
            add_q(part)
        add_q(str(lead.get("company") or ""))

    for q in (extra_queries or []):
        add_q(q)
    if not extra_queries:
        for q in DEFAULT_DISCOVERY_QUERIES:
            add_q(q)
    return queries[:cap]


def poll_ensembledata(queries: list[str], max_items: int = 20) -> list[tuple[str, dict]]:
    token = (os.environ.get("ENSEMBLEDATA_TOKEN") or "").strip()
    if not token:
        return []
    base = os.environ.get("ENSEMBLEDATA_API_BASE", "https://ensembledata.com/apis").rstrip("/")
    results: list[tuple[str, dict]] = []
    for query in queries[:4]:
        if len(results) >= max_items:
            break
        q_clean = query.lstrip("#") if query.startswith("#") else query
        endpoint = (
            f"{base}/tt/hashtag/posts?name={urllib.parse.quote(q_clean)}&token={urllib.parse.quote(token)}"
            if query.startswith("#")
            else f"{base}/tt/keyword/search?name={urllib.parse.quote(q_clean)}&period=1&sorting=0&token={urllib.parse.quote(token)}"
        )
        try:
            payload = http_get_json(endpoint, timeout=18)
            raw_list = payload.get("data") if isinstance(payload, dict) else []
            if isinstance(raw_list, dict):
                raw_list = raw_list.get("data") or raw_list.get("aweme_list") or []
            for item in (raw_list or []):
                if isinstance(item, dict):
                    results.append((query, item))
                    if len(results) >= max_items:
                        break
        except Exception:
            continue
    return results


def poll_rapidapi(queries: list[str], max_items: int = 20) -> list[tuple[str, dict]]:
    key = (os.environ.get("RAPIDAPI_KEY") or "").strip()
    host = (os.environ.get("RAPIDAPI_HOST") or "tiktok-scraper7.p.rapidapi.com").strip()
    if not key:
        return []
    results: list[tuple[str, dict]] = []
    headers = {"x-rapidapi-key": key, "x-rapidapi-host": host}
    for query in queries[:4]:
        if len(results) >= max_items:
            break
        url = f"https://{host}/feed/search?keywords={urllib.parse.quote(query)}&count={min(max_items, 20)}&region=us&publish_time=7&sort_type=0"
        try:
            payload = http_get_json(url, headers=headers, timeout=18)
            videos = []
            data_node = payload.get("data") if isinstance(payload, dict) else None
            if isinstance(data_node, dict):
                videos = data_node.get("videos") or data_node.get("items") or []
            elif isinstance(data_node, list):
                videos = data_node
            for item in videos:
                if isinstance(item, dict):
                    results.append((query, item))
                    if len(results) >= max_items:
                        break
        except Exception:
            continue
    return results


DEFAULT_MAX_PER_TARGET = 30
FACTCHECK_TIKTOK_URL_RE = re.compile(
    r"https?://(?:www\.|m\.|vm\.|vt\.)?tiktok\.com/@[A-Za-z0-9_.]+/video/\d+"
)
FACTCHECK_HANDLE_RE = re.compile(r"tiktok\.com/(@[A-Za-z0-9_.]{2,35})")


def harvest_free_factcheck_targets(max_articles: int = 45) -> tuple[list[str], list[str]]:
    """Harvest public TikTok video URLs and creator handles from IFCN fact-checker feeds ($0)."""
    video_urls: set[str] = set()
    handles: set[str] = set()
    article_urls: list[str] = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xml,*/*",
    }

    for source_url in (
        "https://www.politifact.com/personalities/tiktok-posts/",
        "https://www.politifact.com/personalities/tiktok-posts/?page=2",
        "https://www.politifact.com/search/?q=tiktok.com",
        "https://www.politifact.com/search/?q=tiktok.com&page=2",
        "https://www.politifact.com/rss/factchecks/",
        "https://leadstories.com/atom.xml",
        "https://checkyourfact.com/?s=tiktok",
    ):
        try:
            st, _, _, raw = http_fetch(source_url, headers=headers, timeout=8, verify_ssl=False)
            if st >= 400:
                continue
            txt = raw.decode("utf-8", "replace")
            for u in FACTCHECK_TIKTOK_URL_RE.findall(txt):
                video_urls.add(u)
            for h in FACTCHECK_HANDLE_RE.findall(txt):
                handles.add(h.lstrip("@"))
            if "politifact.com/personalities" in source_url or "politifact.com/search" in source_url:
                for rel in re.findall(r'href="(?:https?://(?:www\.)?politifact\.com)?(/factchecks/\d{4}/[^"#? ]+)"', txt):
                    full = f"https://www.politifact.com{rel}"
                    if full not in article_urls:
                        article_urls.append(full)
            elif "checkyourfact.com" in source_url:
                for link in re.findall(r'href="(https?://checkyourfact\.com/\d{4}/[^"#? ]+)"', txt):
                    if link not in article_urls:
                        article_urls.append(link)
        except Exception:
            continue

    def _fetch_article(art_url: str) -> tuple[list[str], list[str]]:
        try:
            st, _, _, raw = http_fetch(art_url, headers=headers, timeout=7, verify_ssl=False)
            if st >= 400:
                return [], []
            txt = raw.decode("utf-8", "replace")
            return FACTCHECK_TIKTOK_URL_RE.findall(txt), [h.lstrip("@") for h in FACTCHECK_HANDLE_RE.findall(txt)]
        except Exception:
            return [], []

    if article_urls:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for vids, hs in pool.map(_fetch_article, article_urls[:max_articles]):
                video_urls.update(vids)
                handles.update(hs)

    for u in video_urls:
        m = FACTCHECK_HANDLE_RE.search(u)
        if m:
            handles.add(m.group(1).lstrip("@"))
    return sorted(video_urls), sorted(handles)


def collect_discovery_profiles(
    leads: list[dict],
    existing_flagged: list[dict] | None = None,
    extra_profiles: list[str] | None = None,
    cap: int = 8,
) -> list[str]:
    profiles: list[str] = []
    seen: set[str] = set()

    def add_p(handle: str) -> None:
        cleaned = str(handle or "").strip().lstrip("@")
        if cleaned and re.fullmatch(r"[A-Za-z0-9_.]{2,35}", cleaned) and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            profiles.append(cleaned)

    for p in (extra_profiles or []):
        add_p(p)
    for p in DEFAULT_SUSPECT_PROFILES:
        add_p(p)
    for lead in leads:
        for chunk in re.split(r"[,;\n\s]+", str(lead.get("keywords") or "")):
            if chunk.strip().startswith("@"):
                add_p(chunk.strip())
    for item in (existing_flagged or []):
        add_p(str(item.get("authorUsername") or ""))
    return profiles[:cap]


def summarize_raw_diagnostics(raw_items: list[tuple[str, dict]], sample_limit: int = 8) -> dict:
    """Summarize all raw scraper keys, authors, & warning signals without exposing secrets."""
    key_counts: dict[str, int] = {}
    author_counts: dict[str, int] = {}
    warning_signals: list[dict] = []
    risk_infos_contents: dict[str, int] = {}
    unverified_hits_anywhere: list[dict] = []
    penalty_anomalies: list[dict] = []
    sample_previews: list[dict] = []
    target_hits: list[dict] = []
    ssr_checked = 0

    for src, raw in raw_items:
        if not isinstance(raw, dict):
            continue
        root = _extract_root(raw)
        if "_ssr_itemStruct" in raw or "penaltyContext" in raw or "penaltyContext" in root:
            ssr_checked += 1
        pc = root.get("penaltyContext") or raw.get("penaltyContext") or {}
        if isinstance(pc, dict) and (
            str(pc.get("display_penalty_type") or "0") != "0"
            or str(pc.get("display_ui_type") or "0") != "0"
            or int(pc.get("display_policy") or 0) != 0
            or root.get("warnInfo")
            or raw.get("warnInfo")
            or root.get("maskType")
        ):
            if len(penalty_anomalies) < sample_limit:
                penalty_anomalies.append({
                    "id": str(root.get("id") or root.get("aweme_id") or "")[:32],
                    "url": str(root.get("webVideoUrl") or root.get("postPage") or root.get("url") or root.get("share_url") or "")[:100],
                    "text": str(root.get("text") or root.get("desc") or root.get("title") or "")[:90],
                    "warnInfo": root.get("warnInfo") or raw.get("warnInfo"),
                    "maskType": root.get("maskType"),
                    "penaltyContext": pc,
                })
        for k in list(raw.keys()):
            key_counts[k] = key_counts.get(k, 0) + 1
        author_obj = root.get("authorMeta") or root.get("author") or root.get("channel") or {}
        author_name = str(
            (author_obj.get("unique_id") or author_obj.get("name") or author_obj.get("username") or author_obj.get("uniqueId") or "")
            if isinstance(author_obj, dict)
            else ""
        )[:40]
        if author_name:
            author_counts[author_name] = author_counts.get(author_name, 0) + 1
        ri = root.get("risk_infos") or raw.get("risk_infos") or {}
        if isinstance(ri, dict) and str(ri.get("content") or "").strip():
            rc = str(ri.get("content")).strip()
            risk_infos_contents[rc] = risk_infos_contents.get(rc, 0) + 1
        non_caption_blob = json.dumps({
            k: v for k, v in root.items()
            if k not in {"desc", "text", "title", "original_client_text", "share_url", "cha_list", "hashtags", "hashtag_names", "suggest_words", "suggestedWords", "search_desc"}
        }, ensure_ascii=False)
        if "unverified" in non_caption_blob.lower() and len(unverified_hits_anywhere) < 10:
            for k, v in root.items():
                if k in {"desc", "text", "title", "original_client_text", "share_url", "cha_list", "hashtags", "suggest_words", "suggestedWords", "search_desc"}:
                    continue
                if "unverified" in json.dumps(v, ensure_ascii=False).lower():
                    unverified_hits_anywhere.append({
                        "id": str(root.get("id") or root.get("aweme_id") or "")[:32],
                        "author": author_name,
                        "key": k,
                        "value": json.dumps(v, ensure_ascii=False)[:240],
                    })
        cands = [
            (f, t) for f, t in _collect_warning_strings(raw)
            if len(t) >= 6 and any(ch.isalpha() for ch in t) and not t.startswith("http")
        ]
        if cands and len(warning_signals) < sample_limit:
            warning_signals.append({
                "source": src,
                "id": str(root.get("id") or root.get("aweme_id") or "")[:32],
                "url": str(root.get("webVideoUrl") or root.get("postPage") or root.get("url") or root.get("share_url") or "")[:100],
                "warnings": [{"field": f, "text": t[:160]} for f, t in cands[:4]],
            })
        text_val = str(root.get("text") or root.get("desc") or root.get("title") or "")
        if len(target_hits) < 6 and (
            author_name.lower() == "maskedtruthmt"
            or any(tok in text_val.lower() for tok in ("anthony", "script", "maskedtruth", "unverified", "caution"))
        ):
            extra_flags = {
                k: root.get(k)
                for k in root.keys()
                if WARNING_KEY_RE.search(str(k)) and k not in {"authorMeta", "text", "desc", "title"}
            }
            target_hits.append({
                "source": src,
                "id": str(root.get("id") or root.get("aweme_id") or "")[:32],
                "author": author_name,
                "url": str(root.get("webVideoUrl") or root.get("postPage") or root.get("url") or "")[:100],
                "text": text_val[:100],
                "flag_fields": extra_flags,
            })
        if len(sample_previews) < 4:
            sample_previews.append({
                "source": src,
                "id": str(root.get("id") or root.get("aweme_id") or "")[:32],
                "author": author_name,
                "text": text_val[:80],
            })
    return {
        "ssr_enriched_count": ssr_checked,
        "all_keys": [f"{k}:{v}" for k, v in sorted(key_counts.items())],
        "authors_seen": sorted(author_counts.items(), key=lambda kv: -kv[1])[:15],
        "risk_infos_contents": sorted(risk_infos_contents.items(), key=lambda kv: -kv[1]),
        "unverified_hits_anywhere": unverified_hits_anywhere,
        "warning_signals_seen": warning_signals,
        "penalty_anomalies": penalty_anomalies,
        "target_hits": target_hits,
        "sample_previews": sample_previews,
    }


REHYDRATION_RE = re.compile(
    r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
    re.DOTALL,
)
SSR_BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


def fetch_tiktok_ssr_item_struct(video_url: str) -> dict | None:
    """Passively inspect public TikTok video SSR JSON for warnInfo/penalty metadata (never solves CAPTCHAs)."""
    if not video_url or "tiktok.com/" not in video_url or "/video/" not in video_url:
        return None
    try:
        st, _, _, raw = http_fetch(
            video_url,
            headers={"User-Agent": SSR_BROWSER_UA, "Accept": "text/html,application/xhtml+xml"},
            timeout=9,
            verify_ssl=True,
        )
        if st >= 400:
            return None
        html = raw.decode("utf-8", "replace")
        m = REHYDRATION_RE.search(html)
        if not m:
            return None
        payload = json.loads(m.group(1))
        vd = (payload.get("__DEFAULT_SCOPE__") or {}).get("webapp.video-detail") or {}
        if vd.get("statusCode") not in (0, "0", None):
            return None
        st_obj = (vd.get("itemInfo") or {}).get("itemStruct")
        return st_obj if isinstance(st_obj, dict) else None
    except Exception:
        return None


def enrich_items_with_tiktok_ssr(
    raw_items: list[tuple[str, dict]],
    extra_urls: list[str] | None = None,
    max_fetches: int = 80,
) -> list[tuple[str, dict]]:
    """Attach live TikTok SSR itemStruct fields (warnInfo, penaltyContext, contentDesc) to candidate items."""
    out: list[tuple[str, dict]] = []
    seen_urls: set[str] = set()
    to_fetch: list[tuple[int, str]] = []

    for src, raw in raw_items:
        if not isinstance(raw, dict) or raw.get("error"):
            continue
        item_copy = dict(raw)
        out.append((src, item_copy))
        idx = len(out) - 1
        root = _extract_root(item_copy)
        candidate_url = str(
            root.get("webVideoUrl") or root.get("postPage") or root.get("url") or ""
        ).strip()
        if not candidate_url:
            vid = str(root.get("id") or root.get("aweme_id") or "").strip()
            author = root.get("authorMeta") or root.get("author") or root.get("channel") or {}
            uname = str((author.get("name") or author.get("username") or author.get("uniqueId") or "") if isinstance(author, dict) else "").strip().lstrip("@")
            if vid and uname:
                candidate_url = f"https://www.tiktok.com/@{uname}/video/{vid}"
                item_copy.setdefault("webVideoUrl", candidate_url)
        if candidate_url and "/video/" in candidate_url and not _collect_warning_strings(item_copy):
            if candidate_url not in seen_urls and len(to_fetch) < max_fetches:
                seen_urls.add(candidate_url)
                to_fetch.append((idx, candidate_url))

    for u in (extra_urls or []):
        if "/video/" in u and u not in seen_urls and len(to_fetch) < max_fetches:
            seen_urls.add(u)
            out.append(("factcheck_ssr", {"webVideoUrl": u}))
            to_fetch.append((len(out) - 1, u))

    if not to_fetch:
        return out

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        future_map = {ex.submit(fetch_tiktok_ssr_item_struct, url): idx for idx, url in to_fetch}
        for fut in concurrent.futures.as_completed(future_map):
            idx = future_map[fut]
            try:
                struct = fut.result()
            except Exception:
                struct = None
            if not struct:
                continue
            target = out[idx][1]
            target["_ssr_itemStruct"] = True
            for k in ("warnInfo", "warningInfo", "riskInfos", "labelTop", "contentDesc", "maskType", "penaltyContext", "desc", "id", "video", "author", "IsAigc", "AIGCDescription"):
                if struct.get(k) not in (None, "") and not target.get(k):
                    target[k] = struct.get(k)
    return out


def _fetch_large_json(url: str, timeout: int = 60):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "CautionWatch/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read(120_000_000).decode("utf-8", "replace"))


def poll_apify(
    queries: list[str],
    actor_id: str = "clockworks~free-tiktok-scraper",
    max_items: int = 40,
    min_balance_usd: float = 0.02,
    profiles: list[str] | None = None,
    post_urls: list[str] | None = None,
) -> list[tuple[str, dict]]:
    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        return []
    apify_remaining_usd = 5.0
    try:
        usage = http_get_json(f"https://api.apify.com/v2/users/me/usage/monthly?token={urllib.parse.quote(token)}", timeout=10)
        data = usage.get("data") if isinstance(usage, dict) else {}
        used = float(data.get("totalUsageCreditsUsdAfterVolumeDiscount") or data.get("totalUsageCreditsUsdBeforeVolumeDiscount") or 0.0)
        limits = http_get_json(f"https://api.apify.com/v2/users/me/limits?token={urllib.parse.quote(token)}", timeout=10)
        max_monthly = float((limits.get("data") or {}).get("monthlyUsageUsd") or 5.0)
        apify_remaining_usd = max(0.0, max_monthly - used)
        if apify_remaining_usd <= min_balance_usd:
            raise RuntimeError(f"Apify safety stop triggered: remaining ${apify_remaining_usd:.3f} <= ${min_balance_usd:.2f}")
    except RuntimeError:
        raise
    except Exception:
        pass

    hashtags = [q.lstrip("#") for q in queries if q.startswith("#")][:5]
    search_terms = [q for q in queries if not q.startswith("#")][:12]
    all_novi_terms: list[str] = []
    seen_novi: set[str] = set()
    for term in list(queries) + [f"@{p}" for p in (profiles or []) if p.strip()]:
        clean_t = str(term or "").strip()
        if clean_t and clean_t.lower() not in seen_novi:
            seen_novi.add(clean_t.lower())
            all_novi_terms.append(clean_t)
    clean_profiles = [p.lstrip("@") for p in (profiles or []) if p.strip()][:8]
    clean_post_urls = [u for u in (post_urls or []) if "/video/" in u][:45]
    expanded_actors: list[str] = []
    for a in ([x.strip() for x in actor_id.split(",") if x.strip()] or ["novi~tiktok-scraper-ultimate"]):
        if a == "novi~tiktok-scraper-ultimate" and apify_remaining_usd < 2.0:
            print(
                f"[apify] Remaining credit ${apify_remaining_usd:.3f} < $2.00 gate for novi~tiktok-scraper-ultimate; "
                "auto-switching to min=None mobile aweme actors (xtdata~tiktok-scraper, novi~tiktok-search-api).",
                file=sys.stderr,
            )
            for fb in ("xtdata~tiktok-scraper", "novi~tiktok-search-api"):
                if fb not in expanded_actors:
                    expanded_actors.append(fb)
        elif a not in expanded_actors:
            expanded_actors.append(a)
    actors = expanded_actors
    all_results: list[tuple[str, dict]] = []

    def _run_apify_job(
        single_actor_id: str,
        actor_input: dict,
        dataset_limit: int,
        tag_prefix: str = "",
        charge_cap_usd: float | None = None,
    ) -> list[tuple[str, dict]]:
        extra_q = ""
        if "novi~tiktok-scraper-ultimate" in single_actor_id:
            extra_q = "&memory=512"
        elif "novi~tiktok-search-api" in single_actor_id:
            extra_q = "&memory=256"
        elif "xtdata~" in single_actor_id:
            extra_q = "&memory=512"
        if charge_cap_usd is not None and charge_cap_usd > 0:
            extra_q += f"&maxTotalChargeUsd={charge_cap_usd:.2f}"
        run_url = f"https://api.apify.com/v2/acts/{urllib.parse.quote(single_actor_id)}/runs?token={urllib.parse.quote(token)}&waitForFinish=180{extra_q}"
        status, _, _, raw = http_fetch(
            run_url,
            method="POST",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            data=json.dumps(actor_input).encode("utf-8"),
            timeout=185,
        )
        if status >= 400:
            raise RuntimeError(f"Apify run start HTTP {status} ({single_actor_id}): {raw.decode('utf-8', 'replace')[:300]}")
        run_data = json.loads(raw.decode("utf-8", "replace")).get("data") or {}
        dataset_id = run_data.get("defaultDatasetId")
        if not dataset_id:
            return []
        items_url = f"https://api.apify.com/v2/datasets/{urllib.parse.quote(dataset_id)}/items?token={urllib.parse.quote(token)}&clean=false&limit={dataset_limit}"
        items = _fetch_large_json(items_url, timeout=60)
        label = f"apify:{single_actor_id}{tag_prefix}"
        if isinstance(items, list):
            return [(label, it) for it in items if isinstance(it, dict)]
        return []

    spent_est = 0.0
    per_actor_budget = max(15, max_items // max(1, len(actors)))
    for single_actor in actors:
        remaining = max(1, min(per_actor_budget, max_items - len(all_results)))
        if len(all_results) >= max_items:
            break
        if "xtdata~" in single_actor:
            xt_jobs: list[tuple[dict, int, str]] = []
            kw_only = [q for q in queries if not q.startswith("#")]
            tag_list = [q.lstrip("#") for q in queries if q.startswith("#")]
            if clean_profiles:
                p_lim = min(60, max(30, remaining // 4))
                for p in clean_profiles[:4]:
                    xt_jobs.append((
                        {
                            "type": "USER",
                            "region": "GB",
                            "url": f"https://www.tiktok.com/@{p}",
                            "keywords": [],
                            "maxItems": p_lim,
                            "isUnlimited": False,
                            "sortType": 0,
                            "publishTime": "ALL_TIME",
                        },
                        p_lim,
                        f"#user_{p}",
                    ))
            if tag_list and queries:
                t_lim = min(50, max(25, remaining // 5))
                for t in tag_list[:3]:
                    xt_jobs.append((
                        {
                            "type": "HASHTAG",
                            "region": "GB",
                            "url": f"https://www.tiktok.com/tag/{t}",
                            "keywords": [],
                            "maxItems": t_lim,
                            "isUnlimited": False,
                            "sortType": 0,
                            "publishTime": "ALL_TIME",
                        },
                        t_lim,
                        f"#tag_{t}",
                    ))
            if kw_only:
                s_lim = max(40, remaining // 3)
                for idx, chunk in enumerate([kw_only[10:22], kw_only[22:34]]):
                    if not chunk:
                        continue
                    xt_jobs.append((
                        {
                            "type": "SEARCH",
                            "region": "US" if idx == 0 else "GB",
                            "url": "",
                            "keywords": chunk,
                            "maxItems": s_lim,
                            "isUnlimited": False,
                            "sortType": 1,
                            "publishTime": "ALL_TIME",
                        },
                        s_lim,
                        f"#search{idx + 1}",
                    ))
            for inp, dlim, tpf in xt_jobs:
                avail = apify_remaining_usd - spent_est - 0.02
                if avail < 0.03:
                    break
                cap_usd = max(0.03, min(round(dlim * 0.0005 + 0.02, 2), 0.14, avail))
                try:
                    batch_res = _run_apify_job(single_actor, inp, dlim, tpf, charge_cap_usd=cap_usd)
                    all_results.extend(batch_res)
                    spent_est += max(0.005, len(batch_res) * 0.0004)
                except Exception as exc:
                    print(f"[xtdata batch error {tpf}] {exc}", file=sys.stderr)
            continue
        if "novi~tiktok-search-api" in single_actor:
            kw_pool = [q for q in queries if not q.startswith("#")] or ["anthony joshua not following the script"]
            high_priority_kws = (
                [f"@{p}" for p in clean_profiles[:2]]
                + kw_pool[:10]
                + [q for q in queries if q.startswith("#")][:3]
            )
            per_kw = max(25, min(50, remaining // max(1, min(10, len(high_priority_kws)))))
            for idx, kw in enumerate(high_priority_kws[:10]):
                avail = apify_remaining_usd - spent_est - 0.01
                if avail < 0.02 or len(all_results) >= max_items:
                    break
                cap_usd = max(0.02, min(round(per_kw * 0.0005 + 0.015, 2), 0.10, avail))
                inp = {
                    "keyword": kw,
                    "sortType": 0,
                    "region": "GB" if idx % 2 == 0 else "US",
                    "publishTime": "ALL_TIME",
                    "limit": per_kw,
                    "isDownloadVideoCover": False,
                    "isDownloadVideo": False,
                }
                try:
                    batch_res = _run_apify_job(single_actor, inp, per_kw, f"#q{idx + 1}", charge_cap_usd=cap_usd)
                    all_results.extend(batch_res)
                    spent_est += max(0.005, len(batch_res) * 0.0004)
                except Exception as exc:
                    print(f"[novi-search batch error {kw}] {exc}", file=sys.stderr)
            continue
        if "novi~" in single_actor:
            novi_jobs: list[tuple[dict, int, str]] = []
            # Dedicated startUrls jobs WITHOUT keywords (novi ignores startUrls whenever keywords are supplied)
            prof_urls = [f"https://www.tiktok.com/@{p}" for p in clean_profiles]
            tag_urls = [f"https://www.tiktok.com/tag/{q.lstrip('#')}" for q in queries if q.startswith("#")][:6]

            kw_only = [q for q in queries if not q.startswith("#")]
            if not kw_only:
                all_urls = (prof_urls + clean_post_urls + tag_urls)[:45]
                if all_urls:
                    novi_jobs.append(({"startUrls": all_urls, "maxItems": remaining}, remaining, "#urls"))
            else:
                direct_budget = min(max(len(clean_post_urls), 1), max(40, remaining // 4)) if clean_post_urls else 0
                if clean_post_urls and direct_budget > 0:
                    novi_jobs.append((
                        {"startUrls": clean_post_urls[:45], "maxItems": direct_budget},
                        direct_budget,
                        "#direct",
                    ))
                prof_budget = min(150, max(70, (remaining - direct_budget) // 3)) if prof_urls else 0
                if prof_urls and prof_budget > 0:
                    novi_jobs.append((
                        {"startUrls": prof_urls[:8], "maxItems": prof_budget},
                        prof_budget,
                        "#profiles",
                    ))
                tag_budget = min(120, max(50, (remaining - direct_budget - prof_budget) // 4)) if (tag_urls and remaining > 220) else 0
                if tag_urls and tag_budget > 0:
                    novi_jobs.append((
                        {"startUrls": tag_urls[:6], "maxItems": tag_budget},
                        tag_budget,
                        "#tags",
                    ))
                kw_budget = max(0, remaining - direct_budget - prof_budget - tag_budget)
                if kw_budget >= 25:
                    kw_pool = kw_only or ["anthony joshua not following the script"]
                    if kw_budget <= 120 and len(kw_pool) <= 10:
                        kw_chunks = [kw_pool]
                    else:
                        n_kw = min(3, max(1, (kw_budget + 119) // 120))
                        c_sz = max(1, (len(kw_pool) + n_kw - 1) // n_kw)
                        kw_chunks = [kw_pool[i:i + c_sz] for i in range(0, len(kw_pool), c_sz)][:3]
                    per_kw = max(30, kw_budget // max(1, len(kw_chunks)))
                    for idx, chunk in enumerate(kw_chunks):
                        loc = "GB" if idx % 2 == 1 else "US"
                        novi_jobs.append((
                            {"keywords": chunk, "maxItems": per_kw, "location": loc, "sortType": "MOST_LIKED"},
                            per_kw,
                            f"#b{idx + 1}",
                        ))

            spent_est = 0.0
            for inp, dlim, tpf in novi_jobs:
                avail = apify_remaining_usd - spent_est - 0.02
                if avail < 0.04:
                    break
                est_charge = round(dlim * 0.00045 + 0.03, 2)
                cap_usd = max(0.04, min(est_charge, 0.16, avail))
                try:
                    batch_res = _run_apify_job(single_actor, inp, dlim, tpf, charge_cap_usd=cap_usd)
                    all_results.extend(batch_res)
                    spent_est += max(0.01, len(batch_res) * 0.00035)
                except Exception as exc:
                    print(f"[novi batch error {tpf}] {exc}", file=sys.stderr)
                    if len(novi_jobs) == 1:
                        raise
            continue
        if "apidojo" in single_actor and "profile" in single_actor:
            if not clean_profiles:
                continue
            actor_input = {
                "usernames": clean_profiles,
                "startUrls": [f"https://www.tiktok.com/@{p}" for p in clean_profiles],
                "maxItems": max(remaining, 65),
            }
            dataset_limit = max(remaining, 65)
        elif "apidojo" in single_actor:
            actor_input = {
                "keywords": search_terms or ["flagged for unverified content"],
                "maxItems": remaining,
                "customMapFunction": "(object) => ({ ...object })",
            }
            if clean_post_urls:
                actor_input["startUrls"] = clean_post_urls[:6]
            dataset_limit = remaining
        elif "tiktok-video-scraper" in single_actor:
            actor_input = {
                "postURLs": clean_post_urls or ["https://www.tiktok.com/@maskedtruthmt/video/7702510622650518817"],
                "scrapeRelatedVideos": False,
                "shouldDownloadVideos": False,
                "shouldDownloadCovers": False,
            }
            dataset_limit = max(remaining, len(actor_input["postURLs"]))
        elif "xmolodtsov~" in single_actor:
            actor_input = {
                "keywords": search_terms[:2] or ["Anthony Joshua not following the script"],
                "maxVideosPerKeyword": max(5, min(20, remaining)),
            }
            dataset_limit = remaining
        else:
            target_groups = max(1, len(clean_profiles) + len(hashtags) + len(search_terms))
            per_target = max(5, min(70, remaining // target_groups))
            actor_input = {
                "shouldDownloadCovers": False,
                "shouldDownloadVideos": False,
                "resultsPerPage": per_target,
            }
            if clean_profiles:
                actor_input["profiles"] = clean_profiles
            if hashtags:
                actor_input["hashtags"] = hashtags
            if search_terms or (not clean_profiles and not hashtags and not clean_post_urls):
                actor_input["searchQueries"] = search_terms
            if clean_post_urls:
                actor_input["postURLs"] = clean_post_urls
            dataset_limit = max(remaining, per_target * target_groups)

        all_results.extend(_run_apify_job(single_actor, actor_input, dataset_limit))

    # Also harvest recent SUCCEEDED Apify datasets from this account ($0 credit cost) so no aweme_info item is missed
    try:
        runs_meta = http_get_json(
            f"https://api.apify.com/v2/actor-runs?token={urllib.parse.quote(token)}&limit=12&desc=true",
            timeout=12,
        )
        run_items = ((runs_meta.get("data") or {}).get("items") or []) if isinstance(runs_meta, dict) else []
        seen_ds: set[str] = set()
        for r_info in run_items:
            if not isinstance(r_info, dict) or r_info.get("status") != "SUCCEEDED":
                continue
            ds_id = str(r_info.get("defaultDatasetId") or "").strip()
            if not ds_id or ds_id in seen_ds:
                continue
            seen_ds.add(ds_id)
            ds_url = f"https://api.apify.com/v2/datasets/{urllib.parse.quote(ds_id)}/items?token={urllib.parse.quote(token)}&clean=false&limit=250"
            cached_items = _fetch_large_json(ds_url, timeout=25)
            if isinstance(cached_items, list):
                all_results.extend((f"apify:cached_dataset:{ds_id[:8]}", it) for it in cached_items if isinstance(it, dict))
    except Exception:
        pass

    return all_results


def sync_records_to_worker(records: list[dict], worker_base: str = BRAND_WATCH_URL) -> dict | None:
    token = _resolve_ingest_token()
    if not token or not records:
        return None
    total_accepted = 0
    total_rejected = 0
    latest_merged_total = 0
    synced_items: list[dict] = []
    batches = 0
    chunk_size = 15
    for idx in range(0, len(records), chunk_size):
        chunk = records[idx:idx + chunk_size]
        status, _, _, raw = http_fetch(
            f"{worker_base}/api/ingest-caution",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            data=json.dumps({"source": "automated_caution_poller", "items": chunk}).encode("utf-8"),
            timeout=25,
        )
        if status >= 400:
            raise RuntimeError(f"Worker /api/ingest-caution HTTP {status}: {raw.decode('utf-8', 'replace')[:250]}")
        resp = json.loads(raw.decode("utf-8", "replace"))
        batches += 1
        total_accepted += int(resp.get("accepted") or 0)
        total_rejected += int(resp.get("rejected") or 0)
        latest_merged_total = max(latest_merged_total, int(resp.get("merged_total") or 0))
        if isinstance(resp.get("items"), list):
            synced_items.extend(resp["items"])
    return {
        "ok": True,
        "batches": batches,
        "accepted": total_accepted,
        "rejected": total_rejected,
        "merged_total": latest_merged_total,
        "items": synced_items[:15],
    }


def _parse_lead_keywords(lead: dict) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for chunk in re.split(r"[,;\n]+", str(lead.get("keywords") or "")):
        cleaned = chunk.strip()
        if len(cleaned) >= 2 and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            terms.append(cleaned)
    company = str(lead.get("company") or "").strip()
    if len(company) >= 3 and company.lower() not in seen:
        terms.append(company)
    return terms


def match_records_to_leads(records: list[dict], leads: list[dict]) -> list[dict]:
    matches: list[dict] = []
    for lead in leads:
        terms = _parse_lead_keywords(lead)
        if not terms:
            continue
        for rec in records:
            haystack = " ".join([
                str(rec.get("description") or ""),
                str(rec.get("voiceToText") or ""),
                str(rec.get("authorUsername") or ""),
                str(rec.get("authorName") or ""),
                " ".join(f"#{h}" for h in (rec.get("hashtags") or [])),
                str(rec.get("brandTag") or ""),
            ]).lower()
            hit_terms = [t for t in terms if t.lower() in haystack]
            if hit_terms:
                matches.append({"lead": lead, "record": rec, "matched_terms": hit_terms})
    return matches


def is_safe_webhook_url(raw_url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(raw_url.strip())
        if parsed.scheme != "https" or not parsed.hostname:
            return False
        host = parsed.hostname.lower()
        if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".internal"):
            return False
        try:
            ip = ipaddress.ip_address(host)
            return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
        except ValueError:
            try:
                resolved = socket.gethostbyname(host)
                ip = ipaddress.ip_address(resolved)
                return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
            except Exception:
                return True
    except Exception:
        return False


def _send_resend_email(to_addr: str, subject: str, body: str) -> bool:
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    from_addr = (os.environ.get("RESEND_FROM") or "CautionWatch Alerts <onboarding@resend.dev>").strip()
    if not api_key:
        return False
    status, _, _, _ = http_fetch(
        "https://api.resend.com/emails",
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps({"from": from_addr, "to": [to_addr], "subject": subject, "text": body}).encode("utf-8"),
        timeout=15,
    )
    return 200 <= status < 300


def dispatch_subscriber_alerts(
    records: list[dict],
    leads: list[dict],
    state_path: str = ALERT_STATE_PATH,
    live_send: bool = False,
) -> dict:
    state = load_json_state(state_path, {"sent_alert_keys": []})
    sent_keys = set(state.get("sent_alert_keys") or [])
    candidate_matches = match_records_to_leads(records, leads)
    dispatched = 0
    skipped_dedupe = 0
    errors: list[str] = []

    smtp_user, smtp_pass = resolve_smtp_credentials()
    global_webhook = (os.environ.get("MAKE_WEBHOOK_URL") or "").strip()

    for m in candidate_matches:
        lead = m["lead"]
        rec = m["record"]
        dedupe_key = f"{lead.get('lead_id')}:{rec.get('videoId')}"
        if dedupe_key in sent_keys:
            skipped_dedupe += 1
            continue

        subject = f"[CautionWatch Alert] TikTok flagged for unverified content mentioning {', '.join(m['matched_terms'])}"
        body = (
            f"Hello {lead.get('contact_name') or lead.get('company')},\n\n"
            f"CautionWatch detected a TikTok video carrying the official moderation banner:\n"
            f"  Label: {rec.get('cautionText')}\n"
            f"  Matched Field: {rec.get('matchedField')}\n"
            f"  Matched Keywords: {', '.join(m['matched_terms'])}\n"
            f"  Direct URL: {rec.get('url')}\n"
            f"  Creator: {rec.get('authorUsername')}\n"
            f"  Caption Fallback: {rec.get('description')}\n"
            f"  Transcript Fallback: {rec.get('voiceToText')}\n\n"
            f"Evidence Portal & Dossier Download: {BRAND_WATCH_URL}\n"
        )

        if live_send:
            delivered = False
            to_email = str(lead.get("email") or "").strip()
            if to_email:
                try:
                    if _send_resend_email(to_email, subject, body):
                        delivered = True
                    elif smtp_user and smtp_pass:
                        send_smtp_email(to_email, subject, body, sender_name="CautionWatch Alerts")
                        delivered = True
                except Exception as exc:
                    errors.append(f"email:{dedupe_key}:{exc}")

            webhook_targets: list[str] = []
            if global_webhook and is_safe_webhook_url(global_webhook):
                webhook_targets.append(global_webhook)
            for candidate in re.findall(r"https://[^\s,;\"'<>]+", str(lead.get("notes") or "")):
                if is_safe_webhook_url(candidate) and candidate not in webhook_targets:
                    webhook_targets.append(candidate)

            for wh in webhook_targets:
                try:
                    st, _, _, _ = http_fetch(
                        wh,
                        method="POST",
                        headers={"Content-Type": "application/json"},
                        data=json.dumps({
                            "event": "caution_unverified_match",
                            "lead": lead,
                            "matched_terms": m["matched_terms"],
                            "video": rec,
                        }).encode("utf-8"),
                        timeout=10,
                    )
                    if 200 <= st < 300:
                        delivered = True
                except Exception as exc:
                    errors.append(f"webhook:{dedupe_key}:{exc}")

            if delivered:
                sent_keys.add(dedupe_key)
                dispatched += 1

    if live_send and dispatched > 0:
        state["sent_alert_keys"] = sorted(sent_keys)[-2000:]
        state["last_alert_at"] = datetime.now(timezone.utc).isoformat()
        save_json_state(state_path, state)

    return {
        "matched_alerts": len(candidate_matches),
        "dispatched": dispatched,
        "skipped_dedupe": skipped_dedupe,
        "errors": errors,
    }


def main(argv: list[str] | None = None) -> int:
    load_workspace_env(REPO_ROOT)
    parser = argparse.ArgumentParser(description="CautionWatch strict TikTok unverified-content poller.")
    parser.add_argument("--live", action="store_true", help="Actually call external scraper APIs & send subscriber alerts.")
    parser.add_argument("--provider", choices=("auto", "ensembledata", "rapidapi", "apify"), default="auto")
    parser.add_argument("--apify-actor", default="novi~tiktok-scraper-ultimate")
    parser.add_argument("--max-items", type=int, default=40, help="Hard cap on fetched raw items per run.")
    parser.add_argument("--query", action="append", default=[], help="Extra keyword or #hashtag query.")
    parser.add_argument("--profile", action="append", default=[], help="Extra TikTok @username profile to poll.")
    parser.add_argument("--post-url", action="append", default=[], help="Extra direct TikTok video URL to verify.")
    parser.add_argument("--no-harvest-free", action="store_true", help="Skip free fact-checker URL harvesting.")
    parser.add_argument("--no-ssr-enrich", action="store_true", help="Skip passive TikTok video page SSR enrichment.")
    parser.add_argument("--profiles-only", action="store_true", help="Poll ONLY suspect/subscribed profiles without keyword/hashtag dilution.")
    parser.add_argument("--search-only", action="store_true", help="Poll ONLY search/hashtag queries & fact-check URLs without profile crawls.")
    parser.add_argument("--input-json", default="", help="Process local raw scraper JSON list without spending API credits.")
    parser.add_argument("--sync-worker", action="store_true", help="Push stored records to Worker /api/ingest-caution.")
    parser.add_argument("--send-alerts", action="store_true", help="Allow dispatching email/webhook alerts to matched leads.")
    args = parser.parse_args(argv)

    BRAND_WATCH_URL_RUNTIME = (
        os.environ.get("BRAND_WATCH_URL") or BRAND_WATCH_URL
    ).rstrip("/")
    existing = load_flagged_videos(FLAGGED_JSON_PATH)
    leads = fetch_subscriber_leads(BRAND_WATCH_URL_RUNTIME)
    queries = [] if args.profiles_only else collect_discovery_queries(leads, args.query)

    harvested_urls: list[str] = list(args.post_url or [])
    if args.live and not args.no_harvest_free and not args.profiles_only and not args.post_url:
        extra_fc, _ = harvest_free_factcheck_targets()
        harvested_urls.extend(extra_fc)
    profiles = [] if args.search_only else collect_discovery_profiles(leads, existing, args.profile)

    raw_items: list[tuple[str, dict]] = []
    if args.input_json:
        with open(args.input_json, "r", encoding="utf-8") as fh:
            loaded = json.loads(fh.read())
        if isinstance(loaded, list):
            raw_items = [("local_json", x) for x in loaded if isinstance(x, dict)]
    elif args.live:
        prov = args.provider
        if prov in ("auto", "ensembledata") and os.environ.get("ENSEMBLEDATA_TOKEN"):
            raw_items.extend(poll_ensembledata(queries, max_items=args.max_items))
        if len(raw_items) < args.max_items and prov in ("auto", "rapidapi") and os.environ.get("RAPIDAPI_KEY"):
            raw_items.extend(poll_rapidapi(queries, max_items=args.max_items - len(raw_items)))
        if len(raw_items) < args.max_items and prov in ("auto", "apify") and os.environ.get("APIFY_TOKEN"):
            raw_items.extend(
                poll_apify(
                    queries,
                    actor_id=args.apify_actor,
                    max_items=args.max_items - len(raw_items),
                    profiles=profiles,
                    post_urls=harvested_urls,
                )
            )
        if not args.no_ssr_enrich:
            raw_items = enrich_items_with_tiktok_ssr(
                raw_items,
                extra_urls=harvested_urls,
                max_fetches=max(140, args.max_items + 25),
            )

    provider_label = args.provider if args.input_json == "" else "local_json"
    caution_records: list[dict] = []
    rejected_count = 0
    for q_tag, raw in raw_items:
        rec = extract_caution_record(raw, source_provider=provider_label, query_tag=q_tag)
        if rec:
            caution_records.append(rec)
        else:
            rejected_count += 1

    merged, added = merge_caution_records(existing, caution_records)
    if added or merged != existing or (raw_items and args.input_json):
        write_flagged_artifacts(merged, FLAGGED_JSON_PATH, SEED_JS_PATH)

    worker_sync = None
    if (args.live or args.sync_worker) and (added or caution_records or merged != existing):
        to_sync = merged if merged != existing else (added or caution_records)
        worker_sync = sync_records_to_worker(to_sync, BRAND_WATCH_URL_RUNTIME)

    alert_summary = dispatch_subscriber_alerts(
        added or caution_records,
        leads,
        state_path=ALERT_STATE_PATH,
        live_send=bool(args.live or args.send_alerts),
    )

    print(
        json.dumps(
            {
                "ok": True,
                "live": args.live,
                "queries": queries,
                "profiles": profiles,
                "harvested_factcheck_urls": len(harvested_urls),
                "leads_loaded": len(leads),
                "raw_scanned": len(raw_items),
                "strict_caution_accepted": len(caution_records),
                "non_caution_rejected": rejected_count,
                "newly_added": len(added),
                "total_archived": len(merged),
                "worker_sync": worker_sync,
                "alerts": alert_summary,
                "diagnostics": summarize_raw_diagnostics(raw_items) if raw_items else None,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
