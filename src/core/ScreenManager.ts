import type { Canvas } from "./Canvas";

// Base interface for all screens
export interface Screen {
  update(deltaTime: number): void;
  render(interpolation: number): void;
  onEnter?(): void;
  onExit?(): void;
}

export type TransitionType = "fade" | "none";

interface TransitionState {
  type: TransitionType;
  progress: number; // 0 to 1
  duration: number; // ms
  phase: "out" | "in";
  fromScreen: Screen | null;
  toScreen: Screen;
}

export class ScreenManager {
  private canvas: Canvas;
  private currentScreen: Screen | null = null;
  private transition: TransitionState | null = null;
  private transitionStartTime: number = 0;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  // Set screen immediately without transition
  setScreen(screen: Screen): void {
    if (this.currentScreen?.onExit) {
      this.currentScreen.onExit();
    }

    this.currentScreen = screen;

    if (screen.onEnter) {
      screen.onEnter();
    }
  }

  // Transition to a new screen
  transitionTo(
    screen: Screen,
    type: TransitionType = "fade",
    duration: number = 300
  ): void {
    if (type === "none") {
      this.setScreen(screen);
      return;
    }

    this.transition = {
      type,
      progress: 0,
      duration,
      phase: "out",
      fromScreen: this.currentScreen,
      toScreen: screen,
    };
    this.transitionStartTime = performance.now();
  }

  update(deltaTime: number): void {
    // Update transition
    if (this.transition) {
      const elapsed = performance.now() - this.transitionStartTime;
      const halfDuration = this.transition.duration / 2;

      if (this.transition.phase === "out") {
        this.transition.progress = Math.min(1, elapsed / halfDuration);

        if (elapsed >= halfDuration) {
          // Switch screens at midpoint
          if (this.transition.fromScreen?.onExit) {
            this.transition.fromScreen.onExit();
          }

          this.currentScreen = this.transition.toScreen;

          if (this.currentScreen.onEnter) {
            this.currentScreen.onEnter();
          }

          this.transition.phase = "in";
          this.transitionStartTime = performance.now();
        }
      } else {
        this.transition.progress = 1 - Math.min(1, elapsed / halfDuration);

        if (elapsed >= halfDuration) {
          // Transition complete
          this.transition = null;
        }
      }
    }

    // Update current screen
    if (this.currentScreen) {
      this.currentScreen.update(deltaTime);
    }
  }

  render(interpolation: number): void {
    // Render current screen
    if (this.currentScreen) {
      this.currentScreen.render(interpolation);
    }

    // Render transition overlay
    if (this.transition) {
      this.renderTransition();
    }
  }

  private renderTransition(): void {
    if (!this.transition) return;

    const ctx = this.canvas.ctx;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    switch (this.transition.type) {
      case "fade":
        ctx.fillStyle = `rgba(0, 0, 0, ${this.transition.progress})`;
        ctx.fillRect(0, 0, width, height);
        break;
    }
  }

  getCurrentScreen(): Screen | null {
    return this.currentScreen;
  }

  isTransitioning(): boolean {
    return this.transition !== null;
  }
}
