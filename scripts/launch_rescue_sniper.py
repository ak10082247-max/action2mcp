#!/usr/bin/env python3
"""
Play D Cron Sniper: Fresh Indie Launch & Vibe-Code App Bug/Security Rescue
Discovers recently launched web apps from Hacker News Show HN + clean GitHub launch repos
with public homepage URLs, scans for broken pricing/signup CTAs, exposed .env/.git/client keys,
wildcard CORS+Credentials leaks, mixed-content forms, and missing viewport/og:image preview tags,
then alerts verified founders linking to SiteRescue ($10 Deal, $29 Priority, $99 Done-For-You PR).
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

import outreach_common as common

common.load_workspace_env(REPO_ROOT)

STATE_FILE = os.path.join(REPO_ROOT, "data", "launch_rescue_state.json")
DEFAULT_SITE_RESCUE_URL = os.environ.get("SITE_RESCUE_BASE_URL") or "https://site-rescue.ak10082247.workers.dev"

SPAM_REPO_KEYWORDS = (
    "portable-x64", "keygen", "crack", "activator", "hack-tool", "mod-menu",
    "pump-fun", "volume-booster", "wallet-drainer", "stealer", "aimbot",
)
SKIP_APP_HOSTS = {
    "github.com", "gitlab.com", "bitbucket.org", "youtube.com", "youtu.be",
    "x.com", "twitter.com", "medium.com", "substack.com", "npmjs.com",
    "pypi.org", "huggingface.co", "arxiv.org", "docs.google.com", "reddit.com",
    "marketplace.visualstudio.com", "chromewebstore.google.com", "addons.mozilla.org",
    "play.google.com", "apps.apple.com", "store.steampowered.com", "gumroad.com",
}
CTA_LINK_RE = re.compile(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
CTA_KW = re.compile(r"(pric|signup|sign-up|register|waitlist|demo|docs|checkout|buy|start|get-started|contact|login|app)", re.IGNORECASE)
INLINE_SECRET_RE = re.compile(
    r"\b(?:sk_live_[0-9A-Za-z]{16,}|ghp_[0-9A-Za-z]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*[\"'][^\"']{16,})\b"
)


def is_clean_launch_candidate(repo_or_name: str, homepage_url: str) -> bool:
    low_name = (repo_or_name or "").lower()
    if any(bad in low_name for bad in SPAM_REPO_KEYWORDS):
        return False
    if not (homepage_url or "").startswith(("http://", "https://")):
        return False
    host = (urllib.parse.urlparse(homepage_url).hostname or "").lower().replace("www.", "")
    if not host or "." not in host:
        return False
    if any(host == b or host.endswith("." + b) for b in SKIP_APP_HOSTS):
        return False
    return True


def fetch_launch_candidates(limit_total: int = 160) -> list[dict]:
    candidates: list[dict] = []
    seen_domains: set[str] = set()

    # 1. Hacker News Show HN recent launches (up to 120 items)
    try:
        hn = common.http_get_json(
            "https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=120",
            timeout=12,
        )
        for hit in hn.get("hits") or []:
            u = (hit.get("url") or "").strip()
            title = (hit.get("title") or "").strip()
            if not is_clean_launch_candidate(title, u):
                continue
            host = (urllib.parse.urlparse(u).hostname or "").lower().replace("www.", "")
            if host in seen_domains:
                continue
            seen_domains.add(host)
            candidates.append({
                "name": re.sub(r"^Show HN:\s*", "", title, flags=re.I)[:80] or host,
                "url": u,
                "domain": host,
                "source": "show_hn",
                "github_owner": "",
                "github_repo": "",
            })
            if len(candidates) >= limit_total // 2:
                break
    except Exception:
        pass

    # 2. Clean GitHub web/SaaS repositories launched in last 21 days with a live homepage
    since = (datetime.now(timezone.utc) - timedelta(days=21)).strftime("%Y-%m-%d")
    gh_hdrs = {"Accept": "application/vnd.github+json"}
    gh_tok = (os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN") or "").strip()
    if gh_tok:
        gh_hdrs["Authorization"] = f"Bearer {gh_tok}"
    for topic in ("saas", "nextjs", "react", "ai", "webapp", "typescript", "developer-tools"):
        if len(candidates) >= limit_total:
            break
        q = urllib.parse.quote(f"created:>{since} stars:>1 fork:false topic:{topic}")
        try:
            res = common.http_get_json(
                f"https://api.github.com/search/repositories?q={q}&sort=updated&order=desc&per_page=50",
                headers=gh_hdrs,
                timeout=12,
            )
            for repo in res.get("items") or []:
                if len(candidates) >= limit_total:
                    break
                full_name = repo.get("full_name") or ""
                hp = (repo.get("homepage") or "").strip()
                if not is_clean_launch_candidate(full_name + " " + (repo.get("description") or ""), hp):
                    continue
                host = (urllib.parse.urlparse(hp).hostname or "").lower().replace("www.", "")
                if host in seen_domains:
                    continue
                seen_domains.add(host)
                owner = (repo.get("owner") or {}).get("login") or ""
                candidates.append({
                    "name": (repo.get("name") or host)[:80],
                    "url": hp,
                    "domain": host,
                    "source": "github_launch",
                    "github_owner": owner,
                    "github_repo": full_name,
                })
        except Exception:
            continue

    return candidates[:limit_total]


def _resolve_github_owner_email(owner: str, repo_full_name: str = "") -> str | None:
    hdrs = {"Accept": "application/vnd.github+json"}
    gh_tok = (os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN") or "").strip()
    if gh_tok:
        hdrs["Authorization"] = f"Bearer {gh_tok}"
    if owner:
        try:
            u = common.http_get_json(f"https://api.github.com/users/{urllib.parse.quote(owner)}", headers=gh_hdrs if False else hdrs, timeout=6)
            em = (u.get("email") or "").strip().lower()
            if em and common.is_deliverable_email(em):
                return em
        except Exception:
            pass
    if repo_full_name:
        try:
            commits = common.http_get_json(f"https://api.github.com/repos/{repo_full_name}/commits?per_page=5", headers=hdrs, timeout=6)
            if isinstance(commits, list):
                for cm in commits:
                    em = (((cm.get("commit") or {}).get("author") or {}).get("email") or "").strip().lower()
                    if em and common.is_deliverable_email(em):
                        return em
        except Exception:
            pass
    return None


def diagnose_launch_site(cand: dict) -> dict | None:
    url = cand["url"]
    try:
        st, final_url, hdrs, raw_home = common.http_fetch(url, timeout=9, verify_ssl=False)
    except Exception:
        return None
    if st == 0 or st >= 400:
        return None
    html = raw_home.decode("utf-8", "replace")
    if len(html) < 100:
        return None

    parsed = urllib.parse.urlparse(final_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    bare_domain = (parsed.hostname or cand["domain"]).lower().replace("www.", "")
    hdrs_low = {str(k).lower(): str(v) for k, v in (hdrs or {}).items()}

    issues = []
    # 1. Dangerous wildcard CORS + credentials
    if hdrs_low.get("access-control-allow-origin") == "*" and hdrs_low.get("access-control-allow-credentials", "").lower() == "true":
        issues.append("CORS misconfiguration: Access-Control-Allow-Origin: * paired with Allow-Credentials: true")

    # 2. Inline or same-origin JS leaked secret patterns & localhost links (counts only, never leaks values)
    secret_hits = INLINE_SECRET_RE.findall(html)
    if secret_hits:
        issues.append(f"{len(secret_hits)} hardcoded live API/service credential token(s) detected in client HTML/JS")
    if re.search(r'(?:href|action)=["\']https?://(?:localhost|127\.0\.0\.1)[:/"\']', html, re.I):
        issues.append("Production page contains hardcoded localhost/127.0.0.1 CTA or form action link")

    # 3. Exposed .env or .git/HEAD
    for probe_path, marker in (("/.env", "="), ("/.git/HEAD", "ref: refs/")):
        try:
            pst, _, phdrs, praw = common.http_fetch(origin + probe_path, timeout=4, verify_ssl=False)
            ctype = str((phdrs or {}).get("Content-Type") or (phdrs or {}).get("content-type") or "").lower()
            ptxt = praw.decode("utf-8", "replace")
            if pst == 200 and "html" not in ctype and marker in ptxt[:300]:
                if probe_path == "/.env" and any(k in ptxt.upper() for k in ("KEY=", "SECRET=", "DATABASE_URL=", "TOKEN=")):
                    issues.append("Publicly exposed environment config file returning HTTP 200")
                elif probe_path == "/.git/HEAD":
                    issues.append("Publicly exposed Git repository HEAD metadata returning HTTP 200")
        except Exception:
            continue

    # 4. Broken Pricing / Signup / Waitlist / Docs CTA links
    broken_ctas = []
    seen_cta = set()
    for href, label in CTA_LINK_RE.findall(html):
        if len(seen_cta) >= 5:
            break
        if not CTA_KW.search(href) and not CTA_KW.search(label):
            continue
        full = urllib.parse.urljoin(final_url, href)
        p = urllib.parse.urlparse(full)
        if p.scheme not in ("http", "https") or (p.hostname or "").lower().replace("www.", "") != bare_domain:
            continue
        if full in seen_cta:
            continue
        seen_cta.add(full)
        try:
            lst, _, _, _ = common.http_fetch(full, timeout=5, verify_ssl=False)
            if lst in (404, 410) or lst >= 500:
                broken_ctas.append(lst)
        except Exception:
            continue
    if broken_ctas:
        issues.append(f"{len(broken_ctas)} primary Signup/Pricing/Docs CTA link(s) returning HTTP {broken_ctas[0]}")

    # 5. Missing viewport / og:image / insecure mixed-content form
    missing_viewport = bool(re.search(r"<head[\s>]", html, re.I)) and not bool(
        re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I)
    )
    missing_og = bool(re.search(r"<head[\s>]", html, re.I)) and not bool(
        re.search(r'<meta[^>]+(?:property|name)=["\']og:image["\']', html, re.I)
    )
    mixed_forms = []
    if final_url.lower().startswith("https://"):
        mixed_forms = re.findall(r'<(?:form|script)\b[^>]*(?:action|src)=["\'](http://[^"\']+)["\']', html, re.I)

    if mixed_forms:
        issues.append(f"{len(mixed_forms)} insecure http:// form/script resource(s) blocked on HTTPS launch")
    if missing_viewport:
        issues.append('Missing mobile <meta name="viewport"> tag (breaks mobile launch layout)')
    if missing_og and len(issues) >= 1:
        issues.append('Missing social <meta property="og:image"> card (blank previews on X/HN shares)')

    # Require at least 1 critical bug/security issue OR both viewport + og:image missing together
    if not issues and not (missing_viewport and missing_og):
        return None
    if not issues:
        issues.append('Missing both mobile <meta name="viewport"> and social og:image preview card')

    emails = common.extract_deliverable_emails(html, bare_domain)
    if not emails:
        for cp in ("/contact", "/about", "/privacy"):
            try:
                cst, _, _, craw = common.http_fetch(origin + cp, timeout=5, verify_ssl=False)
                if cst < 400:
                    emails = common.extract_deliverable_emails(craw.decode("utf-8", "replace"), bare_domain)
                    if emails:
                        break
            except Exception:
                continue
    if not emails and (cand.get("github_owner") or cand.get("github_repo")):
        owner_em = _resolve_github_owner_email(cand.get("github_owner", ""), cand.get("github_repo", ""))
        if owner_em:
            emails = [owner_em]
    if not emails or common.is_enterprise_queue_email(emails[0], html):
        return None

    return {
        "name": cand["name"],
        "domain": bare_domain,
        "email": emails[0],
        "source": cand.get("source") or "launch",
        "github_repo": cand.get("github_repo") or "",
        "issues": issues[:4],
    }


def craft_launch_rescue_email(target: dict, base_url: str = DEFAULT_SITE_RESCUE_URL) -> tuple[str, str]:
    dom = target["domain"]
    name = target["name"]
    raw_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode({'domain': dom, 'ref': 'launch'})}"
    audit_link = common.build_tracked_url("play_d_launch", dom, raw_link)
    bullets = "\n".join(f"- {issue}" for issue in target["issues"][:3])
    subject = f"Quick launch bug/security heads-up on {dom}"[:96]
    repo_note = f" (or PR directly into {target['github_repo']})" if target.get("github_repo") else ""
    body = (
        f"Hi {name} founder,\n\n"
        f"Congrats on shipping {dom} — I ran an automated pre-traffic check on your launch page and caught {len(target['issues'])} live issue(s):\n"
        f"{bullets}\n\n"
        f"Broken signup CTAs, missing social preview cards, or exposed config files kill day-one launch conversion fast.\n\n"
        f"Two fast ways to get the exact affected path(s) + patch:\n"
        f"1) Reply \"fix\" or \"PR\" and I'll send the exact failing file/URL(s) + handle a complete async fix{repo_note} via a $49-$99 Stripe link.\n"
        f"2) Or inspect live & download the Launch Recovery Pack ZIP ($10 Launch Deal, was $49) at:\n"
        f"{audit_link}\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def craft_followup_email(entry: dict, base_url: str = DEFAULT_SITE_RESCUE_URL) -> tuple[str, str]:
    dom = entry.get("domain") or "your launch app"
    raw_link = f"{base_url.rstrip('/')}/?{urllib.parse.urlencode({'domain': dom, 'ref': 'launch_followup'})}"
    tracked = common.build_tracked_url("play_d_launch", dom, raw_link)
    subj = f"Re: Quick launch bug/security check on {dom}"[:96]
    body = (
        f"Hi again,\n\n"
        f"Following up on the live bug/security checks flagged on {dom}.\n\n"
        f"Reply \"fix\" if you want the exact affected URLs/snippets or an async PR patch, or view live diagnostics ($10 Launch Deal) at:\n{tracked}\n\n"
        f"Best,\nArman\n---\nReply 'unsubscribe' to stop.\n"
    )
    return subj, body


def main():
    parser = argparse.ArgumentParser(description="Play D: Fresh Indie Launch & Show HN Bug/Security Sniper")
    parser.add_argument("--limit", type=int, default=80, help="Max launch candidates to probe per run")
    parser.add_argument("--max-emails", type=int, default=20, help="Daily send cap (default: 20/day)")
    parser.add_argument("--hard-stop", type=int, default=200, help="Stop-loss delivered cap (default: 200)")
    parser.add_argument("--send", action="store_true", help="Send launch alerts via SMTP")
    parser.add_argument("--override", action="store_true", help="Override pause/stop-loss gates intentionally")
    args = parser.parse_args()

    state = common.load_json_state(
        STATE_FILE,
        {"contacted_domains": [], "contacted_emails": [], "bounced_emails": [], "replied_emails": [], "paid_sales": 0, "history": []},
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
        common.push_dashboard_ingest("play_d_launch", stats, source="play_d_cron")
        kv_paused, kv_reason = common.check_dashboard_play_status("play_d_launch")
        if kv_paused and not args.override:
            print(f"[!] Play D Dashboard Safety Gate: {kv_reason} (bounce={stats['bounce_rate_pct']}%)")
            return
    sent_today = stats["sent_today"]
    known_domains = set(state.get("contacted_domains") or [])
    known_emails = {e.lower().strip() for e in (state.get("contacted_emails") or [])}
    bounced_set = stats["bounced_set"]

    if args.send and not allowed:
        print(f"[!] Play D Stop-Loss / Safety Gate: {gate_reason}")
        return

    cands = [c for c in fetch_launch_candidates(args.limit) if c["domain"] not in known_domains]
    hits = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(diagnose_launch_site, c) for c in cands]
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
        subj, body = craft_launch_rescue_email(target)
        print(f"[+] FOUND PLAY D LAUNCH LEAK: {target['domain']} ({target['source']}) -> {target['email']} | issues={len(target['issues'])}")
        if args.send:
            if sent_today >= args.max_emails:
                break
            try:
                common.send_smtp_email(target["email"], subj, body, sender_name="Arman (LaunchRescue Audit)")
                known_domains.add(target["domain"])
                known_emails.add(target["email"])
                state["contacted_domains"].append(target["domain"])
                state["contacted_emails"].append(target["email"])
                state["history"].append({"domain": target["domain"], "email": target["email"], "sent_date": datetime.now(timezone.utc).isoformat()})
                sent_today += 1
                common.save_json_state(STATE_FILE, state)
                print(f"    -> Sent launch rescue note to {target['email']}")
                time.sleep(5)
            except Exception as exc:
                print(f"    [-] SMTP failed: {exc}")

    if args.send:
        sent_today += common.send_due_followups(
            state,
            lambda e: craft_followup_email(e),
            sender_name="Arman (LaunchRescue Audit)",
            daily_cap=args.max_emails,
            max_per_run=4,
            save_path=STATE_FILE,
        )
        _, _, post_stats = common.evaluate_play_gate(state, daily_cap=args.max_emails, hard_stop_total=args.hard_stop, override=True)
        common.push_dashboard_ingest("play_d_launch", post_stats, source="play_d_cron_post")

    print(f"[=] Play D Summary: candidates={len(cands)} verified_leaks={len(hits)} sent_today={sent_today}")


if __name__ == "__main__":
    main()
