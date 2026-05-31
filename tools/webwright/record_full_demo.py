#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Iterable, Sequence

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = os.environ.get("SENTINELTWIN_DEMO_URL", "https://sentinel-twin-studio.vercel.app/")
RUN_ID = os.environ.get("SENTINELTWIN_DEMO_RUN_ID", time.strftime("%Y%m%d-%H%M%S"))
OUT_DIR = Path(os.environ.get("SENTINELTWIN_DEMO_OUT_DIR", f"qa-output/full-demo/{RUN_ID}"))
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
        page.screenshot(path=str(path), timeout=60000, animations="disabled")
        step(log, step_name, True, path.name)
    except Exception as exc:
        step(log, step_name, False, f"screenshot skipped: {exc}")


def click_first(page, labels: Iterable[str], timeout_ms: int = 2500) -> str | None:
    for label in labels:
        try:
            el = page.get_by_role("button", name=label, exact=False)
            if el.count() > 0 and el.first.is_visible():
                el.first.click(timeout=timeout_ms)
                return label
        except Exception:
            continue
    return None

def click_label(page, label: str, timeout_ms: int = 4000) -> bool:
    try:
        btn = page.get_by_role("button", name=label, exact=False)
        if btn.count() > 0:
            btn.first.click(timeout=timeout_ms)
            return True
    except Exception:
        pass
    try:
        txt = page.get_by_text(label, exact=True)
        if txt.count() > 0:
            txt.first.click(timeout=timeout_ms)
            return True
    except Exception:
        pass
    try:
        clicked = page.evaluate(
            """(needle) => {
              const lower = needle.toLowerCase();
              const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
              const target = candidates.find((el) => {
                const text = `${el.innerText || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
                const rect = el.getBoundingClientRect();
                return text.includes(lower) && rect.width > 0 && rect.height > 0 && !el.disabled;
              });
              if (!target) return false;
              target.click();
              return true;
            }""",
            label,
        )
        return bool(clicked)
    except Exception:
        pass
    return False


def wait_any_text(page, texts: Iterable[str], timeout_ms: int = 12000) -> str | None:
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        body_text = current_text(page, 8000).lower()
        for text in texts:
            if text.lower() in body_text:
                return text
        page.wait_for_timeout(200)
    return None


def current_text(page, max_chars: int = 2000) -> str:
    try:
        return page.evaluate("(limit) => document.body ? document.body.innerText.slice(0, limit) : ''", max_chars)
    except Exception:
        return ""


def click_any(page, labels: Sequence[str], timeout_ms: int = 6000) -> str | None:
    for label in labels:
        if click_label(page, label, timeout_ms=timeout_ms):
            return label
    return None


def run_demo_step(
    page,
    log: list[dict],
    *,
    name: str,
    labels: Sequence[str] = (),
    shot: str,
    wait_for: Sequence[str] = (),
    detail: str = "",
    optional: bool = False,
    delay_ms: int = 1000,
) -> bool:
    clicked = None
    if labels:
        clicked = click_any(page, labels)
        if not clicked:
            step(log, f"step_{name}", optional, f"button not found: {', '.join(labels)}")
            if not optional:
                safe_shot(page, SHOT_DIR / f"missing-{shot}", log, f"shot_missing_{name}")
            return optional
    if wait_for:
        signal = wait_any_text(page, wait_for, timeout_ms=18000)
        if not signal:
            step(log, f"step_{name}", optional, f"signal not found after {clicked or 'navigation'}: {', '.join(wait_for)}")
            safe_shot(page, SHOT_DIR / f"missing-signal-{shot}", log, f"shot_missing_signal_{name}")
            return optional
        detail = f"{detail}; signal={signal}".strip("; ")
    page.wait_for_timeout(delay_ms)
    safe_shot(page, SHOT_DIR / shot, log, f"shot_{name}")
    step(log, f"step_{name}", True, detail or clicked or "")
    return True


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
        console_errors: list[str] = []
        page_errors: list[str] = []

        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)

        page.on("console", on_console)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        try:
            step(log, "run_id", True, RUN_ID)
            page.goto(BASE_URL, wait_until="commit", timeout=60000)
            home_signal = wait_any_text(
                page,
                [
                    "Create Site Twin",
                    "Current Site Twin",
                    "Open Security Twin Studio",
                    "Security Digital Twin Command Center",
                    "Start Project",
                    "Workspace",
                    "Security Audit Studio",
                    "Small Retail",
                ],
                timeout_ms=30000,
            )
            if home_signal:
                step(log, "home_loaded", True, f"signal={home_signal}")
            else:
                step(log, "home_loaded", False, "No home signal found")
            try:
                page.wait_for_load_state("networkidle", timeout=12000)
            except Exception:
                step(log, "root_networkidle_skip", False, "networkidle timeout tolerated")
            page.wait_for_timeout(1200)
            safe_shot(page, SHOT_DIR / "01-root.png", log, "shot_root")
            step(log, "open_root", True, page.url)

            run_demo_step(
                page,
                log,
                name="root_run_simulation",
                labels=["Run Simulation", "Run baseline simulation"],
                shot="02-root-after-simulation.png",
                wait_for=["Coverage", "82%", "Critical Zones"],
                detail="Run the baseline simulation from the command center.",
                optional=True,
                delay_ms=1800,
            )
            run_demo_step(
                page,
                log,
                name="root_site_intake",
                labels=["Create Site Twin"],
                shot="03-root-create-site-twin.png",
                wait_for=["Create", "Import", "Scan", "AI Layout"],
                detail="Open the create/import surface without applying a new scene.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="root_reference_sites",
                labels=["Reference Sites"],
                shot="04-root-reference-sites.png",
                wait_for=["Reference", "Retail", "Warehouse", "Office"],
                detail="Show reusable reference-site catalog.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="root_settings",
                labels=["Settings"],
                shot="05-root-settings.png",
                wait_for=["Settings", "Product preferences", "Local"],
                detail="Show product preference controls.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="root_home_return",
                labels=["Home"],
                shot="06-root-home-return.png",
                wait_for=["Current Site Twin", "Open Security Twin Studio", "Security Status"],
                detail="Return to the command center before entering Studio.",
                optional=True,
            )

            clicked = click_first(page, [
                "Open Security Twin Studio",
                "Security Twin Studio",
                "Open Studio",
                "Open Workspace",
                "Continue Workspace",
            ])
            if clicked:
                step(log, "enter_studio", True, clicked)
            else:
                page.goto(BASE_URL.rstrip("/") + "/studio", wait_until="commit", timeout=45000)
                step(log, "enter_studio", True, "fallback:/studio")

            if not wait_any_text(
                page,
                [
                    "Map View",
                    "Camera View",
                    "Camera Operations",
                    "Coverage",
                    "QUALITY VIEW",
                    "Coverage - Map & Analysis",
                    "Path Replay",
                ],
                timeout_ms=45000,
            ):
                step(log, "studio_ready", False, "No studio workspace signal found")
            else:
                step(log, "studio_ready", True, "workspace signal found")
            page.wait_for_timeout(2500)
            try:
                page.wait_for_load_state("networkidle", timeout=12000)
            except Exception:
                step(log, "studio_networkidle_skip", False, "networkidle timeout tolerated")
            safe_shot(page, SHOT_DIR / "07-studio-coverage-map.png", log, "shot_studio_coverage_map")

            run_demo_step(
                page,
                log,
                name="studio_run_review",
                labels=["Run Review", "Simulate", "Run Simulation"],
                shot="08-studio-after-run-review.png",
                wait_for=["Coverage", "Cash Counter", "Recognition", "82%"],
                detail="Run the simulation/review from the Studio top bar.",
                optional=True,
                delay_ms=2000,
            )
            run_demo_step(
                page,
                log,
                name="studio_lighting_overlay",
                labels=["Lighting"],
                shot="09-studio-lighting-overlay.png",
                wait_for=["Lighting", "QUALITY VIEW"],
                detail="Switch quality overlay to lighting impact.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="studio_blindspots_overlay",
                labels=["Blindspots"],
                shot="10-studio-blindspots-overlay.png",
                wait_for=["Blindspots", "QUALITY VIEW"],
                detail="Switch quality overlay to blindspot emphasis.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="studio_view_settings",
                labels=["View Settings"],
                shot="11-studio-view-settings.png",
                wait_for=["View Settings", "Local", "Overlay"],
                detail="Open view/settings controls.",
                optional=True,
            )
            try:
                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
            except Exception:
                pass

            mode_success = 0
            studio_steps = [
                ("camera_view", ["Camera View"], "12-camera-view.png", ["CAMERA VIEW", "Single Camera", "Footage Verification"], "Inspect a single simulated camera feed."),
                ("camera_wall", ["Camera Wall"], "13-camera-wall.png", ["CAMERA WALL", "Multi Camera", "6 view"], "Review the multi-camera wall and offline camera state."),
                ("path_replay", ["Path Replay"], "14-path-replay.png", ["INCIDENT REVIEW", "Path Replay", "Coverage Replay"], "Review route visibility over time."),
                ("compare_view", ["Compare View", "Compare Fix"], "15-compare-view.png", ["COMPARE", "Before", "After", "Delta"], "Compare baseline and proposed fix."),
                ("report_view", ["Report View", "Audit Report"], "16-report-view.png", ["REPORT", "Audit", "Evidence", "Export"], "Open the audit report/evidence view."),
                ("map_return", ["Map View"], "17-map-return.png", ["Map View", "QUALITY VIEW", "Coverage"], "Return to coverage map."),
            ]
            for name, labels, shot, signals, detail in studio_steps:
                if run_demo_step(page, log, name=name, labels=labels, shot=shot, wait_for=signals, detail=detail, optional=False, delay_ms=1400):
                    mode_success += 1

            # Object click contextual behavior check (camera selection)
            # Try clicking known camera labels from left panel if present.
            selected = False
            for label in ["Camera 1", "CAM 1", "Front Door Cam", "Checkout Cam", "Entrance Camera", "cam_", "camera"]:
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

            page.wait_for_timeout(800)
            text = current_text(page, 4000)
            required_demo_signals = [
                "SentinelTwin",
                "Small Retail Shop Demo",
                "Map View",
                "Camera View",
                "Camera Wall",
                "Path Replay",
                "Compare",
                "Report",
            ]
            missing_signals = [signal for signal in required_demo_signals if signal not in text and signal.upper() not in text]
            step(log, "required_demo_signals", len(missing_signals) == 0, ", ".join(missing_signals) if missing_signals else "all present")
            step(log, "console_error_count", len(console_errors) == 0, f"count={len(console_errors)}")
            step(log, "page_error_count", len(page_errors) == 0, f"count={len(page_errors)}")

            context.close()
            browser.close()

            videos = sorted(VIDEO_DIR.glob("*.webm"))
            step(log, "video_artifacts", len(videos) > 0, ", ".join(v.name for v in videos) if videos else "none")
            if console_errors:
                (OUT_DIR / "console-errors.json").write_text(json.dumps(console_errors, indent=2), encoding="utf-8")
            if page_errors:
                (OUT_DIR / "page-errors.json").write_text(json.dumps(page_errors, indent=2), encoding="utf-8")

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
    step(log, "mode_switch_threshold", mode_success >= 3, f"successful={mode_success}")
    LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")
    critical = {
        "open_root",
        "home_loaded",
        "enter_studio",
        "studio_ready",
        "mode_switch_threshold",
        "video_artifacts",
        "page_error_count",
        "required_demo_signals",
    }
    failed = [entry for entry in log if entry["step"] in critical and not entry["ok"]]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
