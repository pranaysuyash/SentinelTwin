#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("SENTINELTWIN_DEMO_URL", "http://localhost:3000")
RUN_ID = os.environ.get("SENTINELTWIN_DEMO_RUN_ID", time.strftime("submission-demo-%Y%m%d-%H%M%S"))
OUT_DIR = Path(os.environ.get("SENTINELTWIN_DEMO_OUT_DIR", f"qa-output/full-demo/{RUN_ID}"))
VIDEO_DIR = OUT_DIR / "video"
SHOT_DIR = OUT_DIR / "screens"
LOG_PATH = OUT_DIR / "run-log.json"

VIDEO_DIR.mkdir(parents=True, exist_ok=True)
SHOT_DIR.mkdir(parents=True, exist_ok=True)


def log(entries: list[dict], step: str, ok: bool, detail: str = "") -> None:
    entries.append({"ts": int(time.time() * 1000), "step": step, "ok": ok, "detail": detail})
    LOG_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")


def wait_server(url: str, timeout_s: int = 90) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urlopen(Request(url, method="HEAD"), timeout=4) as response:
                if response.status < 500:
                    return True
        except Exception:
            pass
        time.sleep(1)
    return False


def text(page) -> str:
    try:
        return page.evaluate("document.body ? document.body.innerText : ''")
    except Exception:
        return ""


def shot(page, name: str, entries: list[dict]) -> None:
    try:
        page.screenshot(path=str(SHOT_DIR / name), timeout=60000, animations="disabled")
        log(entries, f"shot_{name}", True, name)
    except Exception as exc:
        log(entries, f"shot_{name}", False, str(exc))


def click(page, labels: list[str], timeout_ms: int = 3500) -> str | None:
    for label in labels:
        try:
            button = page.get_by_role("button", name=label, exact=False)
            if button.count() > 0 and button.first.is_visible():
                button.first.click(timeout=timeout_ms)
                return label
        except Exception:
            pass
        try:
            loc = page.get_by_text(label, exact=False)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(timeout=timeout_ms)
                return label
        except Exception:
            pass
    return None


def wait_and_capture(page, entries: list[dict], name: str, seconds: float) -> None:
    page.wait_for_timeout(int(seconds * 1000))
    shot(page, f"{name}.png", entries)


def main() -> int:
    entries: list[dict] = []
    if not wait_server(BASE_URL):
        log(entries, "server_ready", False, BASE_URL)
        return 1
    log(entries, "server_ready", True, BASE_URL)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1652, "height": 962},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1652, "height": 962},
        )
        page = context.new_page()
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        page.goto(BASE_URL, wait_until="commit", timeout=120000)
        page.wait_for_timeout(12000)
        log(entries, "home_loaded", "SentinelTwin" in text(page), page.url)
        shot(page, "01-home.png", entries)
        wait_and_capture(page, entries, "02-home-options", 10)

        click(page, ["Open panels"])
        wait_and_capture(page, entries, "03-home-panels", 8)
        click(page, ["Create Site Twin", "Import JSON", "New Scene"])
        wait_and_capture(page, entries, "04-create-site-twin", 12)
        click(page, ["Projects"])
        wait_and_capture(page, entries, "05-projects", 8)
        click(page, ["Demo Sites"])
        wait_and_capture(page, entries, "06-demo-sites", 8)
        click(page, ["Reports"])
        wait_and_capture(page, entries, "07-reports", 8)
        click(page, ["Home"])
        wait_and_capture(page, entries, "08-home-return", 8)

        if not click(page, ["Open Studio", "Open Security Twin Studio"]):
            page.goto(BASE_URL.rstrip("/") + "/studio", wait_until="commit", timeout=120000)
        page.wait_for_timeout(35000)
        click(page, ["Start", "Close", "Dismiss"])
        log(entries, "studio_loaded", "Map View" in text(page) and "Camera View" in text(page), page.url)
        shot(page, "09-studio-map.png", entries)

        click(page, ["Run Review", "Run Simulation", "Simulate"])
        wait_and_capture(page, entries, "10-run-review", 18)
        click(page, ["Night"])
        wait_and_capture(page, entries, "11-night-mode", 12)
        click(page, ["Test Outage"])
        wait_and_capture(page, entries, "12-test-outage", 12)
        click(page, ["Snapshot"])
        wait_and_capture(page, entries, "13-snapshot", 10)

        for name, labels, seconds in [
            ("14-camera-view", ["Camera View"], 22),
            ("15-camera-wall", ["Camera Wall"], 18),
            ("16-path-replay", ["Path Replay"], 22),
            ("17-compare-view", ["Compare View", "Compare"], 18),
            ("18-report-view", ["Report View", "Report"], 22),
            ("19-map-return", ["Map View"], 12),
        ]:
            click(page, labels)
            wait_and_capture(page, entries, name, seconds)

        click(page, ["Guided Edit"])
        wait_and_capture(page, entries, "20-guided-edit", 12)
        click(page, ["Assumptions"])
        wait_and_capture(page, entries, "21-assumptions", 10)
        click(page, ["Evidence Trail"])
        wait_and_capture(page, entries, "22-evidence", 10)

        log(entries, "console_error_count", len(console_errors) == 0, f"count={len(console_errors)}")
        log(entries, "page_error_count", len(page_errors) == 0, f"count={len(page_errors)}")
        if console_errors:
            (OUT_DIR / "console-errors.json").write_text(json.dumps(console_errors, indent=2), encoding="utf-8")
        if page_errors:
            (OUT_DIR / "page-errors.json").write_text(json.dumps(page_errors, indent=2), encoding="utf-8")

        context.close()
        browser.close()

    videos = sorted(VIDEO_DIR.glob("*.webm"))
    log(entries, "video_artifacts", bool(videos), ", ".join(v.name for v in videos))
    return 0 if videos else 1


if __name__ == "__main__":
    raise SystemExit(main())
