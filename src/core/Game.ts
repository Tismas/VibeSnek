import { Canvas } from "./Canvas";
import { GameLoop } from "./GameLoop";
import { EventBus, gameEventBus } from "./EventBus";
import type { GameState, BoardSize, Difficulty } from "../utils/constants";
import { DIFFICULTY_SPEEDS, COUNTDOWN_SECONDS } from "../utils/constants";

export interface GameConfig {
  boardSize: BoardSize;
  difficulty: Difficulty;
}

export class Game {
  private state: GameState = "lobby";
  private canvas: Canvas;
  private gameLoop: GameLoop;
  private eventBus: EventBus;

  // Game configuration (set in lobby)
  private config: GameConfig = {
    boardSize: 25,
    difficulty: "normal",
  };

  // Countdown state
  private countdownValue: number = COUNTDOWN_SECONDS;
  private countdownTimer: number | null = null;

  // Screen renderers (will be set by screens)
  private currentScreen: {
    update?: (deltaTime: number) => void;
    render?: (interpolation: number) => void;
  } | null = null;

  constructor(container: HTMLElement) {
    this.canvas = new Canvas(container);
    this.gameLoop = new GameLoop(60);
    this.eventBus = gameEventBus;

    this.setupGameLoop();
    this.setupEventListeners();
  }

  private setupGameLoop(): void {
    this.gameLoop.setUpdateCallback((deltaTime) => {
      this.update(deltaTime);
    });

    this.gameLoop.setRenderCallback((interpolation) => {
      this.render(interpolation);
    });
  }

  private setupEventListeners(): void {
    // Handle visibility change to pause/resume
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Pause the game loop when tab is hidden
        this.gameLoop.pause();
      } else {
        // Resume when tab becomes visible
        this.gameLoop.resume();
      }
    });
  }

  private update(deltaTime: number): void {
    if (this.currentScreen?.update) {
      this.currentScreen.update(deltaTime);
    }
  }

  private render(interpolation: number): void {
    this.canvas.clear();

    if (this.currentScreen?.render) {
      this.currentScreen.render(interpolation);
    }
  }

  // State management
  setState(newState: GameState): void {
    const oldState = this.state;
    this.state = newState;

    this.eventBus.emit("state:change", { from: oldState, to: newState });

    // Handle state-specific logic
    switch (newState) {
      case "countdown":
        this.startCountdown();
        break;
      case "playing":
        // Game starts
        break;
      case "gameOver":
        // Game ends
        break;
    }
  }

  getState(): GameState {
    return this.state;
  }

  // Countdown logic
  private startCountdown(): void {
    this.countdownValue = COUNTDOWN_SECONDS;
    this.eventBus.emit("game:countdown", { count: this.countdownValue });

    this.countdownTimer = window.setInterval(() => {
      this.countdownValue--;

      if (this.countdownValue > 0) {
        this.eventBus.emit("game:countdown", { count: this.countdownValue });
      } else {
        this.stopCountdown();
        this.setState("playing");
        this.eventBus.emit("game:start");
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  getCountdownValue(): number {
    return this.countdownValue;
  }

  // Configuration
  setConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.boardSize !== undefined) {
      this.canvas.setBoardSize(config.boardSize);
    }
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getSpeed(): number {
    return DIFFICULTY_SPEEDS[this.config.difficulty];
  }

  // Screen management
  setScreen(screen: {
    update?: (deltaTime: number) => void;
    render?: (interpolation: number) => void;
  }): void {
    this.currentScreen = screen;
  }

  // Getters
  getCanvas(): Canvas {
    return this.canvas;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  // Lifecycle
  start(): void {
    this.gameLoop.start();
  }

  stop(): void {
    this.gameLoop.stop();
    this.stopCountdown();
  }

  destroy(): void {
    this.stop();
    this.eventBus.clear();
  }
}
