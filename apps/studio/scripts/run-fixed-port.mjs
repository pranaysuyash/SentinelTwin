#!/usr/bin/env node

import net from "node:net";
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

const nextArgs = mode === "dev" ? ["dev", "--webpack", "-p", String(PORT)] : ["start", "-p", String(PORT)];
const child = spawn("next", nextArgs, {
  env: {
    ...process.env,
    HOSTNAME: HOST,
    PORT: String(PORT),
  },
  stdio: "inherit",
});

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
