import type { Direction, BoardSize } from "../utils/constants";

export interface Position {
  x: number;
  y: number;
}

export type ProjectileState = "active" | "hit" | "expired";

export class Projectile {
  readonly id: number;
  readonly ownerId: number; // playerId of the snake that fired it

  private position: Position;
  private direction: Direction;
  private boardSize: BoardSize;

  private state: ProjectileState = "active";
  private speed: number = 20; // tiles per second (fast!)
  private moveAccumulator: number = 0;

  // For smooth rendering interpolation
  private prevPosition: Position;

  // Trail effect positions (last few positions)
  private trail: Position[] = [];
  private maxTrailLength: number = 5;

  constructor(
    id: number,
    ownerId: number,
    position: Position,
    direction: Direction,
    boardSize: BoardSize
  ) {
    this.id = id;
    this.ownerId = ownerId;
    this.position = { ...position };
    this.prevPosition = { ...position };
    this.direction = direction;
    this.boardSize = boardSize;
  }

  update(deltaTime: number): boolean {
    if (this.state !== "active") return false;

    // Calculate movement
    const moveInterval = 1000 / this.speed;
    this.moveAccumulator += deltaTime;

    let moved = false;
    while (this.moveAccumulator >= moveInterval) {
      this.moveAccumulator -= moveInterval;
      moved = this.move();

      if (!moved) {
        // Hit a wall
        this.state = "expired";
        return false;
      }
    }

    return moved;
  }

  private move(): boolean {
    // Save previous position for interpolation
    this.prevPosition = { ...this.position };

    // Add current position to trail
    this.trail.push({ ...this.position });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    // Calculate new position
    const deltas: Record<Direction, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    const delta = deltas[this.direction];
    const newX = this.position.x + delta.dx;
    const newY = this.position.y + delta.dy;

    // Check wall collision (no wrapping for projectiles)
    if (
      newX < 0 ||
      newX >= this.boardSize ||
      newY < 0 ||
      newY >= this.boardSize
    ) {
      return false; // Hit wall
    }

    this.position.x = newX;
    this.position.y = newY;
    return true;
  }

  getPosition(): Position {
    return { ...this.position };
  }

  getPrevPosition(): Position {
    return { ...this.prevPosition };
  }

  getDirection(): Direction {
    return this.direction;
  }

  getState(): ProjectileState {
    return this.state;
  }

  isActive(): boolean {
    return this.state === "active";
  }

  // Get trail positions for rendering
  getTrail(): ReadonlyArray<Position> {
    return this.trail;
  }

  // Mark as hit (when hitting a gray block)
  hit(): void {
    this.state = "hit";
  }

  // Mark as expired
  expire(): void {
    this.state = "expired";
  }

  // Check if projectile is at a given position
  isAt(pos: Position): boolean {
    return this.position.x === pos.x && this.position.y === pos.y;
  }

  // Get interpolated position for smooth rendering
  getInterpolatedPosition(interpolation: number): Position {
    return {
      x:
        this.prevPosition.x +
        (this.position.x - this.prevPosition.x) * interpolation,
      y:
        this.prevPosition.y +
        (this.position.y - this.prevPosition.y) * interpolation,
    };
  }
}
