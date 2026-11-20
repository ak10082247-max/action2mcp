#!/usr/bin/env python3
"""
Shared outreach utilities for Play A (SiteRescue) & Play B (StoreFix) crons.
Handles workspace .env loading, DoH MX validation, safe HTTP fetching,
email extraction, SMTP sending, and persistent JSON state.
"""
from datetime import datetime, timezone
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
    """Enforce daily 20/day pacing, >5% bounce circuit-breaker, 200-email stop-loss, and Dec 12 cutoff."""
    history = state.get("history") or []
    bounced = {str(x).lower().strip() for x in (state.get("bounced_emails") or []) if x}
    replied = [str(x).lower().strip() for x in (state.get("replied_emails") or []) if x]
    paid_sales = int(state.get("paid_sales") or 0)
    total_sent = len(history)
    known_bounces = len(bounced)
    clean_delivered = max(0, total_sent - known_bounces)
    bounce_pct = round((known_bounces / total_sent) * 100.0, 1) if total_sent > 0 else 0.0
    sent_today = count_sent_today(history)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    stats = {
        "total_sent": total_sent,
        "known_bounces": known_bounces,
        "clean_delivered": clean_delivered,
        "bounce_rate_pct": bounce_pct,
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

    if total_sent >= 10 and bounce_pct > max_bounce_pct:
        return (
            False,
            f"Bounce circuit-breaker tripped: {known_bounces}/{total_sent} ({bounce_pct}%) exceeds {max_bounce_pct}% safe Gmail limit.",
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
    return sum(1 for h in (history or []) if str(h.get("sent_date") or "").startswith(today))


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
