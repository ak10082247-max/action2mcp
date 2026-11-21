#!/usr/bin/env python3
"""
Play B Cron Sniper: Shopify & WooCommerce "Google Shopping & Revenue-Leak" Detector
Pulls real retail domains from Common Crawl (myshopify.com subdomains) + Nominatim storefronts,
verifies live /products.json or /wp-json/wc/store/v1/products inventory, inspects Product JSON-LD,
broken nav links, >3MB images, and legacy Shopify ScriptTags ahead of March 1, 2027,
then emails verified storefront contacts linking to StoreFix ($10 deal, was $49).
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
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

STATE_FILE = os.path.join(REPO_ROOT, "data", "ecom_fix_state.json")
DEFAULT_ECOM_FIX_URL = os.environ.get("ECOM_FIX_BASE_URL") or "https://ecom-fix.ak10082247.workers.dev"

LD_RE = re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.IGNORECASE | re.DOTALL)
LINK_RE = re.compile(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
IMG_RE = re.compile(r'<img\b[^>]*src=["\']([^"\']+)["\']', re.IGNORECASE)
SCRIPTTAG_RE = re.compile(r'asyncLoad[\s\S]{0,1200}?var\s+urls\s*=\s*\[([\s\S]*?)\]', re.IGNORECASE)


def audit_product_jsonld(html: str, expected_price: float | None, product_url: str) -> list[str]:
    issues = []
    products = []
    for raw in LD_RE.findall(html or ""):
        try:
            obj = json.loads(raw.strip())
            nodes = obj if isinstance(obj, list) else (obj.get("@graph") or [obj])
            for n in nodes:
                t = n.get("@type")
                types = t if isinstance(t, list) else [t]
                if "Product" in [str(x) for x in types]:
                    products.append(n)
        except Exception:
            continue
    if not products:
        issues.append(f"Missing Product JSON-LD on {product_url} (blocks Google Shopping price snippets)")
        return issues

    prod = products[0]
    offers = prod.get("offers")
    if isinstance(offers, list) and offers:
        offers = offers[0]
    if not isinstance(offers, dict):
        issues.append(f"Product JSON-LD missing 'offers' object on {product_url}")
    else:
        if offers.get("price") in (None, ""):
            issues.append(f"Missing required offers.price on {product_url}")
        elif expected_price is not None:
            try:
                ld_p = float(re.sub(r"[^0-9.]", "", str(offers["price"])))
                if abs(ld_p - expected_price) > 0.05:
                    issues.append(f"Google Shopping price mismatch on {product_url}: schema={ld_p} vs store={expected_price}")
            except Exception:
                pass
        if not offers.get("priceCurrency"):
            issues.append(f"Missing offers.priceCurrency on {product_url}")
        if not offers.get("availability"):
            issues.append(f"Missing offers.availability on {product_url}")
    if not prod.get("sku") and not prod.get("gtin") and not prod.get("mpn") and not (isinstance(offers, dict) and offers.get("sku")):
        issues.append(f"Missing Product sku/gtin identifier on {product_url}")
    return issues


RETAIL_ROTATION = [
    ("boutique shop", "London"), ("clothing store", "Manchester"), ("jewelry store", "Austin"),
    ("coffee roaster", "Portland"), ("bicycle shop", "Bristol"), ("pet shop", "Chicago"),
    ("gift shop", "Edinburgh"), ("bakery", "Seattle"), ("skincare shop", "Los Angeles"),
    ("homeware shop", "Brighton"), ("outdoor gear shop", "Denver"), ("florist", "Boston"),
    ("record store", "Nashville"), ("bookshop", "Oxford"), ("furniture store", "Melbourne"),
    ("surf shop", "San Diego"), ("tea shop", "Toronto"), ("candle shop", "Brooklyn"),
    ("shoe store", "Leeds"), ("vintage clothing", "Glasgow"), ("sporting goods", "Denver"),
    ("wine shop", "San Francisco"), ("toy shop", "Bath"), ("ceramic shop", "Vancouver"),
]


def fetch_store_candidates(cc_page: int = 2, limit_hosts: int = 75, exclude_domains: set[str] | None = None) -> tuple[list[str], int]:
    hosts = []
    seen = set()
    excl = {d.lower().replace("www.", "") for d in (exclude_domains or set())}
    page = max(2, int(cc_page or 2))

    def _accept(host_raw: str) -> bool:
        h = host_raw.lower().strip()
        bare = h.replace("www.", "")
        if not h or "." not in h or bare in excl or h in seen:
            return False
        if h in ("myshopify.com", "www.myshopify.com") or h.startswith(("admin.", "apps.", "help.", "community.", "accounts.", "partners.")):
            return False
        if any(b in h for b in ("facebook.com", "instagram.com", "linkedin.com", "yell.com")):
            return False
        seen.add(h)
        hosts.append(h)
        return True

    # 1. Common Crawl Shopify storefronts across multiple mirrors (dense pages 2..19)
    page = 2 + ((max(2, int(cc_page or 2)) - 2) % 18)
    try:
        colls = common.http_get_json("https://index.commoncrawl.org/collinfo.json", timeout=10)
        for coll in colls[:6]:
            if len(hosts) >= limit_hosts:
                break
            cdx_api = coll["cdx-api"]
            u = f"{cdx_api}?url=*.myshopify.com&output=json&filter=status:200&limit=60&page={page}&fl=url"
            try:
                st, _, _, raw = common.http_fetch(u, timeout=16, verify_ssl=False)
                if st == 200:
                    for line in raw.decode("utf-8", "replace").splitlines():
                        if not line.strip():
                            continue
                        try:
                            item_url = json.loads(line).get("url") or ""
                            _accept(urllib.parse.urlparse(item_url).hostname or "")
                        except Exception:
                            continue
            except Exception:
                continue
            page = 2 if page >= 19 else page + 1
    except Exception as exc:
        print(f"   [!] Common Crawl discovery warning: {exc}", flush=True)

    # 2. Fast Photon + OSM batch retail shop websites (custom Shopify + WooCommerce storefronts)
    rot_idx = page % len(RETAIL_ROTATION)
    retail_queries = [f"{RETAIL_ROTATION[(rot_idx + off) % len(RETAIL_ROTATION)][0]} {RETAIL_ROTATION[(rot_idx + off) % len(RETAIL_ROTATION)][1]}" for off in range(20)]
    for item in common.fetch_photon_osm_websites(retail_queries, limit_per_query=60):
        if len(hosts) >= limit_hosts:
            break
        _accept(item["domain"])

    # 3. Overpass fallback if total hosts < 120
    m_count = len(common.METRO_BBOXES)
    if len(hosts) < 120:
        _, s, w, n_lat, e = common.METRO_BBOXES[page % m_count]
        ql = f'[out:json][timeout:18];node["shop"]["website"]({s},{w},{n_lat},{e});out tags 150;'
        for item in common.fetch_overpass_websites(ql, timeout=18):
            if len(hosts) >= limit_hosts:
                break
            _accept(item["domain"])

    return hosts[:limit_hosts], page + 1


def diagnose_ecom_store(candidate_host: str) -> dict | None:
    try:
        st, home_url, _, raw_home = common.http_fetch(f"https://{candidate_host}/", timeout=9, verify_ssl=False)
    except Exception:
        return None
    if st >= 400 or "/password" in home_url:
        return None
    parsed_home = urllib.parse.urlparse(home_url)
    base_origin = f"{parsed_home.scheme}://{parsed_home.netloc}"
    bare_domain = (parsed_home.hostname or candidate_host).lower().replace("www.", "")
    home_html = raw_home.decode("utf-8", "replace")

    platform = None
    sample_product_url = None
    sample_price = None
    currency = "USD"

    # Check Shopify /products.json
    try:
        sp_json = common.http_get_json(f"{base_origin}/products.json?limit=3", timeout=7)
        prods = sp_json.get("products") or []
        if prods:
            platform = "shopify"
            p0 = prods[0]
            sample_product_url = f"{base_origin}/products/{p0['handle']}"
            v0 = (p0.get("variants") or [{}])[0]
            if v0.get("price"):
                try:
                    sample_price = float(v0["price"])
                except Exception:
                    sample_price = None
    except Exception:
        pass

    # Fallback WooCommerce /wp-json/wc/store/v1/products
    if not platform:
        try:
            wc_json = common.http_get_json(f"{base_origin}/wp-json/wc/store/v1/products?per_page=3", timeout=7)
            if isinstance(wc_json, list) and wc_json:
                platform = "woocommerce"
                p0 = wc_json[0]
                sample_product_url = p0.get("permalink") or f"{base_origin}/product/{p0.get('slug')}"
                pr = p0.get("prices") or {}
                currency = pr.get("currency_code") or "USD"
                if pr.get("price"):
                    sample_price = int(pr["price"]) / (10 ** int(pr.get("currency_minor_unit") or 2))
        except Exception:
            pass

    if not platform or not sample_product_url:
        return None

    m_curr = re.search(r'"active"\s*:\s*"([A-Z]{3})"', home_html)
    if m_curr:
        currency = m_curr.group(1)

    issues = []
    # 1. Product JSON-LD check
    try:
        pst, _, _, praw = common.http_fetch(sample_product_url, timeout=8, verify_ssl=False)
        if pst == 200:
            issues.extend(audit_product_jsonld(praw.decode("utf-8", "replace"), sample_price, sample_product_url))
    except Exception:
        pass

    # 2. Legacy Shopify ScriptTags ahead of March 1, 2027
    script_tags = []
    stm = SCRIPTTAG_RE.search(home_html)
    if stm:
        for um in re.findall(r'["\']([^"\']+)["\']', stm.group(1)):
            script_tags.append(um.replace("\\/", "/"))
    if script_tags:
        issues.append(f"{len(script_tags)} legacy Shopify ScriptTag(s) active (breaks March 1, 2027)")

    # 3. Broken nav / collection links
    broken_links = []
    checked = 0
    for href, _ in LINK_RE.findall(home_html):
        if checked >= 4:
            break
        if not any(seg in href.lower() for seg in ("/collections/", "/products/", "/pages/")):
            continue
        full = urllib.parse.urljoin(base_origin, href)
        if bare_domain not in full.lower():
            continue
        checked += 1
        try:
            nst, _, _, _ = common.http_fetch(full, timeout=5, verify_ssl=False)
            if nst in (404, 410) or nst >= 500:
                broken_links.append(f"{full} (HTTP {nst})")
                issues.append(f"Broken storefront URL returning HTTP {nst}: {full}")
        except Exception:
            continue

    # 4. Large >3MB image check
    for src in IMG_RE.findall(home_html)[:3]:
        img_u = urllib.parse.urljoin(base_origin, src)
        try:
            ist, _, ihdrs, _ = common.http_fetch(img_u, method="HEAD", timeout=4, verify_ssl=False)
            cl = int(ihdrs.get("Content-Length") or ihdrs.get("content-length") or 0)
            if ist == 200 and cl > 3_000_000:
                issues.append(f"Unoptimized hero/banner image >3MB ({round(cl / 1e6, 1)}MB): {img_u}")
                break
        except Exception:
            continue

    if not issues:
        return None

    emails = common.extract_deliverable_emails(home_html, bare_domain)
    if not emails:
        for cp in ("/pages/contact", "/pages/contact-us", "/contact"):
            try:
                cst, _, _, craw = common.http_fetch(f"{base_origin}{cp}", timeout=6, verify_ssl=False)
                if cst < 400:
                    emails = common.extract_deliverable_emails(craw.decode("utf-8", "replace"), bare_domain)
                    if emails:
                        break
            except Exception:
                continue
    if not emails:
        return None

    return {
        "domain": bare_domain,
        "platform": platform,
        "currency": currency,
        "email": emails[0],
        "sample_product_url": sample_product_url,
        "issues": issues,
    }


def _redact_issue_summary(issues: list[str]) -> str:
    """Summarize storefront issues without giving away exact failing path strings in Email #1."""
    lines: list[str] = []
    ld_count = sum(1 for i in issues if "JSON-LD" in i or "offers." in i or "sku/gtin" in i or "Price" in i.lower() or "price" in i.lower())
    st_count = sum(1 for i in issues if "ScriptTag" in i)
    br_count = sum(1 for i in issues if "Broken storefront" in i or "HTTP " in i)
    img_count = sum(1 for i in issues if ">3MB" in i)
    if ld_count:
        lines.append(f"- {ld_count} Google Shopping Product JSON-LD markup issue(s) (blocks rich price snippets / free listings)")
    if br_count:
        lines.append(f"- {br_count} broken collection/storefront link(s) returning HTTP 404/5xx")
    if st_count:
        lines.append("- Legacy Shopify ScriptTag(s) active ahead of the March 1, 2027 deprecation deadline")
    if img_count:
        lines.append(f"- {img_count} oversized >3MB hero/banner asset(s) slowing mobile checkout")
    if not lines:
        lines.append(f"- {len(issues)} Google Shopping / theme conversion warning(s) flagged")
    return "\n".join(lines[:3])


def craft_ecom_fix_email(target: dict, base_url: str = DEFAULT_ECOM_FIX_URL) -> tuple[str, str]:
    dom = target["domain"]
    raw_audit_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode({'domain': dom, 'ref': 'email1'})}"
    audit_link = common.build_tracked_url("play_b_ecom", dom, raw_audit_link)
    top_issues = _redact_issue_summary(target["issues"])
    subject = f"Google Shopping / theme issues flagged on {dom}"[:96]
    body = (
        f"Hi {dom} team,\n\n"
        f"While running an automated storefront audit on {dom} ({target['platform']}), we caught {len(target['issues'])} live revenue-leak issue(s):\n"
        f"{top_issues}\n\n"
        f"Missing or mismatched Product JSON-LD drops Google Shopping free listings & rich price snippets, and broken/legacy scripts hurt checkout conversion.\n\n"
        f"Two fast ways to get the exact affected URL(s) + ready-to-paste fix:\n"
        f"1) Reply \"fix\" to this email and I'll reply with the failing path(s) + a direct Stripe checkout link (checkout.stripe.com) for our $10 Launch Deal (normally $49).\n"
        f"2) Or inspect the live diagnostic & download the custom Store Fix Bundle ($10 Deal, was $49 — paste-ready "
        f"{'WooCommerce PHP snippet' if target['platform'] == 'woocommerce' else 'Shopify product-schema.liquid snippet'} tuned to {target['currency']}, "
        f"redirect CSV & ScriptTag checklist) at:\n"
        f"{audit_link}\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def main():
    parser = argparse.ArgumentParser(description="Play B: Shopify & WooCommerce Revenue-Leak Sniper")
    parser.add_argument("--limit", type=int, default=100, help="Max store candidates per run")
    parser.add_argument("--max-emails", type=int, default=20, help="Daily send cap (default: 20/day)")
    parser.add_argument("--hard-stop", type=int, default=200, help="Stop-loss delivered cap (default: 200)")
    parser.add_argument("--send", action="store_true", help="Send verified store alerts via SMTP")
    parser.add_argument("--override", action="store_true", help="Override pause/stop-loss gates intentionally")
    parser.add_argument("--canary-to", default=os.environ.get("CANARY_INBOXES", ""), help="Comma-separated test Gmail/Outlook addresses (not counted in 200 test)")
    args = parser.parse_args()

    state = common.load_json_state(
        STATE_FILE,
        {"cc_page": 2, "contacted_domains": [], "contacted_emails": [], "bounced_emails": [], "replied_emails": [], "paid_sales": 0, "history": []},
    )
    if args.canary_to:
        subj, body = craft_ecom_fix_email({
            "domain": "example-shop.com",
            "platform": "shopify",
            "currency": "USD",
            "email": "check@example-shop.com",
            "issues": ["Missing Product JSON-LD (blocks Google Shopping price snippets)", "1 legacy Shopify ScriptTag active"],
        })
        cnt = common.send_canary_copies(args.canary_to, subj, body, sender_name="Arman (StoreFix Audit)")
        print(f"[+] Sent {cnt} uncounted Play B canary spam-check email(s).")
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
        common.push_dashboard_ingest("play_b_ecom", stats, source="play_b_cron")
        kv_paused, kv_reason = common.check_dashboard_play_status("play_b_ecom")
        if kv_paused and not args.override:
            print(f"[!] Play B Dashboard Safety Gate: {kv_reason} (bounce={stats['bounce_rate_pct']}%)")
            return
    sent_today = stats["sent_today"]
    known_domains = set(state.get("contacted_domains") or [])
    known_emails = set(e.lower().strip() for e in (state.get("contacted_emails") or []))
    bounced_set = stats["bounced_set"]

    if args.send and not allowed:
        print(f"[!] Play B Stop-Loss / Safety Gate: {gate_reason} (clean_delivered={stats['clean_delivered']}/{args.hard_stop}, bounce={stats['bounce_rate_pct']}%)")
        return

    hosts, next_page = fetch_store_candidates(int(state.get("cc_page") or 2), args.limit, exclude_domains=known_domains)
    state["cc_page"] = next_page
    common.save_json_state(STATE_FILE, state)

    to_probe = [h for h in hosts if h.replace("www.", "") not in known_domains]
    hits = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(diagnose_ecom_store, h) for h in to_probe]
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
        subj, body = craft_ecom_fix_email(diag)
        print(f"[+] FOUND PLAY B LEAK: {diag['domain']} ({diag['platform']}) -> {diag['email']} | issues={len(diag['issues'])}")
        if args.send:
            if sent_today >= args.max_emails:
                break
            try:
                common.send_smtp_email(diag["email"], subj, body, sender_name="Arman (StoreFix Audit)")
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
        common.push_dashboard_ingest("play_b_ecom", post_stats, source="play_b_cron_post")

    print(f"[=] Play B Summary: candidates={len(hosts)} verified_leaks={len(hits)} sent_today={sent_today}")


if __name__ == "__main__":
    main()
