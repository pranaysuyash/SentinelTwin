import * as THREE from "three";

type ClockLike = {
  autoStart: boolean;
  startTime: number;
  oldTime: number;
  elapsedTime: number;
  running: boolean;
};

class CompatClock implements ClockLike {
  autoStart: boolean;
  startTime: number;
  oldTime: number;
  elapsedTime: number;
  running: boolean;

  constructor(autoStart = true) {
    this.autoStart = autoStart;
    this.startTime = 0;
    this.oldTime = 0;
    this.elapsedTime = 0;
    this.running = false;
  }

  start() {
    this.startTime = performance.now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    let diff = 0;

    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }

    if (this.running) {
      const newTime = performance.now();
      diff = (newTime - this.oldTime) / 1000;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }

    return diff;
  }
}

const compatThree = THREE as typeof THREE & {
  __sentinelTwinClockPatched?: boolean;
};

if (!compatThree.__sentinelTwinClockPatched) {
  // Three.js now exposes Clock as a read-only export in this environment.
  // Keep the compatibility module as a no-op side-effect guard so imports
  // remain safe without mutating the library namespace.
  compatThree.__sentinelTwinClockPatched = true;
}

export { CompatClock };
