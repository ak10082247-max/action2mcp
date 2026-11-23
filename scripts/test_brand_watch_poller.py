#!/usr/bin/env python3
"""Unit tests for CautionWatch strict TikTok Caution poller & subscriber alert matcher."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import poll_tiktok_caution as poller  # noqa: E402


class CautionPollerTests(unittest.TestCase):
    def test_strict_filter_rejects_clean_and_other_labels(self):
        self.assertIsNone(poller.is_unverified_caution_match({
            "id": "101",
            "webVideoUrl": "https://www.tiktok.com/@clean/video/101",
            "warnInfo": [],
            "text": "Reaction video talking about Caution: Video flagged for unverified content",
        }))
        self.assertIsNone(poller.is_unverified_caution_match({
            "id": "102",
            "webVideoUrl": "https://www.tiktok.com/@ai/video/102",
            "warnInfo": [{"text": "Creator labeled as AI-generated"}],
            "labelTop": "Contains AI-generated media",
        }))
        self.assertIsNone(poller.is_unverified_caution_match({
            "id": "103",
            "webVideoUrl": "https://www.tiktok.com/@stunt/video/103",
            "warningText": "Participating in this activity could result in you or others getting hurt.",
        }))
        nested = poller.is_unverified_caution_match({
            "id": "104",
            "anchors": [{"extraInfo": {"warning": "Caution: Video flagged for unverified content."}}],
        })
        self.assertIsNotNone(nested)
        profiles = poller.collect_discovery_profiles([{"keywords": "Brand, @watcher"}], [{"authorUsername": "@repeatflag"}], [])
        self.assertEqual(profiles[0], "maskedtruthmt")
        self.assertIn("watcher", profiles)
        self.assertIn("repeatflag", profiles)

    def test_extracts_caution_unverified_across_raw_schemas(self):
        apify_raw = {
            "id": "7709208502949940500",
            "webVideoUrl": "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
            "authorMeta": {"name": "maskedtruthmt", "nickName": "maskedtruthmt"},
            "text": "Watch what happened to Anthony Joshua after not following the script #maskedtruth",
            "voice_to_text": "Audio transcript claiming Anthony Joshua incident",
            "hashtags": [{"name": "maskedtruth"}],
            "videoMeta": {"coverUrl": "https://p16-sign.tiktokcdn.example/cover.jpg"},
            "warnInfo": [{"text": "Caution: Video flagged for unverified content."}],
        }
        rec1 = poller.extract_caution_record(apify_raw, source_provider="apify", query_tag="Anthony Joshua")
        self.assertIsNotNone(rec1)
        self.assertEqual(rec1["videoId"], "7709208502949940500")
        self.assertEqual(rec1["authorUsername"], "@maskedtruthmt")
        self.assertEqual(rec1["matchedField"], "warnInfo")
        self.assertEqual(rec1["playerUrl"], "https://www.tiktok.com/player/v1/7709208502949940500")
        self.assertEqual(rec1["hashtags"], ["maskedtruth"])

        ensemble_raw = {
            "aweme_detail": {
                "aweme_id": "7710000000000000001",
                "desc": "Staged leak video about Acme Bank",
                "author": {"uniqueId": "rumorwatcher", "nickname": "Rumor Watcher"},
                "labelTop": "Caution: Video flagged for unverified content",
                "video": {"cover": {"url_list": ["https://cdn.example/c.jpg"]}},
            }
        }
        rec2 = poller.extract_caution_record(ensemble_raw, source_provider="ensembledata")
        self.assertIsNotNone(rec2)
        self.assertEqual(rec2["videoId"], "7710000000000000001")
        self.assertEqual(rec2["matchedField"], "labelTop")
        self.assertEqual(rec2["thumbnailUrl"], "https://cdn.example/c.jpg")

    def test_persistence_merge_and_alert_matching_with_dedupe(self):
        rec = poller.extract_caution_record({
            "id": "7709208502949940500",
            "webVideoUrl": "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
            "authorMeta": {"name": "maskedtruthmt"},
            "text": "Watch this clip #maskedtruth",
            "voice_to_text": "Voice transcript mentioning Anthony Joshua directly",
            "hashtags": [{"name": "maskedtruth"}],
            "contentDesc": "Video flagged for unverified content.",
        })
        self.assertIsNotNone(rec)

        with tempfile.TemporaryDirectory() as tmp:
            json_path = os.path.join(tmp, "flagged_videos.json")
            seed_path = os.path.join(tmp, "seed_caution.js")
            state_path = os.path.join(tmp, "alert_state.json")

            merged, added = poller.merge_caution_records([], [rec])
            self.assertEqual(len(added), 1)
            poller.write_flagged_artifacts(merged, json_path=json_path, seed_js_path=seed_path)

            loaded = poller.load_flagged_videos(json_path)
            self.assertEqual(len(loaded), 1)
            with open(seed_path, "r", encoding="utf-8") as fh:
                seed_text = fh.read()
            self.assertIn("export const REPO_CAUTION_VIDEOS =", seed_text)
            self.assertIn("7709208502949940500", seed_text)

            leads = [
                {
                    "lead_id": "BW-AAA11111",
                    "company": "Matchroom PR",
                    "contact_name": "Alex",
                    "email": "alex@matchroom.example",
                    "keywords": "Anthony Joshua, @other",
                    "notes": "Webhook: https://hook.eu2.make.com/abc123",
                },
                {
                    "lead_id": "BW-BBB22222",
                    "company": "Unmatched Brand",
                    "contact_name": "Bob",
                    "email": "bob@unrelated.example",
                    "keywords": "SolarPanels",
                    "notes": "",
                },
            ]

            sent_calls = []
            webhook_calls = []

            def fake_smtp(to_addr, subject, body, sender_name="CautionWatch Alerts"):
                sent_calls.append((to_addr, subject, body))

            def fake_fetch(url, method="GET", headers=None, data=None, timeout=10, verify_ssl=True):
                webhook_calls.append((url, json.loads(data.decode("utf-8"))))
                return 200, url, {}, b"ok"

            with patch.object(poller, "resolve_smtp_credentials", return_value=("alerts@example.com", "apppass")), \
                 patch.object(poller, "send_smtp_email", side_effect=fake_smtp), \
                 patch.object(poller, "http_fetch", side_effect=fake_fetch):
                res1 = poller.dispatch_subscriber_alerts([rec], leads, state_path=state_path, live_send=True)
                res2 = poller.dispatch_subscriber_alerts([rec], leads, state_path=state_path, live_send=True)

            self.assertEqual(res1["matched_alerts"], 1)
            self.assertEqual(res1["dispatched"], 1)
            self.assertEqual(len(sent_calls), 1)
            self.assertEqual(sent_calls[0][0], "alex@matchroom.example")
            self.assertIn("Anthony Joshua", sent_calls[0][1])
            self.assertEqual(len(webhook_calls), 1)
            self.assertEqual(webhook_calls[0][0], "https://hook.eu2.make.com/abc123")
            # Second run for same lead + video must be deduped
            self.assertEqual(res2["dispatched"], 0)
            self.assertEqual(res2["skipped_dedupe"], 1)

    def test_ssr_enrichment_parses_rehydration_warninfo(self):
        fake_rehyd = json.dumps({
            "__DEFAULT_SCOPE__": {
                "webapp.video-detail": {
                    "statusCode": 0,
                    "itemInfo": {
                        "itemStruct": {
                            "id": "7709208502949940500",
                            "desc": "Watch what happened to Anthony Joshua #maskedtruth",
                            "warnInfo": [{"text": "Caution: Video flagged for unverified content."}],
                            "penaltyContext": {"display_penalty_type": "2", "display_policy": 1},
                        }
                    },
                }
            }
        })
        fake_html = f'<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{fake_rehyd}</script></html>'

        def fake_fetch(url, headers=None, timeout=9, verify_ssl=True):
            return 200, url, {}, fake_html.encode("utf-8")

        raw = [("apify:apidojo~tiktok-scraper", {
            "id": "7709208502949940500",
            "postPage": "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
            "channel": {"username": "maskedtruthmt", "name": "maskedtruthmt"},
            "title": "Watch what happened to Anthony Joshua #maskedtruth",
        })]
        with patch.object(poller, "http_fetch", side_effect=fake_fetch):
            enriched = poller.enrich_items_with_tiktok_ssr(raw)
        rec = poller.extract_caution_record(enriched[0][1])
        self.assertIsNotNone(rec)
        self.assertEqual(rec["matchedField"], "warnInfo")
        self.assertIn("unverified content", rec["cautionText"].lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
