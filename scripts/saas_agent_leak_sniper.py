#!/usr/bin/env python3
"""
Play F Cron Sniper: SaaS, AI Agent & Agency "JS-Bundle Secret, Checkout/Form & Endpoint Leak" Detector.
Targets fresh Show HN / GitHub AI/SaaS/MCP launches plus live Common Crawl .ai/.app/.agency sites,
verifying same-origin client JS bundles for leaked service keys (type-only reporting), broken
Pricing/Stripe/Calendly/Typeform/Tally CTAs, dead form webhook actions, exposed configs, and
failing /openapi.json or /mcp endpoints before emailing verified contacts.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
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

import launch_rescue_sniper as play_d
import outreach_common as common

common.load_workspace_env(REPO_ROOT)

STATE_FILE = os.path.join(REPO_ROOT, "data", "saas_agent_leak_state.json")
DEFAULT_SITE_RESCUE_URL = os.environ.get("SITE_RESCUE_BASE_URL") or "https://site-rescue.ak10082247.workers.dev"

EXISTING_STATE_FILES = [
    os.path.join(REPO_ROOT, "data", "site_rescue_state.json"),
    os.path.join(REPO_ROOT, "data", "ecom_fix_state.json"),
    os.path.join(REPO_ROOT, "data", "agency_overflow_state.json"),
    os.path.join(REPO_ROOT, "data", "launch_rescue_state.json"),
    os.path.join(REPO_ROOT, "data", "money_button_state.json"),
]

SCRIPT_SRC_RE = re.compile(r'<script\b[^>]*src=["\']([^"\']+)["\']', re.IGNORECASE)
HREF_CTA_RE = re.compile(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
FORM_ACTION_RE = re.compile(r'<form\b[^>]*action=["\']([^"\']+)["\']', re.IGNORECASE)

HIGH_INTENT_CTA_RE = re.compile(
    r"(pricing|upgrade|checkout|subscribe|buy|get[-_\s]?started|sign[-_\s]?up|waitlist|demo|book|schedule|contact|docs|api)",
    re.IGNORECASE,
)
CONVERSION_TARGET_HOST_RE = re.compile(
    r"(buy\.stripe\.com|checkout\.stripe\.com|cal\.com|calendly\.com|typeform\.com|tally\.so|formspree\.io|getform\.io|usebasin\.com|airtable\.com)",
    re.IGNORECASE,
)
DEAD_CONVERSION_TEXT_RE = re.compile(
    r"(this link is no longer active|payment link has expired|form not found|no longer accepting responses|this calendly url is not valid|event type does not exist|page not found|404\s+not found)",
    re.IGNORECASE,
)
JS_NOISE_RE = re.compile(r"(gtag|googletagmanager|fbevents|analytics|hotjar|clarity|cookie|intercom|crisp|recaptcha|hcaptcha)", re.IGNORECASE)

SECRET_RULES: list[tuple[str, re.Pattern]] = [
    ("Stripe live secret key", re.compile(r"\b(?:sk_live_|rk_live_)[0-9A-Za-z]{16,}\b")),
    ("GitHub personal access token", re.compile(r"\b(?:ghp_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{30,})\b")),
    ("AWS access key ID", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Supabase service_role key", re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*[\"'][^\"']{16,}")),
    ("Slack bot/webhook token", re.compile(r"\bxoxb-[0-9]{8,}-[0-9A-Za-z\-]{12,}\b")),
]


def _scan_text_for_secret_labels(content: str) -> list[str]:
    """Return high-confidence secret category names without returning raw secret values."""
    labels: list[str] = []
    for label, rx in SECRET_RULES:
        if rx.search(content or "") and label not in labels:
            labels.append(label)
    return labels


def gather_saas_agent_candidates(state: dict, limit_total: int = 160) -> tuple[list[dict], int]:
    """Combine fresh ShowHN/GitHub SaaS/AI/MCP launches with Common Crawl .ai/.app/.agency hosts."""
    known_domains, _ = common.load_known_exclusions(EXISTING_STATE_FILES, state)
    candidates: list[dict] = []
    seen = set(known_domains)
    cc_page = max(2, int(state.get("cc_page") or 2))

    def _add(cand: dict) -> None:
        dom = str(cand.get("domain") or "").lower().strip().replace("www.", "")
        url = str(cand.get("url") or "").strip()
        if not dom or dom in seen or not play_d.is_clean_launch_candidate(cand.get("name", dom), url):
            return
        seen.add(dom)
        candidates.append({**cand, "domain": dom})

    # 1. Commercial Stripe / SaaS / AI / Agency domains via urlscan.io (publish emails + pricing/checkout pages)
    urlscan_queries = [
        'filename:stripe AND (page.domain:ai OR page.domain:io OR page.domain:app)',
        'page.domain:ai AND (page.url:contact OR page.url:pricing)',
        'page.domain:app AND (page.url:contact OR page.url:pricing)',
        'filename:calendly.com AND NOT page.domain:calendly.com',
    ]
    rot_q = [urlscan_queries[(cc_page + idx) % len(urlscan_queries)] for idx in range(len(urlscan_queries))]
    for host in common.fetch_urlscan_domains(rot_q, size=70, limit_domains=max(50, limit_total // 2), exclude_domains=seen):
        bare = host.replace("www.", "")
        _add({
            "name": bare,
            "url": f"https://{bare}/",
            "domain": bare,
            "source": "urlscan_ai_saas",
            "github_owner": "",
            "github_repo": "",
        })

    # 2. Fresh Show HN + GitHub AI/SaaS/Stripe/MCP launches (capped so buckets mix cleanly)
    try:
        for item in play_d.fetch_launch_candidates(limit_total=max(40, limit_total // 3)):
            if len(candidates) >= limit_total:
                break
            _add(item)
    except Exception:
        pass

    # 3. Extra GitHub AI-agent / MCP / Stripe SaaS topics (last 45 days) with gh CLI token fallback
    since = (datetime.now(timezone.utc) - timedelta(days=45)).strftime("%Y-%m-%d")
    gh_hdrs = {"Accept": "application/vnd.github+json"}
    gh_tok = (os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN") or "").strip()
    if not gh_tok:
        try:
            import subprocess
            tok_out = subprocess.check_output(["gh", "auth", "token"], text=True, stderr=subprocess.DEVNULL).strip()
            if tok_out:
                gh_tok = tok_out
        except Exception:
            pass
    if gh_tok:
        gh_hdrs["Authorization"] = f"Bearer {gh_tok}"
    for topic in ("mcp", "ai-agent", "stripe", "saas"):
        if len(candidates) >= limit_total:
            break
        q = urllib.parse.quote(f"created:>{since} stars:>1 fork:false topic:{topic}")
        try:
            res = common.http_get_json(
                f"https://api.github.com/search/repositories?q={q}&sort=updated&order=desc&per_page=30",
                headers=gh_hdrs,
                timeout=10,
            )
            for repo in res.get("items") or []:
                hp = (repo.get("homepage") or "").strip()
                dom = (urllib.parse.urlparse(hp).hostname or "").lower().replace("www.", "")
                _add({
                    "name": (repo.get("name") or dom)[:80],
                    "url": hp,
                    "domain": dom,
                    "source": f"github_{topic}",
                    "github_owner": (repo.get("owner") or {}).get("login") or "",
                    "github_repo": repo.get("full_name") or "",
                })
        except Exception:
            continue

    return candidates[:limit_total], cc_page + 1


def diagnose_saas_agent_site(cand: dict) -> dict | None:
    """Audit live SaaS/AI/Agency app for leaked bundle keys, broken Checkout/Booking CTAs, dead forms, or API errors."""
    url = cand["url"]
    try:
        st, final_url, hdrs, raw_home = common.http_fetch(url, timeout=9, verify_ssl=False)
    except Exception:
        return None
    if st == 0 or st >= 400:
        return None
    html = raw_home.decode("utf-8", "replace")
    if len(html) < 120:
        return None

    parsed = urllib.parse.urlparse(final_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    bare_domain = (parsed.hostname or cand["domain"]).lower().replace("www.", "")
    hdrs_low = {str(k).lower(): str(v) for k, v in (hdrs or {}).items()}
    issues: list[str] = []
    has_ai_surface = bool(re.search(r"\b(mcp|openapi|agent|llm|ai\s+api|x402)\b", html[:120000], re.I)) or (
        "mcp" in str(cand.get("source") or "") or "ai" in bare_domain
    )

    # 1. Wildcard CORS + Credentials
    if hdrs_low.get("access-control-allow-origin") == "*" and hdrs_low.get("access-control-allow-credentials", "").lower() == "true":
        issues.append("CORS misconfiguration: Access-Control-Allow-Origin: * paired with Allow-Credentials: true")

    # 2. Inline HTML + same-origin JS bundle secret check (never logs raw values)
    secret_labels = _scan_text_for_secret_labels(html)
    if secret_labels:
        issues.append(f"Client HTML exposes {', '.join(secret_labels[:2])}")
    else:
        bundle_urls: list[str] = []
        for src in SCRIPT_SRC_RE.findall(html):
            if JS_NOISE_RE.search(src):
                continue
            full_js = urllib.parse.urljoin(final_url, src)
            js_host = (urllib.parse.urlparse(full_js).hostname or "").lower().replace("www.", "")
            if js_host == bare_domain and full_js not in bundle_urls:
                bundle_urls.append(full_js)
            if len(bundle_urls) >= 3:
                break
        for js_u in bundle_urls:
            try:
                jst, _, _, jraw = common.http_fetch(js_u, timeout=5, verify_ssl=False)
                bundle_name = urllib.parse.urlparse(js_u).path.rsplit("/", 1)[-1][:48] or "client bundle"
                if jst in (404, 410) or jst >= 500:
                    issues.append(f"First-party JS asset ({bundle_name}) failed to load with HTTP {jst}")
                    break
                if jst == 200 and jraw:
                    found_labels = _scan_text_for_secret_labels(jraw.decode("utf-8", "replace")[:350000])
                    if found_labels:
                        issues.append(f"First-party JS bundle ({bundle_name}) exposes {', '.join(found_labels[:2])}")
                        break
            except Exception:
                continue

    # 3. Exposed .env / .git metadata
    for probe_path, marker in (("/.env", "="), ("/.git/HEAD", "ref: refs/")):
        try:
            pst, _, phdrs, praw = common.http_fetch(origin + probe_path, timeout=4, verify_ssl=False)
            ctype = str((phdrs or {}).get("Content-Type") or (phdrs or {}).get("content-type") or "").lower()
            ptxt = praw.decode("utf-8", "replace")
            if pst == 200 and "html" not in ctype and marker in ptxt[:300]:
                if probe_path == "/.env" and any(k in ptxt.upper() for k in ("KEY=", "SECRET=", "DATABASE_URL=", "TOKEN=")):
                    issues.append("Publicly exposed environment config file returning HTTP 200")
                elif probe_path == "/.git/HEAD":
                    issues.append("Publicly exposed Git HEAD metadata returning HTTP 200")
        except Exception:
            continue

    # 4. Broken Pricing / Stripe Checkout / Booking / Signup / Internal Nav CTAs
    cta_targets: list[tuple[str, str]] = []
    seen_cta: set[str] = set()
    for href, raw_label in HREF_CTA_RE.findall(html):
        if len(cta_targets) >= 8:
            break
        full = urllib.parse.urljoin(final_url, href.strip())
        p = urllib.parse.urlparse(full)
        if p.scheme not in ("http", "https") or p.path.lower().endswith((".png", ".jpg", ".svg", ".webp", ".css", ".js")):
            continue
        target_host = (p.hostname or "").lower().replace("www.", "")
        is_conv_ext = bool(CONVERSION_TARGET_HOST_RE.search(target_host))
        label_clean = re.sub(r"<[^>]+>", " ", raw_label).strip()[:40]
        if target_host != bare_domain and not is_conv_ext:
            continue
        if not is_conv_ext and p.path in ("", "/"):
            continue
        if full not in seen_cta:
            seen_cta.add(full)
            cta_targets.append((full, target_host))

    for cta_url, t_host in cta_targets:
        try:
            cst, _, _, craw = common.http_fetch(cta_url, timeout=6, verify_ssl=False)
            if cst in (404, 410) or cst >= 500:
                path_tag = urllib.parse.urlparse(cta_url).path[:48] or "/"
                issues.append(f"Primary Pricing/Checkout/CTA link ({t_host}{path_tag}) returned HTTP {cst}")
                break
            if CONVERSION_TARGET_HOST_RE.search(t_host):
                body_txt = craw.decode("utf-8", "replace")[:40000]
                m = DEAD_CONVERSION_TEXT_RE.search(body_txt)
                if m:
                    issues.append(f"External checkout/booking link ({t_host}) renders dead error state: \"{m.group(0)}\"")
                    break
        except Exception:
            continue

    # 5. Broken Formspree/Tally/HTTPS->HTTP form action
    for act in FORM_ACTION_RE.findall(html)[:4]:
        act_clean = act.strip()
        if final_url.lower().startswith("https://") and act_clean.lower().startswith("http://"):
            issues.append("HTTPS page submits <form action=\"http://...\"> over insecure HTTP")
            break
        if any(fh in act_clean.lower() for fh in ("formspree.io/f/", "getform.io/f/", "usebasin.com/f/")):
            try:
                fst, _, _, fraw = common.http_fetch(act_clean, timeout=5, verify_ssl=False)
                if fst in (404, 410) or DEAD_CONVERSION_TEXT_RE.search(fraw.decode("utf-8", "replace")[:8000]):
                    issues.append(f"Lead/contact form action endpoint returned dead HTTP {fst or 'not-found'}")
                    break
            except Exception:
                continue

    # 6. Broken AI/Agent JSON endpoint if linked or advertised
    if has_ai_surface:
        for ep in ("/openapi.json", "/.well-known/ai-plugin.json"):
            try:
                est, _, _, eraw = common.http_fetch(origin + ep, timeout=4, verify_ssl=False)
                if est >= 500:
                    issues.append(f"Advertised API/agent endpoint {ep} returned HTTP {est}")
                    break
            except Exception:
                continue

    if not issues:
        return None

    emails = common.extract_deliverable_emails(html, bare_domain)
    if not emails:
        for cp in ("/contact", "/contact-us", "/support", "/about", "/privacy", "/terms"):
            try:
                cst, _, _, craw = common.http_fetch(origin + cp, timeout=5, verify_ssl=False)
                if cst < 400:
                    emails = common.extract_deliverable_emails(craw.decode("utf-8", "replace"), bare_domain)
                    if emails:
                        break
            except Exception:
                continue
    if not emails:
        gh_m = re.search(r"https?://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)", html)
        gh_own = cand.get("github_owner") or (gh_m.group(1) if gh_m else "")
        gh_rep = cand.get("github_repo") or (f"{gh_m.group(1)}/{gh_m.group(2)}" if gh_m else "")
        if gh_own or gh_rep:
            owner_em = play_d._resolve_github_owner_email(gh_own, gh_rep)
            if owner_em:
                emails = [owner_em]
    if not emails or common.is_enterprise_queue_email(emails[0], html):
        return None

    return {
        "name": cand["name"],
        "domain": bare_domain,
        "email": emails[0],
        "source": cand.get("source") or "saas",
        "github_repo": cand.get("github_repo") or "",
        "has_ai_surface": has_ai_surface,
        "issues": issues[:4],
    }


def craft_saas_leak_email(target: dict, base_url: str = DEFAULT_SITE_RESCUE_URL) -> tuple[str, str]:
    dom = target["domain"]
    name = target["name"]
    raw_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode({'domain': dom, 'ref': 'play_f_saas'})}"
    audit_link = common.build_tracked_url("play_f_saas", dom, raw_link)
    bullets = "\n".join(f"- {issue}" for issue in target["issues"][:3])
    subject = f"Quick live check on {dom}: checkout/security issue flagged"[:96]
    repo_note = f" (or open a clean PR directly into {target['github_repo']})" if target.get("github_repo") else ""
    ai_note = (
        "\n(Also, since you ship AI/API tooling: if you ever want automated $0.01/call prompt-injection & schema firewall protection via Stripe MPP, see https://stripe.com/@kurox_x402.)\n"
        if target.get("has_ai_surface")
        else "\n"
    )
    body = (
        f"Hi {name} team,\n\n"
        f"I ran a quick automated production check on {dom} and spotted {len(target['issues'])} live issue(s) affecting signups or security:\n"
        f"{bullets}\n\n"
        f"If helpful, reply \"fix\" or \"PR\" and I'll send the exact failing URL/script line and handle an end-to-end verified fix{repo_note} today ($29-$99 via Stripe), "
        f"or grab the self-serve diagnostic pack ($10) at:\n{audit_link}\n"
        f"{ai_note}\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def craft_followup_email(entry: dict, base_url: str = DEFAULT_SITE_RESCUE_URL) -> tuple[str, str]:
    dom = entry.get("domain") or "your site"
    raw_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode({'domain': dom, 'ref': 'play_f_followup'})}"
    audit_link = common.build_tracked_url("play_f_saas", dom, raw_link)
    subj = f"Re: Quick live check on {dom}: checkout/security issue flagged"[:96]
    body = (
        f"Hi again,\n\n"
        f"Quick bump in case that live checkout/CTA/bundle check on {dom} got buried.\n\n"
        f"Reply \"fix\" if you'd like the exact line/URL proof and same-day patch ($29-$99), or view sample diagnostics ($10) at:\n{audit_link}\n\n"
        f"Best,\nArman\n---\nReply 'unsubscribe' to stop.\n"
    )
    return subj, body


def main():
    parser = argparse.ArgumentParser(description="Play F: SaaS/AI/Agency Bundle Secret, Checkout & Endpoint Leak Sniper")
    parser.add_argument("--limit", type=int, default=140, help="Max candidates to inspect per run")
    parser.add_argument("--max-emails", type=int, default=20, help="Daily send cap (default: 20/day)")
    parser.add_argument("--max-followups", type=int, default=8, help="Max Day+2 follow-ups per run")
    parser.add_argument("--hard-stop", type=int, default=200, help="Stop-loss delivered cap (default: 200)")
    parser.add_argument("--send", action="store_true", help="Send verified alerts via SMTP")
    parser.add_argument("--override", action="store_true", help="Override pause/stop-loss gates intentionally")
    args = parser.parse_args()

    state = common.load_json_state(
        STATE_FILE,
        {"cc_page": 2, "contacted_domains": [], "contacted_emails": [], "bounced_emails": [], "replied_emails": [], "paid_sales": 0, "history": []},
    )
    if args.send and common.sync_imap_bounces_and_replies(state):
        common.save_json_state(STATE_FILE, state)

    allowed, gate_reason, stats = common.evaluate_play_gate(
        state,
        daily_cap=args.max_emails,
        hard_stop_total=args.hard_stop,
        override=args.override,
    )
    if args.send:
        common.push_dashboard_ingest("play_f_saas", stats, source="play_f_cron")
        kv_paused, kv_reason = common.check_dashboard_play_status("play_f_saas")
        if kv_paused and not args.override:
            print(f"[!] Play F Dashboard Safety Gate: {kv_reason} (bounce={stats['bounce_rate_pct']}%)")
            return
    sent_today = stats["sent_today"]
    known_domains, known_emails = common.load_known_exclusions(EXISTING_STATE_FILES, state)
    bounced_set = stats["bounced_set"]

    if args.send and not allowed:
        print(f"[!] Play F Stop-Loss / Safety Gate: {gate_reason}")
        return

    cands, next_cc_page = gather_saas_agent_candidates(state, limit_total=args.limit)
    state["cc_page"] = next_cc_page
    common.save_json_state(STATE_FILE, state)

    to_probe = [c for c in cands if c["domain"] not in known_domains]
    hits: list[dict] = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(diagnose_saas_agent_site, c) for c in to_probe]
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

    for target in hits:
        subj, body = craft_saas_leak_email(target)
        print(f"[+] FOUND PLAY F LEAK: {target['domain']} ({target['source']}) -> {target['email']} | issues={len(target['issues'])}")
        if args.send:
            if sent_today >= args.max_emails:
                break
            try:
                common.send_smtp_email(target["email"], subj, body, sender_name="Arman (Kurox Technical Audit)")
                known_domains.add(target["domain"])
                known_emails.add(target["email"])
                state["contacted_domains"].append(target["domain"])
                state["contacted_emails"].append(target["email"])
                state["history"].append({"domain": target["domain"], "email": target["email"], "sent_date": datetime.now(timezone.utc).isoformat()})
                sent_today += 1
                common.save_json_state(STATE_FILE, state)
                print(f"    -> Sent Play F alert to {target['email']}")
                time.sleep(5)
            except Exception as exc:
                print(f"    [-] SMTP failed: {exc}")

    if args.send:
        sent_today += common.send_due_followups(
            state,
            lambda e: craft_followup_email(e),
            sender_name="Arman (Kurox Technical Audit)",
            daily_cap=args.max_emails,
            max_per_run=args.max_followups,
            save_path=STATE_FILE,
        )
        _, _, post_stats = common.evaluate_play_gate(state, daily_cap=args.max_emails, hard_stop_total=args.hard_stop, override=True)
        common.push_dashboard_ingest("play_f_saas", post_stats, source="play_f_cron_post")

    print(f"[=] Play F Summary: candidates={len(cands)} probed={len(to_probe)} verified_leaks={len(hits)} sent_today={sent_today}")


if __name__ == "__main__":
    main()
