import {
  STARTING_SNAKE_LENGTH,
  TAIL_SHED_THRESHOLD,
  TAIL_SHED_REMAINING,
  SPAWN_POSITIONS,
  type Direction,
  type PlayerColor,
  type BoardSize,
  type AppleColor,
} from "../utils/constants";

export interface Position {
  x: number;
  y: number;
}

export interface SnakeSegment extends Position {
  // For smooth animation interpolation
  prevX: number;
  prevY: number;
}

export type SnakeState = "alive" | "dead" | "spectating";

export interface ActiveEffect {
  type: AppleColor;
  startTime: number;
  duration: number;
}

export interface ComboStreak {
  color: AppleColor | null;
  count: number;
}

// Callback for when the snake sheds its tail
export type TailShedCallback = (blocks: Position[]) => void;

export class Snake {
  // Identity
  readonly playerId: number;
  readonly playerSlot: number; // 0-3, determines spawn position
  readonly color: PlayerColor;
  name: string;

  // State
  private state: SnakeState = "alive";
  private segments: SnakeSegment[] = [];
  private direction: Direction;
  private queuedDirection: Direction | null = null;

  // Movement
  private boardSize: BoardSize;
  private baseSpeed: number; // tiles per second
  private speedModifier: number = 1.0;
  private moveAccumulator: number = 0;

  // Effects
  private activeEffects: Map<AppleColor, ActiveEffect> = new Map();
  private combo: ComboStreak = { color: null, count: 0 };

  // Callbacks
  private onTailShed: TailShedCallback | null = null;

  constructor(
    playerId: number,
    playerSlot: number,
    color: PlayerColor,
    name: string,
    boardSize: BoardSize,
    baseSpeed: number
  ) {
    this.playerId = playerId;
    this.playerSlot = playerSlot;
    this.color = color;
    this.name = name;
    this.boardSize = boardSize;
    this.baseSpeed = baseSpeed;

    // Get spawn position and direction from constants
    const spawn = SPAWN_POSITIONS[playerSlot];
    this.direction = spawn.direction;

    // Initialize segments at spawn position
    this.initializeSegments(spawn);
  }

  private initializeSegments(spawn: {
    x: number;
    y: number;
    direction: Direction;
  }): void {
    // Convert percentage position to tile position
    const headX = Math.floor(spawn.x * this.boardSize);
    const headY = Math.floor(spawn.y * this.boardSize);

    // Direction offsets for building the body behind the head
    const directionOffsets: Record<Direction, { dx: number; dy: number }> = {
      up: { dx: 0, dy: 1 },
      down: { dx: 0, dy: -1 },
      left: { dx: 1, dy: 0 },
      right: { dx: -1, dy: 0 },
    };

    const offset = directionOffsets[this.direction];

    // Create segments from head to tail
    for (let i = 0; i < STARTING_SNAKE_LENGTH; i++) {
      const x = this.wrapCoordinate(headX + offset.dx * i);
      const y = this.wrapCoordinate(headY + offset.dy * i);
      this.segments.push({
        x,
        y,
        prevX: x,
        prevY: y,
      });
    }
  }

  // Set callback for tail shedding
  setTailShedCallback(callback: TailShedCallback): void {
    this.onTailShed = callback;
  }

  // Getters
  getHead(): Position {
    return { x: this.segments[0].x, y: this.segments[0].y };
  }

  getSegments(): ReadonlyArray<SnakeSegment> {
    return this.segments;
  }

  getDirection(): Direction {
    return this.direction;
  }

  getState(): SnakeState {
    return this.state;
  }

  getLength(): number {
    return this.segments.length;
  }

  getSpeed(): number {
    return this.baseSpeed * this.speedModifier;
  }

  getCombo(): ComboStreak {
    return { ...this.combo };
  }

  getActiveEffects(): Map<AppleColor, ActiveEffect> {
    return new Map(this.activeEffects);
  }

  // Get the primary speed-modifying effect (red or green)
  getActiveEffect(): "red" | "green" | null {
    if (this.activeEffects.has("red")) return "red";
    if (this.activeEffects.has("green")) return "green";
    return null;
  }

  // Get the progress (0-1) of the active speed effect
  getEffectProgress(): number {
    const effectType = this.getActiveEffect();
    if (!effectType) return 0;

    const effect = this.activeEffects.get(effectType);
    if (!effect) return 0;

    const elapsed = performance.now() - effect.startTime;
    return Math.min(1, elapsed / effect.duration);
  }

  isAlive(): boolean {
    return this.state === "alive";
  }

  // Direction control
  setDirection(newDirection: Direction): void {
    if (!this.isAlive()) return;

    // Prevent 180° turns
    const opposites: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };

    // Can't turn into opposite direction
    if (opposites[this.direction] === newDirection) return;

    // Queue the direction change for next move
    this.queuedDirection = newDirection;
  }

  // Movement update - returns true if snake moved this frame
  update(deltaTime: number): boolean {
    if (!this.isAlive()) return false;

    // Update effects
    this.updateEffects();

    // Calculate movement based on speed
    const effectiveSpeed = this.getSpeed();
    const moveInterval = 1000 / effectiveSpeed; // ms per tile

    this.moveAccumulator += deltaTime;

    if (this.moveAccumulator >= moveInterval) {
      this.moveAccumulator -= moveInterval;
      this.move();
      return true;
    }

    return false;
  }

  private move(): void {
    // Apply queued direction
    if (this.queuedDirection !== null) {
      this.direction = this.queuedDirection;
      this.queuedDirection = null;
    }

    // Save previous positions for interpolation
    for (const segment of this.segments) {
      segment.prevX = segment.x;
      segment.prevY = segment.y;
    }

    // Calculate new head position
    const head = this.segments[0];
    const directionDeltas: Record<Direction, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    const delta = directionDeltas[this.direction];
    const newHeadX = this.wrapCoordinate(head.x + delta.dx);
    const newHeadY = this.wrapCoordinate(head.y + delta.dy);

    // Move body segments (from tail to head)
    for (let i = this.segments.length - 1; i > 0; i--) {
      this.segments[i].x = this.segments[i - 1].x;
      this.segments[i].y = this.segments[i - 1].y;
    }

    // Move head
    head.x = newHeadX;
    head.y = newHeadY;
  }

  private wrapCoordinate(coord: number): number {
    if (coord < 0) return this.boardSize - 1;
    if (coord >= this.boardSize) return 0;
    return coord;
  }

  // Growth
  grow(): void {
    if (!this.isAlive()) return;

    // Add new segment at tail position
    const tail = this.segments[this.segments.length - 1];
    this.segments.push({
      x: tail.x,
      y: tail.y,
      prevX: tail.prevX,
      prevY: tail.prevY,
    });

    // Check for tail shedding
    this.checkTailShed();
  }

  private checkTailShed(): void {
    if (this.segments.length > TAIL_SHED_THRESHOLD) {
      // Get positions of excess segments to convert to gray blocks
      const excessSegments = this.segments.slice(TAIL_SHED_REMAINING);
      const blockPositions: Position[] = excessSegments.map((seg) => ({
        x: seg.x,
        y: seg.y,
      }));

      // Trim snake to remaining length
      this.segments = this.segments.slice(0, TAIL_SHED_REMAINING);

      // Notify callback to create gray blocks
      if (this.onTailShed) {
        this.onTailShed(blockPositions);
      }
    }
  }

  // Combo system
  eatApple(appleColor: AppleColor): boolean {
    if (!this.isAlive()) return false;

    // Update combo streak
    if (this.combo.color === appleColor) {
      this.combo.count++;
    } else {
      this.combo.color = appleColor;
      this.combo.count = 1;
    }

    // Grow the snake
    this.grow();

    // Check if combo triggered (3 in a row)
    if (this.combo.count >= 3) {
      this.combo.count = 0; // Reset count but keep color
      return true; // Effect should be triggered
    }

    return false;
  }

  // Effects
  applyEffect(effectType: AppleColor, duration: number): void {
    // If same category effect exists, remove it first
    // Speed effects: red (boost) and green (slow)
    if (effectType === "red" || effectType === "green") {
      this.activeEffects.delete("red");
      this.activeEffects.delete("green");
      this.speedModifier = 1.0; // Reset before applying new
    }

    // Apply the new effect
    this.activeEffects.set(effectType, {
      type: effectType,
      startTime: performance.now(),
      duration,
    });

    // Apply effect-specific modifiers
    switch (effectType) {
      case "red":
        this.speedModifier = 1.5; // 50% faster
        break;
      case "green":
        this.speedModifier = 0.5; // 50% slower
        break;
      // Other effects (blue, orange, purple) are handled externally
    }
  }

  private updateEffects(): void {
    const now = performance.now();

    for (const [color, effect] of this.activeEffects) {
      if (now - effect.startTime >= effect.duration) {
        this.activeEffects.delete(color);

        // Reset modifiers when effects expire
        if (color === "red" || color === "green") {
          this.speedModifier = 1.0;
        }
      }
    }
  }

  hasEffect(effectType: AppleColor): boolean {
    return this.activeEffects.has(effectType);
  }

  // Collision detection
  checkSelfCollision(): boolean {
    if (!this.isAlive()) return false;

    const head = this.getHead();

    // Check if head collides with any body segment (skip first 2 to allow tight turns)
    for (let i = 2; i < this.segments.length; i++) {
      if (this.segments[i].x === head.x && this.segments[i].y === head.y) {
        return true;
      }
    }

    return false;
  }

  checkCollisionWithSnake(other: Snake): boolean {
    if (!this.isAlive() || !other.isAlive()) return false;
    if (this === other) return this.checkSelfCollision();

    const head = this.getHead();
    const otherSegments = other.getSegments();

    for (const segment of otherSegments) {
      if (segment.x === head.x && segment.y === head.y) {
        return true;
      }
    }

    return false;
  }

  checkCollisionWithPosition(pos: Position): boolean {
    if (!this.isAlive()) return false;

    const head = this.getHead();
    return head.x === pos.x && head.y === pos.y;
  }

  occupiesPosition(pos: Position): boolean {
    return this.segments.some((seg) => seg.x === pos.x && seg.y === pos.y);
  }

  // Death
  die(): Position[] {
    if (this.state !== "alive") return [];

    this.state = "dead";

    // Return segment positions for gray block conversion
    return this.segments.map((seg) => ({ x: seg.x, y: seg.y }));
  }

  enterSpectatorMode(): void {
    this.state = "spectating";
  }

  // Get move progress for interpolation (0-1 between moves)
  getMoveProgress(): number {
    const effectiveSpeed = this.getSpeed();
    const moveInterval = 1000 / effectiveSpeed;
    return Math.min(1, this.moveAccumulator / moveInterval);
  }

  // Get interpolation progress for smooth rendering
  getInterpolation(
    _frameInterpolation: number
  ): Array<{ x: number; y: number }> {
    const moveProgress = this.getMoveProgress();
    return this.segments.map((seg) => ({
      x: seg.prevX + (seg.x - seg.prevX) * moveProgress,
      y: seg.prevY + (seg.y - seg.prevY) * moveProgress,
    }));
  }

  // Reset for new game
  reset(boardSize: BoardSize, baseSpeed: number): void {
    this.boardSize = boardSize;
    this.baseSpeed = baseSpeed;
    this.state = "alive";
    this.segments = [];
    this.queuedDirection = null;
    this.speedModifier = 1.0;
    this.moveAccumulator = 0;
    this.activeEffects.clear();
    this.combo = { color: null, count: 0 };

    const spawn = SPAWN_POSITIONS[this.playerSlot];
    this.direction = spawn.direction;
    this.initializeSegments(spawn);
  }
}
