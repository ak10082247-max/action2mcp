#!/usr/bin/env python3
"""
Play A Cron Sniper: Local Business "Dead Booking Link & SSL Cliff" Detector
Discovers UK/US high-margin service businesses via OpenStreetMap Nominatim (+ Overpass fallback),
checks live SSL expiry (<= 14 days / expired) + live 404/5xx broken booking/contact URLs,
extracts verified public contact emails, and emails proof-first alerts linking to SiteRescue ($10 deal, was $49).
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
import os
import re
import socket
import ssl
import sys
import time
import urllib.parse

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPTS_DIR)
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

import outreach_common as common

common.load_workspace_env(REPO_ROOT)

STATE_FILE = os.path.join(REPO_ROOT, "data", "site_rescue_state.json")
DEFAULT_SITE_RESCUE_URL = os.environ.get("SITE_RESCUE_BASE_URL") or "https://site-rescue.ak10082247.workers.dev"

SEARCH_ROTATION = [
    ("dentist", "London"), ("dental clinic", "Manchester"), ("med spa", "Austin"),
    ("solicitor", "Bristol"), ("estate agent", "Edinburgh"), ("law firm", "Chicago"),
    ("dentist", "Birmingham"), ("osteopath", "Brighton"), ("med spa", "Miami"),
    ("dental clinic", "Seattle"), ("veterinary clinic", "Denver"), ("physiotherapy", "Leeds"),
    ("chiropractor", "Boston"), ("family lawyer", "Dallas"), ("cosmetic clinic", "London"),
    ("dentist", "San Diego"), ("estate agent", "Glasgow"), ("accounting firm", "Atlanta"),
    ("orthodontist", "Cardiff"), ("optometrist", "Portland"), ("dermatologist", "Phoenix"),
    ("dental clinic", "Toronto"), ("solicitor", "Liverpool"), ("plastic surgeon", "Houston"),
    ("chiropractor", "Austin"), ("physiotherapy", "Sheffield"), ("med spa", "Scottsdale"),
    ("veterinary clinic", "Bristol"), ("family lawyer", "Orlando"), ("dentist", "Newcastle"),
    ("accounting firm", "Charlotte"), ("podiatrist", "Cambridge"), ("estate agent", "Bath"),
    ("cosmetic clinic", "Manchester"), ("law firm", "Philadelphia"), ("optician", "York"),
]

BOOKING_RE = re.compile(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
BOOKING_KW = re.compile(r"(book|appoint|consult|schedule|calendly|fresha|cliniko|janeapp|contact|reserve|enquir)", re.IGNORECASE)
KNOWN_BOOKING_HOSTS = ("calendly.com", "fresha.com", "cliniko.com", "janeapp.com", "acuityscheduling.com", "setmore.com")


def check_ssl_expiry_days(hostname: str, timeout: int = 6) -> tuple[bool, int | None, str | None]:
    """Return (ssl_broken_or_expired, days_remaining, not_after_str)."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
        not_after = cert.get("notAfter")
        if not not_after:
            return False, None, None
        dt = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days = int((dt - datetime.now(timezone.utc)).total_seconds() // 86400)
        return (days <= 0), days, dt.strftime("%Y-%m-%d")
    except ssl.SSLCertVerificationError as exc:
        return True, -1, str(exc)[:120]
    except Exception:
        return False, None, None


def extract_candidate_booking_links(html: str, base_url: str) -> list[tuple[str, str]]:
    base_host = urllib.parse.urlparse(base_url).hostname or ""
    bare_host = base_host.lower().replace("www.", "")
    seen = set()
    out = []
    for href, raw_label in BOOKING_RE.findall(html or ""):
        href = href.strip()
        label = re.sub(r"<[^>]+>", " ", raw_label).strip()
        label = re.sub(r"\s+", " ", label)[:70]
        if not href or href.lower().startswith(("mailto:", "tel:", "javascript:")):
            continue
        if not BOOKING_KW.search(href) and not BOOKING_KW.search(label):
            continue
        full = urllib.parse.urljoin(base_url, href)
        p = urllib.parse.urlparse(full)
        if p.scheme not in ("http", "https"):
            continue
        h = (p.hostname or "").lower().replace("www.", "")
        if h != bare_host and not any(h.endswith(kb) for kb in KNOWN_BOOKING_HOSTS):
            continue
        if full not in seen:
            seen.add(full)
            out.append((full, label or p.path or "/"))
        if len(out) >= 6:
            break
    return out


def fetch_local_business_candidates(cursor: int = 0, limit_queries: int = 8) -> tuple[list[dict], int]:
    candidates = []
    seen_domains = set()
    n = len(SEARCH_ROTATION)
    q_count = max(4, min(10, limit_queries))
    batch_queries = [f"{SEARCH_ROTATION[(cursor + off) % n][0]} {SEARCH_ROTATION[(cursor + off) % n][1]}" for off in range(q_count)]

    # 1. Primary: High-speed Photon + OSM batch nodes/ways API (150-250 websites in seconds, zero Overpass 502 bottlenecks)
    for item in common.fetch_photon_osm_websites(batch_queries, limit_per_query=50):
        if item["domain"] in seen_domains:
            continue
        seen_domains.add(item["domain"])
        parts = item.get("query", "").rsplit(" ", 1)
        candidates.append({
            **item,
            "category": parts[0] if parts else "local_service",
            "city": parts[1] if len(parts) > 1 else "Metro",
        })

    # 2. Secondary Overpass supplement if Photon yielded < 60 targets
    m_count = len(common.METRO_BBOXES)
    if len(candidates) < 60:
        city, s, w, n_lat, e = common.METRO_BBOXES[cursor % m_count]
        ql = (
            f'[out:json][timeout:18];('
            f'node["amenity"~"dentist|clinic|veterinary|doctors"]["website"]({s},{w},{n_lat},{e});'
            f'node["office"~"lawyer|solicitor|accountant|estate_agent"]["website"]({s},{w},{n_lat},{e});'
            f');out tags 150;'
        )
        for item in common.fetch_overpass_websites(ql, timeout=18):
            if item["domain"] in seen_domains:
                continue
            seen_domains.add(item["domain"])
            candidates.append({**item, "category": "local_service", "city": city})

    return candidates, (cursor + q_count) % n


def diagnose_local_site(cand: dict) -> dict | None:
    domain = cand["domain"]
    https_home = f"https://{domain}/"
    ssl_broken, ssl_days, ssl_exp = check_ssl_expiry_days(domain)

    try:
        st, final_url, _, raw_html = common.http_fetch(https_home, timeout=9, verify_ssl=False)
    except Exception:
        return None
    if st == 0 or st in (403, 429):
        return None
    html = raw_html.decode("utf-8", "replace")
    final_host = (urllib.parse.urlparse(final_url).hostname or domain).lower().replace("www.", "")

    broken_links = []
    for link_url, label in extract_candidate_booking_links(html, final_url):
        try:
            lst, _, _, _ = common.http_fetch(link_url, timeout=6, verify_ssl=False)
            if lst in (404, 410) or lst >= 500:
                broken_links.append({"url": link_url, "label": label, "status": lst})
        except Exception:
            continue

    ssl_urgent = ssl_broken or (ssl_days is not None and ssl_days <= 14)
    if not broken_links and not ssl_urgent:
        return None

    emails = common.extract_deliverable_emails(html, final_host)
    if not emails:
        for path in ("/contact", "/contact-us", "/about"):
            try:
                cst, _, _, craw = common.http_fetch(f"https://{final_host}{path}", timeout=6, verify_ssl=False)
                if cst < 400:
                    emails = common.extract_deliverable_emails(craw.decode("utf-8", "replace"), final_host)
                    if emails:
                        break
            except Exception:
                continue
    if not emails and cand.get("hint_email") and common.is_deliverable_email(cand["hint_email"]):
        emails = [cand["hint_email"]]
    if not emails:
        return None

    has_schema = '"LocalBusiness"' in html or '"Dentist"' in html or '"LegalService"' in html or '"MedicalClinic"' in html
    return {
        "name": cand["name"],
        "domain": final_host,
        "category": cand["category"],
        "city": cand["city"],
        "email": emails[0],
        "broken_links": broken_links,
        "ssl_broken": ssl_broken,
        "ssl_days_remaining": ssl_days,
        "ssl_expires_at": ssl_exp,
        "has_local_schema": has_schema,
    }


def craft_site_rescue_email(target: dict, base_url: str = DEFAULT_SITE_RESCUE_URL) -> tuple[str, str]:
    dom = target["domain"]
    broken = target.get("broken_links") or []
    ssl_days = target.get("ssl_days_remaining")
    ssl_broken = bool(target.get("ssl_broken"))

    proof_lines = []
    broken_param = ""
    if broken:
        b0 = broken[0]
        broken_param = b0["url"]
        proof_lines.append(f"- Broken CTA '{b0['label']}': {b0['url']} returned HTTP {b0['status']}")
    if ssl_broken:
        proof_lines.append(f"- SSL Certificate Error / Expired on https://{dom} ({target.get('ssl_expires_at') or 'TLS verify failed'})")
    elif ssl_days is not None and ssl_days <= 14:
        proof_lines.append(f"- SSL Certificate expiring in {ssl_days} day(s) (expires {target.get('ssl_expires_at')})")
    if not target.get("has_local_schema"):
        proof_lines.append("- Google LocalBusiness structured JSON-LD snippet missing")

    subject_issue = f"broken booking link (HTTP {broken[0]['status']})" if broken else "expiring SSL warning"
    subject = f"Quick heads-up on {dom}: {subject_issue}"[:96]

    q = {"domain": dom}
    if ssl_days is not None:
        q["ssl_days"] = str(ssl_days)
    if broken_param:
        q["broken"] = broken_param
    audit_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode(q)}"

    body = (
        f"Hi {target['name']} team,\n\n"
        f"Automated health checks flagged an active customer-facing issue on {dom} right now:\n"
        + "\n".join(proof_lines)
        + "\n\nWhen a prospective client clicks a broken link or hits an SSL warning, they leave immediately.\n\n"
        f"You can verify the live diagnostic and grab a custom pre-built Site Recovery Pack at our $10 launch deal "
        f"(normally $49 one-time — includes your broken-link CSV audit, paste-ready .htaccess/Nginx 301 redirect rules, "
        f"Google LocalBusiness JSON-LD, and a plain-English 3-step handoff sheet for your web host) at:\n"
        f"{audit_link}\n\n"
        f"(Priority async email fix verification is also discounted to $29 there, normally $149, if you prefer hands-off handling.)\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def main():
    parser = argparse.ArgumentParser(description="Play A: Local Business Broken-Link & SSL Cliff Sniper")
    parser.add_argument("--queries", type=int, default=10, help="Nominatim city/category queries per run")
    parser.add_argument("--limit", type=int, default=80, help="Max sites to probe per run")
    parser.add_argument("--max-emails", type=int, default=35, help="Daily send cap")
    parser.add_argument("--send", action="store_true", help="Send verified alerts via SMTP")
    args = parser.parse_args()

    state = common.load_json_state(STATE_FILE, {"cursor": 0, "contacted_domains": [], "contacted_emails": [], "history": []})
    sent_today = common.count_sent_today(state.get("history") or [])
    known_domains = set(state.get("contacted_domains") or [])
    known_emails = set(e.lower().strip() for e in (state.get("contacted_emails") or []))

    if args.send and sent_today >= args.max_emails:
        print(f"[!] Daily cap ({sent_today}/{args.max_emails}) reached; exiting.")
        return

    cands, next_cursor = fetch_local_business_candidates(int(state.get("cursor") or 0), args.queries)
    state["cursor"] = next_cursor
    common.save_json_state(STATE_FILE, state)

    to_probe = [c for c in cands if c["domain"] not in known_domains][: args.limit]
    probed = len(to_probe)
    hits = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(diagnose_local_site, c) for c in to_probe]
        for fut in as_completed(futs):
            try:
                diag = fut.result()
            except Exception:
                diag = None
            if not diag:
                continue
            if diag["domain"] in known_domains or diag["email"] in known_emails:
                continue
            hits.append(diag)

    for diag in hits:
        subj, body = craft_site_rescue_email(diag)
        print(f"[+] FOUND PLAY A ISSUE: {diag['domain']} -> {diag['email']} | broken={len(diag['broken_links'])} ssl_days={diag['ssl_days_remaining']}")
        if args.send:
            if sent_today >= args.max_emails:
                break
            try:
                common.send_smtp_email(diag["email"], subj, body, sender_name="Arman (SiteRescue Audit)")
                known_domains.add(diag["domain"])
                known_emails.add(diag["email"])
                state["contacted_domains"].append(diag["domain"])
                state["contacted_emails"].append(diag["email"])
                state["history"].append({"domain": diag["domain"], "email": diag["email"], "sent_date": datetime.now(timezone.utc).isoformat()})
                sent_today += 1
                common.save_json_state(STATE_FILE, state)
                print(f"    -> Sent alert to {diag['email']}")
                time.sleep(5)
            except Exception as exc:
                print(f"    [-] SMTP failed: {exc}")

    print(f"[=] Play A Summary: candidates={len(cands)} probed={probed} verified_broken={len(hits)} sent_today={sent_today}")


if __name__ == "__main__":
    main()
