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
    const padding = 6;
    const maxCols = Math.max(...KEYBOARD_LAYOUT.map((row) => row.length));
    const inputBoxHeight = 44;
    const inputMargin = 12;
    const availableHeight = boundsHeight - inputBoxHeight - inputMargin * 2;

    const keyWidth = Math.floor(
      (boundsWidth - padding * (maxCols + 1) - 20) / maxCols
    );
    const keyHeight = Math.floor(
      (availableHeight - padding * (KEYBOARD_LAYOUT.length + 1) - 10) /
        KEYBOARD_LAYOUT.length
    );

    const keyboardWidth = keyWidth * maxCols + padding * (maxCols + 1);
    const startX = boundsX + (boundsWidth - keyboardWidth) / 2;
    const startY = boundsY + inputBoxHeight + inputMargin * 2;

    // Draw background with gradient
    const bgGradient = ctx.createLinearGradient(
      boundsX,
      boundsY,
      boundsX,
      boundsY + boundsHeight
    );
    bgGradient.addColorStop(0, "rgba(20, 20, 45, 0.98)");
    bgGradient.addColorStop(1, "rgba(10, 10, 30, 0.98)");
    ctx.fillStyle = bgGradient;
    this.roundRect(ctx, boundsX, boundsY, boundsWidth, boundsHeight, 16);
    ctx.fill();

    // Draw outer glow
    ctx.save();
    ctx.shadowColor = "#00FFAA";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#00FFAA";
    ctx.lineWidth = 3;
    this.roundRect(ctx, boundsX, boundsY, boundsWidth, boundsHeight, 16);
    ctx.stroke();
    ctx.restore();

    // Draw inner border
    ctx.strokeStyle = "rgba(0, 255, 170, 0.3)";
    ctx.lineWidth = 1;
    this.roundRect(
      ctx,
      boundsX + 4,
      boundsY + 4,
      boundsWidth - 8,
      boundsHeight - 8,
      12
    );
    ctx.stroke();

    // Draw current text input box
    const inputBoxX = boundsX + 16;
    const inputBoxY = boundsY + inputMargin;
    const inputBoxWidth = boundsWidth - 32;

    // Input box gradient background
    const inputGradient = ctx.createLinearGradient(
      inputBoxX,
      inputBoxY,
      inputBoxX,
      inputBoxY + inputBoxHeight
    );
    inputGradient.addColorStop(0, "#0a0a1a");
    inputGradient.addColorStop(1, "#151528");
    ctx.fillStyle = inputGradient;
    this.roundRect(ctx, inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight, 8);
    ctx.fill();

    // Input box border with subtle glow
    ctx.save();
    ctx.shadowColor = "#00FFAA";
    ctx.shadowBlur = 4;
    ctx.strokeStyle = "#00FFAA";
    ctx.lineWidth = 2;
    this.roundRect(ctx, inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight, 8);
    ctx.stroke();
    ctx.restore();

    // Current text with animated cursor
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const cursorVisible = Math.floor(now / 500) % 2 === 0;
    const displayText = this.currentText + (cursorVisible ? "│" : "");
    ctx.fillText(
      displayText,
      inputBoxX + 14,
      inputBoxY + inputBoxHeight / 2,
      inputBoxWidth - 70
    );

    // Character count pill
    const countText = `${this.currentText.length}/${this.maxLength}`;
    ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
    const countWidth = ctx.measureText(countText).width + 12;
    const countX = inputBoxX + inputBoxWidth - countWidth - 8;
    const countY = inputBoxY + (inputBoxHeight - 20) / 2;

    ctx.fillStyle = "rgba(0, 255, 170, 0.15)";
    this.roundRect(ctx, countX, countY, countWidth, 20, 10);
    ctx.fill();

    ctx.fillStyle = "#00FFAA";
    ctx.textAlign = "center";
    ctx.fillText(countText, countX + countWidth / 2, countY + 11);

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
            scale = 1 - 0.12 * (elapsed / 100);
          } else if (elapsed < 200) {
            scale = 0.88 + 0.12 * ((elapsed - 100) / 100);
          } else {
            this.pressedKey = null;
          }
        }

        const scaledWidth = keyWidth * scale;
        const scaledHeight = keyHeight * scale;
        const offsetX = (keyWidth - scaledWidth) / 2;
        const offsetY = (keyHeight - scaledHeight) / 2;

        const keyX = kx + offsetX;
        const keyY = ky + offsetY;

        // Key shadow for depth
        if (!isSelected) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          this.roundRect(ctx, keyX + 2, keyY + 3, scaledWidth, scaledHeight, 6);
          ctx.fill();
        }

        // Key background with gradient
        ctx.save();
        if (isSelected) {
          // Selected key - bright cyan glow
          ctx.shadowColor = "#00FFAA";
          ctx.shadowBlur = 15;
          const selectedGradient = ctx.createLinearGradient(
            keyX,
            keyY,
            keyX,
            keyY + scaledHeight
          );
          selectedGradient.addColorStop(0, "#00DDAA");
          selectedGradient.addColorStop(1, "#00AA88");
          ctx.fillStyle = selectedGradient;
        } else if (key === "OK") {
          // Confirm key - green
          const okGradient = ctx.createLinearGradient(
            keyX,
            keyY,
            keyX,
            keyY + scaledHeight
          );
          okGradient.addColorStop(0, "#2d5a2d");
          okGradient.addColorStop(1, "#1a3d1a");
          ctx.fillStyle = okGradient;
        } else if (key === "✕") {
          // Cancel key - red
          const cancelGradient = ctx.createLinearGradient(
            keyX,
            keyY,
            keyX,
            keyY + scaledHeight
          );
          cancelGradient.addColorStop(0, "#5a2d2d");
          cancelGradient.addColorStop(1, "#3d1a1a");
          ctx.fillStyle = cancelGradient;
        } else if (key in SPECIAL_KEYS) {
          // Other special keys - darker
          const specialGradient = ctx.createLinearGradient(
            keyX,
            keyY,
            keyX,
            keyY + scaledHeight
          );
          specialGradient.addColorStop(0, "#2a2a40");
          specialGradient.addColorStop(1, "#1a1a2d");
          ctx.fillStyle = specialGradient;
        } else {
          // Regular keys
          const keyGradient = ctx.createLinearGradient(
            keyX,
            keyY,
            keyX,
            keyY + scaledHeight
          );
          keyGradient.addColorStop(0, "#3a3a55");
          keyGradient.addColorStop(1, "#252538");
          ctx.fillStyle = keyGradient;
        }

        this.roundRect(ctx, keyX, keyY, scaledWidth, scaledHeight, 6);
        ctx.fill();

        // Key border
        if (isSelected) {
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.lineWidth = 1;
        }
        this.roundRect(ctx, keyX, keyY, scaledWidth, scaledHeight, 6);
        ctx.stroke();
        ctx.restore();

        // Key text
        if (isSelected) {
          ctx.fillStyle = "#000000";
        } else if (key === "OK") {
          ctx.fillStyle = "#66FF66";
        } else if (key === "✕") {
          ctx.fillStyle = "#FF6666";
        } else {
          ctx.fillStyle = "#FFFFFF";
        }

        const fontSize = key.length > 1 ? 12 : 14;
        ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
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
