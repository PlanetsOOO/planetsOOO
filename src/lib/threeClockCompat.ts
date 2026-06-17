import * as THREE from "three";

/**
 * R3F v9 still constructs THREE.Clock, which logs a deprecation warning in
 * three.js r183+. Use a drop-in replacement until we adopt R3F v10.
 */
export function installThreeClockCompat(): void {
  const marker = "__orbitClockCompat";
  if ((THREE.Clock as unknown as Record<string, boolean>)[marker]) {
    return;
  }

  class OrbitClock {
    autoStart: boolean;
    startTime = 0;
    oldTime = 0;
    elapsedTime = 0;
    running = false;

    constructor(autoStart = true) {
      this.autoStart = autoStart;
    }

    start(): void {
      this.startTime = performance.now();
      this.oldTime = this.startTime;
      this.elapsedTime = 0;
      this.running = true;
    }

    stop(): void {
      this.getElapsedTime();
      this.running = false;
      this.autoStart = false;
    }

    getElapsedTime(): number {
      this.getDelta();
      return this.elapsedTime;
    }

    getDelta(): number {
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

  (OrbitClock as unknown as Record<string, boolean>)[marker] = true;
  const threeNamespace = THREE as unknown as Record<string, unknown>;
  threeNamespace.Clock = OrbitClock;
}
