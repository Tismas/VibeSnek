import { APPLE_COLORS, type AppleColor } from "../utils/constants";

export interface Position {
  x: number;
  y: number;
}

export type AppleState = "spawning" | "active" | "consumed";

export class Apple {
  readonly id: number;
  readonly color: AppleColor;
  readonly position: Position;

  private state: AppleState = "spawning";
  private spawnTime: number;
  private spawnAnimationDuration: number = 300; // ms

  constructor(id: number, color: AppleColor, position: Position) {
    this.id = id;
    this.color = color;
    this.position = { ...position };
    this.spawnTime = performance.now();
  }

  // Static factory for random apple
  static createRandom(id: number, position: Position): Apple {
    const randomIndex = Math.floor(Math.random() * APPLE_COLORS.length);
    const color = APPLE_COLORS[randomIndex];
    return new Apple(id, color, position);
  }

  update(_deltaTime: number): void {
    if (this.state === "spawning") {
      const elapsed = performance.now() - this.spawnTime;
      if (elapsed >= this.spawnAnimationDuration) {
        this.state = "active";
      }
    }
  }

  getState(): AppleState {
    return this.state;
  }

  isActive(): boolean {
    return this.state === "active";
  }

  isSpawning(): boolean {
    return this.state === "spawning";
  }

  // Get spawn animation progress (0 to 1)
  getSpawnProgress(): number {
    if (this.state !== "spawning") return 1;
    const elapsed = performance.now() - this.spawnTime;
    return Math.min(1, elapsed / this.spawnAnimationDuration);
  }

  consume(): void {
    this.state = "consumed";
  }

  // Check if apple is at a given position
  isAt(pos: Position): boolean {
    return this.position.x === pos.x && this.position.y === pos.y;
  }
}
