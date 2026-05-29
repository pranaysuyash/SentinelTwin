#!/usr/bin/env node

import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = 3000;
const HOST = "127.0.0.1";
const mode = process.argv[2];

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

async function ensureDevBootstrapArtifacts() {
  if (mode !== "dev") return;

  const nextDir = path.join(process.cwd(), ".next");
  const devDir = path.join(nextDir, "dev");
  const devServerDir = path.join(devDir, "server");
  const devPagesDir = path.join(devServerDir, "pages");

  await fs.mkdir(devPagesDir, { recursive: true });

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

  await fs.writeFile(routesManifestPath, `${JSON.stringify(routesManifest, null, 2)}\n`);

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
  await fs.writeFile(prerenderManifestPath, `${JSON.stringify(prerenderManifest, null, 2)}\n`);

  const middlewareManifestPath = path.join(devServerDir, "middleware-manifest.json");
  const middlewareManifest = {
    version: 3,
    middleware: {},
    functions: {},
    sortedMiddleware: [],
  };
  await fs.writeFile(middlewareManifestPath, `${JSON.stringify(middlewareManifest, null, 2)}\n`);

  const documentShimPath = path.join(devServerDir, "pages", "_document.js");
  const documentShim = `'use strict';\n\nconst documentModule = require('next/dist/pages/_document');\nconst document = documentModule.default || documentModule;\n\nmodule.exports = document;\n`;
  await fs.writeFile(documentShimPath, documentShim);
}

await ensureDevBootstrapArtifacts();

const nextArgs = mode === "dev" ? ["dev", "--webpack", "-p", String(PORT)] : ["start", "-p", String(PORT)];
const child = spawn("next", nextArgs, {
  env: {
    ...process.env,
    HOSTNAME: HOST,
    PORT: String(PORT),
  },
  stdio: "inherit",
});

let bootstrapWatch = null;
if (mode === "dev") {
  bootstrapWatch = setInterval(() => {
    ensureDevBootstrapArtifacts().catch((error) => {
      console.error(`Failed to seed Next.js dev bootstrap artifacts: ${error.message}`);
    });
  }, 250);
}

child.on("error", (error) => {
  if (bootstrapWatch) clearInterval(bootstrapWatch);
  console.error(`Failed to launch Next.js on fixed port ${PORT}:`, error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (bootstrapWatch) clearInterval(bootstrapWatch);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
