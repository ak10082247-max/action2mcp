#!/usr/bin/env python3
"""
Play E: Browser Reverse-Engineering "Broken Money-Button & Ad-Burn" Sniper.
Uses real headless Chromium (money_button_probe.mjs) to test live ad-spending
Shopify/WooCommerce stores and high-ticket local service businesses for runtime
conversion failures invisible to static HTML checks: broken Add-to-Cart POSTs,
dead booking iframes, runtime click JS TypeErrors, hydration crashes, and CORS blocks.
"""

import argparse
from datetime import datetime, timezone
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPTS_DIR)
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

import ecom_fix_sniper as play_b
import launch_rescue_sniper as play_d
import outreach_common as common
import site_rescue_sniper as play_a

common.load_workspace_env(REPO_ROOT)

STATE_FILE = os.path.join(REPO_ROOT, "data", "money_button_state.json")
HITS_LOG_FILE = os.path.join(REPO_ROOT, "data", "money_button_hits.jsonl")
PROBE_SCRIPT = os.path.join(SCRIPTS_DIR, "money_button_probe.mjs")

EXISTING_STATE_FILES = [
    os.path.join(REPO_ROOT, "data", "site_rescue_state.json"),
    os.path.join(REPO_ROOT, "data", "ecom_fix_state.json"),
    os.path.join(REPO_ROOT, "data", "agency_overflow_state.json"),
    os.path.join(REPO_ROOT, "data", "launch_rescue_state.json"),
    os.path.join(REPO_ROOT, "data", "saas_agent_leak_state.json"),
]

CHAIN_DOMAIN_BLOCKLIST = {
    "mydentist.co.uk", "bupa.co.uk", "bupadentalcare.co.uk", "nhs.uk", "specsavers.co.uk",
    "boots.com", "visionexpress.com", "superdrug.com", "yoursclothing.co.uk", "crewclothing.co.uk",
    "hollandandbarrett.com", "tesco.com", "asda.com", "sainsburys.co.uk", "johnlewis.com",
    "argos.co.uk", "currys.co.uk", "hm.com", "zara.com", "next.co.uk", "primark.com",
    "tkmaxx.com", "jdsports.co.uk", "sportsdirect.com", "amazon.com", "amazon.co.uk",
    "walmart.com", "target.com", "cvs.com", "walgreens.com",
}


def load_all_known_exclusions(state: dict) -> tuple[set[str], set[str]]:
    """Collect contacted domains and emails across all snipers to avoid duplicate outreach."""
    return common.load_known_exclusions(EXISTING_STATE_FILES, state)


NOMINATIM_TAGS = [
    ("[dentist]", "local_service"),
    ("[clinic]", "local_service"),
    ("[optician]", "local_service"),
    ("[veterinary]", "local_service"),
    ("[doctors]", "local_service"),
    ("[beauty]", "local_service"),
    ("[furniture]", "ecom_store"),
    ("[florist]", "ecom_store"),
    ("[bicycle]", "ecom_store"),
    ("[shoes]", "ecom_store"),
    ("[gift]", "ecom_store"),
    ("[cosmetics]", "ecom_store"),
    ("[bakery]", "ecom_store"),
]


def gather_fresh_targets(
    state: dict,
    local_queries: int,
    ecom_limit: int,
    known_domains: set[str],
    desired_total: int = 50,
) -> tuple[list[dict], int, int]:
    """Gather high-yield non-overlapping targets: Common Crawl stores + ShowHN/SaaS + Nominatim SMB clinics."""
    ecom_targets: list[dict] = []
    launch_targets: list[dict] = []
    local_targets: list[dict] = []
    seen_doms = set(known_domains) | CHAIN_DOMAIN_BLOCKLIST

    local_cursor = int(state.get("local_cursor") or 0)
    cc_page = max(2, int(state.get("cc_page") or 2))

    def _push_unique(bucket: list[dict], dom: str, url: str, name: str, source: str, city: str = "", hint_email: str = "") -> bool:
        bare = str(dom or "").lower().strip().replace("www.", "")
        if not bare or "." not in bare or bare in seen_doms:
            return False
        if bare.endswith((".ac.uk", ".edu", ".gov", ".gov.uk")) or ".edu." in bare or ".gov." in bare:
            return False
        if any(b in bare for b in common.DIRECTORY_BLOCKLIST) or any(ch in bare for ch in CHAIN_DOMAIN_BLOCKLIST):
            return False
        seen_doms.add(bare)
        bucket.append({
            "name": (name or bare).strip()[:80],
            "url": url,
            "domain": bare,
            "hint_email": hint_email.strip().lower(),
            "source": source,
            "city": city,
        })
        return True

    # 1. Real Shopify / commercial stores from Common Crawl & retail rotation (highest JS/ad-pixel conversion hit rate)
    if ecom_limit > 0:
        try:
            hosts, next_cc = play_b.fetch_store_candidates(cc_page, limit_hosts=max(25, ecom_limit), exclude_domains=seen_doms)
            cc_page = next_cc
            for h in hosts:
                _push_unique(ecom_targets, h, f"https://{h}/", h, "ecom_store", "Web")
        except Exception:
            pass
        # 2. Fresh Show HN & SaaS web apps (great for hydration crashes, dead Pricing/Signup CTAs, mobile blocks)
        try:
            for item in play_d.fetch_launch_candidates(limit_total=max(24, ecom_limit)):
                _push_unique(launch_targets, item.get("domain", ""), item.get("url", ""), item.get("name", ""), "saas_launch", "Web")
        except Exception:
            pass

    # 3. Local high-margin clinics/agencies via Nominatim bracket-tag search
    metros = common.METRO_BBOXES
    n_pairs = len(NOMINATIM_TAGS) * len(metros)
    batch_count = max(0, min(14, int(local_queries)))
    for step in range(batch_count):
        if len(local_targets) >= desired_total:
            break
        pair_idx = (local_cursor + step) % n_pairs
        tag, src = NOMINATIM_TAGS[pair_idx % len(NOMINATIM_TAGS)]
        city, s, w, n_lat, e = metros[(pair_idx // len(NOMINATIM_TAGS)) % len(metros)]
        u = (
            f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(tag)}"
            f"&viewbox={w},{n_lat},{e},{s}&bounded=1&format=jsonv2&extratags=1&limit=40"
        )
        try:
            st, _, _, raw = common.http_fetch(u, timeout=10, verify_ssl=False)
            if st == 200:
                rows = json.loads(raw.decode("utf-8", "replace"))
                for row in rows:
                    et = row.get("extratags") or {}
                    web = str(et.get("website") or et.get("contact:website") or et.get("url") or "").strip()
                    if not web:
                        continue
                    if not web.startswith(("http://", "https://")):
                        web = "https://" + web
                    dom = (urllib.parse.urlparse(web).hostname or "").lower().strip()
                    hint_em = str(et.get("email") or et.get("contact:email") or "")
                    _push_unique(local_targets, dom, web, str(row.get("name") or dom), src, city, hint_em)
                    if len(local_targets) >= desired_total:
                        break
        except Exception:
            pass
        time.sleep(1.05)

    local_cursor = (local_cursor + batch_count) % n_pairs

    # Interleave buckets so each Playwright batch tests stores, local services, and SaaS launches together
    targets: list[dict] = []
    buckets = [ecom_targets, local_targets, launch_targets]
    idx = 0
    while len(targets) < desired_total * 2 and any(idx < len(b) for b in buckets):
        for b in buckets:
            if idx < len(b):
                targets.append(b[idx])
        idx += 1

    print(
        f"[*] Target pool built: total={len(targets)} (ecom={len(ecom_targets)}, local={len(local_targets)}, saas={len(launch_targets)})",
        flush=True,
    )
    return targets, local_cursor, cc_page


def run_browser_probe(urls: list[str], concurrency: int = 3, timeout_ms: int = 16000) -> list[dict]:
    """Execute Playwright runtime probe script across candidate URLs cleanly."""
    if not urls:
        return []
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        json.dump(urls, tf)
        temp_path = tf.name
    try:
        proc = subprocess.run(
            ["node", PROBE_SCRIPT, "--targets-file", temp_path, "--concurrency", str(concurrency), "--timeout-ms", str(timeout_ms)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=max(90, len(urls) * 12),
        )
        if proc.returncode != 0:
            raise RuntimeError(f"money_button_probe.mjs failed ({proc.returncode}): {proc.stderr[:400]}")
        if not (proc.stdout or "").strip():
            raise RuntimeError(f"money_button_probe.mjs returned empty stdout (stderr={proc.stderr[:300]})")
        return json.loads(proc.stdout)
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


def pick_best_email(probe_res: dict, target_meta: dict, known_emails: set[str]) -> str | None:
    """Validate DOM-rendered and hint emails through MX + anti-queue checks, with HTML contact fallback."""
    dom = probe_res.get("domain") or target_meta.get("domain") or ""
    final_url = probe_res.get("finalUrl") or (f"https://{dom}/" if dom else "")
    bare_dom = dom.replace("www.", "").lower()

    def _collect_deliverable(raw_list: list[str]) -> list[str]:
        out: list[str] = []
        for em in raw_list:
            low = str(em or "").strip().lower()
            if not low or low in out or low in known_emails:
                continue
            if common.is_enterprise_queue_email(low):
                continue
            if common.is_deliverable_email(low, bounced_set=known_emails):
                out.append(low)
        out.sort(key=lambda e: (0 if e.endswith("@" + bare_dom) or e.endswith("." + bare_dom) else 1))
        return out

    initial: list[str] = list(probe_res.get("emails") or [])
    hint = str(target_meta.get("hint_email") or "").strip().lower()
    if hint:
        initial.append(hint)

    deliverable = _collect_deliverable(initial)

    # Fallback: scan finalUrl homepage raw HTML + common contact pages whenever DOM yielded no deliverable email
    if not deliverable and final_url:
        base_origin = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(final_url))
        extra_cands: list[str] = []
        for path in ("/", "/contact", "/contact-us", "/pages/contact", "/pages/contact-us", "/about-us"):
            try:
                u = final_url if path == "/" else f"{base_origin}{path}"
                st, _, _, raw = common.http_fetch(u, timeout=6, verify_ssl=False)
                if st == 200 and raw:
                    html = raw.decode("utf-8", "replace")
                    for em in common.extract_deliverable_emails(html, dom):
                        if em not in extra_cands:
                            extra_cands.append(em)
                    if extra_cands:
                        break
            except Exception:
                continue
        deliverable = _collect_deliverable(extra_cands)

    return deliverable[0] if deliverable else None


def score_hit(probe_res: dict) -> int:
    """Score broken conversion targets (active ad pixels + critical runtime breakage = highest)."""
    findings = probe_res.get("findings") or []
    if not findings:
        return 0
    score = 0
    for f in findings:
        score += 50 if f.get("severity") == "critical" else 30
    if probe_res.get("adPixels"):
        score += 40
    if any(f.get("kind") in ("CART_ADD_API_FAILED", "BOOKING_IFRAME_DEAD", "BOOKING_CTA_BROKEN") for f in findings):
        score += 20
    return score


def craft_human_alert_email(probe_res: dict, target_meta: dict) -> tuple[str, str]:
    """Write a concise, zero-hype, plain-text developer note citing exact Chrome failure proof."""
    dom = probe_res["domain"]
    finding = probe_res["findings"][0]
    kind = finding.get("kind") or "RUNTIME_ERROR"
    pixels = probe_res.get("adPixels") or []
    platform = probe_res.get("platform") or "site"
    checkout_base = (
        "https://ecom-fix.ak10082247.workers.dev"
        if platform in ("shopify", "woocommerce")
        else "https://site-rescue.ak10082247.workers.dev"
    )
    checkout_tier = "pro_kit" if platform in ("shopify", "woocommerce") else "priority"
    direct_checkout = f"{checkout_base}/api/checkout?tier={checkout_tier}&domain={urllib.parse.quote(dom)}"

    if kind == "CART_ADD_API_FAILED":
        subj = f"quick heads up: Add to Cart error on {dom}"
    elif kind in ("BOOKING_IFRAME_DEAD", "BOOKING_CTA_BROKEN"):
        subj = f"quick heads up: broken booking link on {dom}"
    elif kind == "CLIENT_HYDRATION_CRASH":
        subj = f"quick heads up: Chrome runtime crash on {dom}"
    else:
        subj = f"quick heads up: {platform} JS/network error on {dom}"

    name_hint = str(target_meta.get("name") or dom).strip()
    greeting = f"Hi {name_hint} team," if name_hint != dom else f"Hi {dom} team,"
    ad_line = (
        f"\nI also noticed active ad tracking ({', '.join(pixels[:2])}) firing on the page, so paid clicks hitting that step are dropping off before converting.\n"
        if pixels
        else "\n"
    )

    body = (
        f"{greeting}\n\n"
        f"I was checking {dom} in Chrome just now and hit a live error while testing the {finding['actionTested']}:\n"
        f"- {finding['evidence']}\n"
        f"{ad_line}"
        f"Likely fix: {finding['rootCauseFix']}\n\n"
        f"Happy to send over the full Chrome error/network trace and exact line fix if useful — just reply \"trace\". Or if you want it fixed and verified end-to-end today, reply \"fix\" (or use our direct $25–$29 priority Stripe checkout: {direct_checkout}).\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subj, body


def append_hit_log(entry: dict) -> None:
    os.makedirs(os.path.dirname(HITS_LOG_FILE), exist_ok=True)
    with open(HITS_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Play E: Playwright Broken Money-Button & Ad-Burn Sniper")
    parser.add_argument("--local-queries", type=int, default=6, help="Local business Photon/OSM queries (0 to skip)")
    parser.add_argument("--ecom-limit", type=int, default=20, help="Shopify Common Crawl domains to probe (0 to skip)")
    parser.add_argument("--max-probe", type=int, default=24, help="Max sites to open in headless Chromium per run")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent Chromium contexts")
    parser.add_argument("--max-emails", type=int, default=15, help="Daily send cap")
    parser.add_argument("--send", action="store_true", help="Actually send verified emails via Gmail SMTP")
    parser.add_argument("--urls-file", default="", help="Optional JSON file of explicit URLs to test")
    args = parser.parse_args()

    state = common.load_json_state(
        STATE_FILE,
        {"local_cursor": 40, "cc_page": 12, "contacted_domains": [], "contacted_emails": [], "bounced_emails": [], "replied_emails": [], "paid_sales": 0, "history": []},
    )
    known_domains, known_emails = load_all_known_exclusions(state)

    if args.send and common.sync_imap_bounces_and_replies(state):
        common.save_json_state(STATE_FILE, state)

    allowed, gate_reason, stats = common.evaluate_play_gate(state, daily_cap=args.max_emails, hard_stop_total=200)
    if args.send and not allowed:
        print(f"[!] Play E Safety Gate stopped run: {gate_reason}")
        return

    if args.urls_file and os.path.exists(args.urls_file):
        raw_urls = json.load(open(args.urls_file, encoding="utf-8"))
        targets = [{"name": u, "url": u, "domain": urllib.parse.urlparse(u).hostname or u, "hint_email": "", "source": "custom"} for u in raw_urls][: args.max_probe]
    else:
        print(f"[*] Gathering fresh targets (local_queries={args.local_queries}, ecom_limit={args.ecom_limit})...", flush=True)
        targets, next_local, next_cc = gather_fresh_targets(
            state,
            args.local_queries,
            args.ecom_limit,
            known_domains,
            desired_total=max(args.max_probe, 24),
        )
        state["local_cursor"] = next_local
        state["cc_page"] = next_cc
        common.save_json_state(STATE_FILE, state)
        targets = targets[: args.max_probe]

    print(f"[*] Probing {len(targets)} fresh targets in headless Chromium (concurrency={args.concurrency})...", flush=True)
    meta_by_url = {t["url"]: t for t in targets}
    probe_results = run_browser_probe([t["url"] for t in targets], concurrency=args.concurrency)

    verified_hits = []
    seen_hit_domains: set[str] = set()
    for res in probe_results:
        if not res or not res.get("findings"):
            continue
        hit_dom = str(res.get("domain") or "").lower().strip().replace("www.", "")
        if not hit_dom or hit_dom in seen_hit_domains:
            continue
        seen_hit_domains.add(hit_dom)
        meta = meta_by_url.get(res.get("inputUrl"), {"domain": hit_dom, "name": hit_dom})
        email = pick_best_email(res, meta, known_emails)
        res["_email"] = email
        res["_meta"] = meta
        res["_score"] = score_hit(res)
        verified_hits.append(res)

    verified_hits.sort(key=lambda x: x["_score"], reverse=True)
    sent_today = stats["sent_today"]

    print(f"[=] Probed={len(probe_results)} | BrokenRuntimeHits={len(verified_hits)}")
    for hit in verified_hits:
        f0 = hit["findings"][0]
        pix = ",".join(hit.get("adPixels") or []) or "none"
        em = hit.get("_email") or "NO_MX_EMAIL"
        print(f"  [HIT score={hit['_score']}] {hit['domain']} ({hit['platform']}) | ads={pix} | email={em} | {f0['kind']}: {f0['evidence']}")
        append_hit_log({
            "ts": datetime.now(timezone.utc).isoformat(),
            "domain": hit["domain"],
            "platform": hit["platform"],
            "adPixels": hit.get("adPixels") or [],
            "email": hit.get("_email"),
            "score": hit["_score"],
            "findings": hit["findings"],
        })

        if args.send and em != "NO_MX_EMAIL" and sent_today < args.max_emails:
            if hit["domain"] in known_domains or em in known_emails:
                continue
            subj, body = craft_human_alert_email(hit, hit["_meta"])
            try:
                common.send_smtp_email(em, subj, body, sender_name="Arman Khan")
                known_domains.add(hit["domain"])
                known_emails.add(em)
                state["contacted_domains"].append(hit["domain"])
                state["contacted_emails"].append(em)
                state["history"].append({
                    "domain": hit["domain"],
                    "email": em,
                    "kind": f0["kind"],
                    "ad_pixels": hit.get("adPixels") or [],
                    "sent_date": datetime.now(timezone.utc).isoformat(),
                })
                sent_today += 1
                common.save_json_state(STATE_FILE, state)
                print(f"    -> SENT alert to {em}")
                time.sleep(5)
            except Exception as exc:
                print(f"    [-] SMTP send error ({em}): {exc}")

    print(f"[=] Done. sent_today={sent_today}/{args.max_emails}")


if __name__ == "__main__":
    main()
