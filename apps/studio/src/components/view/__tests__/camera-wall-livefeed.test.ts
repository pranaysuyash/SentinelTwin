import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const wallViewPath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../CameraWallView.tsx",
);

describe("CameraWallView real live-feed support (I4)", () => {
  test("defines a LiveFeedVideo component that renders a <video> element", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("function LiveFeedVideo");
    expect(source).toMatch(/<video[\s\S]*src=\{feedUrl\}[\s\S]*\/>/);
  });

  test("LiveFeedVideo branches on camData.liveFeedUrl presence", () => {
    const source = readFileSync(wallViewPath, "utf8");
    // The CameraFeedPanel renders LiveFeedVideo when liveFeedUrl is set,
    // and the synthetic R3F Canvas when it isn't. Both branches live in
    // the same tile so a partially-bound wall renders a mix.
    expect(source).toMatch(/camData\.liveFeedUrl\s*\?\s*\(/);
    expect(source).toContain("<LiveFeedVideo");
    expect(source).toContain("<Canvas");
  });

  test("LiveFeedVideo surfaces a fallback badge when the browser cannot decode the URL", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("Feed Unreachable");
    // Browser-safe message: RTSP is not natively supported.
    expect(source).toContain("RTSP needs an HLS/MJPEG proxy");
  });

  test("LiveFeedVideo displays a 'Live' indicator so the wall is honest about what's real", () => {
    const source = readFileSync(wallViewPath, "utf8");
    // The tile must distinguish live vs simulated at a glance.
    expect(source).toMatch(/>\s*Live\s*</);
  });

  test("LiveFeedVideo resets its load state when the URL changes", () => {
    const source = readFileSync(wallViewPath, "utf8");
    // useEffect that flips loadState back to "loading" on URL change is
    // the only way to avoid a stale error badge when rebinding a camera.
    expect(source).toMatch(/useEffect[\s\S]*setLoadState\("loading"\)[\s\S]*\[feedUrl\]/);
  });
});