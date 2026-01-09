import type { Snake } from "../entities/Snake";
import { EFFECT_DURATION, type AppleColor } from "../utils/constants";
import { audioManager } from "./AudioManager";

export interface ActiveGlobalEffect {
  type: AppleColor;
  startTime: number;
  duration: number;
  triggeredBy: number; // playerId
}

// Callbacks for effects that need external handling
export interface EffectCallbacks {
  onProjectileSpawn: (snake: Snake) => void;
  onAppleRain: () => void;
  onRainEffectStart: () => void;
  onRainEffectEnd: () => void;
}

export class EffectManager {
  // Global effects (affect all players, like blue rain)
  private globalEffects: Map<AppleColor, ActiveGlobalEffect> = new Map();

  // Callbacks
  private callbacks: EffectCallbacks;

  constructor(callbacks: EffectCallbacks) {
    this.callbacks = callbacks;
  }

  // Apply effect when 3-combo is achieved
  applyEffect(color: AppleColor, snake: Snake): void {
    switch (color) {
      case "red":
        this.applySpeedBoost(snake);
        break;
      case "green":
        this.applySlowDown(snake);
        break;
      case "blue":
        this.applyRainDistortion(snake.playerId);
        break;
      case "orange":
        this.applyProjectile(snake);
        break;
      case "purple":
        this.applyAppleRain();
        break;
    }
  }

  // Red effect: 50% speed boost for 10 seconds
  private applySpeedBoost(snake: Snake): void {
    snake.applyEffect("red", EFFECT_DURATION);
  }

  // Green effect: 50% speed reduction for 10 seconds
  private applySlowDown(snake: Snake): void {
    snake.applyEffect("green", EFFECT_DURATION);
  }

  // Blue effect: Rain distortion affecting all players
  private applyRainDistortion(triggeredByPlayerId: number): void {
    // Clear any existing rain effect
    if (this.globalEffects.has("blue")) {
      this.globalEffects.delete("blue");
    }

    this.globalEffects.set("blue", {
      type: "blue",
      startTime: performance.now(),
      duration: EFFECT_DURATION,
      triggeredBy: triggeredByPlayerId,
    });

    this.callbacks.onRainEffectStart();
    audioManager.startAmbient("rain", "rain");
  }

  // Orange effect: Spawn projectile
  private applyProjectile(snake: Snake): void {
    this.callbacks.onProjectileSpawn(snake);
  }

  // Purple effect: Spawn 10 additional apples
  private applyAppleRain(): void {
    this.callbacks.onAppleRain();
  }

  // Update global effects (check for expiration)
  update(_deltaTime: number): void {
    const now = performance.now();

    for (const [color, effect] of this.globalEffects) {
      if (now - effect.startTime >= effect.duration) {
        this.globalEffects.delete(color);

        // Handle effect end
        if (color === "blue") {
          this.callbacks.onRainEffectEnd();
          audioManager.stopAmbient("rain");
        }
      }
    }
  }

  // Check if a global effect is active
  hasGlobalEffect(color: AppleColor): boolean {
    return this.globalEffects.has(color);
  }

  // Get global effect info for rendering
  getGlobalEffect(color: AppleColor): ActiveGlobalEffect | undefined {
    return this.globalEffects.get(color);
  }

  // Get progress of a global effect (0 to 1, 1 = expired)
  getGlobalEffectProgress(color: AppleColor): number {
    const effect = this.globalEffects.get(color);
    if (!effect) return 1;

    const elapsed = performance.now() - effect.startTime;
    return Math.min(1, elapsed / effect.duration);
  }

  // Get remaining time for global effect
  getGlobalEffectRemainingTime(color: AppleColor): number {
    const effect = this.globalEffects.get(color);
    if (!effect) return 0;

    const elapsed = performance.now() - effect.startTime;
    return Math.max(0, effect.duration - elapsed);
  }

  // Get all active global effects for rendering
  getActiveGlobalEffects(): ReadonlyArray<ActiveGlobalEffect> {
    return Array.from(this.globalEffects.values());
  }

  // Reset for new game
  reset(): void {
    // End any active effects
    if (this.globalEffects.has("blue")) {
      this.callbacks.onRainEffectEnd();
      audioManager.stopAmbient("rain");
    }
    this.globalEffects.clear();
  }
}
