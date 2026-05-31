import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pagePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../app/page.tsx");
const routerPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../product/ProductViewRouter.tsx");
const storePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../store/product-view-store.ts");

describe("Root routing contract", () => {
  test("renders via ProductViewRouter with product_home as default", () => {
    const source = readFileSync(pagePath, "utf8");

    // Root page uses ProductViewRouter instead of modal flags
    expect(source).toContain("ProductViewRouter");
    expect(source).toContain("const handlers: ProductViewHandlers");
    // Default product view is product_home
    expect(source).not.toContain("const [enterStudio, setEnterStudio] = useState(false)");
    expect(source).not.toContain("if (enterStudio) {");
    expect(source).not.toContain("shouldBypassLauncher");
  });

  test("ProductViewRouter switches between product-level views", () => {
    const routerSource = readFileSync(routerPath, "utf8");

    expect(routerSource).toContain('productView === "product_home"');
    expect(routerSource).toContain('productView === "site_intake"');
    expect(routerSource).toContain('productView === "scan_site"');
    expect(routerSource).toContain('productView === "studio"');
    expect(routerSource).toContain("useProductViewStore");
  });

  test("ProductView type is defined in a separate store", () => {
    const storeSource = readFileSync(storePath, "utf8");

    expect(storeSource).toContain('type ProductView =');
    expect(storeSource).toContain('"product_home"');
    expect(storeSource).toContain('"site_intake"');
    expect(storeSource).toContain('"studio"');
    expect(storeSource).toContain('navigate:');
    expect(storeSource).toContain('goHome:');
  });
});
