import { createElement } from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SceneFloatingCard } from "@/components/workspace/overlays/SceneFloatingCard";
import { CameraLabelCard } from "@/components/workspace/overlays/CameraLabelCard";

describe("SceneFloatingCard", () => {
  test("provides stable shell style defaults and accepts width/style overrides", () => {
    const html = renderToStaticMarkup(
      createElement(
        SceneFloatingCard,
        {
          borderColor: "#60a5fa",
          textAlign: "center",
          compact: true,
          minWidth: 160,
          maxWidth: "50vw",
          role: "note",
          ariaLabel: "camera marker shell",
          pointerEvents: "none",
          style: { marginTop: 6 },
        },
        createElement("span", null, "overlay shell"),
      ),
    );

    expect(html).toContain("overlay shell");
    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="camera marker shell"');
    expect(html).toContain("background:rgba(10,13,19,0.9)");
    expect(html).toContain("padding:2px 6px");
    expect(html).toContain("min-width:160px");
    expect(html).toContain("max-width:50vw");
    expect(html).toContain("text-align:center");
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("margin-top:6px");
  });
});

describe("CameraLabelCard", () => {
  test("renders compact active state as explicit Active label regardless of raw status", () => {
    const html = renderToStaticMarkup(
      createElement(CameraLabelCard, {
        name: "rear door",
        resolutionMP: 8,
        mountType: "wall",
        isActive: true,
        status: "off",
        selected: true,
        compact: true,
      }),
    );

    expect(html).toContain("REAR DOOR");
    expect(html).toContain("Active");
  });

  test("renders full label semantics for suggestions, hover state, and inactive status", () => {
    const html = renderToStaticMarkup(
      createElement(CameraLabelCard, {
        name: "lobby",
        resolutionMP: 4,
        mountType: "ceiling",
        isActive: false,
        status: "blocked",
        selected: false,
        hovered: true,
        isSuggested: true,
      }),
    );

    expect(html).toContain("LOBBY");
    expect(html).toContain("4MP · Ceiling mount");
    expect(html).toContain("Blocked");
    expect(html).toContain("SUGGESTED");
    expect(html).toContain("CLICK TO SELECT");
    expect(html).toContain('aria-label="lobby camera Blocked"');
  });
});
