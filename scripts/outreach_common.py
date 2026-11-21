#!/usr/bin/env python3
"""
Shared outreach utilities for Play A (SiteRescue) & Play B (StoreFix) crons.
Handles workspace .env loading, DoH MX validation, safe HTTP fetching,
email extraction, SMTP sending, and persistent JSON state.
"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
import re
import smtplib
import ssl
import threading
import urllib.error
import urllib.parse
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

UA = "KuroxDiagnosticScanner/1.0 (+https://github.com/ak10082247-max/action2mcp)"

BLOCKED_EMAIL_DOMAINS = {
    "example.com", "example.org", "example.net", "localhost", "sentry.io",
    "sentry-next.wixpress.com", "wixpress.com", "shopify.com", "squarespace.com",
    "godaddy.com", "wordpress.com", "w3.org", "schema.org", "cloudflare.com",
    "googleapis.com", "gstatic.com", "github.com", "users.noreply.github.com",
    "noreply.github.com", "email.com", "domain.com", "yourdomain.com",
    "company.com", "yoursite.com", "mysite.com", "website.com", "test.com",
    "xxx.xxx", "mailinator.com", "guerrillamail.com", "tempmail.com",
}
BLOCKED_LOCAL_PREFIXES = {
    "noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster",
    "hostmaster", "webmaster", "bounce", "abuse", "privacy", "security",
    "xxx", "your", "youremail", "email", "user", "username", "test", "testing",
    "sample", "demo", "example", "fake", "dummy", "placeholder", "name",
    "firstname", "lastname", "dependabot", "actions",
}
BLOCKED_PLACEHOLDER_TOKENS = (
    "noreply", "no-reply", "donotreply", "yourdomain", "youremail",
    "placeholder", "u003e", "@2x", "@3x", "xxx",
)
BAD_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")

try:
    SSL_NOVERIFY = ssl._create_unverified_context()
except Exception:
    SSL_NOVERIFY = None

_MX_CACHE: dict[str, bool] = {}
_MX_LOCK = threading.Lock()

METRO_BBOXES = [
    ("London", 51.35, -0.35, 51.65, 0.15),
    ("Manchester", 53.38, -2.38, 53.55, -2.12),
    ("Birmingham", 52.40, -1.98, 52.56, -1.78),
    ("Bristol", 51.40, -2.68, 51.52, -2.50),
    ("Edinburgh", 55.90, -3.28, 55.99, -3.10),
    ("New York", 40.66, -74.03, 40.82, -73.90),
    ("Chicago", 41.80, -87.73, 41.98, -87.58),
    ("Los Angeles", 33.98, -118.48, 34.12, -118.20),
    ("Austin", 30.20, -97.82, 30.38, -97.68),
    ("Toronto", 43.62, -79.46, 43.74, -79.30),
    ("Miami", 25.70, -80.32, 25.88, -80.12),
    ("Seattle", 47.55, -122.40, 47.70, -122.26),
]

DIRECTORY_BLOCKLIST = (
    "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com", "yell.com", "nhs.uk", "yelp.com",
)


def fetch_overpass_websites(ql_query: str, timeout: int = 18) -> list[dict]:
    """Query Overpass OSM API and return deduplicated {name, website, domain} dicts."""
    hdrs = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    body = ("data=" + urllib.parse.quote(ql_query)).encode("utf-8")
    out: list[dict] = []
    seen: set[str] = set()
    try:
        st, _, _, raw = http_fetch(
            "https://overpass-api.de/api/interpreter",
            method="POST",
            headers=hdrs,
            data=body,
            timeout=timeout,
            verify_ssl=False,
        )
        if st != 200:
            return []
        data = json.loads(raw.decode("utf-8", "replace"))
        for el in data.get("elements") or []:
            tags = el.get("tags") or {}
            web = (tags.get("website") or tags.get("contact:website") or tags.get("url") or "").strip()
            if not web:
                continue
            if not web.startswith(("http://", "https://")):
                web = "https://" + web
            host = (urllib.parse.urlparse(web).hostname or "").lower().replace("www.", "")
            if not host or "." not in host or host in seen:
                continue
            if any(b in host for b in DIRECTORY_BLOCKLIST):
                continue
            seen.add(host)
            name = (tags.get("name") or tags.get("brand") or host).strip()[:80]
            out.append({"name": name, "website": web, "domain": host})
    except Exception:
        return []
    return out


def fetch_photon_osm_websites(queries: list[str], limit_per_query: int = 50, timeout: int = 10) -> list[dict]:
    """Discover real business/shop websites via Komoot Photon + official OSM batch nodes/ways API."""
    out: list[dict] = []
    seen: set[str] = set()
    for q in queries:
        try:
            pdata = http_get_json(
                f"https://photon.komoot.io/api/?q={urllib.parse.quote(q)}&limit={limit_per_query}",
                timeout=timeout,
            )
            node_ids: list[str] = []
            way_ids: list[str] = []
            for feat in pdata.get("features") or []:
                props = feat.get("properties") or {}
                oid = props.get("osm_id")
                otype = props.get("osm_type")
                if not oid:
                    continue
                if otype == "N" and len(node_ids) < 50:
                    node_ids.append(str(oid))
                elif otype == "W" and len(way_ids) < 35:
                    way_ids.append(str(oid))

            elements: list[dict] = []
            if node_ids:
                try:
                    nd = http_get_json(f"https://api.openstreetmap.org/api/0.6/nodes.json?nodes={','.join(node_ids)}", timeout=timeout)
                    elements.extend(nd.get("elements") or [])
                except Exception:
                    pass
            if way_ids:
                try:
                    wd = http_get_json(f"https://api.openstreetmap.org/api/0.6/ways.json?ways={','.join(way_ids)}", timeout=timeout)
                    elements.extend(wd.get("elements") or [])
                except Exception:
                    pass

            for el in elements:
                tags = el.get("tags") or {}
                web = (tags.get("website") or tags.get("contact:website") or tags.get("url") or "").strip()
                if not web:
                    continue
                if not web.startswith(("http://", "https://")):
                    web = "https://" + web
                host = (urllib.parse.urlparse(web).hostname or "").lower().replace("www.", "")
                if not host or "." not in host or host in seen:
                    continue
                if any(b in host for b in DIRECTORY_BLOCKLIST):
                    continue
                seen.add(host)
                name = (tags.get("name") or tags.get("brand") or host).strip()[:80]
                hint_em = (tags.get("email") or tags.get("contact:email") or "").strip().lower()
                out.append({"name": name, "website": web, "domain": host, "hint_email": hint_em, "query": q})
        except Exception:
            continue
    return out


def load_workspace_env(repo_root: str) -> None:
    for candidate in (
        os.path.join(repo_root, ".env"),
        os.path.join(os.path.dirname(repo_root), ".env.empire"),
        os.path.join(os.path.dirname(repo_root), ".env"),
    ):
        if not os.path.exists(candidate):
            continue
        raw_bytes = open(candidate, "rb").read()
        encoding = "utf-16" if raw_bytes.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
        try:
            text = raw_bytes.decode(encoding, "replace")
            for line in text.splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v
        except Exception:
            pass


def http_fetch(
    url: str,
    method: str = "GET",
    headers: dict | None = None,
    data: bytes | None = None,
    timeout: int = 10,
    verify_ssl: bool = True,
) -> tuple[int, str, dict, bytes]:
    hdrs = {"User-Agent": UA}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    ctx = ssl.create_default_context() if verify_ssl else SSL_NOVERIFY
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.status, resp.geturl(), dict(resp.headers), resp.read(500000)
    except urllib.error.HTTPError as e:
        try:
            body = e.read(65536)
        except Exception:
            body = b""
        return e.code, e.geturl() or url, dict(e.headers or {}), body


def http_get_json(url: str, headers: dict | None = None, timeout: int = 12):
    h = {"Accept": "application/json"}
    if headers:
        h.update(headers)
    status, _, _, raw = http_fetch(url, headers=h, timeout=timeout, verify_ssl=False)
    if status >= 400:
        raise RuntimeError(f"HTTP {status} from {url}")
    return json.loads(raw.decode("utf-8", "replace"))


def has_valid_mx(domain: str) -> bool:
    d = domain.lower().strip().rstrip(".")
    with _MX_LOCK:
        if d in _MX_CACHE:
            return _MX_CACHE[d]
    ok = False
    for doh in (
        f"https://cloudflare-dns.com/dns-query?name={urllib.parse.quote(d)}&type=MX",
        f"https://dns.google/resolve?name={urllib.parse.quote(d)}&type=MX",
    ):
        try:
            res = http_get_json(doh, headers={"Accept": "application/dns-json"}, timeout=5)
            answers = res.get("Answer") or []
            if any(a.get("type") == 15 and not str(a.get("data", "")).strip().endswith(" .") for a in answers):
                ok = True
                break
        except Exception:
            continue
    with _MX_LOCK:
        _MX_CACHE[d] = ok
    return ok


def is_clean_email_syntax(email: str, bounced_set: set[str] | None = None) -> tuple[bool, str]:
    """Validate syntax and reject placeholders, assets, traps, bounces, and .edu domains."""
    if not email or "@" not in email:
        return False, ""
    em = email.lower().strip()
    if bounced_set and em in bounced_set:
        return False, ""
    if em.endswith(BAD_EXTENSIONS) or any(tok in em for tok in BLOCKED_PLACEHOLDER_TOKENS):
        return False, ""
    parts = em.split("@")
    if len(parts) != 2:
        return False, ""
    local, domain = parts
    if not re.fullmatch(r"[a-z0-9][a-z0-9._%+\-]{0,63}", local):
        return False, ""
    if not re.fullmatch(r"[a-z0-9\-]+(?:\.[a-z0-9\-]+)+", domain):
        return False, ""
    tld = domain.rsplit(".", 1)[-1]
    if len(tld) < 2 or tld.isdigit():
        return False, ""
    if bounced_set and any(b.endswith("@" + domain) for b in bounced_set):
        return False, ""
    if domain in BLOCKED_EMAIL_DOMAINS or domain.endswith((
        ".local", ".internal", ".test", ".png", ".jpg", ".svg",
        ".edu", ".ac.uk", ".noreply.github.com",
    )) or ".edu." in domain:
        return False, ""
    if local in BLOCKED_LOCAL_PREFIXES:
        return False, ""
    return True, domain


def is_deliverable_email(email: str, bounced_set: set[str] | None = None) -> bool:
    ok, domain = is_clean_email_syntax(email, bounced_set=bounced_set)
    if not ok:
        return False
    return has_valid_mx(domain)


def evaluate_play_gate(
    state: dict,
    daily_cap: int = 20,
    hard_stop_total: int | None = 200,
    cutoff_date: str | None = None,
    max_bounce_pct: float = 5.0,
    override: bool = False,
) -> tuple[bool, str, dict]:
    """Enforce daily 20/day pacing, >5% post-fix bounce circuit-breaker, 200-email stop-loss, and Dec 12 cutoff."""
    history = state.get("history") or []
    bounced = {str(x).lower().strip() for x in (state.get("bounced_emails") or []) if x}
    replied = [str(x).lower().strip() for x in (state.get("replied_emails") or []) if x]
    paid_sales = int(state.get("paid_sales") or 0)
    total_sent = len(history)
    known_bounces = len(bounced)
    clean_delivered = max(0, total_sent - known_bounces)
    bounce_pct = round((known_bounces / total_sent) * 100.0, 1) if total_sent > 0 else 0.0

    reset_at = str(state.get("bounce_reset_at") or "").strip()
    if reset_at:
        active_sent = sum(1 for h in history if str(h.get("sent_date") or "") >= reset_at)
        post_bounces = {str(x).lower().strip() for x in (state.get("post_fix_bounced_emails") or []) if x}
        active_bounces = len(post_bounces)
    else:
        active_sent = total_sent
        active_bounces = known_bounces
    active_bounce_pct = round((active_bounces / active_sent) * 100.0, 1) if active_sent > 0 else 0.0

    sent_today = count_sent_today(history)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    stats = {
        "total_sent": total_sent,
        "known_bounces": known_bounces,
        "clean_delivered": clean_delivered,
        "bounce_rate_pct": active_bounce_pct if reset_at else bounce_pct,
        "lifetime_bounce_rate_pct": bounce_pct,
        "active_sent": active_sent,
        "active_bounces": active_bounces,
        "sent_today": sent_today,
        "daily_cap": daily_cap,
        "hard_stop_total": hard_stop_total,
        "cutoff_date": cutoff_date,
        "replied_count": len(replied),
        "paid_sales": paid_sales,
        "bounced_set": bounced,
    }

    if override:
        return True, "override", stats

    paused_reason = str(state.get("paused_reason") or "").strip()
    if paused_reason:
        return False, f"Paused: {paused_reason}", stats

    if cutoff_date and today_str >= cutoff_date and paid_sales == 0:
        return False, f"Cutoff reached ({cutoff_date}): Dec 11 shutdown deadline passed with 0 paid sales.", stats

    if active_sent >= 10 and active_bounce_pct > max_bounce_pct:
        return (
            False,
            f"Bounce circuit-breaker tripped: {active_bounces}/{active_sent} ({active_bounce_pct}%) exceeds {max_bounce_pct}% safe Gmail limit.",
            stats,
        )

    if hard_stop_total and clean_delivered >= hard_stop_total and paid_sales == 0 and len(replied) < 2:
        return (
            False,
            f"Hard stop-loss hit at {clean_delivered}/{hard_stop_total} cleanly delivered emails with 0 sales and {len(replied)} replies.",
            stats,
        )

    if sent_today >= daily_cap:
        return False, f"Daily cap reached ({sent_today}/{daily_cap}).", stats

    return True, "ok", stats


def _fetch_imap_sender_sets() -> tuple[set[str], set[str]] | None:
    """Fetch lowercase candidate emails from recent Gmail mailer-daemon bounces and inbound headers."""
    import imaplib
    smtp_user, smtp_pass = resolve_smtp_credentials()
    if not smtp_user or not smtp_pass:
        return None
    bounce_addrs: set[str] = set()
    reply_addrs: set[str] = set()
    try:
        m = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=10)
        m.login(smtp_user, smtp_pass)
        st, _ = m.select("INBOX", readonly=True)
        if st == "OK":
            typ, msgs = m.search(None, "FROM", "mailer-daemon")
            ids = (msgs[0] or b"").split()[-50:] if typ == "OK" else []
            for mid in ids:
                ftyp, fdata = m.fetch(mid, "(RFC822)")
                if ftyp != "OK" or not fdata or not isinstance(fdata[0], tuple):
                    continue
                txt = fdata[0][1].decode("utf-8", "replace").lower()
                bounce_addrs.update(re.findall(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,12}", txt))

            rtyp, rmsgs = m.search(None, "ALL")
            rids = (rmsgs[0] or b"").split()[-60:] if rtyp == "OK" else []
            for mid in rids:
                ftyp, fdata = m.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM)])")
                if ftyp != "OK" or not fdata or not isinstance(fdata[0], tuple):
                    continue
                fhdr = fdata[0][1].decode("utf-8", "replace").lower()
                if "mailer-daemon" in fhdr or smtp_user.lower() in fhdr:
                    continue
                reply_addrs.update(re.findall(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,12}", fhdr))
        m.logout()
    except Exception:
        return None
    return bounce_addrs, reply_addrs


def _apply_imap_matches_to_state(state: dict, bounce_addrs: set[str], reply_addrs: set[str]) -> bool:
    known_emails = {str(e).lower().strip() for e in (state.get("contacted_emails") or []) if "@" in str(e)}
    if not known_emails:
        return False
    bounced = {str(x).lower().strip() for x in (state.get("bounced_emails") or []) if x}
    post_bounced = {str(x).lower().strip() for x in (state.get("post_fix_bounced_emails") or []) if x}
    replied = {str(x).lower().strip() for x in (state.get("replied_emails") or []) if x}
    reset_at = str(state.get("bounce_reset_at") or "").strip()
    post_set = {
        str(h.get("email") or "").lower().strip()
        for h in (state.get("history") or [])
        if h.get("email") and (not reset_at or str(h.get("sent_date") or "") >= reset_at)
    }

    changed = False
    for cand in bounce_addrs & known_emails:
        if cand not in bounced:
            bounced.add(cand)
            changed = True
        if cand in post_set and cand not in post_bounced:
            post_bounced.add(cand)
            changed = True
    for cand in reply_addrs & known_emails:
        if cand not in replied:
            replied.add(cand)
            changed = True

    if changed:
        state["bounced_emails"] = sorted(bounced)
        state["post_fix_bounced_emails"] = sorted(post_bounced)
        state["replied_emails"] = sorted(replied)
    return changed


def sync_imap_bounces_and_replies(state: dict) -> bool:
    """Best-effort read-only Gmail IMAP sync to auto-record new bounces and prospect replies."""
    known_emails = {str(e).lower().strip() for e in (state.get("contacted_emails") or []) if "@" in str(e)}
    if not known_emails:
        return False
    res = _fetch_imap_sender_sets()
    if res is None:
        return False
    bounce_addrs, reply_addrs = res
    return _apply_imap_matches_to_state(state, bounce_addrs, reply_addrs)


DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://kurox-revenue-dashboard.ak10082247.workers.dev").rstrip("/")


def build_lead_hash(identifier: str) -> str:
    return hashlib.sha256(str(identifier or "").strip().lower().encode("utf-8")).hexdigest()[:16]


def build_tracked_url(play_key: str, lead_identifier: str, target_url: str, dashboard_base: str = DASHBOARD_URL) -> str:
    base = (dashboard_base or DASHBOARD_URL).rstrip("/")
    q = urllib.parse.urlencode({
        "play": play_key,
        "id": build_lead_hash(lead_identifier),
        "to": target_url,
    })
    return f"{base}/t?{q}"


def _dashboard_auth_headers(ingest_token: str | None = None) -> dict[str, str]:
    tok = (ingest_token if ingest_token is not None else os.environ.get("DASHBOARD_INGEST_TOKEN", "")).strip()
    if not tok:
        return {}
    return {
        "Authorization": f"Bearer {tok}",
        "User-Agent": UA,
        "Content-Type": "application/json",
    }


def check_dashboard_play_status(play_key: str, dashboard_base: str = DASHBOARD_URL, ingest_token: str | None = None) -> tuple[bool, str]:
    """Query /api/play-status to honor central PAUSED_HIGH_BOUNCE circuit breaker across plays."""
    hdrs = _dashboard_auth_headers(ingest_token)
    if not hdrs:
        return False, ""
    url = f"{(dashboard_base or DASHBOARD_URL).rstrip('/')}/api/play-status?{urllib.parse.urlencode({'play': play_key})}"
    try:
        j = http_get_json(url, headers=hdrs, timeout=8)
        if j.get("paused"):
            return True, str(j.get("reason") or "PAUSED_HIGH_BOUNCE")
    except Exception:
        return False, ""
    return False, ""


def push_dashboard_ingest(play_key: str, stats: dict, dashboard_base: str = DASHBOARD_URL, ingest_token: str | None = None, source: str = "cron") -> dict | None:
    """Push latest bounce/delivered telemetry to dashboard POST /api/ingest."""
    hdrs = _dashboard_auth_headers(ingest_token)
    if not hdrs:
        return None
    url = f"{(dashboard_base or DASHBOARD_URL).rstrip('/')}/api/ingest"
    payload = json.dumps({
        "play": play_key,
        "emails_sent": int(stats.get("total_sent", 0)),
        "emails_bounced": int(stats.get("known_bounces", 0)),
        "post_fix_sent": int(stats.get("active_sent", 0)),
        "post_fix_bounced": int(stats.get("active_bounces", 0)),
        "bounce_rate_pct": float(stats.get("bounce_rate_pct", 0.0)),
        "emails_today": int(stats.get("sent_today", 0)),
        "daily_cap": int(stats.get("daily_cap", 20)),
        "stop_loss_cap": stats.get("hard_stop_total"),
        "replied_count": int(stats.get("replied_count", 0)),
        "source": source,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=hdrs, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except Exception:
        return None


def sync_imap_bounces_across_states(
    state_specs: list[tuple[str, str, int | None]],
    dashboard_base: str = DASHBOARD_URL,
    ingest_token: str | None = None,
) -> dict[str, dict]:
    """Scan Gmail IMAP once across all outreach state files, persist updates, and ingest into dashboard KV."""
    imap_res = _fetch_imap_sender_sets()
    summary: dict[str, dict] = {}
    for play_key, state_path, stop_cap in state_specs:
        state = load_json_state(state_path, {"contacted_emails": [], "bounced_emails": [], "replied_emails": [], "history": []})
        if imap_res is not None and _apply_imap_matches_to_state(state, imap_res[0], imap_res[1]):
            save_json_state(state_path, state)
        _, _, stats = evaluate_play_gate(state, daily_cap=20, hard_stop_total=stop_cap)
        ingest_resp = push_dashboard_ingest(play_key, stats, dashboard_base=dashboard_base, ingest_token=ingest_token, source="imap_sync")
        if ingest_resp and ingest_resp.get("paused_high_bounce") and not state.get("paused_reason"):
            state["paused_reason"] = ingest_resp.get("pause_reason") or "PAUSED_HIGH_BOUNCE"
            save_json_state(state_path, state)
        summary[play_key] = {
            "total_sent": stats["total_sent"],
            "active_sent": stats["active_sent"],
            "active_bounces": stats["active_bounces"],
            "bounce_rate_pct": stats["bounce_rate_pct"],
            "paused_high_bounce": bool((ingest_resp or {}).get("paused_high_bounce")),
        }
    return summary


def send_canary_copies(canary_csv: str, subject: str, body: str, sender_name: str) -> int:
    addrs = [a.strip() for a in str(canary_csv or "").split(",") if "@" in a]
    sent = 0
    for addr in addrs:
        send_smtp_email(addr, subject, body, sender_name=sender_name)
        sent += 1
    return sent


def extract_deliverable_emails(html: str, site_host: str) -> list[str]:
    text = html or ""
    candidates: list[str] = []
    for m in re.findall(r"mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,12})", text, flags=re.IGNORECASE):
        if m.lower() not in candidates:
            candidates.append(m.lower())
    for m in re.findall(r"\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,12})\b", text):
        if m.lower() not in candidates:
            candidates.append(m.lower())

    bare_host = site_host.lower().replace("www.", "")
    good = [em for em in candidates if is_deliverable_email(em)]
    # Prioritize emails matching the target domain and operational prefixes
    def score(em: str) -> tuple[int, int]:
        same_dom = 0 if em.endswith("@" + bare_host) or em.endswith("." + bare_host) else 1
        pref = 0 if any(em.startswith(p) for p in ("hello@", "appointments@", "booking@", "info@", "support@", "contact@", "reception@", "enquiries@")) else 1
        return (same_dom, pref)

    good.sort(key=score)
    return good


def load_json_state(path: str, default: dict) -> dict:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        return dict(default)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return dict(default)


def save_json_state(path: str, state: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def count_sent_today(history: list[dict]) -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total = 0
    for h in history or []:
        if str(h.get("sent_date") or "").startswith(today):
            total += 1
        if str(h.get("followup_sent_at") or "").startswith(today):
            total += 1
    return total


ENTERPRISE_HELPDESK_MARKERS = (
    "zendesk.com", "freshdesk.com", "helpscout.net", "intercom-mail.com",
    "salesforce.com", "kustomerapp.com", "gorgias.com", "reamaze.com",
)


def is_enterprise_queue_email(email: str, html: str = "") -> bool:
    """Detect ticket-queue autoresponders or mega-chain helpdesk inboxes unlikely to buy quick $10-$99 fixes."""
    em = str(email or "").lower().strip()
    if any(m in em for m in ENTERPRISE_HELPDESK_MARKERS):
        return True
    low = (html or "")[:200000].lower()
    if em.startswith("customerservice@") and any(m in low for m in ("zdassets.com", "gorgias.chat", "salesforce-experience")):
        return True
    return False


def send_due_followups(
    state: dict,
    make_followup_fn,
    sender_name: str,
    daily_cap: int = 20,
    max_per_run: int = 4,
    min_age_hours: int = 48,
    save_path: str | None = None,
) -> int:
    """Send at most 1 clean Day+2 follow-up bump per non-bounced, non-replied prospect inside daily cap."""
    import time

    bounced = {str(x).lower().strip() for x in (state.get("bounced_emails") or []) if x}
    replied = {str(x).lower().strip() for x in (state.get("replied_emails") or []) if x}
    history = state.get("history") or []
    sent_today = count_sent_today(history)
    now = datetime.now(timezone.utc)
    sent_now = 0

    for entry in history:
        if sent_now >= max_per_run or sent_today >= daily_cap:
            break
        if entry.get("followup_sent"):
            continue
        em = str(entry.get("email") or "").lower().strip()
        if not em or em in bounced or em in replied:
            continue
        raw_dt = str(entry.get("sent_date") or "").strip()
        if not raw_dt:
            continue
        try:
            dt = datetime.fromisoformat(raw_dt.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if (now - dt) < timedelta(hours=min_age_hours):
            continue
        try:
            subj, body = make_followup_fn(entry)
            send_smtp_email(em, subj, body, sender_name=sender_name)
            entry["followup_sent"] = True
            entry["followup_sent_at"] = now.isoformat()
            sent_now += 1
            sent_today += 1
            if save_path:
                save_json_state(save_path, state)
            print(f"    -> Sent Day+2 follow-up to {em}")
            time.sleep(4)
        except Exception as exc:
            print(f"    [-] Follow-up SMTP failed ({em}): {exc}")
    return sent_now


def resolve_smtp_credentials() -> tuple[str, str]:
    user = (os.environ.get("SMTP_USER") or os.environ.get("GMAIL_USER") or "").strip()
    pwd = (os.environ.get("SMTP_PASS") or os.environ.get("GMAIL_APP_PASSWORD") or "").strip()
    return user, pwd


def send_smtp_email(to_addr: str, subject: str, body: str, sender_name: str = "Arman (Site & Store Rescue)") -> None:
    smtp_user, smtp_pass = resolve_smtp_credentials()
    if not smtp_user or not smtp_pass:
        raise RuntimeError("SMTP_USER / SMTP_PASS (or GMAIL_USER / GMAIL_APP_PASSWORD) not configured.")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{smtp_user}>"
    msg["To"] = to_addr
    msg["Reply-To"] = smtp_user
    msg.attach(MIMEText(body, "plain", "utf-8"))
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [to_addr], msg.as_string())
