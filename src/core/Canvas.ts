import type { BoardSize } from "../utils/constants";

export class Canvas {
  public readonly element: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;

  private boardSize: BoardSize = 25;
  private tileSize: number = 0;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor(container: HTMLElement) {
    this.element = document.createElement("canvas");
    this.element.id = "game-canvas";

    const ctx = this.element.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;

    container.appendChild(this.element);

    this.setupResizeHandler();
    this.resize();
  }

  private setupResizeHandler(): void {
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.element.width = width * dpr;
    this.element.height = height * dpr;
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;

    this.ctx.scale(dpr, dpr);

    this.calculateTileSize();
  }

  setBoardSize(size: BoardSize): void {
    this.boardSize = size;
    this.calculateTileSize();
  }

  private calculateTileSize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Leave some padding for UI
    const availableWidth = width * 0.9;
    const availableHeight = height * 0.85;

    // Calculate tile size to fit board in available space
    this.tileSize = Math.floor(
      Math.min(
        availableWidth / this.boardSize,
        availableHeight / this.boardSize
      )
    );

    // Center the board
    const boardWidth = this.tileSize * this.boardSize;
    const boardHeight = this.tileSize * this.boardSize;

    this.offsetX = (width - boardWidth) / 2;
    this.offsetY = (height - boardHeight) / 2 + height * 0.05; // Slight offset for top UI
  }

  getBoardSize(): BoardSize {
    return this.boardSize;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  // Convert tile coordinates to screen coordinates
  tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: this.offsetX + tileX * this.tileSize,
      y: this.offsetY + tileY * this.tileSize,
    };
  }

  // Convert screen coordinates to tile coordinates
  screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: Math.floor((screenX - this.offsetX) / this.tileSize),
      y: Math.floor((screenY - this.offsetY) / this.tileSize),
    };
  }

  clear(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.ctx.clearRect(0, 0, width, height);
  }

  // Fill background
  fillBackground(color: string): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, width, height);
  }

  // Draw the game board background
  drawBoard(primaryColor: string, secondaryColor: string): void {
    const size = this.boardSize;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isEven = (x + y) % 2 === 0;
        this.ctx.fillStyle = isEven ? primaryColor : secondaryColor;

        const screenPos = this.tileToScreen(x, y);
        this.ctx.fillRect(
          screenPos.x,
          screenPos.y,
          this.tileSize,
          this.tileSize
        );
      }
    }
  }

  // Draw board border
  drawBoardBorder(color: string, width: number = 3): void {
    const boardWidth = this.tileSize * this.boardSize;
    const boardHeight = this.tileSize * this.boardSize;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.strokeRect(
      this.offsetX - width / 2,
      this.offsetY - width / 2,
      boardWidth + width,
      boardHeight + width
    );
  }

  // Helper to draw rounded rectangle
  roundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    );
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  getWidth(): number {
    return window.innerWidth;
  }

  getHeight(): number {
    return window.innerHeight;
  }
}
