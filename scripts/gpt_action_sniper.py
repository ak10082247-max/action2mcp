#!/usr/bin/env python3
"""
Action2MCP Custom GPT Action Sniper Finder
Discovers public GitHub repositories containing OpenAI Custom GPT Actions
("x-openai-isConsequential" or "chatgpt.com/g/g-" + "openapi"), compiles
their live OpenAPI schemas via POST /api/preview, extracts verified repo
owner contact emails, and drafts/sends proof-first migration alerts (max 20/day).
"""
import argparse
from datetime import datetime, timezone
import json
import os
import re
import smtplib
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)
import outreach_common as common

REPO_ROOT = os.path.dirname(SCRIPTS_DIR)
DATA_DIR = os.path.join(REPO_ROOT, "data")
CONTACTED_FILE = os.path.join(DATA_DIR, "contacted_gpts.json")
ACTION2MCP_CUTOFF_DATE = "2026-12-12"

DEFAULT_API_BASE = os.environ.get("ACTION2MCP_BASE_URL") or "https://action2mcp.ak10082247.workers.dev"
UA = "Action2MCP-GPTSniper/1.0 (+https://github.com/ak10082247-max/action2mcp)"

EXCLUDED_REPOS = {
    "chatgptnextweb/nextchat-awesome-plugins",
    "ainativelab/gptstore-data-backup",
    "louisshark/chatgpt_system_prompt",
    "0xeb/thebigpromptlibrary",
    "microsoft/kiota",
    "ak10082247-max/action2mcp",
}
BLOCKED_DOMAINS = {
    "users.noreply.github.com",
    "noreply.github.com",
    "github.com",
    "example.com",
    "example.org",
    "localhost",
}
BLOCKED_PREFIXES = {
    "noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster",
    "hostmaster", "webmaster", "bounce", "dependabot", "actions",
}

try:
    SSL_CTX = ssl._create_unverified_context()
except Exception:
    SSL_CTX = None

_MX_CACHE = {}


def load_workspace_env():
    for candidate in (
        os.path.join(REPO_ROOT, ".env"),
        os.path.join(os.path.dirname(REPO_ROOT), ".env.empire"),
        os.path.join(os.path.dirname(REPO_ROOT), ".env"),
    ):
        if not os.path.exists(candidate):
            continue
        try:
            with open(candidate, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass


load_workspace_env()


def resolve_gh_token() -> str:
    token = (os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PAT") or "").strip()
    if token:
        return token
    try:
        out = subprocess.check_output(["gh", "auth", "token"], text=True, stderr=subprocess.DEVNULL).strip()
        if out.startswith(("gh", "github_pat_")):
            return out
    except Exception:
        pass
    return ""


def _http_get_text(url: str, headers: dict | None = None, timeout: int = 12) -> str:
    hdrs = {"User-Agent": UA}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    kwargs = {"timeout": timeout}
    if SSL_CTX is not None:
        kwargs["context"] = SSL_CTX
    with urllib.request.urlopen(req, **kwargs) as resp:
        return resp.read().decode("utf-8", "replace")


def _http_get_json(url: str, headers: dict | None = None, timeout: int = 12) -> dict | list:
    h = {"Accept": "application/json"}
    if headers:
        h.update(headers)
    return json.loads(_http_get_text(url, headers=h, timeout=timeout))


def _http_post_json(url: str, payload: dict, timeout: int = 15) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"User-Agent": UA, "Content-Type": "application/json", "Accept": "application/json"},
    )
    kwargs = {"timeout": timeout}
    if SSL_CTX is not None:
        kwargs["context"] = SSL_CTX
    with urllib.request.urlopen(req, **kwargs) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def has_valid_mx(domain: str) -> bool:
    d = domain.lower().strip().rstrip(".")
    if d in _MX_CACHE:
        return _MX_CACHE[d]
    ok = False
    for doh in (
        f"https://cloudflare-dns.com/dns-query?name={urllib.parse.quote(d)}&type=MX",
        f"https://dns.google/resolve?name={urllib.parse.quote(d)}&type=MX",
    ):
        try:
            res = _http_get_json(doh, headers={"Accept": "application/dns-json"}, timeout=5)
            answers = res.get("Answer") or []
            if any(a.get("type") == 15 and not str(a.get("data", "")).strip().endswith(" .") for a in answers):
                ok = True
                break
        except Exception:
            continue
    _MX_CACHE[d] = ok
    return ok


def is_deliverable_email(email: str, bounced_set: set[str] | None = None) -> bool:
    ok, domain = common.is_clean_email_syntax(email, bounced_set=bounced_set)
    if not ok:
        return False
    return has_valid_mx(domain)


def load_state() -> dict:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CONTACTED_FILE):
        return {"contacted_repos": [], "contacted_emails": [], "history": []}
    try:
        with open(CONTACTED_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"contacted_repos": [], "contacted_emails": [], "history": []}


def save_state(state: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(CONTACTED_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def count_sent_today(history: list[dict]) -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return sum(1 for h in (history or []) if str(h.get("sent_date") or "").startswith(today))


def fetch_raw_schema_for_code_item(item: dict, gh_headers: dict) -> str:
    """Resolve raw OpenAPI JSON/YAML bytes via GitHub contents API or html_url."""
    api_url = item.get("url") or ""
    if api_url:
        try:
            meta = _http_get_json(api_url, headers=gh_headers, timeout=10)
            dl_url = meta.get("download_url")
            if dl_url:
                return _http_get_text(dl_url, timeout=12)
        except Exception:
            pass
    html_url = item.get("html_url") or ""
    if "/blob/" in html_url:
        raw_url = html_url.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/blob/", "/", 1)
        return _http_get_text(raw_url, timeout=12)
    return ""


def compile_via_action2mcp(schema_text: str, api_base: str) -> dict:
    return _http_post_json(
        f"{api_base.rstrip('/')}/api/preview",
        {"schema": schema_text},
        timeout=15,
    )


def resolve_repo_owner_email(repo_full: str, gh_headers: dict) -> tuple[str | None, str]:
    """Extract non-noreply public email from repo owner profile or recent commits."""
    owner = repo_full.split("/", 1)[0]
    display_name = owner
    try:
        u = _http_get_json(f"https://api.github.com/users/{urllib.parse.quote(owner)}", headers=gh_headers, timeout=6)
        display_name = (u.get("name") or owner).strip()
        if u.get("email") and is_deliverable_email(u["email"]):
            return u["email"].lower().strip(), display_name
    except Exception:
        pass

    try:
        commits = _http_get_json(f"https://api.github.com/repos/{repo_full}/commits?per_page=8", headers=gh_headers, timeout=6)
        if isinstance(commits, list):
            for c in commits:
                author = (c.get("commit") or {}).get("author") or {}
                cand = (author.get("email") or "").lower().strip()
                if cand and is_deliverable_email(cand):
                    return cand, (author.get("name") or display_name).strip()
    except Exception:
        pass
    return None, display_name


def discover_and_compile_gpt_actions(
    limit: int = 5,
    api_base: str = DEFAULT_API_BASE,
    gh_token: str = "",
    exclude_repos: set[str] | None = None,
    require_email: bool = False,
    no_email_out: set[str] | None = None,
    exclude_emails: set[str] | None = None,
) -> list[dict]:
    """Search GitHub for Custom GPT OpenAPI specs, download raw schemas, and compile via Action2MCP."""
    tok = gh_token or resolve_gh_token()
    if not tok:
        print("   [!] WARNING: No GH_PAT / GITHUB_TOKEN found; GitHub Code Search requires authentication.", flush=True)
    gh_hdrs = {"Accept": "application/vnd.github.v3+json"}
    if tok:
        gh_hdrs["Authorization"] = f"Bearer {tok}"

    excl = {r.lower() for r in (exclude_repos or set())} | EXCLUDED_REPOS
    excl_emails = {e.lower().strip() for e in (exclude_emails or set())}
    queries = [
        '"x-openai-isConsequential" "paths" extension:yaml',
        '"x-openai-isConsequential" "paths" extension:yml',
        '"x-openai-isConsequential" "paths" extension:json',
        '"chatgpt.com/g/g-" "openapi" "paths"',
        '"chat.openai.com/g/g-" "openapi" "paths"',
        '"openapi: 3.1" "servers" "chatgpt" extension:yaml',
        '"openapi: 3.0" "gpt" "action" "paths" extension:yaml',
        '"custom-gpt" "openapi" "paths" extension:json',
        '"gpt" "x-openai-isConsequential" extension:yaml',
        '"openai" "actions" "openapi" "3.1.0" extension:json',
    ]

    candidates = []
    seen_repos = set()
    search_ok = 0
    search_errors = []

    for q in queries:
        if len(candidates) >= max(limit * 10, 120):
            break
        for page in (1, 2, 3, 4, 5, 6, 7, 8):
            if len(candidates) >= max(limit * 10, 120):
                break
            try:
                url = f"https://api.github.com/search/code?q={urllib.parse.quote(q)}&per_page=100&page={page}"
                res = _http_get_json(url, headers=gh_hdrs, timeout=12)
                search_ok += 1
                items = res.get("items") or []
                for item in items:
                    repo_full = ((item.get("repository") or {}).get("full_name") or "").strip()
                    rf_low = repo_full.lower()
                    if not repo_full or rf_low in excl or rf_low in seen_repos:
                        continue
                    if any(tok_bad in rf_low for tok_bad in ("awesome-plugins", "prompt", "backup", "kiota")):
                        continue
                    path_low = (item.get("path") or "").lower()
                    if not path_low.endswith((".json", ".yaml", ".yml")):
                        continue
                    seen_repos.add(rf_low)
                    candidates.append(item)
                if len(items) < 100:
                    break
            except Exception as exc:
                search_errors.append(f"{q[:38]} (p{page}): {exc}")
                print(f"   [!] GitHub search error ({q[:38]} p{page}): {exc}", flush=True)
                break

    if search_ok == 0 and search_errors:
        raise RuntimeError(f"All GitHub Code Search queries failed (first: {search_errors[0]})")

    compiled_targets = []
    for item in candidates:
        if len(compiled_targets) >= limit:
            break
        repo_full = (item.get("repository") or {}).get("full_name") or ""
        try:
            schema_text = fetch_raw_schema_for_code_item(item, gh_hdrs)
            if not schema_text or ("paths" not in schema_text):
                continue
            preview = compile_via_action2mcp(schema_text, api_base)
            if not preview.get("ok") or int(preview.get("tool_count") or 0) < 1:
                continue
            email, owner_name = resolve_repo_owner_email(repo_full, gh_hdrs)
            if not email:
                if no_email_out is not None:
                    no_email_out.add(repo_full)
                if require_email:
                    continue
            elif email.lower().strip() in excl_emails:
                continue
            else:
                excl_emails.add(email.lower().strip())
            compiled_targets.append({
                "repo": repo_full,
                "repo_url": f"https://github.com/{repo_full}",
                "file_path": item.get("path") or "",
                "file_html_url": item.get("html_url") or "",
                "title": preview.get("title") or repo_full,
                "openapi_version": preview.get("openapi_version"),
                "base_url": preview.get("base_url"),
                "tool_count": int(preview.get("tool_count") or 0),
                "consequential_count": int(preview.get("consequential_count") or 0),
                "tool_names": [t["name"] for t in (preview.get("tools") or [])],
                "warnings": preview.get("warnings") or [],
                "owner_name": owner_name,
                "owner_email": email,
            })
        except Exception:
            continue
    return compiled_targets


def craft_sniper_email(target: dict, public_service_url: str = "https://action2mcp.ak10082247.workers.dev") -> tuple[str, str]:
    repo_short = target["repo"].split("/", 1)[-1]
    count = target["tool_count"]
    subject = f"Your Custom GPT Action in {repo_short} breaks Dec 11 — converted {count} tools to MCP"[:96]
    tools_preview = "\n".join(f"  - {name}" for name in target["tool_names"][:10])
    if len(target["tool_names"]) > 10:
        tools_preview += f"\n  - ... (+{len(target['tool_names']) - 10} more)"

    raw_url = target["file_html_url"].replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/blob/", "/", 1)
    spec_q = urllib.parse.quote(raw_url, safe="")
    raw_preview_url = f"{public_service_url}/?spec_url={spec_q}"
    tracked_preview_url = common.build_tracked_url("action2mcp", target["repo"], raw_preview_url)
    raw_checkout_url = f"{public_service_url}/api/checkout?tier=hosted&spec_url={spec_q}"
    tracked_checkout_url = common.build_tracked_url("action2mcp", target["repo"], raw_checkout_url)
    tracked_fiverr_url = common.build_fiverr_tracked_url("action2mcp", target["repo"], "action2mcp")

    body = (
        f"Hi {target.get('owner_name') or 'there'},\n\n"
        f"OpenAI retires Custom GPTs on December 11, 2026 and its Plugin migration drops Custom Actions.\n\n"
        f"I spotted your OpenAPI Action schema in {target['repo']} ({target['file_path']}) and test-compiled all {count} endpoints cleanly into ChatGPT Plugin MCP tools:\n"
        f"{tools_preview}\n\n"
        f"You can inspect the compiled MCP tools/list + SKILL.md and download the full Cloudflare Worker + SKILL.md ZIP 100% free (no account, checkout, or email wall) at:\n"
        f"{tracked_preview_url}\n\n"
        f"Two fast done-for-you options if you want hands-free migration:\n"
        f"- Instant Hosted MCP URL shortcut: $10 launch deal (normally $25 one-time) at {tracked_checkout_url} (or reply \"hosted\" for a direct checkout.stripe.com link).\n"
        f"- Standard buyer escrow via my UK Fiverr gig (full Action Audit/POC & MCP build from $40): {tracked_fiverr_url}\n\n"
        f"Best,\nArman\n"
        f"---\nReply 'unsubscribe' to opt out.\n"
    )
    return subject, body


def send_smtp_email(to_addr: str, subject: str, body: str) -> None:
    smtp_user = (os.environ.get("SMTP_USER") or os.environ.get("GMAIL_USER") or "").strip()
    smtp_pass = (os.environ.get("SMTP_PASS") or os.environ.get("GMAIL_APP_PASSWORD") or "").strip()
    if not smtp_user or not smtp_pass:
        raise RuntimeError("SMTP_USER / SMTP_PASS not configured in environment.")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Arman (Action2MCP) <{smtp_user}>"
    msg["To"] = to_addr
    msg["Reply-To"] = smtp_user
    msg.attach(MIMEText(body, "plain", "utf-8"))
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [to_addr], msg.as_string())


def main():
    parser = argparse.ArgumentParser(description="Action2MCP Custom GPT Action Sniper Finder")
    parser.add_argument("--limit", type=int, default=20, help="Number of compiled repos to find/display (default: 20)")
    parser.add_argument("--max-emails", type=int, default=20, help="Daily outreach cap (default: 20/day)")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Action2MCP URL for live /api/preview compilation")
    parser.add_argument("--send", action="store_true", help="Actually send plain-text proof emails via SMTP")
    parser.add_argument("--override", action="store_true", help="Override pause/cutoff/bounce gates intentionally")
    parser.add_argument("--canary-to", default=os.environ.get("CANARY_INBOXES", ""), help="Comma-separated test Gmail/Outlook addresses (not counted toward tally)")
    args = parser.parse_args()

    state = load_state()
    if args.canary_to:
        subj, body = craft_sniper_email({
            "repo": "example-org/sample-gpt-action",
            "file_path": "openapi.yaml",
            "file_html_url": "https://github.com/example-org/sample-gpt-action/blob/main/openapi.yaml",
            "tool_count": 3,
            "tool_names": ["get_items", "create_order", "check_status"],
            "owner_name": "Creator",
        })
        cnt = common.send_canary_copies(args.canary_to, subj, body, sender_name="Arman (Action2MCP)")
        print(f"[+] Sent {cnt} uncounted Action2MCP canary spam-check email(s).")
        if not args.send:
            return

    if args.send and common.sync_imap_bounces_and_replies(state):
        save_state(state)

    allowed, gate_reason, stats = common.evaluate_play_gate(
        state,
        daily_cap=args.max_emails,
        hard_stop_total=None,
        cutoff_date=ACTION2MCP_CUTOFF_DATE,
        override=args.override,
    )
    if args.send:
        common.push_dashboard_ingest("action2mcp", stats, source="action2mcp_cron")
        kv_paused, kv_reason = common.check_dashboard_play_status("action2mcp")
        if kv_paused and not args.override:
            print(f"[!] Action2MCP Dashboard Safety Gate: {kv_reason} (bounce={stats['bounce_rate_pct']}%)")
            return
    sent_today = stats["sent_today"]
    known_repos = set(state.get("contacted_repos") or [])
    no_email_repos = set(state.get("skipped_no_email_repos") or [])
    known_emails = {e.lower().strip() for e in (state.get("contacted_emails") or [])}
    bounced_set = stats["bounced_set"]

    if args.send and not allowed:
        print(f"[!] Action2MCP Safety / Cutoff Gate: {gate_reason} (total={stats['total_sent']}, bounce={stats['bounce_rate_pct']}%)")
        return

    new_no_email = set()
    print(f"[+] Querying GitHub for OpenAI Custom GPT Actions via 'x-openai-isConsequential' -> compiling against {args.api_base} ...")
    targets = discover_and_compile_gpt_actions(
        limit=args.limit,
        api_base=args.api_base,
        exclude_repos=known_repos | no_email_repos,
        require_email=args.send,
        no_email_out=new_no_email,
        exclude_emails=known_emails | bounced_set,
    )
    if args.send and new_no_email:
        state["skipped_no_email_repos"] = sorted(no_email_repos | new_no_email)
        save_state(state)

    print(f"[+] Compiled {len(targets)} real Custom GPT Action repo(s):")
    for idx, t in enumerate(targets, 1):
        print(f"\n{idx}. {t['repo']} ({t['file_path']})")
        print(f"   Title:       {t['title']} | OpenAPI {t['openapi_version']} | Base: {t['base_url']}")
        print(f"   Tools ({t['tool_count']}):   {', '.join(t['tool_names'][:8])}{' ...' if len(t['tool_names']) > 8 else ''}")
        print(f"   Conseq Ops:  {t['consequential_count']} | Owner Email: {t['owner_email'] or 'Not publicly exposed'}")
        if args.send:
            if sent_today >= args.max_emails:
                print("   [!] Daily cap reached; stopping outreach.")
                break
            em = t.get("owner_email")
            if not em or em in known_emails or em in bounced_set:
                continue
            subj, body = craft_sniper_email(t)
            try:
                send_smtp_email(em, subj, body)
                known_emails.add(em)
                known_repos.add(t["repo"])
                state["contacted_emails"].append(em)
                state["contacted_repos"].append(t["repo"])
                state["history"].append({"repo": t["repo"], "email": em, "tool_count": t["tool_count"], "sent_date": datetime.now(timezone.utc).isoformat()})
                sent_today += 1
                save_state(state)
                print(f"   [+] Sent migration proof email to {em}")
                time.sleep(6)
            except Exception as exc:
                print(f"   [-] SMTP failed for {em}: {exc}")

    if args.send:
        _, _, post_stats = common.evaluate_play_gate(state, daily_cap=args.max_emails, hard_stop_total=None, cutoff_date=ACTION2MCP_CUTOFF_DATE, override=True)
        common.push_dashboard_ingest("action2mcp", post_stats, source="action2mcp_cron_post")


if __name__ == "__main__":
    main()
