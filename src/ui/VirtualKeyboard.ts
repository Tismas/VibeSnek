export interface VirtualKeyboardCallbacks {
  onCharacter: (char: string) => void;
  onBackspace: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface VirtualKeyboardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type VirtualKeyboardRow = string[];

const KEYBOARD_LAYOUT: VirtualKeyboardRow[] = [
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
  private callbacks: VirtualKeyboardCallbacks;
  private isVisible: boolean = false;

  // Cursor position
  private cursorRow: number = 1;
  private cursorCol: number = 0;

  // Animation
  private pressedKey: { row: number; col: number } | null = null;
  private pressAnimationStart: number = 0;

  // Current input display
  private currentText: string = "";
  private maxLength: number = 16;

  constructor(callbacks: VirtualKeyboardCallbacks) {
    this.callbacks = callbacks;
  }

  show(initialText: string = ""): void {
    this.isVisible = true;
    this.currentText = initialText;
    this.cursorRow = 1;
    this.cursorCol = 0;
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
          this.callbacks.onBackspace();
          break;
        case "space":
          if (this.currentText.length < this.maxLength) {
            this.currentText += " ";
            this.callbacks.onCharacter(" ");
          }
          break;
        case "confirm":
          this.callbacks.onConfirm();
          break;
        case "cancel":
          this.callbacks.onCancel();
          break;
      }
    } else {
      // Regular character
      if (this.currentText.length < this.maxLength) {
        this.currentText += key;
        this.callbacks.onCharacter(key);
      }
    }
  }

  // Handle backspace directly (from X button)
  backspace(): void {
    if (!this.isVisible) return;
    this.currentText = this.currentText.slice(0, -1);
    this.callbacks.onBackspace();
  }

  // Render the keyboard within a specific bounds
  render(ctx: CanvasRenderingContext2D, bounds: VirtualKeyboardBounds): void {
    if (!this.isVisible) return;

    const now = performance.now();
    const {
      x: boundsX,
      y: boundsY,
      width: boundsWidth,
      height: boundsHeight,
    } = bounds;

    // Calculate key dimensions to fit within bounds
    const padding = 3;
    const maxCols = Math.max(...KEYBOARD_LAYOUT.map((row) => row.length));
    const inputBoxHeight = 28;
    const inputMargin = 5;
    const availableHeight = boundsHeight - inputBoxHeight - inputMargin * 2;

    const keyWidth = Math.floor(
      (boundsWidth - padding * (maxCols + 1)) / maxCols
    );
    const keyHeight = Math.floor(
      (availableHeight - padding * (KEYBOARD_LAYOUT.length + 1)) /
        KEYBOARD_LAYOUT.length
    );

    const keyboardWidth = keyWidth * maxCols + padding * (maxCols + 1);
    const startX = boundsX + (boundsWidth - keyboardWidth) / 2;
    const startY = boundsY + inputBoxHeight + inputMargin * 2;

    // Draw background overlay
    ctx.fillStyle = "rgba(15, 15, 30, 0.95)";
    this.roundRect(ctx, boundsX, boundsY, boundsWidth, boundsHeight, 8);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = "#4444FF";
    ctx.lineWidth = 2;
    this.roundRect(ctx, boundsX, boundsY, boundsWidth, boundsHeight, 8);
    ctx.stroke();

    // Draw current text input box
    const inputBoxX = boundsX + 10;
    const inputBoxY = boundsY + inputMargin;
    const inputBoxWidth = boundsWidth - 20;

    ctx.fillStyle = "#1a1a2e";
    this.roundRect(ctx, inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight, 4);
    ctx.fill();

    ctx.strokeStyle = "#333366";
    ctx.lineWidth = 1;
    this.roundRect(ctx, inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight, 4);
    ctx.stroke();

    // Current text with cursor
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const displayText =
      this.currentText + (Math.floor(now / 500) % 2 === 0 ? "|" : "");
    ctx.fillText(
      displayText,
      inputBoxX + 8,
      inputBoxY + inputBoxHeight / 2,
      inputBoxWidth - 50
    );

    // Character count
    ctx.fillStyle = "#666666";
    ctx.font = "10px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      `${this.currentText.length}/${this.maxLength}`,
      inputBoxX + inputBoxWidth - 5,
      inputBoxY + inputBoxHeight / 2
    );

    // Draw keyboard keys
    for (let row = 0; row < KEYBOARD_LAYOUT.length; row++) {
      const keys = KEYBOARD_LAYOUT[row];
      for (let col = 0; col < keys.length; col++) {
        const key = keys[col];
        const isSelected = row === this.cursorRow && col === this.cursorCol;
        const isPressed =
          this.pressedKey?.row === row && this.pressedKey?.col === col;

        const kx = startX + padding + col * (keyWidth + padding);
        const ky = startY + padding + row * (keyHeight + padding);

        // Press animation scale
        let scale = 1;
        if (isPressed) {
          const elapsed = now - this.pressAnimationStart;
          if (elapsed < 100) {
            scale = 1 - 0.15 * (elapsed / 100);
          } else if (elapsed < 200) {
            scale = 0.85 + 0.15 * ((elapsed - 100) / 100);
          } else {
            this.pressedKey = null;
          }
        }

        const scaledWidth = keyWidth * scale;
        const scaledHeight = keyHeight * scale;
        const offsetX = (keyWidth - scaledWidth) / 2;
        const offsetY = (keyHeight - scaledHeight) / 2;

        // Key background
        if (isSelected) {
          ctx.fillStyle = "#4444FF";
          ctx.shadowColor = "#4444FF";
          ctx.shadowBlur = 5;
        } else if (key in SPECIAL_KEYS) {
          ctx.fillStyle =
            key === "OK" ? "#336633" : key === "✕" ? "#663333" : "#333344";
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = "#252540";
          ctx.shadowBlur = 0;
        }

        this.roundRect(
          ctx,
          kx + offsetX,
          ky + offsetY,
          scaledWidth,
          scaledHeight,
          3
        );
        ctx.fill();
        ctx.shadowBlur = 0;

        // Key text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${key.length > 1 ? 9 : 11}px 'Segoe UI', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(key, kx + keyWidth / 2, ky + keyHeight / 2);
      }
    }
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
