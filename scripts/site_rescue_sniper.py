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
BOOKING_KW = re.compile(r"(book|appoint|consult|schedule|calendly|fresha|cliniko|janeapp|contact|reserve|enquir|pricing|patient|intake|referral|form|quote|request|service)", re.IGNORECASE)
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
    q_count = max(4, min(28, limit_queries))
    batch_queries = [f"{SEARCH_ROTATION[(cursor + off) % n][0]} {SEARCH_ROTATION[(cursor + off) % n][1]}" for off in range(q_count)]

    # 1. Primary: High-speed Photon + OSM batch nodes/ways API (150-350 websites in seconds, zero Overpass 502 bottlenecks)
    for item in common.fetch_photon_osm_websites(batch_queries, limit_per_query=60):
        if item["domain"] in seen_domains:
            continue
        seen_domains.add(item["domain"])
        parts = item.get("query", "").rsplit(" ", 1)
        candidates.append({
            **item,
            "category": parts[0] if parts else "local_service",
            "city": parts[1] if len(parts) > 1 else "Metro",
        })

    # 2. Secondary Overpass supplement if Photon yielded < 220 targets
    m_count = len(common.METRO_BBOXES)
    if len(candidates) < 220:
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
        st, final_url, hdrs, raw_html = common.http_fetch(https_home, timeout=9, verify_ssl=False)
    except Exception:
        return None
    if st == 0 or st in (403, 429):
        return None
    html = raw_html.decode("utf-8", "replace")
    final_host = (urllib.parse.urlparse(final_url).hostname or domain).lower().replace("www.", "")
    hdrs_low = {str(k).lower(): str(v) for k, v in (hdrs or {}).items()}
    missing_hsts = "strict-transport-security" not in hdrs_low
    missing_viewport = bool(re.search(r"<head[\s>]", html, re.I)) and not bool(
        re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I)
    )
    insecure_http_assets = []
    if final_url.lower().startswith("https://"):
        insecure_http_assets = re.findall(
            r'<(?:form|script)\b[^>]*(?:action|src)=["\'](http://[^"\']+)["\']', html, re.I
        )[:5]

    https_redirect_ok = True
    try:
        hst, hfinal, _, _ = common.http_fetch(f"http://{domain}/", timeout=5, verify_ssl=False)
        if hst > 0 and hfinal.lower().startswith("http://"):
            https_redirect_ok = False
    except Exception:
        https_redirect_ok = True

    broken_links = []
    for link_url, label in extract_candidate_booking_links(html, final_url):
        try:
            lst, _, _, _ = common.http_fetch(link_url, timeout=6, verify_ssl=False)
            if lst in (404, 410) or lst >= 500:
                broken_links.append({"url": link_url, "label": label, "status": lst})
        except Exception:
            continue

    has_schema = any(t in html for t in ('"LocalBusiness"', '"Dentist"', '"LegalService"', '"MedicalClinic"', '"Attorney"', '"VeterinaryCare"'))
    ssl_urgent = ssl_broken or (ssl_days is not None and ssl_days <= 14)
    if not broken_links and not ssl_urgent and not insecure_http_assets and (https_redirect_ok or has_schema):
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
        "https_redirect_ok": https_redirect_ok,
        "has_local_schema": has_schema,
        "missing_viewport": missing_viewport,
        "insecure_http_assets": insecure_http_assets,
        "missing_hsts": missing_hsts,
    }


def craft_site_rescue_email(target: dict, base_url: str = DEFAULT_SITE_RESCUE_URL) -> tuple[str, str]:
    dom = target["domain"]
    broken = target.get("broken_links") or []
    ssl_days = target.get("ssl_days_remaining")
    ssl_broken = bool(target.get("ssl_broken"))
    https_redirect_ok = target.get("https_redirect_ok", True)
    insecure_http_assets = target.get("insecure_http_assets") or []

    # Avoid the "Free Forward" leak: state concrete severity counts without exposing exact path strings in Email #1
    proof_lines = []
    if broken:
        statuses = sorted({str(b.get("status") or 404) for b in broken})
        proof_lines.append(f"- {len(broken)} booking/appointment CTA link(s) returning HTTP {'/'.join(statuses)} (visitors drop on click)")
    if ssl_broken:
        proof_lines.append(f"- SSL/HTTPS certificate error flagged on https://{dom} ({target.get('ssl_expires_at') or 'TLS verify failed'})")
    elif ssl_days is not None and ssl_days <= 14:
        proof_lines.append(f"- SSL Certificate expiring in {ssl_days} day(s) (expires {target.get('ssl_expires_at')})")
    if https_redirect_ok is False:
        proof_lines.append(f"- http://{dom} does not enforce a 301 redirect to HTTPS (triggers browser 'Not Secure' warnings)")
    if insecure_http_assets:
        proof_lines.append(f"- {len(insecure_http_assets)} insecure http:// form/script element(s) on your HTTPS page (triggers mixed-content blocks)")
    if target.get("missing_viewport"):
        proof_lines.append('- Missing mobile <meta name="viewport"> tag (causes tiny unclickable text on mobile phones)')
    if not target.get("has_local_schema"):
        proof_lines.append("- Google LocalBusiness structured JSON-LD snippet missing")

    if broken:
        subject_issue = f"broken booking link (HTTP {broken[0]['status']})"
    elif ssl_broken or (ssl_days is not None and ssl_days <= 14):
        subject_issue = "expiring SSL warning"
    elif insecure_http_assets:
        subject_issue = "mixed-content HTTP warning on HTTPS"
    else:
        subject_issue = "HTTP redirect & Google Maps schema warning"
    subject = f"Quick heads-up on {dom}: {subject_issue}"[:96]

    q = {"domain": dom, "ref": "email1"}
    if ssl_days is not None:
        q["ssl_days"] = str(ssl_days)
    raw_audit_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode(q)}"
    audit_link = common.build_tracked_url("play_a_local", dom, raw_audit_link)

    body = (
        f"Hi {target['name']} team,\n\n"
        f"Automated health checks flagged active customer-facing issues on {dom} right now:\n"
        + "\n".join(proof_lines)
        + "\n\nWhen a prospective client clicks a dead booking link or hits an SSL warning, they leave immediately.\n\n"
        f"Two fast ways to get the exact affected path(s) + ready-to-apply fix:\n"
        f"1) Reply \"link\" to this email and I'll reply right here with the failing URL(s) + a direct Stripe checkout link (checkout.stripe.com) for our $10 Launch Deal (normally $49).\n"
        f"2) Or view live diagnostics & grab the custom Site Recovery Pack ZIP ($10 Deal, was $49 — 301 redirect rules, LocalBusiness JSON-LD & 3-step host handoff) at:\n"
        f"{audit_link}\n\n"
        f"(Priority async email verification is also discounted to $29 there, normally $149.)\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def main():
    parser = argparse.ArgumentParser(description="Play A: Local Business Broken-Link & SSL Cliff Sniper")
    parser.add_argument("--queries", type=int, default=8, help="Photon/Nominatim queries per run")
    parser.add_argument("--limit", type=int, default=100, help="Max sites to probe per run")
    parser.add_argument("--max-emails", type=int, default=20, help="Daily send cap (default: 20/day)")
    parser.add_argument("--hard-stop", type=int, default=200, help="Stop-loss delivered cap (default: 200)")
    parser.add_argument("--send", action="store_true", help="Send verified alerts via SMTP")
    parser.add_argument("--override", action="store_true", help="Override pause/stop-loss gates intentionally")
    parser.add_argument("--canary-to", default=os.environ.get("CANARY_INBOXES", ""), help="Comma-separated test Gmail/Outlook addresses (not counted in 200 test)")
    args = parser.parse_args()

    state = common.load_json_state(
        STATE_FILE,
        {"cursor": 0, "contacted_domains": [], "contacted_emails": [], "bounced_emails": [], "replied_emails": [], "paid_sales": 0, "history": []},
    )
    if args.canary_to:
        subj, body = craft_site_rescue_email({
            "name": "Example Dental Practice",
            "domain": "clinic-example.co.uk",
            "email": "check@clinic-example.co.uk",
            "broken_links": [{"url": "https://clinic-example.co.uk/book", "label": "Book Now", "status": 404}],
            "ssl_broken": False,
            "ssl_days_remaining": 11,
            "ssl_expires_at": "2026-12-01",
            "has_local_schema": False,
        })
        cnt = common.send_canary_copies(args.canary_to, subj, body, sender_name="Arman (SiteRescue Audit)")
        print(f"[+] Sent {cnt} uncounted Play A canary spam-check email(s).")
        if not args.send:
            return

    if args.send and common.sync_imap_bounces_and_replies(state):
        common.save_json_state(STATE_FILE, state)

    allowed, gate_reason, stats = common.evaluate_play_gate(
        state,
        daily_cap=args.max_emails,
        hard_stop_total=args.hard_stop,
        override=args.override,
    )
    if args.send:
        common.push_dashboard_ingest("play_a_local", stats, source="play_a_cron")
        kv_paused, kv_reason = common.check_dashboard_play_status("play_a_local")
        if kv_paused and not args.override:
            print(f"[!] Play A Dashboard Safety Gate: {kv_reason} (bounce={stats['bounce_rate_pct']}%)")
            return
    sent_today = stats["sent_today"]
    known_domains = set(state.get("contacted_domains") or [])
    known_emails = set(e.lower().strip() for e in (state.get("contacted_emails") or []))
    bounced_set = stats["bounced_set"]

    if args.send and not allowed:
        print(f"[!] Play A Stop-Loss / Safety Gate: {gate_reason} (clean_delivered={stats['clean_delivered']}/{args.hard_stop}, bounce={stats['bounce_rate_pct']}%)")
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
            if diag["domain"] in known_domains or diag["email"] in known_emails or diag["email"] in bounced_set:
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

    if args.send:
        _, _, post_stats = common.evaluate_play_gate(state, daily_cap=args.max_emails, hard_stop_total=args.hard_stop, override=True)
        common.push_dashboard_ingest("play_a_local", post_stats, source="play_a_cron_post")

    print(f"[=] Play A Summary: candidates={len(cands)} probed={probed} verified_broken={len(hits)} sent_today={sent_today}")


if __name__ == "__main__":
    main()
