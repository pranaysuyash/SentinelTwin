#!/usr/bin/env node

import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = 3001;
const HOST = "127.0.0.1";
const mode = process.argv[2];
const devBundler = (process.env.STUDIO_DEV_BUNDLER ?? "turbopack").toLowerCase();

if (!mode || !["dev", "start"].includes(mode)) {
  console.error("Usage: node ./scripts/run-fixed-port.mjs <dev|start>");
  process.exit(1);
}

function isPortListening(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    const finish = (value) => {
      socket.removeAllListeners();
      socket.end();
      resolve(value);
    };

    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

const alreadyRunning = await isPortListening(PORT, HOST);

if (alreadyRunning) {
  console.error(
    `Port ${PORT} is already serving SentinelTwin Studio. Reuse http://localhost:${PORT} instead of starting a second instance. If you need a restart, stop the existing process and relaunch the same fixed port.`,
  );
  process.exit(1);
}

async function ensureDevBootstrapArtifacts({ cleanPages = false } = {}) {
  if (mode !== "dev") return;

  const nextDir = path.join(process.cwd(), ".next");
  const devDir = path.join(nextDir, "dev");
  const devCacheDir = path.join(devDir, "cache");
  const devServerDir = path.join(devDir, "server");
  const devPagesDir = path.join(devServerDir, "pages");

  if (cleanPages) {
    await fs.rm(devPagesDir, { recursive: true, force: true });
  }

  await fs.mkdir(devPagesDir, { recursive: true });
  await fs.mkdir(devCacheDir, { recursive: true });

  async function writeIfMissing(filePath, contents) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${contents}\n`);
    }
  }

  const routesManifestPath = path.join(devDir, "routes-manifest.json");
  const routesManifest = {
    version: 3,
    pages404: true,
    appType: "app",
    caseSensitive: false,
    basePath: "",
    redirects: [],
    headers: [],
    onMatchHeaders: [],
    rewrites: {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    },
    dynamicRoutes: [],
    staticRoutes: [
      {
        page: "/",
        regex: "^/(?:/)?$",
        routeKeys: {},
        namedRegex: "^/(?:/)?$",
      },
    ],
    dataRoutes: [],
    rsc: {
      header: "rsc",
      varyHeader: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
      prefetchHeader: "next-router-prefetch",
      didPostponeHeader: "x-nextjs-postponed",
      contentTypeHeader: "text/x-component",
      suffix: ".rsc",
      prefetchSegmentHeader: "next-router-segment-prefetch",
      prefetchSegmentSuffix: ".segment.rsc",
      prefetchSegmentDirSuffix: ".segments",
      clientParamParsing: false,
      dynamicRSCPrerender: false,
    },
    rewriteHeaders: {
      pathHeader: "x-nextjs-rewritten-path",
      queryHeader: "x-nextjs-rewritten-query",
    },
    skipProxyUrlNormalize: false,
  };

  await writeIfMissing(routesManifestPath, JSON.stringify(routesManifest, null, 2));

  const prerenderManifestPath = path.join(devDir, "prerender-manifest.json");
  const prerenderManifest = {
    version: 4,
    routes: {
      "/": {
        experimentalBypassFor: [
          { type: "header", key: "next-action" },
          { type: "header", key: "content-type", value: "multipart/form-data;.*" },
        ],
        initialRevalidateSeconds: false,
        srcRoute: "/",
        dataRoute: "/index.rsc",
        allowHeader: [
          "host",
          "x-matched-path",
          "x-prerender-revalidate",
          "x-prerender-revalidate-if-generated",
          "x-next-revalidated-tags",
          "x-next-revalidate-tag-token",
        ],
      },
      "/_global-error": {
        experimentalBypassFor: [
          { type: "header", key: "next-action" },
          { type: "header", key: "content-type", value: "multipart/form-data;.*" },
        ],
        initialRevalidateSeconds: false,
        srcRoute: "/_global-error",
        dataRoute: "/_global-error.rsc",
        allowHeader: [
          "host",
          "x-matched-path",
          "x-prerender-revalidate",
          "x-prerender-revalidate-if-generated",
          "x-next-revalidated-tags",
          "x-next-revalidate-tag-token",
        ],
      },
      "/_not-found": {
        initialStatus: 404,
        experimentalBypassFor: [
          { type: "header", key: "next-action" },
          { type: "header", key: "content-type", value: "multipart/form-data;.*" },
        ],
        initialRevalidateSeconds: false,
        srcRoute: "/_not-found",
        dataRoute: "/_not-found.rsc",
        allowHeader: [
          "host",
          "x-matched-path",
          "x-prerender-revalidate",
          "x-prerender-revalidate-if-generated",
          "x-next-revalidated-tags",
          "x-next-revalidate-tag-token",
        ],
      },
    },
    dynamicRoutes: {},
    notFoundRoutes: [],
    preview: {
      previewModeId: "bootstrap-preview-mode-id",
      previewModeSigningKey: "bootstrap-preview-mode-signing-key",
      previewModeEncryptionKey: "bootstrap-preview-mode-encryption-key",
    },
  };
  await writeIfMissing(prerenderManifestPath, JSON.stringify(prerenderManifest, null, 2));

  const middlewareManifestPath = path.join(devServerDir, "middleware-manifest.json");
  const middlewareManifest = {
    version: 3,
    middleware: {},
    functions: {},
    sortedMiddleware: [],
  };
  await writeIfMissing(middlewareManifestPath, JSON.stringify(middlewareManifest, null, 2));

  const appPathsManifestPath = path.join(devServerDir, "app-paths-manifest.json");
  const appPathsManifest = {
    "/page": "app/page.js",
    "/_not-found": "app/not-found.js",
    "/_error": "app/page.js",
  };
  await writeIfMissing(appPathsManifestPath, JSON.stringify(appPathsManifest, null, 2));

  const appBuildManifestPath = path.join(devServerDir, "app", "build-manifest.json");
  const appBuildManifest = {
    "pages": {},
    "devFiles": [],
    "polyfillFiles": [
      "static/chunks/009k_next_dist_build_polyfills_polyfill-nomodule.js",
    ],
    "lowPriorityFiles": [],
    "rootMainFiles": [],
    "ampFirstPages": [],
  };
  await writeIfMissing(appBuildManifestPath, JSON.stringify(appBuildManifest, null, 2));

  const pageBuildManifestPath = path.join(devServerDir, "app", "page", "build-manifest.json");
  const pageBuildManifest = {
    devFiles: [],
    ampDevFiles: [],
    polyfillFiles: [
      "static/chunks/009k_next_dist_build_polyfills_polyfill-nomodule.js",
    ],
    lowPriorityFiles: [],
    rootMainFiles: [
      "static/chunks/[turbopack]_browser_dev_hmr-client_hmr-client_ts_0j0oemo._.js",
      "static/chunks/009k_next_dist_compiled_next-devtools_index_0z7gsmq.js",
      "static/chunks/009k_next_dist_compiled_react-dom_0isg2b9._.js",
      "static/chunks/009k_next_dist_compiled_react-server-dom-turbopack_05098jq._.js",
      "static/chunks/009k_next_dist_compiled_0wt-3nb._.js",
      "static/chunks/009k_next_dist_client_0x9d1-q._.js",
      "static/chunks/009k_next_dist_0.~rjop._.js",
      "static/chunks/0i4a_@swc_helpers_cjs_0hvz.20._.js",
      "static/chunks/apps_studio_0rqeker._.js",
      "static/chunks/turbopack-apps_studio_0snlx.8._.js",
    ],
    pages: {},
    ampFirstPages: [],
  };
  await writeIfMissing(pageBuildManifestPath, JSON.stringify(pageBuildManifest, null, 2));

  const documentShimPath = path.join(devServerDir, "pages", "_document.js");
  const documentShim = `'use strict';\n\nconst documentModule = require('next/dist/pages/_document');\nconst document = documentModule.default || documentModule;\n\nmodule.exports = document;\n`;
  await writeIfMissing(documentShimPath, documentShim);

  const devStaticDir = path.join(devDir, "static");
  const staticAliasDir = path.join(nextDir, "static");
  try {
    await fs.access(devStaticDir);
    await fs.rm(staticAliasDir, { recursive: true, force: true });
    await fs.symlink(devStaticDir, staticAliasDir, "dir");
  } catch {
    // If the dev asset tree is not ready yet, Next will create it on demand.
  }
}

async function ensureProductionBootstrapArtifacts() {
  if (mode !== "start") return;

  const nextDir = path.join(process.cwd(), ".next");
  const requiredServerFilesJsonPath = path.join(nextDir, "required-server-files.json");
  const requiredServerFilesJsPath = path.join(nextDir, "required-server-files.js");

  try {
    await fs.access(requiredServerFilesJsonPath);
  } catch {
    try {
      const manifestSource = await fs.readFile(requiredServerFilesJsPath, "utf8");
      const manifestJson = manifestSource
        .replace(/^self\.__SERVER_FILES_MANIFEST=/, "")
        .replace(/;\s*$/, "");
      await fs.writeFile(requiredServerFilesJsonPath, `${manifestJson}\n`);
    } catch {
      // If the manifest cannot be derived, let Next report the underlying build issue.
    }
  }

  const serverPagesDir = path.join(nextDir, "server", "pages");
  await fs.mkdir(serverPagesDir, { recursive: true });

  const error500Path = path.join(serverPagesDir, "500.html");
  try {
    await fs.access(error500Path);
  } catch {
    await fs.writeFile(
      error500Path,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SentinelTwin Studio</title></head><body></body></html>\n`,
    );
  }
}

await ensureProductionBootstrapArtifacts();

const devArgs = devBundler === "webpack"
  ? ["dev", "--webpack", "-p", String(PORT)]
  : ["dev", "--turbopack", "-p", String(PORT)];
const nextArgs = mode === "dev" ? devArgs : ["start", "-p", String(PORT)];
const localNextBinary = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [localNextBinary, ...nextArgs], {
  env: {
    ...process.env,
    HOSTNAME: HOST,
    PORT: String(PORT),
  },
  stdio: "inherit",
});

if (mode === "dev" && devBundler === "turbopack") {
  await ensureDevBootstrapArtifacts({ cleanPages: true });

  for (const delayMs of [1000, 3000, 7000, 15000, 30000, 45000]) {
    setTimeout(() => {
      ensureDevBootstrapArtifacts().catch((error) => {
        console.warn(`Unable to refresh Next dev bootstrap artifacts after ${delayMs}ms:`, error.message);
      });
    }, delayMs);
  }
}

child.on("error", (error) => {
  console.error(`Failed to launch Next.js on fixed port ${PORT}:`, error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
