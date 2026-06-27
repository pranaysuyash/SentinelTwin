#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("SENTINELTWIN_DEMO_URL", "http://127.0.0.1:3001")
OUT_DIR = Path("qa-output/visual-verification")
VIDEO_DIR = OUT_DIR / "video"
SHOT_DIR = OUT_DIR / "screens"
REPORT_PATH = OUT_DIR / "report.json"

VIDEO_DIR.mkdir(parents=True, exist_ok=True)
SHOT_DIR.mkdir(parents=True, exist_ok=True)


def log_step(entries: list[dict], name: str, ok: bool, detail: str = "") -> None:
    entries.append({
        "ts": int(time.time() * 1000),
        "step": name,
        "ok": ok,
        "detail": detail,
    })
    REPORT_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")


def wait_server(url: str, timeout_s: int = 60) -> bool:
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


def click_label(page, labels: list[str], timeout_ms: int = 3500) -> str | None:
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


def main() -> int:
    entries: list[dict] = []
    print(f"Starting Visual Verification against {BASE_URL}...")

    if not wait_server(BASE_URL):
        log_step(entries, "server_ready", False, f"Server not reachable at {BASE_URL}")
        return 1
    log_step(entries, "server_ready", True, f"Connected to {BASE_URL}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 900},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1600, "height": 900},
        )
        page = context.new_page()
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        # 1. Verify /api/camera-live-session-health endpoint
        health_url = f"{BASE_URL.rstrip('/')}/api/camera-live-session-health"
        print(f"Navigating to {health_url}...")
        page.goto(health_url, wait_until="commit", timeout=60000)
        page.wait_for_timeout(3000)
        page.screenshot(path=str(SHOT_DIR / "01-health-endpoint.png"), animations="disabled")

        body_text = page.evaluate("document.body ? document.body.innerText : ''")
        try:
            data = json.loads(body_text)
            has_continuity = "continuityRecords" in data and "renewalEvaluations" in data and "pendingRenewals" in data
            log_step(entries, "health_endpoint_schema", has_continuity, f"Keys found: {list(data.keys())}")
        except Exception as exc:
            log_step(entries, "health_endpoint_schema", False, f"JSON parse error: {exc}")

        # 2. Verify Site Intake Hub / Studio UI
        print(f"Navigating to Studio UI ({BASE_URL})...")
        page.goto(BASE_URL, wait_until="commit", timeout=90000)
        page.wait_for_timeout(6000)
        page.screenshot(path=str(SHOT_DIR / "02-studio-map-view.png"), animations="disabled")

        ui_text = page.evaluate("document.body ? document.body.innerText : ''")
        has_studio_modes = "Map View" in ui_text or "Camera View" in ui_text or "SentinelTwin" in ui_text
        log_step(entries, "studio_ui_loaded", has_studio_modes, f"URL: {page.url}")

        # 2b. From Site Intake Hub, click "Open demo" or "Workspaces" to enter 3D Studio with Small Retail Shop scene
        print("Entering 3D Studio workspace with reference demo scene...")
        demo_clicked = click_label(page, ["Open demo", "Workspaces", "Open Manual Builder", "Open Studio"])
        page.wait_for_timeout(5000)
        log_step(entries, "enter_studio_demo", demo_clicked is not None, f"Clicked button: {demo_clicked}")

        # 2c. Dismiss any first-run onboarding guides or modals (e.g. FirstRunGuide "Start" button)
        print("Checking for and dismissing onboarding guides...")
        guide_clicked = click_label(page, ["Start", "Got it", "Dismiss", "Close"])
        page.wait_for_timeout(2000)
        log_step(entries, "dismiss_onboarding_guide", guide_clicked is not None, f"Dismissed guide with: {guide_clicked}")

        # 2d. In TopBar, click "Run Review" (or "Run Simulation") so simulation results are computed
        print("Running review / simulation...")
        sim_clicked = click_label(page, ["Run Review", "Run Simulation", "Simulate"])
        page.wait_for_timeout(6000)
        page.screenshot(path=str(SHOT_DIR / "02b-studio-simulated-scene.png"), animations="disabled")
        log_step(entries, "run_review_simulation", sim_clicked is not None, f"Clicked: {sim_clicked}")

        # 3. Test View Modes and take screenshots
        modes = [
            ("03-camera-view", ["Camera View"], 5),
            ("04-camera-wall", ["Camera Wall"], 5),
            ("05-path-replay", ["Path Replay"], 5),
            ("06-report-view", ["Report", "Report View"], 5),
            ("07-map-return", ["Map View"], 5),
        ]
        for name, labels, wait_s in modes:
            clicked = click_label(page, labels)
            page.wait_for_timeout(int(wait_s * 1000))
            page.screenshot(path=str(SHOT_DIR / f"{name}.png"), animations="disabled")
            log_step(entries, f"view_mode_{name}", clicked is not None, f"Clicked label: {clicked}")

        log_step(entries, "console_error_check", len(console_errors) == 0, f"Errors: {len(console_errors)}")
        log_step(entries, "page_error_check", len(page_errors) == 0, f"Errors: {len(page_errors)}")

        if console_errors:
            (OUT_DIR / "console-errors.json").write_text(json.dumps(console_errors, indent=2), encoding="utf-8")
        if page_errors:
            (OUT_DIR / "page-errors.json").write_text(json.dumps(page_errors, indent=2), encoding="utf-8")

        context.close()
        browser.close()

    videos = sorted(VIDEO_DIR.glob("*.webm"))
    log_step(entries, "video_artifact_created", bool(videos), ", ".join(v.name for v in videos))
    return 0 if (bool(videos) and all(e["ok"] for e in entries if e["step"] in ["health_endpoint_schema", "studio_ui_loaded"])) else 1


if __name__ == "__main__":
    raise SystemExit(main())
