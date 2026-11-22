import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import money_button_sniper as play_e
import outreach_common as common


class MoneyButtonSniperTests(unittest.TestCase):
    def test_score_hit_prioritizes_ad_pixels_and_critical_cart_failures(self):
        hit_with_ads = {
            "domain": "clinic-example.co.uk",
            "platform": "wordpress",
            "adPixels": ["Meta Pixel (fbq)", "Google Ads Tag (AW)"],
            "findings": [
                {
                    "kind": "BOOKING_IFRAME_DEAD",
                    "severity": "critical",
                    "actionTested": "Embedded Calendly frame",
                    "evidence": 'Live booking/form iframe renders error: "This Calendly URL is not valid"',
                    "rootCauseFix": "Fix expired Calendly embed slug.",
                }
            ],
        }
        hit_no_ads = {
            "domain": "clinic2.co.uk",
            "platform": "wordpress",
            "adPixels": [],
            "findings": [
                {
                    "kind": "PAYMENT_OR_API_ERROR",
                    "severity": "high",
                    "actionTested": "Live browser network request",
                    "evidence": "POST /api/quote returned HTTP 500",
                    "rootCauseFix": "Fix quote API 500.",
                }
            ],
        }
        self.assertGreater(play_e.score_hit(hit_with_ads), play_e.score_hit(hit_no_ads))

    def test_craft_human_alert_email_shopify_and_local_service(self):
        shop_res = {
            "domain": "oakshop.co.uk",
            "platform": "shopify",
            "adPixels": ["Meta Pixel (fbq)"],
            "findings": [
                {
                    "kind": "CART_ADD_API_FAILED",
                    "severity": "critical",
                    "actionTested": 'Clicked "Add to cart" on https://oakshop.co.uk/products/chair',
                    "evidence": "Cart endpoint returned HTTP 422: https://oakshop.co.uk/cart/add.js",
                    "rootCauseFix": "Sync hidden variant ID in product form.",
                }
            ],
        }
        subj, body = play_e.craft_human_alert_email(shop_res, {"name": "Oak Shop"})
        self.assertIn("Add to Cart error on oakshop.co.uk", subj)
        self.assertIn("HTTP 422", body)
        self.assertIn("Meta Pixel (fbq)", body)
        self.assertIn("ecom-fix.ak10082247.workers.dev/api/checkout?tier=pro_kit&domain=oakshop.co.uk", body)
        self.assertNotIn("Limited-time", body)
        self.assertNotIn("/t?play=", body)

        clinic_res = {
            "domain": "smileclinic.co.uk",
            "platform": "wordpress",
            "adPixels": [],
            "findings": [
                {
                    "kind": "BOOKING_CTA_BROKEN",
                    "severity": "critical",
                    "actionTested": 'Followed "Book Now" CTA',
                    "evidence": "Booking destination https://calendly.com/old-clinic returned HTTP 404",
                    "rootCauseFix": "Update Calendly slug across header CTAs.",
                }
            ],
        }
        c_subj, c_body = play_e.craft_human_alert_email(clinic_res, {"name": "Smile Clinic"})
        self.assertIn("broken booking link on smileclinic.co.uk", c_subj)
        self.assertIn("site-rescue.ak10082247.workers.dev/api/checkout?tier=priority&domain=smileclinic.co.uk", c_body)

    def test_pick_best_email_prefers_same_domain_and_blocks_enterprise_queues(self):
        probe_res = {
            "domain": "brightdental.co.uk",
            "emails": ["support@zendesk.com", "info@other.com", "appointments@brightdental.co.uk"],
        }
        with patch.object(common, "has_valid_mx", return_value=True):
            picked = play_e.pick_best_email(probe_res, {"hint_email": ""}, set())
        self.assertEqual(picked, "appointments@brightdental.co.uk")


if __name__ == "__main__":
    unittest.main()
