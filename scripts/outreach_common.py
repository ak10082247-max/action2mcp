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
}
BLOCKED_LOCAL_PREFIXES = {
    "noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster",
    "hostmaster", "webmaster", "bounce", "abuse", "privacy", "security",
}
BAD_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")

try:
    SSL_NOVERIFY = ssl._create_unverified_context()
except Exception:
    SSL_NOVERIFY = None

_MX_CACHE: dict[str, bool] = {}


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
    _MX_CACHE[d] = ok
    return ok


def is_deliverable_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    em = email.lower().strip()
    if em.endswith(BAD_EXTENSIONS) or any(tok in em for tok in ("@2x", "@3x", "u003e", "yourdomain")):
        return False
    parts = em.split("@")
    if len(parts) != 2:
        return False
    local, domain = parts
    if not re.fullmatch(r"[a-z0-9][a-z0-9._%+\-]{0,63}", local):
        return False
    if not re.fullmatch(r"[a-z0-9\-]+(?:\.[a-z0-9\-]+)+", domain):
        return False
    tld = domain.rsplit(".", 1)[-1]
    if len(tld) < 2 or tld.isdigit():
        return False
    if domain in BLOCKED_EMAIL_DOMAINS or domain.endswith((".local", ".internal", ".test", ".png", ".jpg", ".svg")):
        return False
    if local in BLOCKED_LOCAL_PREFIXES or any(b in local for b in ("noreply", "no-reply", "donotreply")):
        return False
    return has_valid_mx(domain)


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
