import type { Canvas } from "../core/Canvas";
import { COUNTDOWN_SECONDS } from "../utils/constants";

interface CountdownCallbacks {
  onComplete: () => void;
}

export class CountdownScreen {
  private canvas: Canvas;
  private callbacks: CountdownCallbacks;

  // Countdown state
  private currentCount: number = COUNTDOWN_SECONDS;
  private countdownStartTime: number = 0;
  private isActive: boolean = false;

  // Animation state
  private scale: number = 1;
  private opacity: number = 1;

  constructor(canvas: Canvas, callbacks: CountdownCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
  }

  start(): void {
    this.currentCount = COUNTDOWN_SECONDS;
    this.countdownStartTime = performance.now();
    this.isActive = true;
    this.scale = 1;
    this.opacity = 1;
  }

  stop(): void {
    this.isActive = false;
  }

  update(_deltaTime: number): void {
    if (!this.isActive) return;

    const elapsed = performance.now() - this.countdownStartTime;
    const secondsElapsed = Math.floor(elapsed / 1000);
    const newCount = COUNTDOWN_SECONDS - secondsElapsed;

    // Check if we moved to a new number
    if (newCount !== this.currentCount && newCount >= 0) {
      this.currentCount = newCount;
      this.scale = 1.5; // Start big
      this.opacity = 1;
    }

    // Animate within each second
    const progressInSecond = (elapsed % 1000) / 1000;

    // Scale down from 1.5 to 1.0 over 0.3 seconds, then hold
    if (progressInSecond < 0.3) {
      this.scale = 1.5 - 0.5 * (progressInSecond / 0.3);
    } else {
      this.scale = 1.0;
    }

    // Fade out in last 0.2 seconds (but not for "GO!")
    if (this.currentCount > 0 && progressInSecond > 0.8) {
      this.opacity = 1 - (progressInSecond - 0.8) / 0.2;
    } else if (this.currentCount === 0 && progressInSecond > 0.7) {
      // Fade out "GO!" at the end
      this.opacity = 1 - (progressInSecond - 0.7) / 0.3;
    } else {
      this.opacity = 1;
    }

    // Check if countdown complete (after "GO!" is shown for 1 second)
    if (newCount < 0) {
      this.isActive = false;
      this.callbacks.onComplete();
    }
  }

  render(_interpolation: number): void {
    if (!this.isActive) return;

    const ctx = this.canvas.ctx;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, width, height);

    // Draw countdown number or "GO!"
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = this.opacity;

    const displayText =
      this.currentCount > 0 ? this.currentCount.toString() : "GO!";

    // Text shadow/glow
    ctx.shadowColor = this.getCountdownColor();
    ctx.shadowBlur = 30;

    // Main text
    ctx.fillStyle = this.getCountdownColor();
    ctx.font = `bold ${
      this.currentCount > 0 ? 200 : 150
    }px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayText, 0, 0);

    // Outline for better visibility
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.strokeText(displayText, 0, 0);

    ctx.restore();

    // Draw "Get Ready!" subtitle for numbers
    if (this.currentCount > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity * 0.8})`;
      ctx.font = "bold 36px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Get Ready!", width / 2, height / 2 + 150);
    }
  }

  private getCountdownColor(): string {
    switch (this.currentCount) {
      case 3:
        return "#FF4444"; // Red
      case 2:
        return "#FFAA00"; // Orange
      case 1:
        return "#FFFF00"; // Yellow
      case 0:
        return "#44FF44"; // Green for GO!
      default:
        return "#FFFFFF";
    }
  }

  isRunning(): boolean {
    return this.isActive;
  }
}
