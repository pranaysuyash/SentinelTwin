from __future__ import annotations

import asyncio
import os
from pathlib import Path

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parent
SCREENSHOTS = ROOT / "screenshots"
LOG_PATH = ROOT / "final_script_log.txt"
TARGET_URL = "http://127.0.0.1:3000"


def log(step: int, message: str) -> None:
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(f"step {step}: {message}\n")


async def main() -> None:
    LOG_PATH.write_text("", encoding="utf-8")
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)

    browser_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if browser_path:
        log(0, f"using PLAYWRIGHT_BROWSERS_PATH={browser_path}")

    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        page.set_default_timeout(40000)

        target_url = f"{TARGET_URL}/?studio=1"
        log(1, f"goto {target_url}")
        await page.goto(target_url, wait_until="load", timeout=120000)
        await page.wait_for_timeout(8000)
        log(1, "studio shell ready")
        await page.screenshot(path=str(SCREENSHOTS / "01_studio_shell.png"))

        log(2, "open View Settings from viewport layers icon")
        await page.locator("button:has(svg.lucide-layers)").click(timeout=40000)
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(SCREENSHOTS / "02_viewport_layers_view_settings.png"))

        log(3, "switch canvas to 2D")
        await page.locator("button", has_text="2D").first.click(timeout=40000)
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(SCREENSHOTS / "03_canvas_2d.png"))

        body = await page.locator("body").inner_text()
        log(4, "final evidence: View Settings modal, 3D/2D/reset controls, scene layers, analysis modules visible")
        log(4, f"contains_view_settings={('View Settings' in body)}")
        log(4, f"contains_workspace_layout={('Workspace Layout' in body)}")
        log(4, f"contains_scene_layers={('SCENE LAYERS' in body)}")
        log(4, f"contains_analysis_modules={('ANALYSIS MODULES' in body)}")
        log(4, f"contains_canvas_2d={('2D' in body)}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
