import type { Canvas } from "../core/Canvas";
import type { InputManager, PlayerSlot } from "../systems/InputManager";
import { Snake } from "../entities/Snake";
import { AppleManager } from "../systems/AppleManager";
import { GrayBlockManager } from "../systems/GrayBlockManager";
import { ProjectileManager } from "../systems/ProjectileManager";
import { EffectManager } from "../systems/EffectManager";
import { GameRenderer } from "../systems/GameRenderer";
import { audioManager } from "../systems/AudioManager";
import {
  DIFFICULTY_SPEEDS,
  type BoardSize,
  type Difficulty,
} from "../utils/constants";

interface GameScreenConfig {
  boardSize: BoardSize;
  difficulty: Difficulty;
  players: PlayerSlot[];
}

interface GameScreenCallbacks {
  onGameOver: (scores: Map<number, number>) => void;
}

export class GameScreen {
  private canvas: Canvas;
  private inputManager: InputManager;
  private callbacks: GameScreenCallbacks;

  // Game config
  private boardSize: BoardSize;
  private baseSpeed: number;

  // Game entities
  private snakes: Map<number, Snake> = new Map();
  private appleManager: AppleManager;
  private grayBlockManager: GrayBlockManager;
  private projectileManager: ProjectileManager;
  private effectManager: EffectManager;

  // Rendering
  private renderer: GameRenderer;

  // Game state
  private scores: Map<number, number> = new Map();
  private isGameOver: boolean = false;
  private gameStartTime: number = performance.now();
  private elapsedTime: number = 0;
  private snakeDeathTimes: Map<number, number> = new Map(); // playerId -> survival time in ms

  // Input handling
  private unsubscribers: Array<() => void> = [];

  constructor(
    canvas: Canvas,
    inputManager: InputManager,
    config: GameScreenConfig,
    callbacks: GameScreenCallbacks
  ) {
    this.canvas = canvas;
    this.inputManager = inputManager;
    this.callbacks = callbacks;

    this.boardSize = config.boardSize;
    this.baseSpeed = DIFFICULTY_SPEEDS[config.difficulty];

    // Initialize canvas
    this.canvas.setBoardSize(this.boardSize);

    // Initialize managers
    this.appleManager = new AppleManager({ boardSize: this.boardSize });
    this.grayBlockManager = new GrayBlockManager();
    this.projectileManager = new ProjectileManager(this.boardSize);
    this.effectManager = new EffectManager({
      onProjectileSpawn: (snake) => this.spawnProjectile(snake),
      onAppleRain: () => this.triggerAppleRain(),
      onRainEffectStart: () => this.renderer.setRainActive(true),
      onRainEffectEnd: () => this.renderer.setRainActive(false),
    });

    // Initialize renderer
    this.renderer = new GameRenderer(this.canvas);

    // Setup manager connections
    this.projectileManager.setGrayBlockManager(this.grayBlockManager);
    this.grayBlockManager.setBlockConvertedCallback((block) => {
      // Update occupied positions to exclude the converting block
      this.updateOccupiedPositions();
      // Spawn random apple where block was
      this.appleManager.spawnApple(block.position, this.getRandomAppleColor());
      // Play hit sound
      audioManager.play("projectile_hit");
    });

    // Create snakes for each player
    this.initializeSnakes(config.players);

    // Initialize apples
    this.appleManager.initialize();

    // Setup input handling
    this.setupInputHandlers();
  }

  private initializeSnakes(players: PlayerSlot[]): void {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const snake = new Snake(
        player.playerId,
        i, // slot index for spawn position
        player.color,
        player.name,
        this.boardSize,
        this.baseSpeed
      );

      // Set tail shed callback
      snake.setTailShedCallback((positions) => {
        this.grayBlockManager.spawnBlocks(positions);
        this.renderer.triggerScreenShake(5);
        audioManager.play("tail_shed");
      });

      this.snakes.set(player.playerId, snake);
      this.scores.set(player.playerId, 0);
    }
  }

  private setupInputHandlers(): void {
    const unsubInput = this.inputManager.onInput((input) => {
      if (this.isGameOver) return;

      const snake = this.snakes.get(input.playerId);
      if (!snake || !snake.isAlive()) return;

      // Direction inputs
      switch (input.action) {
        case "up":
          snake.setDirection("up");
          break;
        case "down":
          snake.setDirection("down");
          break;
        case "left":
          snake.setDirection("left");
          break;
        case "right":
          snake.setDirection("right");
          break;
      }
    });
    this.unsubscribers.push(unsubInput);
  }

  update(deltaTime: number): void {
    if (this.isGameOver) return;

    // Track elapsed time
    this.elapsedTime = performance.now() - this.gameStartTime;

    // Update renderer animations
    this.renderer.update(deltaTime);

    // Update effects
    this.effectManager.update(deltaTime);

    // Update occupied positions for apple spawning
    this.updateOccupiedPositions();

    // Update snakes
    for (const snake of this.snakes.values()) {
      if (!snake.isAlive()) continue;

      const moved = snake.update(deltaTime);

      if (moved) {
        // Check apple collision
        const apple = this.appleManager.checkCollision(snake);
        if (apple) {
          const triggeredEffect = this.appleManager.consumeApple(apple, snake);

          // Play eat sound
          audioManager.play("eat_apple");

          this.scores.set(
            snake.playerId,
            (this.scores.get(snake.playerId) || 0) + 10
          );

          if (triggeredEffect) {
            // Play combo activation sound
            audioManager.play("combo_activate");

            this.effectManager.applyEffect(apple.color, snake);
            this.scores.set(
              snake.playerId,
              (this.scores.get(snake.playerId) || 0) + 50
            );
          }
        }

        // Check collisions
        this.checkSnakeCollisions(snake);
      }
    }

    // Update apples
    this.appleManager.update(deltaTime);

    // Update gray blocks
    this.grayBlockManager.update(deltaTime);

    // Update projectiles
    this.projectileManager.update(deltaTime);

    // Check for game over
    this.checkGameOver();
  }

  private updateOccupiedPositions(): void {
    const positions: Array<{ x: number; y: number }> = [];

    // Add snake positions
    for (const snake of this.snakes.values()) {
      if (snake.isAlive()) {
        for (const segment of snake.getSegments()) {
          positions.push({ x: segment.x, y: segment.y });
        }
      }
    }

    // Add gray block positions
    positions.push(...this.grayBlockManager.getOccupiedPositions());

    this.appleManager.updateOccupiedPositions(positions);
  }

  private checkSnakeCollisions(snake: Snake): void {
    const head = snake.getHead();

    // Check self-collision
    if (snake.checkSelfCollision()) {
      this.killSnake(snake);
      return;
    }

    // Check collision with other snakes
    for (const other of this.snakes.values()) {
      if (other.playerId === snake.playerId) continue;
      if (snake.checkCollisionWithSnake(other)) {
        this.killSnake(snake);
        return;
      }
    }

    // Check collision with gray blocks
    if (this.grayBlockManager.hasBlockAt(head)) {
      this.killSnake(snake);
      return;
    }
  }

  private killSnake(snake: Snake): void {
    const bodyPositions = snake.die();
    this.grayBlockManager.spawnBlocks(bodyPositions);
    snake.enterSpectatorMode();
    this.renderer.triggerScreenShake(15);

    // Track survival time
    this.snakeDeathTimes.set(snake.playerId, this.elapsedTime);

    // Play death sound
    audioManager.play("snake_death");
  }

  private checkGameOver(): void {
    // Game over when all snakes are dead
    let aliveCount = 0;
    for (const snake of this.snakes.values()) {
      if (snake.isAlive()) {
        aliveCount++;
      }
    }

    if (aliveCount === 0) {
      this.isGameOver = true;
      // Stop any ambient sounds
      audioManager.stopAllAmbient();

      // Calculate final scores with bonuses
      this.calculateFinalScores();

      this.callbacks.onGameOver(this.scores);
    }
  }

  private calculateFinalScores(): void {
    // Find the maximum survival time for bonus calculation
    let maxSurvivalTime = 0;
    for (const time of this.snakeDeathTimes.values()) {
      if (time > maxSurvivalTime) {
        maxSurvivalTime = time;
      }
    }

    for (const snake of this.snakes.values()) {
      let bonus = 0;
      const survivalTime = this.snakeDeathTimes.get(snake.playerId) || 0;

      // Survival time bonus: 1 point per second survived
      const survivalBonus = Math.floor(survivalTime / 1000);
      bonus += survivalBonus;

      // Last survivor bonus: extra 100 points if you survived the longest
      if (survivalTime === maxSurvivalTime && this.snakes.size > 1) {
        bonus += 100;
      }

      // Final length bonus: 5 points per segment at death
      // (Snake length is reset after death, so we track differently)
      // For now, we'll add a flat bonus based on apples eaten
      // The combo bonus already rewards skilled play

      // Add bonus to score
      const currentScore = this.scores.get(snake.playerId) || 0;
      this.scores.set(snake.playerId, currentScore + bonus);
    }
  }

  private spawnProjectile(snake: Snake): void {
    this.projectileManager.spawnFromSnake(snake);
    audioManager.play("projectile_fire");
  }

  private triggerAppleRain(): void {
    this.appleManager.spawnAppleRain();
  }

  private getRandomAppleColor() {
    const colors = ["red", "green", "blue", "orange", "purple"] as const;
    return colors[Math.floor(Math.random() * colors.length)];
  }

  render(interpolation: number): void {
    this.renderer.beginFrame();

    // Render board
    this.renderer.renderBoard();

    // Render gray blocks
    for (const block of this.grayBlockManager.getBlocks()) {
      this.renderer.renderGrayBlock(block);
    }

    // Render apples
    for (const apple of this.appleManager.getApples()) {
      this.renderer.renderApple(apple);
    }

    // Render snakes
    for (const snake of this.snakes.values()) {
      this.renderer.renderSnake(snake, interpolation);
      this.renderer.renderSpeedLines(snake);
    }

    // Render projectiles
    for (const projectile of this.projectileManager.getProjectiles()) {
      this.renderer.renderProjectile(projectile, interpolation);
    }

    // Render rain effect (if active)
    this.renderer.renderRainEffect(this.effectManager);

    // Render UI
    this.renderUI();

    this.renderer.endFrame();
  }

  private renderUI(): void {
    const ctx = this.canvas.ctx;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Format elapsed time
    const totalSeconds = Math.floor(this.elapsedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    // Timer at top center
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(width / 2 - 50, 5, 100, 30);

    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(timeString, width / 2, 10);

    // Player scores in corners
    this.renderPlayerScores(ctx, width, height);

    // Active global effects indicator
    this.renderGlobalEffects(ctx, width);
  }

  private renderPlayerScores(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const playerList = Array.from(this.snakes.values());
    const corners = [
      { x: 15, y: 45, align: "left" as const },
      { x: width - 15, y: 45, align: "right" as const },
      { x: 15, y: height - 15, align: "left" as const },
      { x: width - 15, y: height - 15, align: "right" as const },
    ];

    playerList.forEach((snake, index) => {
      const corner = corners[index];
      if (!corner) return;

      const score = this.scores.get(snake.playerId) || 0;
      const isAlive = snake.isAlive();

      // Background panel
      ctx.textAlign = corner.align;
      ctx.textBaseline = index < 2 ? "top" : "bottom";

      const panelWidth = 160;
      const panelHeight = 50;
      const panelX =
        corner.align === "left" ? corner.x - 5 : corner.x - panelWidth + 5;
      const panelY = index < 2 ? corner.y - 5 : corner.y - panelHeight + 5;

      ctx.fillStyle = isAlive ? "rgba(0, 0, 0, 0.5)" : "rgba(80, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
      ctx.fill();

      // Player color indicator
      const colorX =
        corner.align === "left" ? panelX + 12 : panelX + panelWidth - 12;
      const colorY = panelY + panelHeight / 2;
      ctx.fillStyle = isAlive ? snake.color : "#444444";
      ctx.beginPath();
      ctx.arc(colorX, colorY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Name and score
      const textX =
        corner.align === "left" ? panelX + 28 : panelX + panelWidth - 28;
      ctx.fillStyle = isAlive ? "#FFFFFF" : "#666666";
      ctx.font = "bold 14px 'Segoe UI', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(snake.name, textX, panelY + 16);

      ctx.font = "bold 20px 'Segoe UI', sans-serif";
      ctx.fillStyle = isAlive ? "#FFD700" : "#666666";
      ctx.fillText(score.toString(), textX, panelY + 36);

      // Dead indicator
      if (!isAlive) {
        ctx.fillStyle = "#FF4444";
        ctx.font = "bold 10px 'Segoe UI', sans-serif";
        const deadX =
          corner.align === "left" ? panelX + panelWidth - 35 : panelX + 35;
        ctx.textAlign = "center";
        ctx.fillText("DEAD", deadX, panelY + panelHeight / 2);
      }

      // Active effect timer on snake
      const effect = snake.getActiveEffect();
      if (effect && isAlive) {
        const progress = snake.getEffectProgress();
        const effectX =
          corner.align === "left" ? panelX + panelWidth - 20 : panelX + 20;
        const effectY = panelY + panelHeight / 2;

        // Effect timer circle
        ctx.strokeStyle = effect === "red" ? "#FF4444" : "#44FF44";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          effectX,
          effectY,
          12,
          -Math.PI / 2,
          -Math.PI / 2 + (1 - progress) * Math.PI * 2
        );
        ctx.stroke();

        // Effect icon
        ctx.fillStyle = effect === "red" ? "#FF4444" : "#44FF44";
        ctx.font = "bold 12px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(effect === "red" ? "⚡" : "🐢", effectX, effectY);
      }
    });
  }

  private renderGlobalEffects(
    ctx: CanvasRenderingContext2D,
    width: number
  ): void {
    const blueEffect = this.effectManager.getGlobalEffect("blue");
    if (blueEffect) {
      const progress = this.effectManager.getGlobalEffectProgress("blue");
      const remaining = this.effectManager.getGlobalEffectRemainingTime("blue");
      const secondsLeft = Math.ceil(remaining / 1000);

      // Rain effect indicator
      ctx.fillStyle = "rgba(68, 136, 255, 0.8)";
      ctx.font = "bold 16px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`🌧️ Rain Effect: ${secondsLeft}s`, width / 2, 42);

      // Progress bar
      const barWidth = 120;
      const barHeight = 4;
      const barX = width / 2 - barWidth / 2;
      const barY = 62;

      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = "#4488FF";
      ctx.fillRect(barX, barY, barWidth * (1 - progress), barHeight);
    }
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}
