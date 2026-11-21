import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gpt_action_sniper as sniper


class SniperUnitTest(unittest.TestCase):
    def test_blocks_noreply_and_trap_emails(self):
        self.assertFalse(sniper.is_deliverable_email("12345+user@users.noreply.github.com"))
        self.assertFalse(sniper.is_deliverable_email("noreply@example.com"))
        self.assertFalse(sniper.is_deliverable_email("student@mit.edu"))
        self.assertFalse(sniper.is_deliverable_email("41151138@comunidadort.edu.ar"))
        self.assertFalse(sniper.is_deliverable_email("your@email.com"))
        self.assertFalse(sniper.is_deliverable_email("xxx@xxx.xxx"))
        with patch.object(sniper, "has_valid_mx", return_value=True):
            self.assertTrue(sniper.is_deliverable_email("founder@customgpt-app.io"))

    def test_discover_and_compile_gpt_actions_excludes_dumps_and_compiles_valid_specs(self):
        sample_yaml = """
openapi: "3.1.0"
info:
  title: Forex Rate Action
  version: "1.0.0"
servers:
  - url: https://api.forex-gpt.example.com
paths:
  /rates:
    get:
      operationId: getLatestRates
      x-openai-isConsequential: false
"""

        def fake_get_json(url, headers=None, timeout=12):
            if "/search/code?" in url:
                return {
                    "items": [
                        {
                            "repository": {"full_name": "LouisShark/chatgpt_system_prompt"},
                            "path": "prompts/test.json",
                            "url": "https://api.github.com/skip",
                        },
                        {
                            "repository": {"full_name": "hatgit/forex-gpt"},
                            "path": "openapi.yaml",
                            "url": "https://api.github.com/repos/hatgit/forex-gpt/contents/openapi.yaml",
                            "html_url": "https://github.com/hatgit/forex-gpt/blob/main/openapi.yaml",
                        },
                    ]
                }
            if url.endswith("/contents/openapi.yaml"):
                return {"download_url": "https://raw.githubusercontent.com/hatgit/forex-gpt/main/openapi.yaml"}
            if "/users/" in url:
                return {"name": "Alice Trader", "email": "alice@forex-gpt.io"}
            return {}

        with patch.object(sniper, "_http_get_json", side_effect=fake_get_json), \
             patch.object(sniper, "_http_get_text", return_value=sample_yaml), \
             patch.object(sniper, "has_valid_mx", return_value=True), \
             patch.object(sniper, "_http_post_json", return_value={
                 "ok": True,
                 "title": "Forex Rate Action",
                 "openapi_version": "3.1.0",
                 "base_url": "https://api.forex-gpt.example.com",
                 "tool_count": 1,
                 "consequential_count": 0,
                 "tools": [{"name": "get_latest_rates"}],
                 "warnings": [],
             }):
            found = sniper.discover_and_compile_gpt_actions(limit=5, api_base="http://127.0.0.1:8787", gh_token="tok")

        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["repo"], "hatgit/forex-gpt")
        self.assertEqual(found[0]["tool_names"], ["get_latest_rates"])
        self.assertEqual(found[0]["owner_email"], "alice@forex-gpt.io")

        subj, body = sniper.craft_sniper_email(found[0])
        self.assertIn("Your Custom GPT Action in forex-gpt breaks Dec 11", subj)
        self.assertIn("get_latest_rates", body)
        self.assertIn("100% free", body)
        self.assertIn("/t?play=action2mcp", body)
        self.assertIn("spec_url%3D", body)
        self.assertIn("tier%3Dhosted", body)
        self.assertIn("$10", body)
        self.assertIn("$25", body)
        self.assertIn("$40", body)
        self.assertIn("fiverr.com%2Fs%2F2pQja04", body)
        self.assertIn('reply "hosted"', body)
        self.assertNotIn("tier=bundle", body)


if __name__ == "__main__":
    unittest.main()
