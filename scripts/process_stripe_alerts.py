#!/usr/bin/env python3
"""
Drains due Stripe webhook sale confirmations & 30-min abandoned checkout recovery
emails from kurox-revenue-dashboard KV queue, and syncs Gmail IMAP bounce rates
across all 3 active outreach plays to enforce the 5% PAUSED_HIGH_BOUNCE circuit breaker.
"""
import argparse
import json
import os
import sys
import urllib.request

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)
import outreach_common as common

REPO_ROOT = os.path.dirname(SCRIPTS_DIR)

STATE_SPECS = [
    ("play_a_local", os.path.join(REPO_ROOT, "data", "site_rescue_state.json"), 200),
    ("play_b_ecom", os.path.join(REPO_ROOT, "data", "ecom_fix_state.json"), 200),
    ("play_c_agency", os.path.join(REPO_ROOT, "data", "agency_overflow_state.json"), 200),
    ("action2mcp", os.path.join(REPO_ROOT, "data", "contacted_gpts.json"), None),
]


def format_alert_email(alert: dict, owner_email: str) -> tuple[str, str, str, str]:
    """Return (recipient, subject, body, sender_name) for a queued Stripe alert."""
    kind = str(alert.get("kind") or "")
    play_label = str(alert.get("play_label") or alert.get("play") or "Kurox Product")
    tier = str(alert.get("tier") or "standard")
    amount = float(alert.get("amount_usd") or 0.0)
    target = str(alert.get("target_domain") or "-")
    ref = str(alert.get("session_ref") or "-")

    if kind == "sale_confirmed":
        subject = f"$$$ SALE CONFIRMED: {play_label} (${amount:.2f})"
        body = (
            f"Verified Stripe Checkout payment received!\n\n"
            f"Play:   {play_label}\n"
            f"Tier:   {tier}\n"
            f"Amount: ${amount:.2f} USD\n"
            f"Target: {target}\n"
            f"Ref:    {ref}\n"
            f"Time:   {alert.get('created_at') or '-'}\n\n"
            f"Cockpit: {common.DASHBOARD_URL}\n"
        )
        return owner_email, subject, body, "Kurox Sale Alerts"

    if kind == "abandoned_recovery":
        to_addr = str(alert.get("recipient_email") or "").strip()
        checkout_url = str(alert.get("checkout_url") or common.DASHBOARD_URL)
        subj_target = f" ({target})" if target and target != "-" else ""
        subject = f"Quick question on your {play_label} checkout{subj_target}"[:96]
        body = (
            f"Hi there,\n\n"
            f"Looks like your {play_label} checkout (${amount:.2f} launch deal) timed out before finishing.\n\n"
            f"No pressure at all — just wanted to check if anything looked unclear or if you had any questions about what's included for {target if target != '-' else 'your site'}.\n\n"
            f"You can review the preview or restart anytime at:\n"
            f"{checkout_url}\n\n"
            f"Or just reply here and I'll send the exact issue list or a direct link.\n\n"
            f"Best,\nArman\n"
            f"---\nOne-time checkout follow-up (you will not receive automated follow-ups).\n"
        )
        return to_addr, subject, body, "Arman (Kurox Support)"

    return "", "", "", ""


def drain_pending_alerts(
    dashboard_base: str = common.DASHBOARD_URL,
    ingest_token: str | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    hdrs = common._dashboard_auth_headers(ingest_token)
    if not hdrs:
        print("[!] DASHBOARD_INGEST_TOKEN not set; skipping pending alert poll.")
        return {"fetched": 0, "sent": 0, "acked": 0}

    smtp_user, smtp_pass = common.resolve_smtp_credentials()
    owner_email = (os.environ.get("ALERT_NOTIFY_EMAIL") or smtp_user or "").strip()

    url = f"{(dashboard_base or common.DASHBOARD_URL).rstrip('/')}/api/pending-alerts"
    try:
        res = common.http_get_json(url, headers=hdrs, timeout=10)
    except Exception as exc:
        print(f"[!] Failed to fetch pending alerts: {exc}")
        return {"fetched": 0, "sent": 0, "acked": 0}

    alerts = res.get("alerts") or []
    sent = 0
    acked = 0
    for alert in alerts:
        aid = str(alert.get("id") or "")
        to_addr, subj, body, sender_name = format_alert_email(alert, owner_email)
        if not to_addr or "@" not in to_addr or not subj:
            continue
        if dry_run:
            print(f"[dry-run] Would send {alert.get('kind')} -> {to_addr}: {subj}")
            sent += 1
            continue
        if not smtp_user or not smtp_pass:
            print(f"[!] SMTP credentials missing; keeping {aid} queued.")
            continue
        try:
            common.send_smtp_email(to_addr, subj, body, sender_name=sender_name)
            sent += 1
            ack_req = urllib.request.Request(
                f"{(dashboard_base or common.DASHBOARD_URL).rstrip('/')}/api/ack-alert",
                data=json.dumps({"id": aid}).encode("utf-8"),
                headers=hdrs,
                method="POST",
            )
            with urllib.request.urlopen(ack_req, timeout=10):
                acked += 1
            print(f"[+] Processed & acked alert {aid} ({alert.get('kind')})")
        except Exception as exc:
            print(f"[-] Alert send/ack failed for {aid}: {exc}")

    return {"fetched": len(alerts), "sent": sent, "acked": acked}


def main():
    parser = argparse.ArgumentParser(description="Process Stripe webhook sale/recovery alerts & sync IMAP bounce gates")
    parser.add_argument("--dry-run", action="store_true", help="Print due alerts without sending email or acking")
    args = parser.parse_args()

    print("[+] Syncing Gmail IMAP bounces & replies across all 3 outreach plays...")
    sync_summary = common.sync_imap_bounces_across_states(STATE_SPECS)
    for pk, st in sync_summary.items():
        print(
            f"   - {pk}: total={st['total_sent']} active={st['active_sent']} "
            f"bounces={st['active_bounces']} ({st['bounce_rate_pct']}%) paused={st['paused_high_bounce']}"
        )

    res = drain_pending_alerts(dry_run=args.dry_run)
    print(f"[=] Stripe alerts drained: fetched={res['fetched']} sent={res['sent']} acked={res['acked']}")


if __name__ == "__main__":
    main()
