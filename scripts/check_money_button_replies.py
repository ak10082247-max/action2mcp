#!/usr/bin/env python3
"""
Checks Gmail IMAP INBOX for real prospect replies ("trace", "fix", "done", etc.)
and bounces across Play E (money_button_state.json) plus Plays A/B/C/D.
Matches any reply against data/money_button_hits.jsonl and prints exact
diagnostic proof + ready Stripe DFY/Priority checkout links so no hot lead is missed.
"""

import email
import imaplib
import json
import os
import re
import sys

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPTS_DIR)
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

import outreach_common as common

common.load_workspace_env(REPO_ROOT)

STATE_FILES = [
    ("play_e_money_button", os.path.join(REPO_ROOT, "data", "money_button_state.json")),
    ("play_a_local", os.path.join(REPO_ROOT, "data", "site_rescue_state.json")),
    ("play_b_ecom", os.path.join(REPO_ROOT, "data", "ecom_fix_state.json")),
    ("play_c_agency", os.path.join(REPO_ROOT, "data", "agency_overflow_state.json")),
    ("play_d_launch", os.path.join(REPO_ROOT, "data", "launch_rescue_state.json")),
    ("play_f_saas", os.path.join(REPO_ROOT, "data", "saas_agent_leak_state.json")),
]
HITS_LOG = os.path.join(REPO_ROOT, "data", "money_button_hits.jsonl")

AUTO_NOISE_RE = re.compile(
    r"(requires verification|verify that you are a real live human|outside of our business hours|automatic reply|out of office|auto-reply|mailer-daemon|automated reply to confirm|operates monday to friday|get back to your request upon reopening|received your message for ticket|邮件已收到)",
    re.IGNORECASE,
)


def load_hits_index() -> dict[str, dict]:
    index: dict[str, dict] = {}
    if not os.path.exists(HITS_LOG):
        return index
    with open(HITS_LOG, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                dom = str(rec.get("domain") or "").lower().strip()
                em = str(rec.get("email") or "").lower().strip()
                if dom:
                    index[dom] = rec
                if em:
                    index[em] = rec
            except Exception:
                continue
    return index


def classify_reply(body_text: str) -> str:
    low = (body_text or "").lower()
    if AUTO_NOISE_RE.search(low):
        return "AUTO_OR_CHALLENGE"
    if re.search(r"\bunsubscribe\b|\bopt out\b|\bremove me\b|\bstop emailing\b", low):
        return "UNSUBSCRIBE"
    if re.search(r"\b(fix|done|dfy|patch|how much|quote|cost|price|link|send it|please fix|help)\b", low):
        return "FIX_REQUEST"
    if re.search(r"\b(trace|screenshot|console|error|details|what did you see|which page)\b", low):
        return "TRACE_REQUEST"
    return "HUMAN_REPLY"


def decode_body(em_msg) -> str:
    if em_msg.is_multipart():
        for part in em_msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    return payload.decode("utf-8", "replace")
    else:
        payload = em_msg.get_payload(decode=True)
        if payload:
            return payload.decode("utf-8", "replace")
    return ""


def check_replies(lookback: int = 120) -> dict:
    smtp_user, smtp_pass = common.resolve_smtp_credentials()
    if not smtp_user or not smtp_pass:
        raise RuntimeError("GMAIL_USER / GMAIL_APP_PASSWORD (or SMTP_USER / SMTP_PASS) missing.")

    tracked_emails: dict[str, tuple[str, str, str]] = {}
    for play_key, path in STATE_FILES:
        if not os.path.exists(path):
            continue
        st = common.load_json_state(path, {})
        for h in st.get("history") or []:
            addr = str(h.get("email") or "").lower().strip()
            dom = str(h.get("domain") or "").lower().strip()
            if addr and "@" in addr:
                tracked_emails[addr] = (play_key, dom, path)

    hits_index = load_hits_index()
    m = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=15)
    m.login(smtp_user, smtp_pass)
    st_sel, _ = m.select("INBOX", readonly=True)
    actionable: list[dict] = []
    bounces: list[str] = []

    if st_sel == "OK":
        _, rmsgs = m.search(None, "ALL")
        ids = (rmsgs[0] or b"").split()[-lookback:]
        for mid in reversed(ids):
            _, hdata = m.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            if not hdata or not isinstance(hdata[0], tuple):
                continue
            hdr_txt = hdata[0][1].decode("utf-8", "replace")
            hmsg = email.message_from_string(hdr_txt)
            from_hdr = str(hmsg.get("From") or "").lower()
            if smtp_user.lower() in from_hdr:
                continue

            is_bounce = "mailer-daemon" in from_hdr or "mail delivery subsystem" in from_hdr
            sender_matches = [e for e in re.findall(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,12}", from_hdr) if e in tracked_emails]
            if not is_bounce and not sender_matches:
                continue

            _, fdata = m.fetch(mid, "(RFC822)")
            if not fdata or not isinstance(fdata[0], tuple):
                continue
            msg = email.message_from_bytes(fdata[0][1])
            auto_hdr = str(msg.get("Auto-Submitted") or "").lower()
            prec_hdr = str(msg.get("Precedence") or "").lower()
            if auto_hdr in ("auto-replied", "auto-generated") or prec_hdr in ("bulk", "auto_reply", "junk"):
                continue
            subj = str(msg.get("Subject") or "")
            date_str = str(msg.get("Date") or "")
            body = decode_body(msg)

            if is_bounce:
                for addr in re.findall(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,12}", body.lower()):
                    if addr in tracked_emails and addr not in bounces:
                        bounces.append(addr)
                continue

            sender = sender_matches[0]
            play_key, dom, _ = tracked_emails[sender]
            top_reply = re.split(r"\r?\n\s*On\s.+wrote:|\r?\n>|\r?\nFrom:", body, maxsplit=1)[0].strip()
            intent = classify_reply(top_reply)
            if intent in ("TRACE_REQUEST", "FIX_REQUEST", "HUMAN_REPLY"):
                hit = hits_index.get(dom) or hits_index.get(sender) or {}
                actionable.append({
                    "intent": intent,
                    "play": play_key,
                    "from": sender,
                    "domain": dom,
                    "date": date_str,
                    "subject": subj[:120],
                    "reply_snippet": top_reply[:500],
                    "recorded_findings": hit.get("findings") or [],
                })

    m.logout()
    return {"tracked_count": len(tracked_emails), "actionable_replies": actionable, "bounces_seen": bounces}


if __name__ == "__main__":
    out = check_replies()
    print(json.dumps(out, indent=2, ensure_ascii=False))
