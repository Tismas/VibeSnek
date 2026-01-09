export type UpdateCallback = (deltaTime: number) => void;
export type RenderCallback = (interpolation: number) => void;

export class GameLoop {
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly timestep: number; // Fixed timestep in ms
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;

  private updateCallback: UpdateCallback | null = null;
  private renderCallback: RenderCallback | null = null;

  constructor(targetFPS: number = 60) {
    this.timestep = 1000 / targetFPS;
  }

  setUpdateCallback(callback: UpdateCallback): void {
    this.updateCallback = callback;
  }

  setRenderCallback(callback: RenderCallback): void {
    this.renderCallback = callback;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop(this.lastTime);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.loop);

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap delta time to prevent spiral of death
    const cappedDelta = Math.min(deltaTime, 250);
    this.accumulator += cappedDelta;

    // Fixed timestep updates
    while (this.accumulator >= this.timestep) {
      if (this.updateCallback) {
        this.updateCallback(this.timestep);
      }
      this.accumulator -= this.timestep;
    }

    // Render with interpolation for smooth visuals
    const interpolation = this.accumulator / this.timestep;
    if (this.renderCallback) {
      this.renderCallback(interpolation);
    }
  };

  isActive(): boolean {
    return this.isRunning;
  }

  getTimestep(): number {
    return this.timestep;
  }
}
