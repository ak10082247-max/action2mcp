#!/usr/bin/env python3
"""
CautionWatch Robotic Android Phone / Emulator TikTok Crawler + Cropped OCR & Share-Modal Extractor.

Implements the complete Android ADB + UI XML + Cropped Top-20% OCR + Share Warning Modal pipeline:
  1. Connects to your Android phone (e.g. moto g55 5G) or emulator over USB ADB or
     Wireless Debugging (`--pair IP:PORT --pair-code CODE --connect IP:PORT`).
  2. Trains & navigates TikTok by opening PolitiFact/IFCN fact-checked TikTok URLs,
     monitored @handle profiles, and high-signal unverified-claim search feeds.
  3. On every video:
     - Shortcut 1 (10x faster): Reads the Android UI XML dump (`android layout --full --flat`
       or `adb exec-out uiautomator dump /dev/tty`) for `"Caution: Video flagged for unverified content"`.
     - Shortcut 2 (Visual fallback): Streams `adb exec-out screencap -p`, crops the top 22%
       banner region where TikTok renders the grey Caution bar, and runs Windows Native OCR
       (`Windows.Media.Ocr.OcrEngine`).
  4. When a Caution video is detected during swiping:
     - Taps the Share arrow on the bottom right.
     - Automatically detects & clicks through TikTok's `"Are you sure you want to share this video?"`
       warning modal (`"Continue"` / `"Share anyway"`).
     - Taps `"Copy link"` and reads the URL from the device clipboard (`cmd clipboard get-text`)
       or logcat `aweme_id`.
  5. Appends the verified video to `brand_watch/flagged_videos.json` & `brand_watch/seed_caution.js`,
     POSTs it live to `https://brand-watch.ak10082247.workers.dev/api/report`, and optionally runs
     `git commit` & `git push` so the archive updates everywhere automatically.
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
    r"https?://(?:www\.|m\.|vm\.|vt\.)?tiktok\.com/(?:@[A-Za-z0-9_.]+/video/\d+|[A-Za-z0-9_-]{6,22}/?)"
)
BOUNDS_RE = re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")


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
    out = subprocess.check_output([adb_bin, "devices"], text=True, timeout=10)
    devices: list[tuple[str, str]] = []
    for line in out.splitlines()[1:]:
        stripped = line.strip()
        if not stripped or "\t" not in stripped:
            continue
        serial, state = stripped.split("\t", 1)
        devices.append((serial.strip(), state.strip()))
    return devices


def pair_and_connect_wireless_adb(
    adb_bin: str,
    pair_host_port: str | None = None,
    pair_code: str | None = None,
    connect_host_port: str | None = None,
) -> dict:
    info: dict = {}
    if pair_host_port and pair_code:
        out = subprocess.check_output(
            [adb_bin, "pair", pair_host_port.strip(), pair_code.strip()],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=15,
        )
        info["pair_output"] = out.strip()
    if connect_host_port:
        out = subprocess.check_output(
            [adb_bin, "connect", connect_host_port.strip()],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=15,
        )
        info["connect_output"] = out.strip()
    return info


def run_windows_ocr_on_png(png_path: str, crop_top_ratio: float = 0.0) -> str:
    """
    Run built-in Windows.Media.Ocr.OcrEngine on a screenshot PNG file.
    When crop_top_ratio > 0 (e.g. 0.25), crops only the top 25% of the screen
    where TikTok's grey 'Caution: Video flagged for unverified content.' banner sits,
    making OCR faster and eliminating background noise.
    """
    if not os.path.isfile(png_path) or os.path.getsize(png_path) < 100:
        return ""
    target_path = png_path
    cropped_temp = None
    if 0.05 <= crop_top_ratio < 1.0:
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
                cropped_temp = tf.name
            safe_in = png_path.replace("'", "''")
            safe_out = cropped_temp.replace("'", "''")
            ps_crop = (
                "Add-Type -AssemblyName System.Drawing; "
                f"$bmp = [System.Drawing.Bitmap]::FromFile('{safe_in}'); "
                f"$h = [Math]::Max(80, [int]($bmp.Height * {crop_top_ratio:.2f})); "
                "$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $h); "
                "$crop = $bmp.Clone($rect, $bmp.PixelFormat); "
                f"$crop.Save('{safe_out}', [System.Drawing.Imaging.ImageFormat]::Png); "
                "$crop.Dispose(); $bmp.Dispose();"
            )
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_crop],
                timeout=8,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )
            if os.path.isfile(cropped_temp) and os.path.getsize(cropped_temp) > 100:
                target_path = cropped_temp
        except Exception:
            target_path = png_path

    safe_path = target_path.replace("'", "''")
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
    finally:
        if cropped_temp:
            try:
                os.remove(cropped_temp)
            except OSError:
                pass


def dump_ui_elements(adb_bin: str, serial: str, android_bin: str | None = None) -> list[dict]:
    """
    Dump structured UI elements with text, contentDesc, and center (x, y) coordinates.
    Uses `android layout` first and falls back to `adb exec-out uiautomator dump /dev/tty`.
    """
    elements: list[dict] = []
    if android_bin:
        try:
            raw = subprocess.check_output(
                [android_bin, "layout", "--device", serial, "--full", "--flat", "--no-idle"],
                text=True,
                timeout=8,
                stderr=subprocess.DEVNULL,
            )
            nodes = json.loads(raw)
            if isinstance(nodes, list):
                for n in nodes:
                    if not isinstance(n, dict):
                        continue
                    bounds = str(n.get("bounds") or "")
                    center = None
                    m = BOUNDS_RE.search(bounds)
                    if m:
                        x1, y1, x2, y2 = map(int, m.groups())
                        center = ((x1 + x2) // 2, (y1 + y2) // 2)
                    elements.append({
                        "text": str(n.get("text") or "").strip(),
                        "contentDesc": str(n.get("contentDesc") or "").strip(),
                        "resourceId": str(n.get("resourceId") or "").strip(),
                        "bounds": bounds,
                        "center": center,
                    })
        except Exception:
            pass

    if not elements:
        try:
            xml_raw = subprocess.check_output(
                [adb_bin, "-s", serial, "exec-out", "uiautomator", "dump", "/dev/tty"],
                text=True,
                timeout=8,
                stderr=subprocess.DEVNULL,
            )
            for node_match in re.finditer(r"<node\s+([^>]+)>", xml_raw):
                attrs = node_match.group(1)
                txt_m = re.search(r'text="([^"]*)"', attrs)
                desc_m = re.search(r'content-desc="([^"]*)"', attrs)
                id_m = re.search(r'resource-id="([^"]*)"', attrs)
                b_m = re.search(r'bounds="(\[\d+,\d+\]\[\d+,\d+\])"', attrs)
                bounds = b_m.group(1) if b_m else ""
                center = None
                if bounds:
                    bm = BOUNDS_RE.search(bounds)
                    if bm:
                        x1, y1, x2, y2 = map(int, bm.groups())
                        center = ((x1 + x2) // 2, (y1 + y2) // 2)
                elements.append({
                    "text": (txt_m.group(1) if txt_m else "").strip(),
                    "contentDesc": (desc_m.group(1) if desc_m else "").strip(),
                    "resourceId": (id_m.group(1) if id_m else "").strip(),
                    "bounds": bounds,
                    "center": center,
                })
        except Exception:
            pass
    return elements


def find_element_center(elements: list[dict], pattern: re.Pattern[str]) -> tuple[int, int] | None:
    for el in elements:
        hay = f"{el.get('text', '')} {el.get('contentDesc', '')} {el.get('resourceId', '')}"
        if pattern.search(hay) and el.get("center"):
            return el["center"]
    return None


def inspect_device_screen_for_caution(
    adb_bin: str,
    serial: str,
    android_bin: str | None = None,
) -> dict:
    """
    1. Fast UI XML check (`android layout` / `uiautomator dump`).
    2. Cropped Top-25% Banner OCR check + Full screen OCR fallback.
    """
    elements = dump_ui_elements(adb_bin, serial, android_bin)
    text_nodes = [
        val
        for el in elements
        for val in (el.get("text", ""), el.get("contentDesc", ""))
        if val
    ]
    layout_blob = "\n".join(text_nodes)
    matched_via = "android_xml_layout" if UNVERIFIED_CAUTION_RE.search(layout_blob) else ""

    ocr_top_text = ""
    ocr_full_text = ""
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
            # First run OCR on top 25% banner slice (fast, zero caption noise)
            ocr_top_text = run_windows_ocr_on_png(png_path, crop_top_ratio=0.25)
            if UNVERIFIED_CAUTION_RE.search(ocr_top_text):
                matched_via = "windows_ocr_top_crop"
            else:
                ocr_full_text = run_windows_ocr_on_png(png_path, crop_top_ratio=0.0)
                if UNVERIFIED_CAUTION_RE.search(ocr_full_text):
                    matched_via = "windows_ocr_full"
        finally:
            try:
                os.remove(png_path)
            except OSError:
                pass

    combined = f"{layout_blob}\n{ocr_top_text}\n{ocr_full_text}".strip()
    handle = ""
    for m in re.findall(r"@([A-Za-z0-9_.]{3,32})", combined):
        if m.lower() not in ("tiktok", "for", "you", "following"):
            handle = m.lower()
            break

    caption_lines = [
        line.strip()
        for line in (text_nodes or ocr_full_text.splitlines())
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
        "elements": elements,
        "raw_text_blob": combined[:1500],
    }


def extract_video_url_via_share_modal(
    adb_bin: str,
    serial: str,
    elements: list[dict],
    fallback_handle: str = "",
    android_bin: str | None = None,
) -> str:
    """
    Automate TikTok's Share -> Unverified Share Confirmation Modal ('Continue' / 'Share anyway') -> Copy Link -> Clipboard / Logcat.
    """
    # 1. Tap Share button on right rail
    share_xy = find_element_center(elements, re.compile(r"\bshare\b", re.I)) or (990, 1460)
    subprocess.run(
        [adb_bin, "-s", serial, "shell", "input", "tap", str(share_xy[0]), str(share_xy[1])],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=5,
    )
    time.sleep(1.6)

    # 2. Check if TikTok popped up "Are you sure you want to share this video?" warning modal
    modal_elements = dump_ui_elements(adb_bin, serial, android_bin)
    continue_xy = find_element_center(
        modal_elements,
        re.compile(r"(?:share\s+anyway|continue|proceed)", re.I),
    )
    if continue_xy:
        subprocess.run(
            [adb_bin, "-s", serial, "shell", "input", "tap", str(continue_xy[0]), str(continue_xy[1])],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        time.sleep(1.4)
        modal_elements = dump_ui_elements(adb_bin, serial, android_bin)

    # 3. Tap "Copy link"
    copy_xy = find_element_center(modal_elements, re.compile(r"copy\s*link", re.I)) or (180, 1750)
    subprocess.run(
        [adb_bin, "-s", serial, "shell", "input", "tap", str(copy_xy[0]), str(copy_xy[1])],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=5,
    )
    time.sleep(1.2)

    # 4. Read copied URL from Android clipboard or logcat
    for clip_cmd in (
        [adb_bin, "-s", serial, "shell", "cmd", "clipboard", "get-text"],
        [adb_bin, "-s", serial, "shell", "am", "broadcast", "-a", "clipper.get"],
    ):
        try:
            clip_out = subprocess.check_output(clip_cmd, text=True, timeout=5, stderr=subprocess.DEVNULL)
            url_m = TIKTOK_URL_IN_TEXT_RE.search(clip_out)
            if url_m:
                raw_u = url_m.group(0)
                if "/video/" in raw_u:
                    return raw_u
                # Resolve shortlink (vm.tiktok.com / vt.tiktok.com)
                st, final_u, _, _ = http_fetch(raw_u, timeout=10)
                if "/video/" in final_u:
                    return final_u.split("?")[0]
        except Exception:
            pass

    # 5. Fallback: extract aweme_id / group_id from recent logcat buffer
    try:
        log_raw = subprocess.check_output(
            [adb_bin, "-s", serial, "logcat", "-d", "-t", "350"],
            text=True,
            timeout=8,
            stderr=subprocess.DEVNULL,
        )
        url_m = re.search(r"https?://(?:www\.)?tiktok\.com/@[A-Za-z0-9_.]+/video/\d{18,20}", log_raw)
        if url_m:
            return url_m.group(0)
        id_matches = re.findall(r"(?:aweme_id|group_id|item_id)[=:\"\s]+(\d{18,20})", log_raw)
        if id_matches:
            clean_h = fallback_handle.lstrip("@").lower() or "tiktok"
            return f"https://www.tiktok.com/@{clean_h}/video/{id_matches[-1]}"
    except Exception:
        pass
    return ""


def report_verified_clip_to_live_site(
    video_url: str,
    handle: str,
    caption: str,
    matched_via: str,
    worker_base: str = BRAND_WATCH_URL,
    auto_git_push: bool = False,
) -> dict | None:
    """Immediately publish a phone-verified Caution video to the live CautionWatch site & local JSON archive."""
    m = re.search(r"tiktok\.com/@([A-Za-z0-9_.]{2,35})/video/(\d+)", video_url)
    clean_handle = (m.group(1) if m else handle).lstrip("@").lower() or "unknown"
    vid = m.group(2) if m else ""
    if not vid:
        return None

    raw_item = {
        "id": vid,
        "webVideoUrl": f"https://www.tiktok.com/@{clean_handle}/video/{vid}",
        "authorMeta": {"name": clean_handle, "nickName": clean_handle},
        "text": caption or f"Phone verified Caution-flagged video by @{clean_handle}",
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

    if auto_git_push and added:
        try:
            subprocess.run(
                ["git", "add", "brand_watch/flagged_videos.json", "brand_watch/seed_caution.js"],
                cwd=str(REPO_ROOT),
                timeout=10,
                check=False,
            )
            subprocess.run(
                ["git", "commit", "-m", f"chore(brand-watch): archive phone-verified Caution video {vid} (@{clean_handle})"],
                cwd=str(REPO_ROOT),
                timeout=15,
                check=False,
            )
            subprocess.run(["git", "push", "origin", "main"], cwd=str(REPO_ROOT), timeout=30, check=False)
        except Exception:
            pass
    return rec


def run_phone_robot(
    serial: str | None = None,
    swipes_per_profile: int = 12,
    max_direct_urls: int = 30,
    wait_seconds: int = 20,
    pair_host_port: str | None = None,
    pair_code: str | None = None,
    connect_host_port: str | None = None,
    auto_git_push: bool = True,
) -> dict:
    load_workspace_env(REPO_ROOT)
    adb_bin = resolve_adb_binary()
    android_bin = resolve_android_cli_binary()

    wireless_info = pair_and_connect_wireless_adb(
        adb_bin,
        pair_host_port=pair_host_port,
        pair_code=pair_code,
        connect_host_port=connect_host_port,
    )

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
            "wireless": wireless_info,
            "devices_seen": last_states,
            "instructions": (
                "Windows shows USB\\VID_22B8&PID_2E76\\ZY22L8LM57 as disconnected (CM_PROB_PHANTOM). "
                "Either: (A) Plug the USB cable into a different USB port on your laptop, choose 'File Transfer' on the phone, "
                "and tap 'Allow' on 'Allow USB debugging?'; OR (B) On your moto g55 5G open Settings -> Developer options -> "
                "Wireless debugging -> Pair device with pairing code, and send me the IP:Port and 6-digit pairing code."
            ),
        }

    subprocess.run([adb_bin, "-s", active_serial, "shell", "svc", "power", "stayon", "usb"], stderr=subprocess.DEVNULL)

    fc_urls, fc_handles = harvest_free_factcheck_targets(max_articles=45)
    reported_accts = fetch_reported_accounts(BRAND_WATCH_URL)

    candidate_urls: list[str] = ["https://www.tiktok.com/@maskedtruthmt/video/7702510622650518817"]
    for u in fc_urls:
        if u not in candidate_urls:
            candidate_urls.append(u)

    verified_records: list[dict] = []
    inspected_count = 0

    # Phase 1: Direct deep-link verification of fact-checked TikTok URLs
    for url in candidate_urls[:max_direct_urls]:
        subprocess.run(
            [adb_bin, "-s", active_serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=8,
        )
        time.sleep(3.8)
        inspected_count += 1
        res = inspect_device_screen_for_caution(adb_bin, active_serial, android_bin)
        if res["matched"]:
            rec = report_verified_clip_to_live_site(
                video_url=url,
                handle=res["handle"],
                caption=res["caption"],
                matched_via=res["matched_via"],
                auto_git_push=auto_git_push,
            )
            if rec:
                verified_records.append(rec)

    # Phase 2: Robotic Profile Grid Swiping + Share-Warning Modal Link Extraction
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
        time.sleep(3.8)
        subprocess.run(
            [adb_bin, "-s", active_serial, "shell", "input", "tap", "200", "1350"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        time.sleep(2.8)
        for _ in range(swipes_per_profile):
            inspected_count += 1
            res = inspect_device_screen_for_caution(adb_bin, active_serial, android_bin)
            if res["matched"]:
                v_url = extract_video_url_via_share_modal(
                    adb_bin,
                    active_serial,
                    res.get("elements") or [],
                    fallback_handle=res["handle"] or handle,
                    android_bin=android_bin,
                )
                if v_url:
                    rec = report_verified_clip_to_live_site(
                        video_url=v_url,
                        handle=res["handle"] or handle,
                        caption=res["caption"],
                        matched_via=res["matched_via"],
                        auto_git_push=auto_git_push,
                    )
                    if rec:
                        verified_records.append(rec)
            subprocess.run(
                [adb_bin, "-s", active_serial, "shell", "input", "swipe", "540", "1650", "540", "350", "380"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
            time.sleep(2.5)

    return {
        "ok": True,
        "device_serial": active_serial,
        "videos_inspected_on_phone": inspected_count,
        "caution_videos_found": len(verified_records),
        "verified_records": verified_records,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CautionWatch Robotic Android Phone TikTok Crawler + Cropped OCR Verifier.")
    parser.add_argument("--serial", default=None, help="Specific ADB device serial (e.g. ZY22L8LM57).")
    parser.add_argument("--pair", default=None, help="Wireless ADB pairing IP:Port (e.g. 192.168.1.50:37123).")
    parser.add_argument("--pair-code", default=None, help="6-digit Wireless ADB pairing code.")
    parser.add_argument("--connect", default=None, help="Wireless ADB connect IP:Port.")
    parser.add_argument("--swipes-per-profile", type=int, default=12)
    parser.add_argument("--max-direct-urls", type=int, default=25)
    parser.add_argument("--wait-seconds", type=int, default=10)
    parser.add_argument("--no-git-push", action="store_true")
    args = parser.parse_args(argv)
    result = run_phone_robot(
        serial=args.serial,
        swipes_per_profile=args.swipes_per_profile,
        max_direct_urls=args.max_direct_urls,
        wait_seconds=args.wait_seconds,
        pair_host_port=args.pair,
        pair_code=args.pair_code,
        connect_host_port=args.connect,
        auto_git_push=not args.no_git_push,
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
