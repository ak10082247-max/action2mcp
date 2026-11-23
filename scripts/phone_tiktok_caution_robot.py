#!/usr/bin/env python3
"""
CautionWatch Robotic Android Phone / Emulator TikTok Crawler + Windows OCR Verifier.

Drives the native TikTok Android app on a USB-connected phone (e.g. moto g55 5G)
or Android emulator via `adb` + `android` CLI:
  1. Opens PolitiFact/IFCN fact-checked TikTok URLs, reported @handle profiles,
     and high-signal search feeds directly in the TikTok mobile app.
  2. Swipes robotically through videos (`adb shell input swipe`) and inspects
     every video using BOTH:
       - Android UI hierarchy dump (`android layout --full --flat` / `uiautomator`)
       - Windows native OCR (`Windows.Media.Ocr.OcrEngine`) on `adb exec-out screencap -p`
  3. Whenever the official `"Caution: Video flagged for unverified content"` banner
     is detected, extracts the video URL / ID / @handle / caption and immediately
     publishes the verified record to `https://brand-watch.ak10082247.workers.dev`
     and local `brand_watch/flagged_videos.json` + `brand_watch/seed_caution.js`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.poll_tiktok_caution import (
    BRAND_WATCH_URL,
    FLAGGED_JSON_PATH,
    SEED_JS_PATH,
    UNVERIFIED_CAUTION_RE,
    extract_caution_record,
    fetch_reported_accounts,
    harvest_free_factcheck_targets,
    http_fetch,
    load_flagged_videos,
    load_workspace_env,
    merge_caution_records,
    sync_records_to_worker,
    write_flagged_artifacts,
)

DEFAULT_ADB_PATHS = [
    os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"),
    r"C:\Users\AK\AppData\Local\Android\Sdk\platform-tools\adb.exe",
]
DEFAULT_ANDROID_CLI_PATHS = [
    r"C:\Users\AK\AppData\AndroidCLI\android.exe",
    os.path.expandvars(r"%USERPROFILE%\AppData\AndroidCLI\android.exe"),
]
TIKTOK_URL_IN_TEXT_RE = re.compile(
    r"https?://(?:www\.|m\.|vm\.|vt\.)?tiktok\.com/(?:@[A-Za-z0-9_.]+/video/\d+|[A-Za-z0-9_-]{6,20}/?)"
)


def resolve_adb_binary() -> str:
    found = shutil.which("adb")
    if found:
        return found
    for candidate in DEFAULT_ADB_PATHS:
        if os.path.isfile(candidate):
            return candidate
    raise FileNotFoundError("adb.exe not found. Run `android sdk install platform-tools`.")


def resolve_android_cli_binary() -> str | None:
    found = shutil.which("android")
    if found:
        return found
    for candidate in DEFAULT_ANDROID_CLI_PATHS:
        if os.path.isfile(candidate):
            return candidate
    return None


def list_adb_devices(adb_bin: str) -> list[tuple[str, str]]:
    """Return list of (serial, state) pairs from `adb devices`."""
    out = subprocess.check_output([adb_bin, "devices"], text=True, timeout=10)
    devices: list[tuple[str, str]] = []
    for line in out.splitlines()[1:]:
        stripped = line.strip()
        if not stripped or "\t" not in stripped:
            continue
        serial, state = stripped.split("\t", 1)
        devices.append((serial.strip(), state.strip()))
    return devices


def run_windows_ocr_on_png(png_path: str) -> str:
    """Run built-in Windows.Media.Ocr.OcrEngine on a screenshot PNG file."""
    if not os.path.isfile(png_path) or os.path.getsize(png_path) < 100:
        return ""
    safe_path = png_path.replace("'", "''")
    ps_ocr = (
        "Add-Type -AssemblyName System.Runtime.WindowsRuntime; "
        "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | "
        "Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and "
        "$_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]; "
        "Function Await($WinRtTask, $ResultType) { "
        "$asTask = $asTaskGeneric.MakeGenericMethod($ResultType); "
        "$netTask = $asTask.Invoke($null, @($WinRtTask)); "
        "$netTask.Wait(-1) | Out-Null; $netTask.Result }; "
        "[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null; "
        "[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null; "
        "[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime] | Out-Null; "
        f"$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('{safe_path}')) ([Windows.Storage.StorageFile]); "
        "$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream]); "
        "$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder]); "
        "$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap]); "
        "$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages(); "
        "$ocr = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult]); "
        "Write-Output $ocr.Text"
    )
    try:
        return subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", ps_ocr],
            text=True,
            timeout=15,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return ""


def inspect_device_screen_for_caution(
    adb_bin: str,
    serial: str,
    android_bin: str | None = None,
) -> dict:
    """
    Inspect the current phone screen via BOTH UI hierarchy dump and Windows OCR.
    Returns:
      {
        "matched": bool,
        "caution_text": str,
        "matched_via": "android_layout" | "uiautomator" | "windows_ocr" | "",
        "handle": str,
        "caption": str,
        "raw_text_blob": str,
      }
    """
    text_nodes: list[str] = []
    matched_via = ""

    # 1. Try `android layout --device <serial> --full --flat` first (fast structured JSON)
    if android_bin:
        try:
            layout_raw = subprocess.check_output(
                [android_bin, "layout", "--device", serial, "--full", "--flat", "--no-idle"],
                text=True,
                timeout=8,
                stderr=subprocess.DEVNULL,
            )
            nodes = json.loads(layout_raw)
            if isinstance(nodes, list):
                for n in nodes:
                    if not isinstance(n, dict):
                        continue
                    for key in ("text", "contentDesc"):
                        val = str(n.get(key) or "").strip()
                        if val:
                            text_nodes.append(val)
        except Exception:
            pass

    # 2. Fallback / supplement with `adb exec-out uiautomator dump /dev/tty`
    if not text_nodes:
        try:
            xml_raw = subprocess.check_output(
                [adb_bin, "-s", serial, "exec-out", "uiautomator", "dump", "/dev/tty"],
                text=True,
                timeout=8,
                stderr=subprocess.DEVNULL,
            )
            for attr_val in re.findall(r'(?:text|content-desc)="([^"]+)"', xml_raw):
                cleaned = attr_val.strip()
                if cleaned:
                    text_nodes.append(cleaned)
        except Exception:
            pass

    layout_blob = "\n".join(text_nodes)
    if UNVERIFIED_CAUTION_RE.search(layout_blob):
        matched_via = "android_layout"

    # 3. Always run Windows OCR on screenshot if layout didn't match (or to capture visual banner text)
    ocr_text = ""
    if not matched_via:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
            png_path = tf.name
        try:
            with open(png_path, "wb") as out_f:
                subprocess.run(
                    [adb_bin, "-s", serial, "exec-out", "screencap", "-p"],
                    stdout=out_f,
                    stderr=subprocess.DEVNULL,
                    timeout=8,
                )
            ocr_text = run_windows_ocr_on_png(png_path)
            if UNVERIFIED_CAUTION_RE.search(ocr_text):
                matched_via = "windows_ocr"
        finally:
            try:
                os.remove(png_path)
            except OSError:
                pass

    combined = f"{layout_blob}\n{ocr_text}".strip()
    handle = ""
    for m in re.findall(r"@([A-Za-z0-9_.]{3,32})", combined):
        if m.lower() not in ("tiktok", "for", "you", "following"):
            handle = m.lower()
            break

    caption_lines = [
        line.strip()
        for line in (text_nodes or ocr_text.splitlines())
        if len(line.strip()) >= 18
        and not UNVERIFIED_CAUTION_RE.search(line)
        and "participating in this activity" not in line.lower()
    ]
    caption = caption_lines[0] if caption_lines else ""

    return {
        "matched": bool(matched_via),
        "caution_text": "Caution: Video flagged for unverified content." if matched_via else "",
        "matched_via": matched_via,
        "handle": handle,
        "caption": caption[:280],
        "raw_text_blob": combined[:1500],
    }


def report_verified_clip_to_live_site(
    video_url: str,
    handle: str,
    caption: str,
    matched_via: str,
    worker_base: str = BRAND_WATCH_URL,
) -> dict | None:
    """Immediately publish a phone-verified Caution video to the live CautionWatch site."""
    m = re.search(r"tiktok\.com/@([A-Za-z0-9_.]{2,35})/video/(\d+)", video_url)
    clean_handle = (m.group(1) if m else handle).lstrip("@").lower() or "unknown"
    vid = m.group(2) if m else ""
    if not vid:
        return None

    raw_item = {
        "id": vid,
        "webVideoUrl": f"https://www.tiktok.com/@{clean_handle}/video/{vid}",
        "authorMeta": {"name": clean_handle, "nickName": clean_handle},
        "text": caption or f"Phone OCR verified Caution-flagged video by @{clean_handle}",
        "misc_info": json.dumps({
            "ktf_info": {
                "bottom_banner": True,
                "Caution": "Caution:",
                "warn_text": "Video flagged for unverified content.",
            }
        }),
        "brandTag": f"phone_verified:{matched_via}",
    }
    rec = extract_caution_record(raw_item, source_provider=f"phone_{matched_via}", query_tag=f"@{clean_handle}")
    if not rec:
        return None

    existing = load_flagged_videos(FLAGGED_JSON_PATH)
    merged, added = merge_caution_records(existing, [rec])
    write_flagged_artifacts(merged, FLAGGED_JSON_PATH, SEED_JS_PATH)
    sync_records_to_worker([rec], worker_base=worker_base)
    try:
        http_fetch(
            f"{worker_base}/api/report",
            method="POST",
            headers={"Content-Type": "application/json"},
            data=json.dumps({
                "url": rec["url"],
                "brandTag": rec.get("brandTag") or f"@{clean_handle}",
                "voiceToText": rec.get("description") or "",
                "cautionLabel": "Caution: Video flagged for unverified content",
            }).encode("utf-8"),
            timeout=15,
        )
    except Exception:
        pass
    return rec


def run_phone_robot(
    serial: str | None = None,
    swipes_per_profile: int = 12,
    max_direct_urls: int = 30,
    wait_seconds: int = 60,
) -> dict:
    load_workspace_env(REPO_ROOT)
    adb_bin = resolve_adb_binary()
    android_bin = resolve_android_cli_binary()

    deadline = time.time() + max(5, wait_seconds)
    active_serial = serial
    last_states: list[tuple[str, str]] = []
    while time.time() < deadline:
        last_states = list_adb_devices(adb_bin)
        online = [s for s, st in last_states if st == "device" and (not serial or s == serial)]
        if online:
            active_serial = online[0]
            break
        time.sleep(2)

    if not active_serial:
        return {
            "ok": False,
            "error": "No authorized Android device detected over ADB.",
            "devices_seen": last_states,
            "instructions": (
                "Unlock your moto g55 5G, keep USB Debugging enabled in Developer Options, "
                "set USB mode to File Transfer (MTP) / PTP, and tap 'Always allow from this computer' -> 'Allow' "
                "on the 'Allow USB debugging?' prompt."
            ),
        }

    # Keep screen awake while plugged in
    subprocess.run([adb_bin, "-s", active_serial, "shell", "svc", "power", "stayon", "usb"], stderr=subprocess.DEVNULL)

    fc_urls, fc_handles = harvest_free_factcheck_targets(max_articles=45)
    reported_accts = fetch_reported_accounts(BRAND_WATCH_URL)

    candidate_urls: list[str] = ["https://www.tiktok.com/@maskedtruthmt/video/7702510622650518817"]
    for u in fc_urls:
        if u not in candidate_urls:
            candidate_urls.append(u)

    verified_records: list[dict] = []
    inspected_count = 0

    # Phase 1: Open direct candidate TikTok video URLs in the TikTok mobile app & verify banner via UI dump + OCR
    for url in candidate_urls[:max_direct_urls]:
        subprocess.run(
            [adb_bin, "-s", active_serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=8,
        )
        time.sleep(4.0)
        inspected_count += 1
        res = inspect_device_screen_for_caution(adb_bin, active_serial, android_bin)
        if res["matched"]:
            rec = report_verified_clip_to_live_site(
                video_url=url,
                handle=res["handle"],
                caption=res["caption"],
                matched_via=res["matched_via"],
            )
            if rec:
                verified_records.append(rec)

    # Phase 2: Open monitored/reported @handle profiles & swipe through their videos
    profile_queue: list[str] = []
    for a in reported_accts:
        h = str(a.get("handle") or "").strip().lstrip("@").lower()
        if h and h not in profile_queue:
            profile_queue.append(h)
    for h in fc_handles:
        clean_h = h.lstrip("@").lower()
        if clean_h and clean_h not in profile_queue:
            profile_queue.append(clean_h)

    for handle in profile_queue[:10]:
        prof_url = f"https://www.tiktok.com/@{handle}"
        subprocess.run(
            [adb_bin, "-s", active_serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", prof_url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=8,
        )
        time.sleep(4.0)
        # Tap first video tile on the creator's profile grid (left column, middle-lower screen)
        subprocess.run(
            [adb_bin, "-s", active_serial, "shell", "input", "tap", "200", "1350"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        time.sleep(3.0)
        for _ in range(swipes_per_profile):
            inspected_count += 1
            res = inspect_device_screen_for_caution(adb_bin, active_serial, android_bin)
            if res["matched"]:
                # Copy link via Share or logcat aweme_id extraction
                log_raw = subprocess.check_output(
                    [adb_bin, "-s", active_serial, "logcat", "-d", "-t", "250"],
                    text=True,
                    timeout=8,
                    stderr=subprocess.DEVNULL,
                )
                id_matches = re.findall(r"(?:aweme_id|group_id|item_id)[=:\"\s]+(\d{18,20})", log_raw)
                if id_matches:
                    vid_id = id_matches[-1]
                    v_url = f"https://www.tiktok.com/@{handle}/video/{vid_id}"
                    rec = report_verified_clip_to_live_site(
                        video_url=v_url,
                        handle=handle,
                        caption=res["caption"],
                        matched_via=res["matched_via"],
                    )
                    if rec:
                        verified_records.append(rec)
            # Swipe up to the next video on this profile
            subprocess.run(
                [adb_bin, "-s", active_serial, "shell", "input", "swipe", "540", "1650", "540", "350", "380"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
            time.sleep(2.8)

    return {
        "ok": True,
        "device_serial": active_serial,
        "videos_inspected_on_phone": inspected_count,
        "caution_videos_found": len(verified_records),
        "verified_records": verified_records,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CautionWatch Robotic Android Phone TikTok Crawler + OCR Verifier.")
    parser.add_argument("--serial", default=None, help="Specific ADB device serial (e.g. ZY22L8LM57).")
    parser.add_argument("--swipes-per-profile", type=int, default=12)
    parser.add_argument("--max-direct-urls", type=int, default=25)
    parser.add_argument("--wait-seconds", type=int, default=15)
    args = parser.parse_args(argv)
    result = run_phone_robot(
        serial=args.serial,
        swipes_per_profile=args.swipes_per_profile,
        max_direct_urls=args.max_direct_urls,
        wait_seconds=args.wait_seconds,
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
