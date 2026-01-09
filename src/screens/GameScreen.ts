import type { Canvas } from "../core/Canvas";
import type { InputManager, PlayerSlot } from "../systems/InputManager";
import { Snake } from "../entities/Snake";
import { AppleManager } from "../systems/AppleManager";
import { GrayBlockManager } from "../systems/GrayBlockManager";
import { ProjectileManager } from "../systems/ProjectileManager";
import { EffectManager } from "../systems/EffectManager";
import { GameRenderer } from "../systems/GameRenderer";
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
          this.scores.set(
            snake.playerId,
            (this.scores.get(snake.playerId) || 0) + 10
          );

          if (triggeredEffect) {
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
      this.callbacks.onGameOver(this.scores);
    }
  }

  private spawnProjectile(snake: Snake): void {
    this.projectileManager.spawnFromSnake(snake);
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

    // Score display at top
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    let xOffset = 20;
    for (const [playerId, score] of this.scores) {
      const snake = this.snakes.get(playerId);
      if (!snake) continue;

      const color = snake.isAlive() ? "#FFFFFF" : "#666666";
      ctx.fillStyle = color;
      ctx.fillText(`${snake.name}: ${score}`, xOffset, 20);
      xOffset += 200;
    }
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}
