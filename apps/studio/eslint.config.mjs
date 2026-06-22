import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Visual Pass V1 — ban raw Tailwind semantic-color utilities in chrome.
 *
 * Flags `text-emerald-300`, `bg-sky-500/10`, `border-amber-500/30`, etc. in
 * the chrome directories (view / bottom-panel / dock / top-bar / layout) and
 * points to `UI_TONES` (`@/lib/design-tokens`) instead. The canonical semantic
 * palette lives there; raw utilities had drifted across ~30 files.
 *
 * Scope (per motto_v3 §11 — no conflated sources of truth):
 *   - Canvas geometry keeps using `MAP_COLORS` (`@/components/map/map-colors`)
 *     — that's a *different* concern (deterministic sim colors) and is exempt.
 *   - `design-tokens.ts` itself is exempt (it defines the class fragments).
 *   - Test files are exempt (test assertions on exact classes are brittle
 *     enough without a lint rule).
 *
 * Implemented as a lightweight regex-based `no-restricted-syntax`-style check
 * via a custom rule object, so it runs in the existing flat-config pipeline
 * without a separate plugin package.
 */
const CHROME_DIRS = [
  "src/components/view/**",
  "src/components/bottom-panel/**",
  "src/components/dock/**",
  "src/components/top-bar/**",
  "src/components/layout/**",
  "src/components/inspector/**",
  "src/components/shared/**",
  "src/components/launcher/**",
  "src/components/site-intake/**",
  "src/components/scan-to-scene/**",
  "src/components/product/**",
  "src/components/security-outcome/**",
];
const SEMANTIC_COLOR_RE =
  /\b(text|bg|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(emerald|sky|rose|amber|red|violet|purple|indigo|cyan|green|blue|yellow|pink|fuchsia)-\d/;
const RAW_HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

const noRawChromeColorsRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Ban raw Tailwind semantic-color utilities and hex literals in chrome — use UI_TONES from @/lib/design-tokens (Visual Pass V1).",
    },
    schema: [],
    messages: {
      rawTailwind:
        "Avoid raw Tailwind color utility '{{match}}' in chrome — use UI_TONES from @/lib/design-tokens so the semantic palette has one owner (Visual Pass V1).",
      rawHex:
        "Avoid raw hex color '{{match}}' in chrome — use UI_TONES (@/lib/design-tokens) for semantic tones or MAP_COLORS (@/components/map/map-colors) for canvas geometry (Visual Pass V1).",
    },
  },
  create(context) {
    // The filename.id pattern from context determines applicability; the flat
    // config `files` array below already restricts to chrome dirs. We keep
    // design-tokens.ts and test files exempt via explicit filename checks.
    const filename = context.filename ?? "";
    if (
      filename.endsWith("design-tokens.ts") ||
      filename.endsWith("confidence-display.ts") ||
      filename.includes("/__tests__/") ||
      filename.endsWith(".test.ts") ||
      filename.endsWith(".test.tsx")
    ) {
      return {};
    }
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        const value = node.value;
        const tailwindMatch = value.match(SEMANTIC_COLOR_RE);
        if (tailwindMatch) {
          context.report({ node, messageId: "rawTailwind", data: { match: tailwindMatch[0] } });
          return;
        }
        const hexMatch = value.match(RAW_HEX_RE);
        if (hexMatch) {
          context.report({ node, messageId: "rawHex", data: { match: hexMatch[0] } });
        }
      },
      // Tailwind classes are also frequently built via template literals or
      // cn(...) arguments — catch those via Literal covers most; JSXAttribute
      // string values are Literal nodes already so this is sufficient.
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Visual Pass V1 — custom rule scoped to chrome directories.
  {
    files: CHROME_DIRS,
    plugins: {
      "sentinel-design": {
        rules: {
          "no-raw-chrome-colors": noRawChromeColorsRule,
        },
      },
    },
    rules: {
      "sentinel-design/no-raw-chrome-colors": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

