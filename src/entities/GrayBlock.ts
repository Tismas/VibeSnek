export interface Position {
  x: number;
  y: number;
}

export type GrayBlockState = "active" | "converting" | "removed";

export class GrayBlock {
  readonly id: number;
  readonly position: Position;

  private state: GrayBlockState = "active";

  // Animation state
  private pulsePhase: number;
  private conversionStartTime: number = 0;
  private conversionDuration: number = 300; // ms

  constructor(id: number, position: Position) {
    this.id = id;
    this.position = { ...position };
    // Randomize pulse phase so blocks don't all pulse in sync
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update(deltaTime: number): void {
    // Update pulse animation
    this.pulsePhase += deltaTime * 0.003;

    // Handle conversion animation
    if (this.state === "converting") {
      const elapsed = performance.now() - this.conversionStartTime;
      if (elapsed >= this.conversionDuration) {
        this.state = "removed";
      }
    }
  }

  getState(): GrayBlockState {
    return this.state;
  }

  isActive(): boolean {
    return this.state === "active";
  }

  isRemoved(): boolean {
    return this.state === "removed";
  }

  // Get pulse animation value (0 to 1) for rendering
  getPulseValue(): number {
    return (Math.sin(this.pulsePhase) + 1) / 2;
  }

  // Get conversion animation progress (0 to 1)
  getConversionProgress(): number {
    if (this.state !== "converting") return 0;
    const elapsed = performance.now() - this.conversionStartTime;
    return Math.min(1, elapsed / this.conversionDuration);
  }

  // Start conversion animation (when hit by projectile)
  startConversion(): void {
    if (this.state !== "active") return;
    this.state = "converting";
    this.conversionStartTime = performance.now();
  }

  // Check if block is at a given position
  isAt(pos: Position): boolean {
    return this.position.x === pos.x && this.position.y === pos.y;
  }
}
