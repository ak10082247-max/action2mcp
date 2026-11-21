import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import outreach_common as common
import site_rescue_sniper as play_a
import ecom_fix_sniper as play_b
import agency_overflow_sniper as play_c
import launch_rescue_sniper as play_d
import process_stripe_alerts as stripe_alerts


class MultiPlaySniperTests(unittest.TestCase):
    def test_email_filtering_blocks_assets_and_traps(self):
        with patch.object(common, "has_valid_mx", return_value=True):
            emails = common.extract_deliverable_emails(
                'Contact icon@2x.png or sentry@sentry.io or noreply@clinic.co.uk or xxx@xxx.xxx or your@email.com or mailto:appointments@brightclinic.co.uk',
                "brightclinic.co.uk",
            )
        self.assertEqual(emails, ["appointments@brightclinic.co.uk"])
        self.assertFalse(common.is_deliverable_email("xxx@xxx.xxx"))
        self.assertFalse(common.is_deliverable_email("your@email.com"))
        self.assertFalse(common.is_deliverable_email("student@uni.edu.au"))

    def test_play_a_site_rescue_diagnostics_and_email(self):
        cand = {"name": "Bright Smile Dental", "domain": "brightdental.co.uk", "category": "dentist", "city": "London"}

        def fake_fetch(url, method="GET", headers=None, data=None, timeout=10, verify_ssl=True):
            if url == "https://brightdental.co.uk/":
                html = '<html><head></head><form action="http://brightdental.co.uk/lead"></form><a href="/book-online">Book Online</a> Email <a href="mailto:reception@brightdental.co.uk">reception@brightdental.co.uk</a></html>'
                return 200, "https://brightdental.co.uk/", {}, html.encode()
            if url == "https://brightdental.co.uk/book-online":
                return 404, url, {}, b"Not Found"
            return 404, url, {}, b""

        with patch.object(play_a, "check_ssl_expiry_days", return_value=(False, 9, "2026-11-28")), \
             patch.object(common, "http_fetch", side_effect=fake_fetch), \
             patch.object(common, "has_valid_mx", return_value=True):
            res = play_a.diagnose_local_site(cand)

        self.assertIsNotNone(res)
        self.assertEqual(res["email"], "reception@brightdental.co.uk")
        self.assertEqual(res["broken_links"][0]["status"], 404)
        self.assertTrue(res["missing_viewport"])
        self.assertEqual(len(res["insecure_http_assets"]), 1)
        subj, body = play_a.craft_site_rescue_email(res)
        self.assertIn("brightdental.co.uk", subj)
        self.assertIn("HTTP 404", body)
        self.assertIn("mixed-content", body)
        self.assertIn("viewport", body)
        self.assertNotIn("/book-online", body)
        self.assertIn('Reply "link"', body)
        self.assertIn("$10", body)
        self.assertIn("$49", body)
        self.assertIn("/t?play=play_a_local", body)
        self.assertIn("site-rescue.ak10082247.workers.dev", body)

        subj2, body2 = play_a.craft_site_rescue_email({
            "name": "Oak Clinic",
            "domain": "oakclinic.co.uk",
            "email": "info@oakclinic.co.uk",
            "broken_links": [],
            "ssl_broken": False,
            "ssl_days_remaining": 60,
            "https_redirect_ok": False,
            "has_local_schema": False,
        })
        self.assertIn("HTTP redirect", subj2)
        self.assertIn("301 redirect to HTTPS", body2)

    def test_play_b_ecom_fix_diagnostics_and_email(self):
        def fake_json(url, headers=None, timeout=12):
            if "/products.json?limit=15" in url:
                return {
                    "products": [
                        {
                            "title": "Oak Table",
                            "handle": "oak-table",
                            "variants": [{"price": "249.00"}],
                            "images": [{"src": "https://cdn.shopify.com/oak-300.jpg", "width": 300, "height": 300}],
                        }
                    ]
                }
            raise RuntimeError("not woo")

        def fake_fetch(url, method="GET", headers=None, data=None, timeout=10, verify_ssl=True):
            if url == "https://oakgoods.myshopify.com/":
                html = (
                    '<html><script>Shopify.currency={"active":"USD"}; function asyncLoad(){var urls=["https://oldapp.example/t.js"];}</script>'
                    '<a href="/collections/tables">Tables</a><footer>support@oakgoods.com</footer></html>'
                )
                return 200, "https://oakgoods.com/", {}, html.encode()
            if "/products/oak-table" in url:
                return 200, url, {}, b'<html><h1>Oak Table</h1></html>'
            if "/collections/tables" in url:
                return 404, url, {}, b"Not found"
            return 404, url, {}, b""

        with patch.object(common, "http_get_json", side_effect=fake_json), \
             patch.object(common, "http_fetch", side_effect=fake_fetch), \
             patch.object(common, "has_valid_mx", return_value=True):
            res = play_b.diagnose_ecom_store("oakgoods.myshopify.com")

        self.assertIsNotNone(res)
        self.assertEqual(res["domain"], "oakgoods.com")
        self.assertEqual(res["platform"], "shopify")
        self.assertEqual(res["email"], "support@oakgoods.com")
        self.assertTrue(any("Missing Product JSON-LD" in i for i in res["issues"]))
        self.assertTrue(any("ScriptTag" in i for i in res["issues"]))
        self.assertTrue(any("500x500px" in i for i in res["issues"]))
        subj, body = play_b.craft_ecom_fix_email(res)
        self.assertIn("oakgoods.com", subj)
        self.assertIn("500x500px", body)
        self.assertIn("1500x1500px", body)
        self.assertNotIn("/collections/tables", body)
        self.assertNotIn("/products/oak-table", body)
        self.assertIn('Reply "fix"', body)
        self.assertIn("$10", body)
        self.assertIn("$49", body)
        self.assertIn("/t?play=play_b_ecom", body)
        self.assertIn("ecom-fix.ak10082247.workers.dev", body)

    def test_stop_loss_and_bounce_gates(self):
        ok, reason, _ = common.evaluate_play_gate({"history": [], "bounced_emails": [], "replied_emails": []}, daily_cap=20, hard_stop_total=200)
        self.assertTrue(ok, reason)

        # Hard kill at 200 cleanly delivered with 0 sales and < 2 replies
        hist_202 = [{"email": f"u{i}@d{i}.com", "sent_date": "2026-11-10T10:00:00Z"} for i in range(202)]
        ok_kill, reason_kill, stats_kill = common.evaluate_play_gate(
            {"history": hist_202, "bounced_emails": ["b1@x.com", "b2@y.com"], "replied_emails": ["one@d1.com"], "paid_sales": 0},
            daily_cap=20,
            hard_stop_total=200,
        )
        self.assertFalse(ok_kill)
        self.assertIn("stop-loss", reason_kill.lower())
        self.assertEqual(stats_kill["clean_delivered"], 200)

        # Keep going when >= 2 replies
        ok_keep, _, _ = common.evaluate_play_gate(
            {"history": hist_202, "bounced_emails": ["b1@x.com", "b2@y.com"], "replied_emails": ["a@d1.com", "b@d2.com"], "paid_sales": 0},
            daily_cap=20,
            hard_stop_total=200,
        )
        self.assertTrue(ok_keep)

        # Bounce circuit-breaker > 5%
        hist_20 = [{"email": f"u{i}@d{i}.com", "sent_date": "2026-11-10T10:00:00Z"} for i in range(20)]
        ok_b, reason_b, _ = common.evaluate_play_gate(
            {"history": hist_20, "bounced_emails": ["u0@d0.com", "u1@d1.com"], "replied_emails": []},
            daily_cap=20,
            hard_stop_total=200,
        )
        self.assertFalse(ok_b)
        self.assertIn("bounce", reason_b.lower())

        # Action2MCP shutdown after Dec 11
        ok_dec, reason_dec, _ = common.evaluate_play_gate(
            {"history": [], "bounced_emails": []},
            daily_cap=20,
            hard_stop_total=None,
            cutoff_date="2026-11-20",
        )
        self.assertFalse(ok_dec)
        self.assertIn("cutoff", reason_dec.lower())

    def test_tracked_urls_dashboard_gate_and_stripe_alert_formatting(self):
        tracked = common.build_tracked_url("play_a_local", "clinic.co.uk", "https://site-rescue.ak10082247.workers.dev/?domain=clinic.co.uk")
        self.assertIn("/t?play=play_a_local&id=", tracked)
        self.assertNotIn("@", tracked)

        with patch.object(common, "http_get_json", return_value={"ok": True, "paused": True, "reason": "PAUSED_HIGH_BOUNCE"}):
            paused, reason = common.check_dashboard_play_status("play_a_local", ingest_token="tok_123")
        self.assertTrue(paused)
        self.assertEqual(reason, "PAUSED_HIGH_BOUNCE")

        to_sale, subj_sale, body_sale, _ = stripe_alerts.format_alert_email(
            {"kind": "sale_confirmed", "play_label": "Play A: SiteRescue", "tier": "pack", "amount_usd": 10.0, "target_domain": "clinic.co.uk", "session_ref": "cs_live_12...34"},
            owner_email="armkhan18@gmail.com",
        )
        self.assertEqual(to_sale, "armkhan18@gmail.com")
        self.assertIn("$$$ SALE CONFIRMED", subj_sale)
        self.assertIn("$10.00 USD", body_sale)

        to_rec, subj_rec, body_rec, _ = stripe_alerts.format_alert_email(
            {"kind": "abandoned_recovery", "play_label": "Play B: StoreFix", "amount_usd": 10.0, "target_domain": "oak.com", "recipient_email": "owner@oak.com", "checkout_url": "https://ecom-fix.ak10082247.workers.dev/"},
            owner_email="armkhan18@gmail.com",
        )
        self.assertEqual(to_rec, "owner@oak.com")
        self.assertIn("oak.com", subj_rec)
        self.assertIn("One-time checkout follow-up", body_rec)

    def test_play_c_agency_overflow_pitch(self):
        subj, body = play_c.craft_agency_overflow_email({"name": "Harbor SEO", "domain": "harborseo.co.uk"})
        self.assertIn("Harbor SEO", subj)
        self.assertIn("pay after proof", subj)
        self.assertIn("$49 per client", body)
        self.assertIn("500x500px", body)
        self.assertIn("/t?play=play_c_agency", body)

    def test_play_d_launch_rescue_and_followups(self):
        self.assertFalse(play_d.is_clean_launch_candidate("fl-studio-2026-portable-x64", "https://spam.github.io/x"))
        self.assertFalse(play_d.is_clean_launch_candidate("goodapp", "https://github.com/user/repo"))
        self.assertTrue(play_d.is_clean_launch_candidate("FastInvoice SaaS", "https://fastinvoice.example.com"))
        self.assertTrue(common.is_enterprise_queue_email("support@brand.zendesk.com"))

        cand = {
            "name": "FastInvoice",
            "url": "https://fastinvoice.example.com",
            "domain": "fastinvoice.example.com",
            "source": "show_hn",
            "github_owner": "founder1",
            "github_repo": "founder1/fastinvoice",
        }

        def fake_fetch(url, method="GET", headers=None, data=None, timeout=10, verify_ssl=True):
            if url == "https://fastinvoice.example.com":
                html = '<html><head><title>FastInvoice</title></head><body><h1>FastInvoice automated billing for freelancers</h1><a href="/pricing">Pricing</a><footer>Contact founder@fastinvoice.example.com for support</footer></body></html>'
                return 200, "https://fastinvoice.example.com/", {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"}, html.encode()
            if url == "https://fastinvoice.example.com/.env":
                return 200, url, {"Content-Type": "text/plain"}, b"STRIPE_SECRET=sk_test_not_printed\nDATABASE_URL=pg://x\n"
            if url == "https://fastinvoice.example.com/.git/HEAD":
                return 404, url, {}, b"Not Found"
            if url == "https://fastinvoice.example.com/pricing":
                return 404, url, {}, b"Not Found"
            return 404, url, {}, b""

        with patch.object(common, "http_fetch", side_effect=fake_fetch), \
             patch.object(common, "has_valid_mx", return_value=True):
            res = play_d.diagnose_launch_site(cand)

        self.assertIsNotNone(res)
        self.assertEqual(res["email"], "founder@fastinvoice.example.com")
        self.assertTrue(any("CORS misconfiguration" in i for i in res["issues"]))
        self.assertTrue(any("environment config file" in i for i in res["issues"]))
        subj, body = play_d.craft_launch_rescue_email(res)
        self.assertIn("fastinvoice.example.com", subj)
        self.assertNotIn("sk_test_not_printed", body)
        self.assertNotIn("/.env", body)
        self.assertIn("/t?play=play_d_launch", body)
        self.assertIn("$49-$99", body)

        state = {
            "bounced_emails": ["b@x.com"],
            "replied_emails": ["r@x.com"],
            "history": [
                {"domain": "old-clean.com", "email": "ok@old-clean.com", "sent_date": "2026-11-18T10:00:00+00:00"},
                {"domain": "bounced.com", "email": "b@x.com", "sent_date": "2026-11-18T10:00:00+00:00"},
                {"domain": "replied.com", "email": "r@x.com", "sent_date": "2026-11-18T10:00:00+00:00"},
                {"domain": "fresh.com", "email": "fresh@fresh.com", "sent_date": "2099-01-01T10:00:00+00:00"},
            ],
        }
        sent_to = []
        with patch.object(common, "send_smtp_email", side_effect=lambda to, s, b, sender_name="": sent_to.append(to)), \
             patch("time.sleep"):
            cnt = common.send_due_followups(state, lambda e: ("Re: bump", f"Hi {e['domain']}"), "Arman", daily_cap=20, max_per_run=4)
        self.assertEqual(cnt, 1)
        self.assertEqual(sent_to, ["ok@old-clean.com"])
        self.assertTrue(state["history"][0].get("followup_sent"))


if __name__ == "__main__":
    unittest.main()
