import { Apple, type Position } from "../entities/Apple";
import type { Snake } from "../entities/Snake";
import {
  MIN_APPLES,
  PURPLE_APPLE_SPAWN_COUNT,
  type AppleColor,
  type BoardSize,
} from "../utils/constants";

export interface AppleManagerConfig {
  boardSize: BoardSize;
}

// Callback types for external notifications
export type AppleConsumedCallback = (
  apple: Apple,
  snake: Snake,
  triggeredEffect: boolean
) => void;

export class AppleManager {
  private apples: Map<number, Apple> = new Map();
  private nextAppleId: number = 1;
  private boardSize: BoardSize;

  // Track occupied positions (snakes, gray blocks)
  private occupiedPositions: Set<string> = new Set();

  // Callbacks
  private onAppleConsumed: AppleConsumedCallback | null = null;

  constructor(config: AppleManagerConfig) {
    this.boardSize = config.boardSize;
  }

  // Initialize with starting apples
  initialize(): void {
    this.apples.clear();
    this.nextAppleId = 1;

    // Spawn initial apples
    for (let i = 0; i < MIN_APPLES; i++) {
      this.spawnRandomApple();
    }
  }

  // Set callback for apple consumption
  setAppleConsumedCallback(callback: AppleConsumedCallback): void {
    this.onAppleConsumed = callback;
  }

  // Update occupied positions from external sources (snakes, blocks)
  updateOccupiedPositions(positions: Position[]): void {
    this.occupiedPositions.clear();
    for (const pos of positions) {
      this.occupiedPositions.add(this.positionKey(pos));
    }
  }

  // Add positions to occupied set
  addOccupiedPositions(positions: Position[]): void {
    for (const pos of positions) {
      this.occupiedPositions.add(this.positionKey(pos));
    }
  }

  private positionKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  // Update all apples
  update(deltaTime: number): void {
    for (const apple of this.apples.values()) {
      apple.update(deltaTime);
    }

    // Maintain minimum apple count
    this.maintainMinimumApples();
  }

  private maintainMinimumApples(): void {
    // Count active + spawning apples
    const activeCount = this.getActiveAppleCount();

    if (activeCount < MIN_APPLES) {
      const toSpawn = MIN_APPLES - activeCount;
      for (let i = 0; i < toSpawn; i++) {
        this.spawnRandomApple();
      }
    }
  }

  // Spawn a random apple at a random empty position
  spawnRandomApple(): Apple | null {
    const position = this.findEmptyPosition();
    if (!position) return null;

    const apple = Apple.createRandom(this.nextAppleId++, position);
    this.apples.set(apple.id, apple);
    return apple;
  }

  // Spawn apple at specific position with specific color
  spawnApple(position: Position, color: AppleColor): Apple | null {
    // Check if position is valid
    if (this.isPositionOccupied(position)) return null;

    const apple = new Apple(this.nextAppleId++, color, position);
    this.apples.set(apple.id, apple);
    return apple;
  }

  // Spawn multiple apples (for purple effect)
  spawnAppleRain(): Apple[] {
    const spawned: Apple[] = [];

    for (let i = 0; i < PURPLE_APPLE_SPAWN_COUNT; i++) {
      const apple = this.spawnRandomApple();
      if (apple) {
        spawned.push(apple);
      }
    }

    return spawned;
  }

  // Find an empty position on the board
  private findEmptyPosition(): Position | null {
    // Get all apple positions
    const applePositions = new Set<string>();
    for (const apple of this.apples.values()) {
      applePositions.add(this.positionKey(apple.position));
    }

    // Try random positions first (faster for sparse boards)
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const pos: Position = {
        x: Math.floor(Math.random() * this.boardSize),
        y: Math.floor(Math.random() * this.boardSize),
      };
      const key = this.positionKey(pos);

      if (!this.occupiedPositions.has(key) && !applePositions.has(key)) {
        return pos;
      }
    }

    // Fallback: scan all positions (for dense boards)
    const emptyPositions: Position[] = [];
    for (let x = 0; x < this.boardSize; x++) {
      for (let y = 0; y < this.boardSize; y++) {
        const pos: Position = { x, y };
        const key = this.positionKey(pos);
        if (!this.occupiedPositions.has(key) && !applePositions.has(key)) {
          emptyPositions.push(pos);
        }
      }
    }

    if (emptyPositions.length === 0) return null;

    return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  }

  private isPositionOccupied(pos: Position): boolean {
    const key = this.positionKey(pos);

    // Check external occupied positions
    if (this.occupiedPositions.has(key)) return true;

    // Check existing apples
    for (const apple of this.apples.values()) {
      if (apple.isAt(pos)) return true;
    }

    return false;
  }

  // Check if a snake's head is on an apple
  checkCollision(snake: Snake): Apple | null {
    const head = snake.getHead();

    for (const apple of this.apples.values()) {
      if (apple.isActive() && apple.isAt(head)) {
        return apple;
      }
    }

    return null;
  }

  // Handle snake eating an apple
  consumeApple(apple: Apple, snake: Snake): boolean {
    if (!this.apples.has(apple.id)) return false;

    apple.consume();
    this.apples.delete(apple.id);

    // Snake eats apple and potentially triggers combo effect
    const triggeredEffect = snake.eatApple(apple.color);

    // Notify callback
    if (this.onAppleConsumed) {
      this.onAppleConsumed(apple, snake, triggeredEffect);
    }

    return triggeredEffect;
  }

  // Get all apples for rendering
  getApples(): ReadonlyArray<Apple> {
    return Array.from(this.apples.values());
  }

  // Get count of active apples (not consumed)
  getActiveAppleCount(): number {
    let count = 0;
    for (const apple of this.apples.values()) {
      if (apple.getState() !== "consumed") {
        count++;
      }
    }
    return count;
  }

  // Get apple at position (for projectile collision)
  getAppleAt(pos: Position): Apple | null {
    for (const apple of this.apples.values()) {
      if (apple.isAt(pos)) {
        return apple;
      }
    }
    return null;
  }

  // Remove apple by id
  removeApple(id: number): void {
    this.apples.delete(id);
  }

  // Reset for new game
  reset(boardSize: BoardSize): void {
    this.boardSize = boardSize;
    this.apples.clear();
    this.occupiedPositions.clear();
    this.nextAppleId = 1;
  }
}
