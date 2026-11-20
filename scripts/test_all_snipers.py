import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import outreach_common as common
import site_rescue_sniper as play_a
import ecom_fix_sniper as play_b


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
                html = '<html><a href="/book-online">Book Online</a> Email <a href="mailto:reception@brightdental.co.uk">reception@brightdental.co.uk</a></html>'
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
        subj, body = play_a.craft_site_rescue_email(res)
        self.assertIn("brightdental.co.uk", subj)
        self.assertIn("HTTP 404", body)
        self.assertNotIn("/book-online", body)
        self.assertIn('Reply "link"', body)
        self.assertIn("$10", body)
        self.assertIn("$49", body)
        self.assertIn("https://site-rescue.ak10082247.workers.dev/", body)

    def test_play_b_ecom_fix_diagnostics_and_email(self):
        def fake_json(url, headers=None, timeout=12):
            if "/products.json" in url:
                return {"products": [{"title": "Oak Table", "handle": "oak-table", "variants": [{"price": "249.00"}]}]}
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
        subj, body = play_b.craft_ecom_fix_email(res)
        self.assertIn("oakgoods.com", subj)
        self.assertNotIn("/collections/tables", body)
        self.assertNotIn("/products/oak-table", body)
        self.assertIn('Reply "fix"', body)
        self.assertIn("$10", body)
        self.assertIn("$49", body)
        self.assertIn("https://ecom-fix.ak10082247.workers.dev/", body)

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


if __name__ == "__main__":
    unittest.main()
