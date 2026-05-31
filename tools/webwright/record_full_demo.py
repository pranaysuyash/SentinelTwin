#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Iterable

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "https://sentinel-twin-studio.vercel.app/"
OUT_DIR = Path("qa-output/full-demo")
VIDEO_DIR = OUT_DIR / "video"
SHOT_DIR = OUT_DIR / "screens"
LOG_PATH = OUT_DIR / "run-log.json"

OUT_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_DIR.mkdir(parents=True, exist_ok=True)
SHOT_DIR.mkdir(parents=True, exist_ok=True)


def step(log: list[dict], name: str, ok: bool, detail: str = "") -> None:
    log.append({
        "ts": int(time.time() * 1000),
        "step": name,
        "ok": ok,
        "detail": detail,
    })

def safe_shot(page, path: Path, log: list[dict], step_name: str) -> None:
    try:
        page.screenshot(path=str(path), timeout=5000)
        step(log, step_name, True, path.name)
    except Exception as exc:
        step(log, step_name, False, f"screenshot skipped: {exc}")


def click_first(page, labels: Iterable[str], timeout_ms: int = 2500) -> str | None:
    for label in labels:
        try:
            el = page.get_by_role("button", name=label)
            if el.count() > 0 and el.first.is_visible():
                el.first.click(timeout=timeout_ms)
                return label
        except Exception:
            continue
    return None


def wait_any_text(page, texts: Iterable[str], timeout_ms: int = 12000) -> str | None:
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        for text in texts:
            if page.get_by_text(text).count() > 0:
                return text
        page.wait_for_timeout(200)
    return None


def main() -> int:
    log: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        try:
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_load_state("networkidle", timeout=30000)
            safe_shot(page, SHOT_DIR / "01-root.png", log, "shot_root")
            step(log, "open_root", True, page.url)

            home_signal = wait_any_text(
                page,
                [
                    "Create Site Twin",
                    "Start Project",
                    "Workspace",
                    "Security Audit Studio",
                    "Small Retail",
                ],
            )
            if home_signal:
                step(log, "home_loaded", True, f"signal={home_signal}")
            else:
                step(log, "home_loaded", False, "No home signal found")

            clicked = click_first(page, [
                "Start Project",
                "Open Studio",
                "Open Workspace",
                "Continue Workspace",
                "Open",
            ])
            if clicked:
                step(log, "enter_studio", True, clicked)
            else:
                # fallback to direct studio route for rest of demo surface
                page.goto(BASE_URL.rstrip("/") + "/studio", wait_until="domcontentloaded", timeout=45000)
                step(log, "enter_studio", True, "fallback:/studio")

            page.wait_for_timeout(1500)
            page.wait_for_load_state("networkidle", timeout=30000)
            safe_shot(page, SHOT_DIR / "02-studio-map.png", log, "shot_studio_map")

            # Mode switches
            for name, shot in [
                ("Camera View", "03-camera-view.png"),
                ("Camera Wall", "04-camera-wall.png"),
                ("Path Replay", "05-path-replay.png"),
                ("Compare", "06-compare.png"),
                ("Report", "07-report.png"),
                ("Map View", "08-map-view-return.png"),
            ]:
                try:
                    btn = page.get_by_role("button", name=name).first
                    btn.click(timeout=8000)
                    page.wait_for_timeout(900)
                    safe_shot(page, SHOT_DIR / shot, log, f"shot_{shot.replace('.png','')}")
                    step(log, f"mode_{name.lower().replace(' ', '_')}", True)
                except Exception as exc:
                    step(log, f"mode_{name.lower().replace(' ', '_')}", False, str(exc))

            # Object click contextual behavior check (camera selection)
            # Try clicking known camera labels from left panel if present.
            selected = False
            for label in ["Front Door Cam", "Checkout Cam", "Entrance Camera", "Camera 1", "cam_", "camera"]:
                try:
                    loc = page.get_by_text(label)
                    if loc.count() > 0 and loc.first.is_visible():
                        loc.first.click(timeout=2500)
                        selected = True
                        step(log, "select_camera_object", True, f"label={label}")
                        break
                except Exception:
                    continue
            if not selected:
                step(log, "select_camera_object", False, "No camera label found for click selection")

            page.wait_for_timeout(800)
            safe_shot(page, SHOT_DIR / "09-selection-context.png", log, "shot_selection_context")

            # Basic runtime console error capture summary
            errors = []

            def on_console(msg):
                if msg.type == "error":
                    errors.append(msg.text)

            page.on("console", on_console)
            page.wait_for_timeout(800)
            step(log, "console_error_count", len(errors) == 0, f"count={len(errors)}")

            context.close()
            browser.close()

            videos = sorted(VIDEO_DIR.glob("*.webm"))
            step(log, "video_artifacts", len(videos) > 0, ", ".join(v.name for v in videos) if videos else "none")

        except PlaywrightTimeoutError as exc:
            step(log, "fatal_timeout", False, str(exc))
            safe_shot(page, SHOT_DIR / "fatal-timeout.png", log, "shot_fatal_timeout")
            context.close()
            browser.close()
            LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")
            return 1
        except Exception as exc:
            step(log, "fatal_error", False, str(exc))
            safe_shot(page, SHOT_DIR / "fatal-error.png", log, "shot_fatal_error")
            context.close()
            browser.close()
            LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")
            return 1

    LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")

    # Fail if critical milestones failed
    critical = {"open_root", "enter_studio", "mode_camera_view", "mode_map_view_return", "video_artifacts"}
    failed = [entry for entry in log if entry["step"] in critical and not entry["ok"]]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
