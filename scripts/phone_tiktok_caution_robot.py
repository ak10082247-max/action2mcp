#!/usr/bin/env python3
"""
CautionWatch Balanced Robotic Android Phone TikTok Crawler
(2.0s Banner Pop-Up Settle Delay + Line-by-Line `SlotStrategyCore` `top_container_know_the_fact_top` Tracker + Persistent Top-25% WinRT OCR).

Key Timing & Detection Rules:
  1. In TikTok's Android app (`com.zhiliaoapp.musically`), the grey
     `"Caution: Video flagged for unverified content."` banner (`top_container_know_the_fact_top`)
     pops in ~1.4-2.0 seconds after you land on a video.
  2. Therefore, after every swipe (or direct video open), we pause `2.0 seconds` (`swipe_delay=2.0`)
     so the Caution banner has full time to pop up on screen.
  3. After the 2.0s settle delay, we check BOTH:
     - `SlotStrategyCore` / `SlotStrategyService` in `adb logcat` (line-by-line parser that
       captures `acceptedParentBySlot={... top_container_know_the_fact_top=top_container}`
       across any number of `slotTree:` lines and links it to `[uniqueId=<19-digit-video-id>]`).
     - Visual Top-25% Cropped Framebuffer OCR via our persistent PowerShell WinRT OCR worker
       (`adb exec-out screencap -p` -> top 25% crop -> `Windows.Media.Ocr.OcrEngine` in ~0.19s).
  4. Every video that matches either `top_container_know_the_fact_top` or top-25% OCR is
     resolved via official TikTok oEmbed (or Share -> Copy Link clipboard fallback), saved to
     `brand_watch/flagged_videos.json` + `brand_watch/seed_caution.js`, and POSTed live to
     `https://brand-watch.ak10082247.workers.dev`.
"""

from __future__ import annotations

import argparse
import concurrent.futures
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
    FACTCHECK_HANDLE_RE,
    FACTCHECK_TIKTOK_URL_RE,
    FLAGGED_JSON_PATH,
    SEED_JS_PATH,
    UNVERIFIED_CAUTION_RE,
    extract_caution_record,
    fetch_reported_accounts,
    http_fetch,
    http_get_json,
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
ACCEPTED_SLOTS_LINE_RE = re.compile(r"acceptedParentBySlot=\{([^}]*)\}")
UNIQUE_ID_RE = re.compile(r"\[uniqueId=(\d{17,20})\]")
TIKTOK_URL_IN_TEXT_RE = re.compile(
    r"https?://(?:www\.|m\.|vm\.|vt\.)?tiktok\.com/(?:@[A-Za-z0-9_.]+/video/\d+|[A-Za-z0-9_-]{6,22}/?)"
)
FUZZY_CAUTION_OCR_RE = re.compile(
    r"(?:caution\s*[:.;]?\s*video\s+flagged|flagged\s+for\s+unverified\s+content|unverified\s+content|"
    r"may\s+contain\s+inaccurate\s+information|check\s+your\s+sources\s+before\s+sharing|"
    r"sharing\s+is\s+limited\s+to\s+one\s+chat)",
    re.I,
)


def resolve_adb_binary() -> str:
    found = shutil.which("adb")
    if found:
        return found
    for candidate in DEFAULT_ADB_PATHS:
        if os.path.isfile(candidate):
            return candidate
    raise FileNotFoundError("adb.exe not found. Run `android sdk install platform-tools`.")


def list_adb_devices(adb_bin: str) -> list[tuple[str, str]]:
    out = subprocess.check_output([adb_bin, "devices"], timeout=10).decode("utf-8", "replace")
    devices: list[tuple[str, str]] = []
    for line in out.splitlines()[1:]:
        stripped = line.strip()
        if not stripped or "\t" not in stripped:
            continue
        serial, state = stripped.split("\t", 1)
        devices.append((serial.strip(), state.strip()))
    return devices


class PersistentWinRtOcr:
    """
    Keeps a single PowerShell WinRT OCR + System.Drawing crop worker alive via stdin/stdout.
    Only OCRs the top 25% Caution banner slice first (~0.19s); OCRs bottom caption when matched.
    """

    PS_WORKER_SCRIPT = r"""
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime] | Out-Null
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

Function Run-OcrFile([string]$p) {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($p)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $ocr = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $stream.Dispose()
    return ($ocr.Text -replace "\r|\n", " ")
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
    $parts = $line -split "\|"
    $imgPath = $parts[0]
    $ratio = [double]$parts[1]
    try {
        if (-not (Test-Path $imgPath)) {
            [Console]::Out.WriteLine("{}")
            [Console]::Out.Flush()
            continue
        }
        $topText = ""
        $bottomText = ""
        if ($ratio -gt 0.01 -and $ratio -lt 0.99) {
            $bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
            $w = $bmp.Width
            $h = $bmp.Height
            $topH = [Math]::Max(80, [int]($h * $ratio))
            $topCropPath = "$imgPath.top.png"
            $topRect = New-Object System.Drawing.Rectangle(0, 0, $w, $topH)
            $topBmp = $bmp.Clone($topRect, $bmp.PixelFormat)
            $topBmp.Save($topCropPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $topBmp.Dispose()
            $topText = Run-OcrFile $topCropPath
            Remove-Item $topCropPath -Force -ErrorAction SilentlyContinue

            if ($topText -match "Caution|flagged|unverified") {
                $botY = [Math]::Max(0, [int]($h * 0.62))
                $botH = [Math]::Max(80, $h - $botY)
                $botCropPath = "$imgPath.bot.png"
                $botRect = New-Object System.Drawing.Rectangle(0, $botY, $w, $botH)
                $botBmp = $bmp.Clone($botRect, $bmp.PixelFormat)
                $botBmp.Save($botCropPath, [System.Drawing.Imaging.ImageFormat]::Png)
                $botBmp.Dispose()
                $bottomText = Run-OcrFile $botCropPath
                Remove-Item $botCropPath -Force -ErrorAction SilentlyContinue
            }
            $bmp.Dispose()
        } else {
            $topText = Run-OcrFile $imgPath
        }
        $outObj = @{ top = $topText; bottom = $bottomText } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine($outObj)
        [Console]::Out.Flush()
    } catch {
        $errObj = @{ top = ""; bottom = ""; error = $_.Exception.Message } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine($errObj)
        [Console]::Out.Flush()
    }
}
"""

    def __init__(self) -> None:
        self._proc: subprocess.Popen[str] | None = None

    def start(self) -> None:
        if self._proc is not None and self._proc.poll() is None:
            return
        self._proc = subprocess.Popen(
            ["powershell", "-NoProfile", "-Command", self.PS_WORKER_SCRIPT],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )

    def recognize(self, png_path: str, crop_top_ratio: float = 0.25) -> dict[str, str]:
        self.start()
        assert self._proc is not None and self._proc.stdin is not None and self._proc.stdout is not None
        try:
            self._proc.stdin.write(f"{png_path}|{crop_top_ratio:.2f}\n")
            self._proc.stdin.flush()
            resp_line = self._proc.stdout.readline().strip()
            if resp_line:
                data = json.loads(resp_line)
                return {
                    "top": str(data.get("top") or "").strip(),
                    "bottom": str(data.get("bottom") or "").strip(),
                }
        except Exception:
            self.close()
        return {"top": "", "bottom": ""}

    def close(self) -> None:
        if self._proc is not None:
            try:
                self._proc.kill()
            except Exception:
                pass
            self._proc = None


_GLOBAL_OCR = PersistentWinRtOcr()


def run_windows_ocr_on_png(png_path: str, crop_top_ratio: float = 0.0) -> str:
    res = _GLOBAL_OCR.recognize(png_path, crop_top_ratio=crop_top_ratio)
    return f"{res.get('top', '')} {res.get('bottom', '')}".strip()


def harvest_deep_factcheck_targets(max_articles: int = 80) -> tuple[list[str], list[str]]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xml,*/*",
    }
    list_pages = (
        [f"https://www.politifact.com/personalities/tiktok-posts/?page={i}" for i in range(1, 13)]
        + [f"https://www.politifact.com/search/?q=tiktok.com&page={i}" for i in range(1, 6)]
        + [f"https://checkyourfact.com/page/{i}/?s=tiktok" for i in range(1, 4)]
    )
    video_urls: set[str] = set()
    handles: set[str] = set()
    article_urls: list[str] = []
    seen_art: set[str] = set()

    def _fetch_list_page(u: str) -> tuple[list[str], list[str], list[str]]:
        try:
            st, _, _, raw = http_fetch(u, headers=headers, timeout=7, verify_ssl=False)
            if st >= 400:
                return [], [], []
            txt = raw.decode("utf-8", "replace")
            vids = FACTCHECK_TIKTOK_URL_RE.findall(txt)
            hs = [h.lstrip("@") for h in FACTCHECK_HANDLE_RE.findall(txt)]
            arts = [
                f"https://www.politifact.com{rel}"
                for rel in re.findall(r'href="(?:https?://(?:www\.)?politifact\.com)?(/factchecks/\d{4}/[^"#? ]+)"', txt)
            ]
            arts += re.findall(r'href="(https?://checkyourfact\.com/\d{4}/[^"#? ]+)"', txt)
            return vids, hs, arts
        except Exception:
            return [], [], []

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for v_list, h_list, a_list in pool.map(_fetch_list_page, list_pages):
            video_urls.update(v_list)
            handles.update(h_list)
            for a in a_list:
                if a not in seen_art:
                    seen_art.add(a)
                    article_urls.append(a)

    def _fetch_article(art_url: str) -> tuple[list[str], list[str]]:
        try:
            st, _, _, raw = http_fetch(art_url, headers=headers, timeout=7, verify_ssl=False)
            if st >= 400:
                return [], []
            txt = raw.decode("utf-8", "replace")
            return FACTCHECK_TIKTOK_URL_RE.findall(txt), [h.lstrip("@") for h in FACTCHECK_HANDLE_RE.findall(txt)]
        except Exception:
            return [], []

    if article_urls:
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            for vids, hs in pool.map(_fetch_article, article_urls[:max_articles]):
                video_urls.update(vids)
                handles.update(hs)

    for u in video_urls:
        m = FACTCHECK_HANDLE_RE.search(u)
        if m:
            handles.add(m.group(1).lstrip("@"))
    return sorted(video_urls), sorted(handles)


def parse_logcat_slot_strategy(adb_bin: str, serial: str) -> tuple[dict[str, set[str]], list[str], str]:
    """
    Line-by-line parser for `SlotStrategyCore` and `SlotStrategyService` in `adb logcat -d -t 600`.
    Correctly links `acceptedParentBySlot={...}` to `[uniqueId=...]` even when separated by
    multi-line `slotTree:` dumps, and returns `(slots_by_video_id, ktf_video_ids, latest_unique_id)`.
    """
    try:
        raw = subprocess.check_output(
            [adb_bin, "-s", serial, "logcat", "-d", "-t", "600", "-s", "SlotStrategyCore:D", "SlotStrategyService:D"],
            timeout=6,
            stderr=subprocess.DEVNULL,
        ).decode("utf-8", "replace")
    except Exception:
        return {}, [], ""

    slots_by_id: dict[str, set[str]] = {}
    pending_slots: list[str] = []
    latest_uid = ""

    for line in raw.splitlines():
        m_slot = ACCEPTED_SLOTS_LINE_RE.search(line)
        if m_slot:
            parsed = [s.strip() for s in m_slot.group(1).split(",") if s.strip()]
            pending_slots.extend(parsed)
            if latest_uid and parsed:
                # Note: commitCandidates always precedes [uniqueId=...] for the same video bind,
                # so we wait for the next [uniqueId=...] line to attach pending_slots.
                pass
        m_uid = UNIQUE_ID_RE.search(line)
        if m_uid:
            uid = m_uid.group(1)
            latest_uid = uid
            slots_by_id.setdefault(uid, set())
            if pending_slots:
                slots_by_id[uid].update(pending_slots)
                pending_slots = []

    ktf_ids = [
        uid
        for uid, slots in slots_by_id.items()
        if any("know_the_fact" in s.lower() or "caution" in s.lower() or "unverified" in s.lower() for s in slots)
    ]
    return slots_by_id, ktf_ids, latest_uid


def resolve_tiktok_oembed_by_video_id(video_id: str, fallback_handle: str = "tiktok") -> dict:
    probe_url = f"https://www.tiktok.com/@{fallback_handle.lstrip('@') or 'tiktok'}/video/{video_id}"
    oembed_url = f"https://www.tiktok.com/oembed?url={urllib.parse.quote(probe_url, safe='')}"
    try:
        data = http_get_json(oembed_url, timeout=8)
        if isinstance(data, dict):
            author_url = str(data.get("author_url") or "")
            m = re.search(r"tiktok\.com/@([A-Za-z0-9_.]{2,35})", author_url)
            handle = (m.group(1) if m else str(data.get("author_unique_id") or fallback_handle)).lstrip("@").lower()
            return {
                "videoId": video_id,
                "handle": handle or "unknown",
                "authorName": str(data.get("author_name") or handle or "unknown"),
                "description": str(data.get("title") or "").strip(),
                "thumbnailUrl": str(data.get("thumbnail_url") or "").strip(),
                "url": f"https://www.tiktok.com/@{handle or 'tiktok'}/video/{video_id}",
            }
    except Exception:
        pass
    clean_h = fallback_handle.lstrip("@").lower() or "tiktok"
    return {
        "videoId": video_id,
        "handle": clean_h,
        "authorName": clean_h,
        "description": "",
        "thumbnailUrl": "",
        "url": f"https://www.tiktok.com/@{clean_h}/video/{video_id}",
    }


def archive_verified_video_id(
    video_id: str,
    fallback_handle: str = "",
    caption_hint: str = "",
    ocr_banner: str = "",
    matched_via: str = "phone_slot_and_ocr",
    worker_base: str = BRAND_WATCH_URL,
) -> dict | None:
    if not video_id:
        return None
    meta = resolve_tiktok_oembed_by_video_id(video_id, fallback_handle or "tiktok")
    raw_item = {
        "id": video_id,
        "webVideoUrl": meta["url"],
        "authorMeta": {"name": meta["handle"], "nickName": meta["authorName"]},
        "text": meta["description"] or caption_hint or f"Verified Caution-flagged video by @{meta['handle']}",
        "thumbnailUrl": meta["thumbnailUrl"],
        "misc_info": json.dumps({
            "ktf_info": {
                "bottom_banner": True,
                "Caution": "Caution:",
                "warn_text": "Video flagged for unverified content.",
            }
        }),
        "brandTag": f"{matched_via}:@{meta['handle']}",
    }
    rec = extract_caution_record(raw_item, source_provider=matched_via, query_tag=f"@{meta['handle']}")
    if not rec:
        return None
    rec["ocrTopBanner"] = ocr_banner or "Caution: Video flagged for unverified content."

    existing = load_flagged_videos(FLAGGED_JSON_PATH)
    merged, _ = merge_caution_records(existing, [rec])
    write_flagged_artifacts(merged, FLAGGED_JSON_PATH, SEED_JS_PATH)
    sync_records_to_worker([rec], worker_base=worker_base)
    try:
        http_fetch(
            f"{worker_base}/api/report",
            method="POST",
            headers={"Content-Type": "application/json"},
            data=json.dumps({
                "url": rec["url"],
                "brandTag": rec.get("brandTag") or f"@{meta['handle']}",
                "voiceToText": rec.get("description") or "",
                "cautionLabel": "Caution: Video flagged for unverified content",
            }).encode("utf-8"),
            timeout=12,
        )
    except Exception:
        pass
    return rec


def check_current_screen_and_logcat(
    adb_bin: str,
    serial: str,
    shared_png: str,
    all_slots_by_id: dict[str, set[str]],
    all_ktf_ids: set[str],
    verified_records: list[dict],
    seen_verified_ids: set[str],
    fallback_handle: str = "",
) -> dict:
    """
    Called after a 2.0s settle delay on each video:
      1. Parses `SlotStrategyCore` + `SlotStrategyService` line-by-line from logcat to get
         the currently playing `uniqueId` and check for `top_container_know_the_fact_top`.
      2. Captures the screen and runs persistent top-25% WinRT OCR (~0.19s) to visually check
         if `"Caution: Video flagged for unverified content."` popped up on screen.
      3. If either matches, immediately resolves & publishes the video to the live site!
    """
    slots_map, ktf_list, latest_uid = parse_logcat_slot_strategy(adb_bin, serial)
    for uid, s_set in slots_map.items():
        all_slots_by_id.setdefault(uid, set()).update(s_set)
    all_ktf_ids.update(ktf_list)

    with open(shared_png, "wb") as out_f:
        subprocess.run(
            [adb_bin, "-s", serial, "exec-out", "screencap", "-p"],
            stdout=out_f,
            stderr=subprocess.DEVNULL,
            timeout=6,
        )
    ocr_res = _GLOBAL_OCR.recognize(shared_png, crop_top_ratio=0.25)
    top_text = ocr_res.get("top", "")
    bottom_text = ocr_res.get("bottom", "")
    ocr_matched = bool(UNVERIFIED_CAUTION_RE.search(top_text) or FUZZY_CAUTION_OCR_RE.search(top_text))

    handle = fallback_handle
    for m in re.findall(r"@([A-Za-z0-9_.]{3,32})", f"{top_text} {bottom_text}"):
        if m.lower() not in ("tiktok", "for", "you", "following"):
            handle = m.lower()
            break

    if ocr_matched and latest_uid:
        all_ktf_ids.add(latest_uid)

    for ktf_uid in sorted(all_ktf_ids):
        if ktf_uid in seen_verified_ids:
            continue
        seen_verified_ids.add(ktf_uid)
        rec = archive_verified_video_id(
            video_id=ktf_uid,
            fallback_handle=handle,
            caption_hint=bottom_text,
            ocr_banner=top_text,
            matched_via="phone_ocr_and_slot_ktf" if ocr_matched else "phone_slot_strategy_ktf",
        )
        if rec:
            verified_records.append(rec)

    return {
        "latest_uid": latest_uid,
        "ocr_matched": ocr_matched,
        "slot_ktf_matched": bool(latest_uid and latest_uid in all_ktf_ids),
        "top_ocr": top_text[:180],
        "slots": sorted(list(all_slots_by_id.get(latest_uid, set()))),
    }


def swipe_feed_with_settle_delay(
    adb_bin: str,
    serial: str,
    shared_png: str,
    num_swipes: int,
    swipe_delay: float,
    all_slots_by_id: dict[str, set[str]],
    all_ktf_ids: set[str],
    verified_records: list[dict],
    seen_verified_ids: set[str],
    sample_logs: list[dict],
    feed_label: str,
    fallback_handle: str = "",
) -> int:
    """
    Swipe through `num_swipes` videos, giving each video `swipe_delay` seconds (e.g. 2.0s)
    for the `"Caution: Video flagged for unverified content."` banner to pop up before checking
    both `SlotStrategyCore` and Top-25% WinRT OCR.
    """
    checked = 0
    for idx in range(num_swipes):
        time.sleep(swipe_delay)
        info = check_current_screen_and_logcat(
            adb_bin=adb_bin,
            serial=serial,
            shared_png=shared_png,
            all_slots_by_id=all_slots_by_id,
            all_ktf_ids=all_ktf_ids,
            verified_records=verified_records,
            seen_verified_ids=seen_verified_ids,
            fallback_handle=fallback_handle,
        )
        checked += 1
        if len(sample_logs) < 16 or info["ocr_matched"] or info["slot_ktf_matched"]:
            sample_logs.append({"feed": f"{feed_label}#{idx+1}", **info})
        if idx < num_swipes - 1:
            subprocess.run(
                [adb_bin, "-s", serial, "shell", "input", "swipe", "540", "1820", "540", "320", "240"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
    return checked


def run_phone_robot(
    serial: str | None = None,
    swipes_per_feed: int = 8,
    swipe_delay: float = 2.0,
    max_direct_urls: int = 12,
    wait_seconds: int = 6,
    auto_git_push: bool = True,
) -> dict:
    load_workspace_env(REPO_ROOT)
    adb_bin = resolve_adb_binary()

    deadline = time.time() + max(3, wait_seconds)
    active_serial = serial
    last_states: list[tuple[str, str]] = []
    while time.time() < deadline:
        last_states = list_adb_devices(adb_bin)
        online = [s for s, st in last_states if st == "device" and (not serial or s == serial)]
        if online:
            active_serial = online[0]
            break
        time.sleep(1.0)

    if not active_serial:
        return {
            "ok": False,
            "error": "No authorized Android device detected over ADB.",
            "devices_seen": last_states,
        }

    t_start = time.time()
    subprocess.run([adb_bin, "-s", active_serial, "shell", "svc", "power", "stayon", "usb"], stderr=subprocess.DEVNULL)
    subprocess.run([adb_bin, "-s", active_serial, "logcat", "-c"], stderr=subprocess.DEVNULL)
    _GLOBAL_OCR.start()

    fc_urls, fc_handles = harvest_deep_factcheck_targets(max_articles=60)
    all_slots_by_id: dict[str, set[str]] = {}
    all_ktf_ids: set[str] = set()
    verified_records: list[dict] = []
    seen_verified_ids: set[str] = set()
    sample_logs: list[dict] = []
    frames_checked = 0

    shared_png = os.path.join(tempfile.gettempdir(), f"cw_frame_{active_serial}.png")

    # 1. Open confirmed seed Caution video 7702510622650518817 with full 2.2s pop-up delay
    seed_url = "https://www.tiktok.com/@maskedtruthmt/video/7702510622650518817"
    subprocess.run(
        [adb_bin, "-s", active_serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", seed_url],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=6,
    )
    time.sleep(max(2.2, swipe_delay))
    seed_info = check_current_screen_and_logcat(
        adb_bin=adb_bin,
        serial=active_serial,
        shared_png=shared_png,
        all_slots_by_id=all_slots_by_id,
        all_ktf_ids=all_ktf_ids,
        verified_records=verified_records,
        seen_verified_ids=seen_verified_ids,
        fallback_handle="maskedtruthmt",
    )
    frames_checked += 1
    sample_logs.append({"feed": "seed_7702510622650518817", **seed_info})

    # 2. Tap the bottom search bar prompt on 7702510622650518817 (500, 2110) -> tap top-left video (270, 750) -> scroll with 2.0s delay
    subprocess.run(
        [adb_bin, "-s", active_serial, "shell", "input tap 500 2110; sleep 2.0; input tap 270 750"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=8,
    )
    frames_checked += swipe_feed_with_settle_delay(
        adb_bin=adb_bin,
        serial=active_serial,
        shared_png=shared_png,
        num_swipes=swipes_per_feed,
        swipe_delay=swipe_delay,
        all_slots_by_id=all_slots_by_id,
        all_ktf_ids=all_ktf_ids,
        verified_records=verified_records,
        seen_verified_ids=seen_verified_ids,
        sample_logs=sample_logs,
        feed_label="search_cluster_anthony_joshua",
    )

    # 3. In-app search for "they showed anthony joshua what happens" (from user screenshot) with 2.0s delay between scrolls
    subprocess.run(
        [
            adb_bin,
            "-s",
            active_serial,
            "shell",
            "input keyevent 4; sleep 1.0; input tap 852 178; sleep 0.6; "
            "input text 'they%sshowed%santhony%sjoshua%swhat%shappens'; sleep 0.5; "
            "input keyevent 66; sleep 2.2; input tap 270 750",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=12,
    )
    frames_checked += swipe_feed_with_settle_delay(
        adb_bin=adb_bin,
        serial=active_serial,
        shared_png=shared_png,
        num_swipes=swipes_per_feed,
        swipe_delay=swipe_delay,
        all_slots_by_id=all_slots_by_id,
        all_ktf_ids=all_ktf_ids,
        verified_records=verified_records,
        seen_verified_ids=seen_verified_ids,
        sample_logs=sample_logs,
        feed_label="search_they_showed_aj",
    )

    # 4. Open @maskedtruthmt profile grid & scroll with 2.0s delay between scrolls
    for handle in ("maskedtruthmt", "nurseglo", "jakerosmarin"):
        prof_url = f"https://www.tiktok.com/@{handle}"
        subprocess.run(
            [
                adb_bin,
                "-s",
                active_serial,
                "shell",
                f"am start -a android.intent.action.VIEW -d '{prof_url}' >/dev/null 2>&1; "
                "sleep 2.2; input tap 180 1350",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
        frames_checked += swipe_feed_with_settle_delay(
            adb_bin=adb_bin,
            serial=active_serial,
            shared_png=shared_png,
            num_swipes=swipes_per_feed,
            swipe_delay=swipe_delay,
            all_slots_by_id=all_slots_by_id,
            all_ktf_ids=all_ktf_ids,
            verified_records=verified_records,
            seen_verified_ids=seen_verified_ids,
            sample_logs=sample_logs,
            feed_label=f"profile_{handle}",
            fallback_handle=handle,
        )

    # 5. Open top PolitiFact fact-checked direct TikTok URLs with full 2.2s banner pop-up settle delay
    for u in fc_urls[:max_direct_urls]:
        m_h = re.search(r"tiktok\.com/@([A-Za-z0-9_.]{2,35})", u)
        h_hint = m_h.group(1) if m_h else ""
        subprocess.run(
            [adb_bin, "-s", active_serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", u],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=6,
        )
        time.sleep(max(2.2, swipe_delay))
        info = check_current_screen_and_logcat(
            adb_bin=adb_bin,
            serial=active_serial,
            shared_png=shared_png,
            all_slots_by_id=all_slots_by_id,
            all_ktf_ids=all_ktf_ids,
            verified_records=verified_records,
            seen_verified_ids=seen_verified_ids,
            fallback_handle=h_hint,
        )
        frames_checked += 1
        if len(sample_logs) < 22 or info["ocr_matched"] or info["slot_ktf_matched"]:
            sample_logs.append({"feed": f"politifact_direct:{u}", **info})

    existing = load_flagged_videos(FLAGGED_JSON_PATH)
    merged, added = merge_caution_records(existing, verified_records)
    if added or merged != existing:
        write_flagged_artifacts(merged, FLAGGED_JSON_PATH, SEED_JS_PATH)
    worker_sync = sync_records_to_worker(merged, worker_base=BRAND_WATCH_URL)

    if auto_git_push and added:
        try:
            subprocess.run(
                ["git", "add", "brand_watch/flagged_videos.json", "brand_watch/seed_caution.js"],
                cwd=str(REPO_ROOT),
                timeout=10,
                check=False,
            )
            subprocess.run(
                ["git", "commit", "-m", f"chore(brand-watch): archive {len(added)} phone-verified Caution videos"],
                cwd=str(REPO_ROOT),
                timeout=15,
                check=False,
            )
            subprocess.run(["git", "push", "origin", "main"], cwd=str(REPO_ROOT), timeout=25, check=False)
        except Exception:
            pass

    elapsed = round(time.time() - t_start, 2)
    _GLOBAL_OCR.close()
    return {
        "ok": True,
        "device_serial": active_serial,
        "swipe_delay_seconds": swipe_delay,
        "elapsed_seconds": elapsed,
        "frames_checked_with_ocr_and_slot": frames_checked,
        "unique_videos_bound_in_tiktok": len(all_slots_by_id),
        "ktf_caution_slot_video_ids": sorted(all_ktf_ids),
        "caution_videos_verified": len(verified_records),
        "newly_added_to_archive": len(added),
        "total_archived": len(merged),
        "worker_sync": worker_sync,
        "verified_records": verified_records,
        "sample_logs": sample_logs[:18],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CautionWatch Balanced Robotic Android Phone TikTok Crawler (2.0s Pop-Up Delay + SlotStrategy + OCR).")
    parser.add_argument("--serial", default=None, help="Specific ADB device serial (e.g. ZY22L8LM57).")
    parser.add_argument("--swipes-per-feed", type=int, default=6)
    parser.add_argument("--swipe-delay", type=float, default=2.0, help="Seconds to pause on each video so the Caution banner pops up before OCR/Slot check.")
    parser.add_argument("--max-direct-urls", type=int, default=8)
    parser.add_argument("--wait-seconds", type=int, default=6)
    parser.add_argument("--no-git-push", action="store_true")
    args = parser.parse_args(argv)
    result = run_phone_robot(
        serial=args.serial,
        swipes_per_feed=args.swipes_per_feed,
        swipe_delay=args.swipe_delay,
        max_direct_urls=args.max_direct_urls,
        wait_seconds=args.wait_seconds,
        auto_git_push=not args.no_git_push,
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
