import type { Canvas } from "../core/Canvas";

export interface VirtualKeyboardConfig {
  onCharacter: (char: string) => void;
  onBackspace: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

type VirtualKeyboardRow = string[];

const KEYBOARD_LAYOUT: VirtualKeyboardRow[] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "⌫"],
  ["Z", "X", "C", "V", "B", "N", "M", "␣", "OK", "✕"],
];

const SPECIAL_KEYS = {
  "⌫": "backspace",
  "␣": "space",
  OK: "confirm",
  "✕": "cancel",
} as const;

export class VirtualKeyboard {
  private canvas: Canvas;
  private config: VirtualKeyboardConfig;
  private isVisible: boolean = false;

  // Cursor position
  private cursorRow: number = 1;
  private cursorCol: number = 0;

  // Keyboard dimensions
  private keyWidth: number = 0;
  private keyHeight: number = 0;
  private keyPadding: number = 4;
  private startX: number = 0;
  private startY: number = 0;

  // Animation
  private pressedKey: { row: number; col: number } | null = null;
  private pressAnimationStart: number = 0;

  // Current input display
  private currentText: string = "";
  private maxLength: number = 16;

  constructor(canvas: Canvas, config: VirtualKeyboardConfig) {
    this.canvas = canvas;
    this.config = config;
    this.calculateDimensions();
  }

  private calculateDimensions(): void {
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    // Calculate key size based on screen size
    const maxKeyboardWidth = Math.min(canvasWidth * 0.8, 600);
    const maxCols = Math.max(...KEYBOARD_LAYOUT.map((row) => row.length));

    this.keyWidth = Math.floor(
      (maxKeyboardWidth - this.keyPadding * (maxCols + 1)) / maxCols
    );
    this.keyHeight = Math.floor(this.keyWidth * 0.8);

    // Center the keyboard
    const keyboardWidth =
      this.keyWidth * maxCols + this.keyPadding * (maxCols + 1);
    const keyboardHeight =
      this.keyHeight * KEYBOARD_LAYOUT.length +
      this.keyPadding * (KEYBOARD_LAYOUT.length + 1);

    this.startX = (canvasWidth - keyboardWidth) / 2;
    this.startY = canvasHeight * 0.5 - keyboardHeight / 2 + 50; // Offset for text display
  }

  show(initialText: string = ""): void {
    this.isVisible = true;
    this.currentText = initialText;
    this.cursorRow = 1;
    this.cursorCol = 0;
    this.calculateDimensions();
  }

  hide(): void {
    this.isVisible = false;
  }

  isShowing(): boolean {
    return this.isVisible;
  }

  setMaxLength(length: number): void {
    this.maxLength = length;
  }

  getCurrentText(): string {
    return this.currentText;
  }

  // Navigation
  moveUp(): void {
    if (!this.isVisible) return;
    this.cursorRow = Math.max(0, this.cursorRow - 1);
    this.clampCursorCol();
  }

  moveDown(): void {
    if (!this.isVisible) return;
    this.cursorRow = Math.min(KEYBOARD_LAYOUT.length - 1, this.cursorRow + 1);
    this.clampCursorCol();
  }

  moveLeft(): void {
    if (!this.isVisible) return;
    this.cursorCol = Math.max(0, this.cursorCol - 1);
  }

  moveRight(): void {
    if (!this.isVisible) return;
    const rowLength = KEYBOARD_LAYOUT[this.cursorRow].length;
    this.cursorCol = Math.min(rowLength - 1, this.cursorCol + 1);
  }

  private clampCursorCol(): void {
    const rowLength = KEYBOARD_LAYOUT[this.cursorRow].length;
    this.cursorCol = Math.min(this.cursorCol, rowLength - 1);
  }

  // Select current key
  select(): void {
    if (!this.isVisible) return;

    const key = KEYBOARD_LAYOUT[this.cursorRow][this.cursorCol];

    // Start press animation
    this.pressedKey = { row: this.cursorRow, col: this.cursorCol };
    this.pressAnimationStart = performance.now();

    // Handle special keys
    if (key in SPECIAL_KEYS) {
      const action = SPECIAL_KEYS[key as keyof typeof SPECIAL_KEYS];
      switch (action) {
        case "backspace":
          this.currentText = this.currentText.slice(0, -1);
          this.config.onBackspace();
          break;
        case "space":
          if (this.currentText.length < this.maxLength) {
            this.currentText += " ";
            this.config.onCharacter(" ");
          }
          break;
        case "confirm":
          this.config.onConfirm();
          break;
        case "cancel":
          this.config.onCancel();
          break;
      }
    } else {
      // Regular character
      if (this.currentText.length < this.maxLength) {
        this.currentText += key;
        this.config.onCharacter(key);
      }
    }
  }

  // Handle backspace directly (from X button)
  backspace(): void {
    if (!this.isVisible) return;
    this.currentText = this.currentText.slice(0, -1);
    this.config.onBackspace();
  }

  render(): void {
    if (!this.isVisible) return;

    const ctx = this.canvas.ctx;
    const now = performance.now();

    // Draw semi-transparent background
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, this.canvas.getWidth(), this.canvas.getHeight());

    // Draw title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Enter Your Name",
      this.canvas.getWidth() / 2,
      this.startY - 80
    );

    // Draw current text input box
    const inputBoxWidth = 300;
    const inputBoxHeight = 50;
    const inputBoxX = (this.canvas.getWidth() - inputBoxWidth) / 2;
    const inputBoxY = this.startY - 60;

    // Input box background
    ctx.fillStyle = "#1a1a2e";
    ctx.strokeStyle = "#4444FF";
    ctx.lineWidth = 3;
    this.roundRect(ctx, inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Current text with cursor
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    const displayText =
      this.currentText + (Math.floor(now / 500) % 2 === 0 ? "|" : "");
    ctx.fillText(
      displayText,
      this.canvas.getWidth() / 2,
      inputBoxY + inputBoxHeight / 2 + 10
    );

    // Character count
    ctx.fillStyle = "#888888";
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      `${this.currentText.length}/${this.maxLength}`,
      inputBoxX + inputBoxWidth - 5,
      inputBoxY + inputBoxHeight + 20
    );

    // Draw keyboard
    for (let row = 0; row < KEYBOARD_LAYOUT.length; row++) {
      const keys = KEYBOARD_LAYOUT[row];
      for (let col = 0; col < keys.length; col++) {
        const key = keys[col];
        const isSelected = row === this.cursorRow && col === this.cursorCol;
        const isPressed =
          this.pressedKey?.row === row && this.pressedKey?.col === col;

        // Calculate key position
        const x =
          this.startX +
          this.keyPadding +
          col * (this.keyWidth + this.keyPadding);
        const y =
          this.startY +
          this.keyPadding +
          row * (this.keyHeight + this.keyPadding);

        // Key width adjustment for special keys
        let keyWidth = this.keyWidth;
        if (key === "OK" || key === "✕") {
          keyWidth = this.keyWidth;
        }

        // Press animation scale
        let scale = 1;
        if (isPressed) {
          const elapsed = now - this.pressAnimationStart;
          if (elapsed < 100) {
            scale = 1 - 0.1 * (elapsed / 100);
          } else if (elapsed < 200) {
            scale = 0.9 + 0.1 * ((elapsed - 100) / 100);
          } else {
            this.pressedKey = null;
          }
        }

        // Draw key background
        const scaledWidth = keyWidth * scale;
        const scaledHeight = this.keyHeight * scale;
        const offsetX = (keyWidth - scaledWidth) / 2;
        const offsetY = (this.keyHeight - scaledHeight) / 2;

        if (isSelected) {
          // Selected key - highlighted
          ctx.fillStyle = "#4444FF";
          ctx.shadowColor = "#4444FF";
          ctx.shadowBlur = 10;
        } else if (key in SPECIAL_KEYS) {
          // Special keys
          ctx.fillStyle =
            key === "OK" ? "#44AA44" : key === "✕" ? "#AA4444" : "#333355";
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = "#2a2a4e";
          ctx.shadowBlur = 0;
        }

        this.roundRect(
          ctx,
          x + offsetX,
          y + offsetY,
          scaledWidth,
          scaledHeight,
          6
        );
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw key border
        ctx.strokeStyle = isSelected ? "#6666FF" : "#444466";
        ctx.lineWidth = 2;
        this.roundRect(
          ctx,
          x + offsetX,
          y + offsetY,
          scaledWidth,
          scaledHeight,
          6
        );
        ctx.stroke();

        // Draw key text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${key.length > 1 ? 16 : 20}px 'Segoe UI', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(key, x + keyWidth / 2, y + this.keyHeight / 2);
      }
    }

    // Draw instructions
    ctx.fillStyle = "#888888";
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const instructionY =
      this.startY +
      (this.keyHeight + this.keyPadding) * KEYBOARD_LAYOUT.length +
      30;
    ctx.fillText(
      "D-pad: Navigate | A: Select | X: Backspace | B: Cancel",
      this.canvas.getWidth() / 2,
      instructionY
    );
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  destroy(): void {
    this.hide();
  }
}
