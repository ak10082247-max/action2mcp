#!/usr/bin/env python3
"""
Play C Cron Sniper: B2B White-Label Overflow for Small SEO, Shopify & Web Agencies
Discovers boutique SEO/ecommerce/web design agencies, verifies live agency relevance
and MX-checked contact emails, and pitches fix-first white-label client packs ($49/client
wholesale or $10 live sample test on any client domain; pay only after staging verification).
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import os
import re
import sys
import time
import urllib.parse

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPTS_DIR)
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

import outreach_common as common

common.load_workspace_env(REPO_ROOT)

STATE_FILE = os.path.join(REPO_ROOT, "data", "agency_overflow_state.json")
DEFAULT_SITERESCUE_URL = os.environ.get("SITE_RESCUE_BASE_URL") or "https://site-rescue.ak10082247.workers.dev"
DEFAULT_ECOMFIX_URL = os.environ.get("ECOM_FIX_BASE_URL") or "https://ecom-fix.ak10082247.workers.dev"

AGENCY_ROTATION = [
    ("seo agency", "London"), ("shopify agency", "Austin"), ("web design agency", "Manchester"),
    ("digital marketing agency", "Bristol"), ("ecommerce agency", "Chicago"), ("webflow agency", "Toronto"),
    ("seo consultant", "Edinburgh"), ("wordpress agency", "Denver"), ("shopify expert", "Melbourne"),
    ("web development agency", "Leeds"), ("digital agency", "Boston"), ("ecommerce studio", "Portland"),
    ("seo agency", "Birmingham"), ("web design", "Brighton"), ("shopify developer", "Seattle"),
    ("digital marketing", "Atlanta"), ("web agency", "Glasgow"), ("seo company", "Dallas"),
    ("ecommerce agency", "London"), ("web studio", "San Diego"), ("marketing agency", "Cardiff"),
    ("shopify agency", "Brooklyn"), ("seo agency", "Miami"), ("web design agency", "Dublin"),
]

AGENCY_KW_RE = re.compile(
    r"\b(seo|shopify|ecommerce|e-commerce|woocommerce|webflow|wordpress|web design|digital marketing|clients|agency|retainer)\b",
    re.IGNORECASE,
)


def fetch_agency_candidates(
    cursor: int = 0,
    limit_queries: int = 14,
    cc_page: int = 2,
    exclude_domains: set[str] | None = None,
) -> tuple[list[dict], int, int]:
    candidates = []
    seen_domains = set()
    excl = {d.lower().strip().replace("www.", "") for d in (exclude_domains or set()) if d}
    n = len(AGENCY_ROTATION)
    q_count = max(4, min(18, limit_queries))
    batch_queries = [f"{AGENCY_ROTATION[(cursor + off) % n][0]} {AGENCY_ROTATION[(cursor + off) % n][1]}" for off in range(q_count)]

    def _add(item: dict, default_niche: str = "digital agency", default_city: str = "Metro"):
        dom = item["domain"]
        if dom in seen_domains or dom in excl:
            return
        seen_domains.add(dom)
        parts = item.get("query", "").rsplit(" ", 1) if item.get("query") else []
        candidates.append({
            **item,
            "niche": parts[0] if parts else default_niche,
            "city": parts[1] if len(parts) > 1 else default_city,
        })

    # 1. Primary: Rapid urlscan.io .agency & SEO/Shopify/Marketing agency domains (<1s)
    agency_queries = [
        "page.domain:agency",
        'page.title:"SEO Agency" OR page.title:"Digital Agency"',
        'page.title:"Shopify Agency" OR page.title:"Web Design Agency"',
    ]
    urlscan_hosts = common.fetch_urlscan_domains(
        [agency_queries[(cc_page + i) % len(agency_queries)] for i in range(len(agency_queries))],
        size=80,
        limit_domains=90,
        exclude_domains=excl,
    )
    for host in urlscan_hosts:
        bare = host.replace("www.", "")
        _add({"name": bare, "website": f"https://{bare}/", "domain": bare}, "digital agency", "Web")

    # 2. Secondary: OSM Nominatim office / IT / consulting / advertising businesses (<0.5s/query)
    nom_items, next_nom = common.fetch_nominatim_websites(
        ["[office]", "[it]", "[consulting]", "[advertising]"],
        cursor=cursor,
        batch_queries=min(10, max(4, limit_queries)),
        limit_total=100,
        exclude_domains=excl | seen_domains,
    )
    for item in nom_items:
        _add(item, "digital agency", item.get("city", "Metro"))

    return candidates, next_nom, max(2, int(cc_page or 2) + 1)


def inspect_agency_site(cand: dict) -> dict | None:
    domain = cand["domain"]
    if domain.endswith((".ru", ".by", ".cn", ".ir")) or "investigation" in domain:
        return None
    try:
        st, final_url, _, raw_html = common.http_fetch(f"https://{domain}/", timeout=9, verify_ssl=False)
    except Exception:
        return None
    if st >= 400 or st == 0:
        return None
    html = raw_html.decode("utf-8", "replace")
    text_sample = re.sub(r"<[^>]+>", " ", html[:120000])
    matches = {m.lower() for m in AGENCY_KW_RE.findall(text_sample)}
    if len(matches) < 2:
        return None

    final_host = (urllib.parse.urlparse(final_url).hostname or domain).lower().replace("www.", "")
    emails = common.extract_deliverable_emails(html, final_host)
    if not emails:
        for path in ("/contact", "/contact-us", "/about", "/work-with-us"):
            try:
                cst, _, _, craw = common.http_fetch(f"https://{final_host}{path}", timeout=6, verify_ssl=False)
                if cst < 400:
                    emails = common.extract_deliverable_emails(craw.decode("utf-8", "replace"), final_host)
                    if emails:
                        break
            except Exception:
                continue
    if not emails:
        return None

    return {
        "name": cand.get("name") or final_host,
        "domain": final_host,
        "city": cand.get("city", ""),
        "niche": cand.get("niche", "digital agency"),
        "matched_services": sorted(matches)[:5],
        "email": emails[0],
    }


def craft_agency_overflow_email(target: dict) -> tuple[str, str]:
    dom = target["domain"]
    name = target.get("name") or dom
    sr_link = common.build_tracked_url("play_c_agency", dom, f"{DEFAULT_SITERESCUE_URL}/?ref=agency")
    ef_link = common.build_tracked_url("play_c_agency", dom, f"{DEFAULT_ECOMFIX_URL}/?ref=agency")

    subject = f"White-label Shopify/SEO technical overflow for {name} (pay after proof)"[:96]
    body = (
        f"Hi {name} team,\n\n"
        f"Quick note from a fellow technical builder — do your retainers ever back up on tedious client cleanups like:\n"
        f"- Invalid Google Merchant Product JSON-LD snippets & Jan 31, 2027 500x500px product image audits + 1500x1500px batch padding\n"
        f"- 404 booking/collection redirect CSVs & Apache/Nginx 301 rules\n"
        f"- March 1, 2027 Shopify ScriptTag deprecation audits & Custom GPT -> MCP tool migrations\n\n"
        f"I built deterministic automated packers for these and run white-label overflow for small agencies:\n"
        f"- Wholesale rate: $49 per client fix ZIP (mark it up cleanly under your own agency brand)\n"
        f"- Risk-free first test: $10 trial client pack — and for a verified client domain, send me the URL and I'll generate the staging fix diff first so you only pay after checking it works.\n\n"
        f"You can test both live scanners right now on any client domain:\n"
        f"- Local 404/SSL/LocalBusiness JSON-LD scanner: {sr_link}\n"
        f"- Shopify/Woo Google Shopping & ScriptTag audit: {ef_link}\n\n"
        f"Happy to run a free diagnostic sample on 1 client URL if helpful — just reply with a domain.\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def craft_followup_email(entry: dict) -> tuple[str, str]:
    dom = entry.get("domain") or "your agency"
    raw_audit = f"{DEFAULT_SITERESCUE_URL}/?{urllib.parse.urlencode({'domain': dom, 'ref': 'agency_followup'})}"
    site_link = common.build_tracked_url("play_c_agency", dom, raw_audit)
    subj = f"Re: White-label Shopify/SEO technical overflow for {dom}"[:96]
    body = (
        f"Hi again,\n\n"
        f"Quick bump in case technical cleanup tickets (Merchant 500px image feeds, broken booking/collection 301s, or March 2027 Shopify ScriptTags) are piling up on your client retainers.\n\n"
        f"Reply with any client URL for a free proof audit before paying a cent ($49/client wholesale), or check sample diagnostics at:\n{site_link}\n\n"
        f"Best,\nArman\n---\nReply 'unsubscribe' to stop.\n"
    )
    return subj, body


def main():
    parser = argparse.ArgumentParser(description="Play C: B2B White-Label Agency Overflow Sniper")
    parser.add_argument("--queries", type=int, default=14, help="Agency city queries per run")
    parser.add_argument("--limit", type=int, default=180, help="Max agency sites to inspect per run")
    parser.add_argument("--max-emails", type=int, default=20, help="Daily send cap (default: 20/day)")
    parser.add_argument("--max-followups", type=int, default=4, help="Max Day+2 follow-ups per run (capped by daily cap)")
    parser.add_argument("--hard-stop", type=int, default=200, help="Stop-loss delivered cap (default: 200)")
    parser.add_argument("--send", action="store_true", help="Send B2B white-label pitches via SMTP")
    parser.add_argument("--override", action="store_true", help="Override pause/stop-loss gates intentionally")
    parser.add_argument("--canary-to", default=os.environ.get("CANARY_INBOXES", ""), help="Comma-separated test Gmail/Outlook addresses")
    args = parser.parse_args()

    state = common.load_json_state(
        STATE_FILE,
        {"cursor": 0, "contacted_domains": [], "contacted_emails": [], "bounced_emails": [], "replied_emails": [], "paid_sales": 0, "history": []},
    )
    if args.canary_to:
        subj, body = craft_agency_overflow_email({"name": "Northbridge Digital", "domain": "northbridge-example.co.uk"})
        cnt = common.send_canary_copies(args.canary_to, subj, body, sender_name="Arman (Kurox Partner Overflow)")
        print(f"[+] Sent {cnt} uncounted Play C canary spam-check email(s).")
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
        common.push_dashboard_ingest("play_c_agency", stats, source="play_c_cron")
        kv_paused, kv_reason = common.check_dashboard_play_status("play_c_agency")
        if kv_paused and not args.override:
            print(f"[!] Play C Dashboard Safety Gate: {kv_reason} (bounce={stats['bounce_rate_pct']}%)")
            return
    sent_today = stats["sent_today"]
    known_domains = set(state.get("contacted_domains") or [])
    known_emails = {e.lower().strip() for e in (state.get("contacted_emails") or [])}
    bounced_set = stats["bounced_set"]

    if args.send and not allowed:
        print(f"[!] Play C Stop-Loss / Safety Gate: {gate_reason} (clean_delivered={stats['clean_delivered']}/{args.hard_stop}, bounce={stats['bounce_rate_pct']}%)")
        return

    cands, next_cursor, next_cc_page = fetch_agency_candidates(
        int(state.get("cursor") or 0),
        args.queries,
        cc_page=int(state.get("cc_page") or 2),
        exclude_domains=known_domains,
    )
    state["cursor"] = next_cursor
    state["cc_page"] = next_cc_page
    common.save_json_state(STATE_FILE, state)

    to_probe = [c for c in cands if c["domain"] not in known_domains][: args.limit]
    hits = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(inspect_agency_site, c) for c in to_probe]
        for fut in as_completed(futs):
            try:
                res = fut.result()
            except Exception:
                res = None
            if not res:
                continue
            if res["domain"] in known_domains or res["email"] in known_emails or res["email"] in bounced_set:
                continue
            hits.append(res)

    for agency in hits:
        subj, body = craft_agency_overflow_email(agency)
        print(f"[+] FOUND PLAY C AGENCY: {agency['domain']} ({','.join(agency['matched_services'])}) -> {agency['email']}")
        if args.send:
            if sent_today >= args.max_emails:
                break
            try:
                common.send_smtp_email(agency["email"], subj, body, sender_name="Arman (Kurox Technical Partner)")
                known_domains.add(agency["domain"])
                known_emails.add(agency["email"])
                state["contacted_domains"].append(agency["domain"])
                state["contacted_emails"].append(agency["email"])
                state["history"].append({"domain": agency["domain"], "email": agency["email"], "sent_date": datetime.now(timezone.utc).isoformat()})
                sent_today += 1
                common.save_json_state(STATE_FILE, state)
                print(f"    -> Sent B2B partner note to {agency['email']}")
                time.sleep(5)
            except Exception as exc:
                print(f"    [-] SMTP failed: {exc}")

    if args.send:
        sent_today += common.send_due_followups(
            state,
            lambda e: craft_followup_email(e),
            sender_name="Arman (Kurox Technical Partner)",
            daily_cap=args.max_emails,
            max_per_run=args.max_followups,
            save_path=STATE_FILE,
        )
        _, _, post_stats = common.evaluate_play_gate(state, daily_cap=args.max_emails, hard_stop_total=args.hard_stop, override=True)
        common.push_dashboard_ingest("play_c_agency", post_stats, source="play_c_cron_post")

    print(f"[=] Play C Summary: candidates={len(cands)} probed={len(to_probe)} verified_agencies={len(hits)} sent_today={sent_today}")


if __name__ == "__main__":
    main()
