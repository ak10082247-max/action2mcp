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
from datetime import datetime, timezone
import ipaddress
import json
import os
import re
import socket
import sys
import urllib.parse

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
    "flagged for unverified content",
    "not following the script",
    "#maskedtruth",
    "staged video exposed",
]

WARNING_FIELDS = (
    "warnInfo",
    "warningInfo",
    "riskInfos",
    "risk_infos",
    "labelTop",
    "contentDesc",
    "video_label",
    "videoLabel",
    "cautionLabel",
    "warningText",
)

WARNING_SUBKEYS = ("text", "content", "label", "title", "desc", "warning", "msg")


def _extract_root(raw_item: dict) -> dict:
    if not isinstance(raw_item, dict):
        return {}
    for key in ("aweme_detail", "itemStruct"):
        val = raw_item.get(key)
        if isinstance(val, dict):
            return val
    item_info = raw_item.get("itemInfo")
    if isinstance(item_info, dict) and isinstance(item_info.get("itemStruct"), dict):
        return item_info["itemStruct"]
    return raw_item


def _collect_warning_strings(raw_item: dict) -> list[tuple[str, str]]:
    root = _extract_root(raw_item)
    candidates: list[tuple[str, str]] = []

    def push(field: str, value) -> None:
        if value is None:
            return
        if isinstance(value, str):
            text = value.strip()
            if text:
                candidates.append((field, text))
        elif isinstance(value, list):
            for entry in value:
                push(field, entry)
        elif isinstance(value, dict):
            for subkey in WARNING_SUBKEYS:
                subval = value.get(subkey)
                if isinstance(subval, str) and subval.strip():
                    candidates.append((field, subval.strip()))

    for field in WARNING_FIELDS:
        if field in root:
            push(field, root.get(field))
        elif field in raw_item:
            push(field, raw_item.get(field))
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

    author_meta = root.get("authorMeta") or root.get("author") or root.get("channel") or {}
    if not isinstance(author_meta, dict):
        author_meta = {}
    raw_user = str(
        author_meta.get("name")
        or author_meta.get("username")
        or author_meta.get("uniqueId")
        or root.get("author_username")
        or root.get("handle")
        or ""
    ).strip().lstrip("@")

    raw_url = str(
        root.get("webVideoUrl")
        or root.get("url")
        or (f"https://www.tiktok.com/@{raw_user}/video/{video_id}" if video_id and raw_user else "")
        or (f"https://www.tiktok.com/video/{video_id}" if video_id else "")
    ).strip()

    if not video_id and raw_url:
        m = re.search(r"/video/(\d+)", raw_url)
        if m:
            video_id = m.group(1)

    if not video_id or not raw_url:
        return None

    author_handle = f"@{raw_user}" if raw_user else str(author_meta.get("nickName") or author_meta.get("nickname") or "unknown")
    author_name = str(
        author_meta.get("nickName")
        or author_meta.get("nickname")
        or author_meta.get("name")
        or raw_user
        or "Unknown creator"
    ).strip()

    raw_tags = root.get("hashtags")
    if not isinstance(raw_tags, list):
        raw_tags = root.get("hashtag_names") if isinstance(root.get("hashtag_names"), list) else []
    hashtags: list[str] = []
    for tag in raw_tags:
        val = tag if isinstance(tag, str) else (tag.get("name") or tag.get("title") or "") if isinstance(tag, dict) else ""
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
        or root.get("video_description")
        or root.get("title")
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

    return {
        "id": str(video_id),
        "videoId": str(video_id),
        "sourceType": source_provider,
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
        "matchedField": matched_field,
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


def merge_caution_records(existing: list[dict], incoming: list[dict], limit: int = 500) -> tuple[list[dict], list[dict]]:
    by_id: dict[str, dict] = {}
    ordered_ids: list[str] = []
    added: list[dict] = []

    for rec in existing:
        vid = str(rec.get("id") or rec.get("videoId") or "").strip()
        if vid and vid not in by_id:
            by_id[vid] = rec
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
            # Preserve richer fallback metadata if already stored
            merged = dict(by_id[vid])
            for k, v in rec.items():
                if v and not merged.get(k):
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


def collect_discovery_queries(leads: list[dict], extra_queries: list[str] | None = None, cap: int = 12) -> list[str]:
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


def poll_apify(
    queries: list[str],
    actor_id: str = "clockworks~free-tiktok-scraper",
    max_items: int = 20,
    min_balance_usd: float = 0.25,
) -> list[tuple[str, dict]]:
    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        return []
    try:
        usage = http_get_json(f"https://api.apify.com/v2/users/me/usage/monthly?token={urllib.parse.quote(token)}", timeout=10)
        data = usage.get("data") if isinstance(usage, dict) else {}
        used = float(data.get("totalUsageCreditsUsdAfterVolumeDiscount") or data.get("totalUsageCreditsUsdBeforeVolumeDiscount") or 0.0)
        # Monthly free tier cap check (Apify free plan is $5/mo; abort if <= min_balance_usd headroom left)
        limits = http_get_json(f"https://api.apify.com/v2/users/me/limits?token={urllib.parse.quote(token)}", timeout=10)
        max_monthly = float((limits.get("data") or {}).get("monthlyUsageUsd") or 5.0)
        if max_monthly - used <= min_balance_usd:
            raise RuntimeError(f"Apify safety stop triggered: remaining ${max_monthly - used:.3f} <= ${min_balance_usd:.2f}")
    except RuntimeError:
        raise
    except Exception:
        pass

    hashtags = [q.lstrip("#") for q in queries if q.startswith("#")][:3]
    search_terms = [q for q in queries if not q.startswith("#")][:3]
    per_query = max(1, min(max_items, 20))

    if "apidojo" in actor_id:
        actor_input = {
            "keywords": search_terms or ["flagged for unverified content"],
            "maxItems": per_query,
            "customMapFunction": """(object) => {
  return {
    id: object.id || object.aweme_id,
    webVideoUrl: object.postPage || object.webVideoUrl || object.url,
    text: object.title || object.desc || object.text || '',
    authorMeta: object.channel || object.authorMeta || object.author || {},
    hashtags: object.hashtags || [],
    videoMeta: object.video || object.videoMeta || {},
    warnInfo: object.warnInfo || object.warningInfo || null,
    labelTop: object.labelTop || null,
    contentDesc: object.contentDesc || null,
    riskInfos: object.riskInfos || object.risk_infos || null,
    voice_to_text: object.voice_to_text || object.voiceToText || ''
  };
}""",
        }
    else:
        actor_input = {
            "hashtags": hashtags,
            "searchQueries": search_terms or ["flagged for unverified content"],
            "resultsPerPage": per_query,
            "shouldDownloadCovers": False,
            "shouldDownloadVideos": False,
        }

    run_url = f"https://api.apify.com/v2/acts/{urllib.parse.quote(actor_id)}/runs?token={urllib.parse.quote(token)}&waitForFinish=90"
    status, _, _, raw = http_fetch(
        run_url,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        data=json.dumps(actor_input).encode("utf-8"),
        timeout=95,
    )
    if status >= 400:
        raise RuntimeError(f"Apify run start HTTP {status}: {raw.decode('utf-8', 'replace')[:300]}")
    run_data = json.loads(raw.decode("utf-8", "replace")).get("data") or {}
    dataset_id = run_data.get("defaultDatasetId")
    if not dataset_id:
        return []
    items_url = f"https://api.apify.com/v2/datasets/{urllib.parse.quote(dataset_id)}/items?token={urllib.parse.quote(token)}&clean=false&limit={per_query}"
    items = http_get_json(items_url, timeout=30)
    if not isinstance(items, list):
        return []
    return [(search_terms[0] if search_terms else "apify", it) for it in items if isinstance(it, dict)]


def sync_records_to_worker(records: list[dict], worker_base: str = BRAND_WATCH_URL) -> dict | None:
    token = _resolve_ingest_token()
    if not token or not records:
        return None
    status, _, _, raw = http_fetch(
        f"{worker_base}/api/ingest-caution",
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        data=json.dumps({"source": "automated_caution_poller", "items": records}).encode("utf-8"),
        timeout=20,
    )
    if status >= 400:
        raise RuntimeError(f"Worker /api/ingest-caution HTTP {status}: {raw.decode('utf-8', 'replace')[:250]}")
    return json.loads(raw.decode("utf-8", "replace"))


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
    parser.add_argument("--apify-actor", default="clockworks~free-tiktok-scraper")
    parser.add_argument("--max-items", type=int, default=20, help="Hard cap on fetched raw items per run.")
    parser.add_argument("--query", action="append", default=[], help="Extra keyword or #hashtag query.")
    parser.add_argument("--input-json", default="", help="Process local raw scraper JSON list without spending API credits.")
    parser.add_argument("--sync-worker", action="store_true", help="Push stored records to Worker /api/ingest-caution.")
    parser.add_argument("--send-alerts", action="store_true", help="Allow dispatching email/webhook alerts to matched leads.")
    args = parser.parse_args(argv)

    BRAND_WATCH_URL_RUNTIME = (
        os.environ.get("BRAND_WATCH_URL") or BRAND_WATCH_URL
    ).rstrip("/")
    leads = fetch_subscriber_leads(BRAND_WATCH_URL_RUNTIME)
    queries = collect_discovery_queries(leads, args.query)

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
            raw_items.extend(poll_apify(queries, actor_id=args.apify_actor, max_items=args.max_items - len(raw_items)))

    provider_label = args.provider if args.input_json == "" else "local_json"
    caution_records: list[dict] = []
    rejected_count = 0
    for q_tag, raw in raw_items:
        rec = extract_caution_record(raw, source_provider=provider_label, query_tag=q_tag)
        if rec:
            caution_records.append(rec)
        else:
            rejected_count += 1

    existing = load_flagged_videos(FLAGGED_JSON_PATH)
    merged, added = merge_caution_records(existing, caution_records)
    if added or (raw_items and args.input_json):
        write_flagged_artifacts(merged, FLAGGED_JSON_PATH, SEED_JS_PATH)

    worker_sync = None
    if (args.live or args.sync_worker) and (added or caution_records):
        worker_sync = sync_records_to_worker(added or caution_records, BRAND_WATCH_URL_RUNTIME)

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
                "leads_loaded": len(leads),
                "raw_scanned": len(raw_items),
                "strict_caution_accepted": len(caution_records),
                "non_caution_rejected": rejected_count,
                "newly_added": len(added),
                "total_archived": len(merged),
                "worker_sync": worker_sync,
                "alerts": alert_summary,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
