#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
from pathlib import Path
from typing import Iterable, Sequence

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = os.environ.get("SENTINELTWIN_DEMO_URL", "https://sentinel-twin-studio.vercel.app/")
RUN_ID = os.environ.get("SENTINELTWIN_DEMO_RUN_ID", time.strftime("%Y%m%d-%H%M%S"))
OUT_DIR = Path(os.environ.get("SENTINELTWIN_DEMO_OUT_DIR", f"qa-output/full-demo/{RUN_ID}"))
VIDEO_DIR = OUT_DIR / "video"
SHOT_DIR = OUT_DIR / "screens"
LOG_PATH = OUT_DIR / "run-log.json"
MAX_RUN_SECONDS = int(os.environ.get("SENTINELTWIN_DEMO_MAX_SECONDS", "900"))
SCREENSHOT_TIMEOUT_MS = int(os.environ.get("SENTINELTWIN_DEMO_SCREENSHOT_TIMEOUT_MS", "15000"))
REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_JSON_PATH = Path(
    os.environ.get(
        "SENTINELTWIN_DEMO_SAMPLE_JSON_PATH",
        str(REPO_ROOT / "apps/studio/public/sample-security-scene-import.json"),
    )
)
REQUIRE_JSON_SAMPLE = os.environ.get("SENTINELTWIN_DEMO_REQUIRE_JSON_SAMPLE", "1") != "0"
SERVER_WAIT_SECONDS = int(os.environ.get("SENTINELTWIN_DEMO_SERVER_WAIT_SECONDS", "90"))
STRICT_GATES = os.environ.get("SENTINELTWIN_DEMO_STRICT", "0") == "1"
INCLUDE_OPERATOR_EDITS = os.environ.get("SENTINELTWIN_DEMO_INCLUDE_EDITS", "0") == "1"

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
    try:
        LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")
    except Exception:
        pass


def wait_for_server(url: str, timeout_s: int) -> bool:
    deadline = time.time() + timeout_s
    request = Request(url, method="HEAD")
    while time.time() < deadline:
        try:
            with urlopen(request, timeout=4) as response:
                if response.status < 500:
                    return True
        except URLError:
            pass
        except Exception:
            pass
        time.sleep(1)
    return False

def safe_shot(page, path: Path, log: list[dict], step_name: str) -> None:
    try:
        page.screenshot(path=str(path), timeout=SCREENSHOT_TIMEOUT_MS, animations="disabled")
        step(log, step_name, True, path.name)
    except Exception as exc:
        step(log, step_name, False, f"screenshot skipped: {exc}")


def click_first(page, labels: Iterable[str], timeout_ms: int = 2500) -> str | None:
    for label in labels:
        if click_label(page, label, timeout_ms=timeout_ms):
            return label
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


def click_visible_text(page, labels: Sequence[str], timeout_ms: int = 4000) -> str | None:
    for label in labels:
        try:
            clicked = page.evaluate(
                """(needle) => {
                  const lower = needle.toLowerCase();
                  const candidates = Array.from(document.querySelectorAll('button, [role="button"], a, [data-node-id], div, span'))
                    .filter((el) => {
                      const rect = el.getBoundingClientRect();
                      const text = `${el.innerText || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
                      return rect.width > 0 && rect.height > 0 && text.includes(lower);
                    });
                  const target = candidates.find((el) => el.matches('button, [role="button"], a, [data-node-id]'))
                    || candidates[0];
                  if (!target) return false;
                  target.click();
                  return true;
                }""",
                label,
            )
            if clicked:
                page.wait_for_timeout(timeout_ms // 4)
                return label
        except Exception:
            continue
    return None


def load_sample_scene_name(log: list[dict]) -> str | None:
    try:
        payload = json.loads(SAMPLE_JSON_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        step(log, "json_sample_read", False, f"{exc}")
        return None
    scene_name = payload.get("name")
    if isinstance(scene_name, str) and scene_name.strip():
        step(log, "json_sample_read", True, f"name={scene_name}")
        return scene_name
    step(log, "json_sample_read", False, "sample JSON has no scene name")
    return None


def select_json_source_card(page, log: list[dict]) -> bool:
    """Select the JSON source card by current card-grid structure, not button copy."""
    try:
        clicked = page.evaluate(
            """() => {
              const main = document.querySelector('main');
              if (!main) return false;
              const cardButtons = Array.from(main.querySelectorAll('section button'))
                .filter((el) => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 160 && rect.height > 120 && !el.disabled;
                });
              const jsonCard = cardButtons[3];
              if (!jsonCard) return false;
              jsonCard.click();
              return true;
            }"""
        )
        if clicked:
            step(log, "json_sample_select_source", True, "source card index=3")
            return True
    except Exception as exc:
        step(log, "json_sample_select_source_structural", False, f"{exc}")

    step(log, "json_sample_select_source", False, "JSON source card not found by structure")
    return False


def find_sample_download_link(page) -> str | None:
    try:
        return page.evaluate(
            """() => {
              const links = Array.from(document.querySelectorAll('a[download]'));
              const target = links.find((el) => {
                const href = el.getAttribute('href') || '';
                const download = el.getAttribute('download') || '';
                return href.endsWith('/sample-security-scene-import.json')
                  || href.endsWith('sample-security-scene-import.json')
                  || download === 'sample-security-scene-import.json';
              });
              return target ? target.getAttribute('href') : null;
            }"""
        )
    except Exception:
        return None


def upload_sample_json_via_file_input(page) -> bool:
    file_input = page.locator('input[type="file"][accept=".json"]').first
    if file_input.count() == 0:
        file_input = page.locator('input[type="file"]').first
    if file_input.count() == 0:
        return False
    file_input.set_input_files(str(SAMPLE_JSON_PATH), timeout=10000)
    return True


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


def submit_guided_edit(page, log: list[dict], command: str, shot: str, name: str) -> bool:
    """Use the product command bar so demo edits flow through structured scene operations."""
    input_box = page.get_by_placeholder("Describe a site edit or review action...")
    opened = input_box.count() > 0 and input_box.first.is_visible()
    if not opened:
        opened = click_any(page, ["Guided Edit"], timeout_ms=4000) is not None
    if not opened:
        try:
            page.keyboard.press("Meta+K")
            page.wait_for_timeout(600)
            opened = input_box.count() > 0 and input_box.first.is_visible()
        except Exception:
            opened = False
    if not opened:
        step(log, f"guided_edit_{name}", False, "Guided Edit button not found")
        safe_shot(page, SHOT_DIR / f"missing-{shot}", log, f"shot_missing_guided_edit_{name}")
        return False
    try:
        input_box.first.fill(command, timeout=6000)
        page.keyboard.press("Enter")
        applied = wait_any_text(page, ["Apply", "Target selection required", "AI command failed"], timeout_ms=12000)
        if applied != "Apply":
            step(log, f"guided_edit_{name}", False, f"preview not applicable for command={command}; signal={applied}")
            safe_shot(page, SHOT_DIR / f"failed-{shot}", log, f"shot_failed_guided_edit_{name}")
            page.keyboard.press("Escape")
            return False
        click_label(page, "Apply", timeout_ms=5000)
        signal = wait_any_text(page, ["Applied", "Moved", "Rotated", "Added", "Switched", "Snapshot saved"], timeout_ms=15000)
        page.wait_for_timeout(1200)
        safe_shot(page, SHOT_DIR / shot, log, f"shot_guided_edit_{name}")
        step(log, f"guided_edit_{name}", signal is not None, f"{command}; signal={signal}")
        page.keyboard.press("Escape")
        return signal is not None
    except Exception as exc:
        step(log, f"guided_edit_{name}", False, f"{command}; {exc}")
        safe_shot(page, SHOT_DIR / f"failed-{shot}", log, f"shot_failed_guided_edit_{name}")
        return False


def run_json_sample_intake_check(page, log: list[dict]) -> bool:
    """Exercise Create Site Twin -> JSON import -> draft review with stable DOM hooks."""
    if not SAMPLE_JSON_PATH.exists():
        step(log, "json_sample_file", False, f"missing={SAMPLE_JSON_PATH}")
        return not REQUIRE_JSON_SAMPLE
    scene_name = load_sample_scene_name(log)
    if not scene_name:
        return not REQUIRE_JSON_SAMPLE

    import_opened = click_any(page, ["Import Scene JSON", "Import JSON", "Import Site Twin", "Import Site Twin Data"], timeout_ms=7000)
    if not import_opened:
        selected = select_json_source_card(page, log)
        if not selected:
            safe_shot(page, SHOT_DIR / "missing-json-source.png", log, "shot_missing_json_source")
    else:
        step(log, "json_sample_select_source", True, f"entry={import_opened}")

    page.wait_for_timeout(400)
    sample_href = find_sample_download_link(page)
    step(log, "json_sample_download_link", bool(sample_href), sample_href or "Download sample JSON link not found")

    try:
        uploaded = upload_sample_json_via_file_input(page)
        if not uploaded:
            raise RuntimeError("JSON file input not found")
    except Exception as exc:
        step(log, "json_sample_upload", False, f"{exc}")
        safe_shot(page, SHOT_DIR / "missing-json-upload.png", log, "shot_missing_json_upload")
        return not REQUIRE_JSON_SAMPLE

    step(log, "json_sample_upload", True, SAMPLE_JSON_PATH.name)
    signal = wait_any_text(
        page,
        [
            scene_name,
            "sample-security-scene-import.json",
            "Site Draft Review",
            "Draft Review",
        ],
        timeout_ms=18000,
    )
    if not signal:
        step(log, "json_sample_review_ready", False, f"No imported draft signal found for {scene_name}")
        safe_shot(page, SHOT_DIR / "missing-json-draft-review.png", log, "shot_missing_json_draft_review")
        return not REQUIRE_JSON_SAMPLE

    step(log, "json_sample_review_ready", True, f"signal={signal}")
    page.wait_for_timeout(1000)
    safe_shot(page, SHOT_DIR / "04-json-sample-draft-review.png", log, "shot_json_sample_draft_review")

    page.goto(BASE_URL, wait_until="commit", timeout=45000)
    home_signal = wait_any_text(
        page,
        ["Current Site Twin", "Open Security Twin Studio", "Security Status", "Create Site Twin"],
        timeout_ms=12000,
    )
    if home_signal:
        step(log, "json_sample_return_home", True, f"signal={home_signal}")
    else:
        body = current_text(page, 12000)
        step(log, "json_sample_return_home", len(body.strip()) > 100, "fallback=body_text_present")
    page.wait_for_timeout(800)
    safe_shot(page, SHOT_DIR / "05-after-json-sample-return-home.png", log, "shot_after_json_sample_return_home")

    return True


def main() -> int:
    log: list[dict] = []
    run_started = time.monotonic()
    def ensure_within_runtime(checkpoint: str) -> None:
        elapsed = time.monotonic() - run_started
        if elapsed > MAX_RUN_SECONDS:
            raise TimeoutError(f"Recorder watchdog exceeded {MAX_RUN_SECONDS}s at {checkpoint}")

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
        page.on("dialog", lambda dialog: dialog.accept())

        try:
            step(log, "run_id", True, RUN_ID)
            ensure_within_runtime("startup")
            target_ready = wait_for_server(BASE_URL, SERVER_WAIT_SECONDS)
            step(log, "target_ready", target_ready, BASE_URL)
            if not target_ready:
                raise RuntimeError(f"Target not reachable after {SERVER_WAIT_SECONDS}s: {BASE_URL}")
            page.goto(BASE_URL, wait_until="commit", timeout=60000)
            home_signal = wait_any_text(
                page,
                [
                    "Create Site Twin",
                    "Current Site Twin",
                    "Open Security Twin Studio",
                    "Open Studio",
                    "Security Simulation Workspace",
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
                body = current_text(page, 12000)
                if len(body.strip()) > 100:
                    step(log, "home_loaded", True, "fallback=body_text_present")
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
                labels=["Create Site Twin", "New Scene", "Import JSON"],
                shot="03-root-create-site-twin.png",
                wait_for=["Create Site Twin", "Import Site Twin Data", "Import", "Scan a Site", "AI Layout Draft", "New Blank Site"],
                detail="Verify the command-center create/import surface without applying a new scene.",
                optional=True,
            )
            run_json_sample_intake_check(page, log)
            ensure_within_runtime("post_json_sample")
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
                "Open Studio",
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
            ensure_within_runtime("studio_entered")

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
            click_visible_text(page, ["Start", "Close", "Dismiss"], timeout_ms=1200)
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
            edit_success = 0
            if INCLUDE_OPERATOR_EDITS:
                if submit_guided_edit(page, log, "move camera 1 toward the counter", "09-guided-camera-aim-counter.png", "camera_aim_counter"):
                    edit_success += 1
                run_demo_step(
                    page,
                    log,
                    name="studio_recompute_after_camera_edit",
                    labels=["Run Review", "Simulate", "Run Simulation"],
                    shot="10-recompute-after-camera-edit.png",
                    wait_for=["Coverage", "Cash Counter", "Recognition"],
                    detail="Recompute after the camera aim/position edit.",
                    optional=True,
                    delay_ms=2200,
                )
                if submit_guided_edit(page, log, "add light near counter", "11-guided-add-counter-light.png", "add_counter_light"):
                    edit_success += 1
                if submit_guided_edit(page, log, "switch to night mode", "12-guided-night-mode.png", "night_mode"):
                    edit_success += 1
                run_demo_step(
                    page,
                    log,
                    name="studio_recompute_after_light_night",
                    labels=["Run Review", "Simulate", "Run Simulation"],
                    shot="13-recompute-after-light-night.png",
                    wait_for=["Coverage", "Cash Counter", "Night", "Recognition"],
                    detail="Recompute with added light and night assumptions.",
                    optional=True,
                    delay_ms=2600,
                )
                if submit_guided_edit(page, log, "save snapshot", "14-guided-save-snapshot.png", "save_snapshot"):
                    edit_success += 1
                step(log, "operator_edit_threshold", edit_success >= 3, f"successful={edit_success}")
            else:
                step(log, "operator_edit_threshold", True, "skipped (SENTINELTWIN_DEMO_INCLUDE_EDITS=0)")
            run_demo_step(
                page,
                log,
                name="studio_lighting_overlay",
                labels=["Lighting"],
                shot="15-studio-lighting-overlay.png",
                wait_for=["Lighting", "QUALITY VIEW"],
                detail="Switch quality overlay to lighting impact.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="studio_blindspots_overlay",
                labels=["Blindspots"],
                shot="16-studio-blindspots-overlay.png",
                wait_for=["Blindspots", "QUALITY VIEW"],
                detail="Switch quality overlay to blindspot emphasis.",
                optional=True,
            )
            run_demo_step(
                page,
                log,
                name="studio_view_settings",
                labels=["View Settings"],
                shot="17-studio-view-settings.png",
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
                ("camera_view", ["Camera View"], "18-camera-view.png", ["CAMERA VIEW", "Single Camera", "Footage Verification"], "Inspect a single simulated camera feed."),
                ("camera_wall", ["Camera Wall"], "19-camera-wall.png", ["CAMERA WALL", "Multi Camera", "6 view"], "Review the multi-camera wall and offline camera state."),
                ("path_replay", ["Path Replay"], "20-path-replay.png", ["INCIDENT REVIEW", "Path Replay", "Coverage Replay"], "Review route visibility over time."),
                ("compare_view", ["Compare View", "Compare Fix"], "21-compare-view.png", ["COMPARE", "Before", "After", "Delta"], "Compare baseline and proposed fix."),
                ("report_view", ["Report View", "Audit Report"], "22-report-view.png", ["REPORT", "Audit", "Evidence", "Export"], "Open the audit report/evidence view."),
                ("map_return", ["Map View"], "23-map-return.png", ["Map View", "QUALITY VIEW", "Coverage"], "Return to coverage map."),
            ]
            for name, labels, shot, signals, detail in studio_steps:
                ensure_within_runtime(f"studio_step_{name}")
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
            safe_shot(page, SHOT_DIR / "24-selection-context.png", log, "shot_selection_context")

            page.wait_for_timeout(800)
            text = current_text(page, 4000)
            required_demo_signals = [
                "SentinelTwin",
                "Map View",
                "Camera View",
                "Camera Wall",
                "Path Replay",
                "Compare",
                "Report",
            ]
            missing_signals = [signal for signal in required_demo_signals if signal not in text and signal.upper() not in text]
            step(log, "required_demo_signals", len(missing_signals) <= 2, ", ".join(missing_signals) if missing_signals else "all present")
            step(log, "console_error_count", len(console_errors) <= 5, f"count={len(console_errors)}")
            step(log, "page_error_count", len(page_errors) <= 1, f"count={len(page_errors)}")

            context.close()
            browser.close()

            videos = sorted(VIDEO_DIR.glob("*.webm"))
            step(log, "video_artifacts", len(videos) > 0, ", ".join(v.name for v in videos) if videos else "none")
            screenshots = sorted(SHOT_DIR.glob("*.png"))
            step(log, "screenshot_artifacts", len(screenshots) > 0, f"count={len(screenshots)}")
            step(log, "artifact_dir", True, str(OUT_DIR))
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
        "enter_studio",
        "studio_ready",
        "video_artifacts",
    }
    if REQUIRE_JSON_SAMPLE:
        critical.add("json_sample_review_ready")
    if STRICT_GATES:
        critical.add("home_loaded")
        critical.add("mode_switch_threshold")
        critical.add("operator_edit_threshold")
        critical.add("required_demo_signals")
        critical.add("page_error_count")
    failed = [entry for entry in log if entry["step"] in critical and not entry["ok"]]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
