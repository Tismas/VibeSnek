import type { Canvas } from "../core/Canvas";
import type { Snake } from "../entities/Snake";
import type { Apple } from "../entities/Apple";
import type { GrayBlock } from "../entities/GrayBlock";
import type { Projectile } from "../entities/Projectile";
import type { EffectManager } from "../systems/EffectManager";
import { PLAYER_COLOR_VALUES, APPLE_COLOR_VALUES } from "../utils/constants";

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
}

export class GameRenderer {
  private canvas: Canvas;

  // Rain effect state
  private rainDrops: RainDrop[] = [];
  private rainActive: boolean = false;

  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDecay: number = 0.9;

  // Animation time
  private animationTime: number = 0;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.initRainDrops();
  }

  private initRainDrops(): void {
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    for (let i = 0; i < 200; i++) {
      this.rainDrops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 5 + Math.random() * 10,
        length: 10 + Math.random() * 20,
      });
    }
  }

  update(deltaTime: number): void {
    this.animationTime += deltaTime;

    // Decay screen shake
    this.shakeIntensity *= this.shakeDecay;
    if (this.shakeIntensity < 0.5) {
      this.shakeIntensity = 0;
    }

    // Update rain
    if (this.rainActive) {
      const height = this.canvas.getHeight();
      for (const drop of this.rainDrops) {
        drop.y += drop.speed;
        if (drop.y > height) {
          drop.y = -drop.length;
          drop.x = Math.random() * this.canvas.getWidth();
        }
      }
    }
  }

  // Start rendering frame
  beginFrame(): void {
    const ctx = this.canvas.ctx;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Apply screen shake
    if (this.shakeIntensity > 0) {
      ctx.save();
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    // Clear and draw background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // End rendering frame
  endFrame(): void {
    if (this.shakeIntensity > 0) {
      this.canvas.ctx.restore();
    }
  }

  // Render the game board grid
  renderBoard(): void {
    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();
    const boardSize = this.canvas.getBoardSize();
    const offset = this.canvas.getOffset();

    // Board background
    ctx.fillStyle = "#0a0a15";
    ctx.fillRect(
      offset.x,
      offset.y,
      boardSize * tileSize,
      boardSize * tileSize
    );

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= boardSize; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(offset.x + i * tileSize, offset.y);
      ctx.lineTo(offset.x + i * tileSize, offset.y + boardSize * tileSize);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(offset.x, offset.y + i * tileSize);
      ctx.lineTo(offset.x + boardSize * tileSize, offset.y + i * tileSize);
      ctx.stroke();
    }

    // Board border with glow
    ctx.strokeStyle = "#333366";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#4444AA";
    ctx.shadowBlur = 10;
    ctx.strokeRect(
      offset.x,
      offset.y,
      boardSize * tileSize,
      boardSize * tileSize
    );
    ctx.shadowBlur = 0;
  }

  // Render a snake
  renderSnake(snake: Snake, interpolation: number): void {
    if (!snake.isAlive()) return;

    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();
    const segments = snake.getInterpolation(interpolation);
    const color = PLAYER_COLOR_VALUES[snake.color];

    // Draw body segments (from tail to head)
    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];
      const pos = this.canvas.tileToScreen(segment.x, segment.y);

      const isHead = i === 0;
      const isTail = i === segments.length - 1;

      // Segment size (tapers toward tail)
      const sizeFactor = isHead
        ? 1.0
        : isTail
        ? 0.6
        : 0.85 - (i / segments.length) * 0.2;
      const size = tileSize * sizeFactor;
      const padding = (tileSize - size) / 2;

      // Draw segment
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHead ? 8 : 4;

      this.roundRect(
        ctx,
        pos.x + padding,
        pos.y + padding,
        size,
        size,
        size * 0.3
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw eyes on head
      if (isHead) {
        this.drawSnakeEyes(ctx, pos, tileSize, snake.getDirection());
      }
    }

    // Draw combo indicator
    this.renderComboIndicator(snake, interpolation);

    // Draw effect timers
    this.renderEffectTimers(snake, interpolation);
  }

  private drawSnakeEyes(
    ctx: CanvasRenderingContext2D,
    headPos: { x: number; y: number },
    tileSize: number,
    direction: string
  ): void {
    const eyeSize = tileSize * 0.2;
    const pupilSize = eyeSize * 0.5;
    const eyeOffset = tileSize * 0.25;

    // Eye positions based on direction
    let leftEye: { x: number; y: number };
    let rightEye: { x: number; y: number };
    let pupilOffset = { x: 0, y: 0 };

    const centerX = headPos.x + tileSize / 2;
    const centerY = headPos.y + tileSize / 2;

    switch (direction) {
      case "up":
        leftEye = { x: centerX - eyeOffset, y: centerY - eyeOffset * 0.5 };
        rightEye = { x: centerX + eyeOffset, y: centerY - eyeOffset * 0.5 };
        pupilOffset = { x: 0, y: -2 };
        break;
      case "down":
        leftEye = { x: centerX - eyeOffset, y: centerY + eyeOffset * 0.5 };
        rightEye = { x: centerX + eyeOffset, y: centerY + eyeOffset * 0.5 };
        pupilOffset = { x: 0, y: 2 };
        break;
      case "left":
        leftEye = { x: centerX - eyeOffset * 0.5, y: centerY - eyeOffset };
        rightEye = { x: centerX - eyeOffset * 0.5, y: centerY + eyeOffset };
        pupilOffset = { x: -2, y: 0 };
        break;
      case "right":
      default:
        leftEye = { x: centerX + eyeOffset * 0.5, y: centerY - eyeOffset };
        rightEye = { x: centerX + eyeOffset * 0.5, y: centerY + eyeOffset };
        pupilOffset = { x: 2, y: 0 };
        break;
    }

    // Draw eyes (white part)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEye.x, rightEye.y, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw pupils (black part)
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(
      leftEye.x + pupilOffset.x,
      leftEye.y + pupilOffset.y,
      pupilSize,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      rightEye.x + pupilOffset.x,
      rightEye.y + pupilOffset.y,
      pupilSize,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  private renderComboIndicator(snake: Snake, interpolation: number): void {
    const combo = snake.getCombo();
    if (!combo.color || combo.count === 0) return;

    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();
    const segments = snake.getInterpolation(interpolation);
    const headPos = this.canvas.tileToScreen(segments[0].x, segments[0].y);

    const dotSize = tileSize * 0.15;
    const dotSpacing = dotSize * 2;
    const startX =
      headPos.x + tileSize / 2 - ((combo.count - 1) * dotSpacing) / 2;
    const y = headPos.y - dotSize * 2;

    const comboColor = APPLE_COLOR_VALUES[combo.color];

    for (let i = 0; i < combo.count; i++) {
      ctx.fillStyle = comboColor;
      ctx.shadowColor = comboColor;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(startX + i * dotSpacing, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  private renderEffectTimers(snake: Snake, interpolation: number): void {
    const effects = snake.getActiveEffects();
    if (effects.size === 0) return;

    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();
    const segments = snake.getInterpolation(interpolation);
    const headPos = this.canvas.tileToScreen(segments[0].x, segments[0].y);

    const timerRadius = tileSize * 0.2;
    let offsetIndex = 0;

    for (const [color, effect] of effects) {
      const elapsed = performance.now() - effect.startTime;
      const progress = 1 - elapsed / effect.duration;

      if (progress <= 0) continue;

      const x =
        headPos.x + tileSize + timerRadius + offsetIndex * (timerRadius * 2.5);
      const y = headPos.y + tileSize / 2;

      // Background circle
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y, timerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Progress arc
      const effectColor = APPLE_COLOR_VALUES[color];
      ctx.strokeStyle = effectColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        timerRadius - 2,
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2
      );
      ctx.stroke();

      offsetIndex++;
    }
  }

  // Render an apple
  renderApple(apple: Apple): void {
    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();
    const pos = this.canvas.tileToScreen(apple.position.x, apple.position.y);
    const color = APPLE_COLOR_VALUES[apple.color];

    // Spawn animation
    let scale = 1;
    if (apple.isSpawning()) {
      const progress = apple.getSpawnProgress();
      // Bouncy pop-in effect
      scale = this.easeOutBack(progress);
    }

    // Bobbing animation
    const bobOffset =
      Math.sin(this.animationTime * 0.005 + apple.position.x * 0.5) * 2;

    const size = tileSize * 0.7 * scale;
    const centerX = pos.x + tileSize / 2;
    const centerY = pos.y + tileSize / 2 + bobOffset;

    // Apple body (circle)
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Highlight/shine
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(
      centerX - size * 0.15,
      centerY - size * 0.15,
      size * 0.2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Leaf (small green triangle)
    ctx.fillStyle = "#44AA44";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size / 2);
    ctx.lineTo(centerX + size * 0.2, centerY - size / 2 - size * 0.3);
    ctx.lineTo(centerX - size * 0.1, centerY - size / 2 - size * 0.15);
    ctx.closePath();
    ctx.fill();

    // Stem
    ctx.strokeStyle = "#885533";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size / 2);
    ctx.lineTo(centerX, centerY - size / 2 - size * 0.15);
    ctx.stroke();
  }

  // Render a gray block
  renderGrayBlock(block: GrayBlock): void {
    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();
    const pos = this.canvas.tileToScreen(block.position.x, block.position.y);

    // Conversion animation
    let scale = 1;
    let alpha = 1;
    if (block.getState() === "converting") {
      const progress = block.getConversionProgress();
      scale = 1 - progress * 0.5;
      alpha = 1 - progress;
    }

    // Pulsing effect
    const pulse = block.getPulseValue();
    const brightness = 60 + pulse * 20;

    const size = tileSize * 0.9 * scale;
    const padding = (tileSize - size) / 2;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;

    this.roundRect(ctx, pos.x + padding, pos.y + padding, size, size, 4);
    ctx.fill();

    // Subtle inner highlight
    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * pulse})`;
    this.roundRect(
      ctx,
      pos.x + padding + 2,
      pos.y + padding + 2,
      size - 4,
      size - 4,
      3
    );
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  // Render a projectile
  renderProjectile(projectile: Projectile, interpolation: number): void {
    const ctx = this.canvas.ctx;
    const tileSize = this.canvas.getTileSize();

    // Draw trail
    const trail = projectile.getTrail();
    for (let i = 0; i < trail.length; i++) {
      const alpha = ((i + 1) / (trail.length + 1)) * 0.5;
      const size = tileSize * 0.3 * ((i + 1) / trail.length);
      const pos = this.canvas.tileToScreen(trail[i].x, trail[i].y);

      ctx.fillStyle = `rgba(255, 170, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(pos.x + tileSize / 2, pos.y + tileSize / 2, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw projectile
    const interpPos = projectile.getInterpolatedPosition(interpolation);
    const pos = this.canvas.tileToScreen(interpPos.x, interpPos.y);
    const centerX = pos.x + tileSize / 2;
    const centerY = pos.y + tileSize / 2;

    // Glowing orb
    ctx.fillStyle = "#FFAA00";
    ctx.shadowColor = "#FFAA00";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(centerX, centerY, tileSize * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(centerX, centerY, tileSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  // Render rain effect overlay
  renderRainEffect(effectManager: EffectManager): void {
    if (!effectManager.hasGlobalEffect("blue")) {
      this.rainActive = false;
      return;
    }

    this.rainActive = true;
    const ctx = this.canvas.ctx;
    const progress = effectManager.getGlobalEffectProgress("blue");

    // Fade in/out at start and end
    let alpha = 1;
    if (progress < 0.1) {
      alpha = progress / 0.1;
    } else if (progress > 0.9) {
      alpha = (1 - progress) / 0.1;
    }

    // Blue tint overlay
    ctx.fillStyle = `rgba(0, 50, 150, ${0.2 * alpha})`;
    ctx.fillRect(0, 0, this.canvas.getWidth(), this.canvas.getHeight());

    // Rain drops
    ctx.strokeStyle = `rgba(150, 200, 255, ${0.6 * alpha})`;
    ctx.lineWidth = 2;

    for (const drop of this.rainDrops) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + drop.length);
      ctx.stroke();
    }
  }

  // Render speed lines effect (for red boost)
  renderSpeedLines(snake: Snake): void {
    if (!snake.hasEffect("red")) return;

    const ctx = this.canvas.ctx;
    const segments = snake.getSegments();
    if (segments.length === 0) return;

    const head = segments[0];
    const pos = this.canvas.tileToScreen(head.x, head.y);
    const tileSize = this.canvas.getTileSize();
    const direction = snake.getDirection();

    ctx.strokeStyle = "rgba(255, 100, 100, 0.5)";
    ctx.lineWidth = 2;

    // Draw speed lines behind the snake
    const lineCount = 5;
    for (let i = 0; i < lineCount; i++) {
      const offset = (Math.random() - 0.5) * tileSize;
      const length = 20 + Math.random() * 30;

      ctx.beginPath();
      switch (direction) {
        case "up":
          ctx.moveTo(pos.x + tileSize / 2 + offset, pos.y + tileSize);
          ctx.lineTo(pos.x + tileSize / 2 + offset, pos.y + tileSize + length);
          break;
        case "down":
          ctx.moveTo(pos.x + tileSize / 2 + offset, pos.y);
          ctx.lineTo(pos.x + tileSize / 2 + offset, pos.y - length);
          break;
        case "left":
          ctx.moveTo(pos.x + tileSize, pos.y + tileSize / 2 + offset);
          ctx.lineTo(pos.x + tileSize + length, pos.y + tileSize / 2 + offset);
          break;
        case "right":
          ctx.moveTo(pos.x, pos.y + tileSize / 2 + offset);
          ctx.lineTo(pos.x - length, pos.y + tileSize / 2 + offset);
          break;
      }
      ctx.stroke();
    }
  }

  // Trigger screen shake
  triggerScreenShake(intensity: number = 10): void {
    this.shakeIntensity = intensity;
  }

  // Set rain active state
  setRainActive(active: boolean): void {
    this.rainActive = active;
  }

  // Helper: Draw rounded rectangle
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

  // Helper: Easing function for bouncy pop-in
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
}
