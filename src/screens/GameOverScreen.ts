import type { Canvas } from "../core/Canvas";
import type { Screen } from "../core/ScreenManager";
import type { PlayerSlot } from "../systems/InputManager";
import { audioManager } from "../systems/AudioManager";
import { PLAYER_COLOR_VALUES, type BoardSize } from "../utils/constants";
import { highScoreManager } from "../systems/HighScoreManager";

interface PlayerScore {
  playerId: number;
  name: string;
  score: number;
  color: string;
  qualifiesForHighScore: boolean;
  highScoreRank: number;
}

interface GameOverCallbacks {
  onPlayAgain: () => void;
}

// Name entry state
type NameEntryState = "none" | "entering" | "complete";

export class GameOverScreen implements Screen {
  private canvas: Canvas;
  private callbacks: GameOverCallbacks;
  private players: PlayerSlot[];
  private boardSize: BoardSize;

  // Score data
  private playerScores: PlayerScore[] = [];
  private winner: PlayerScore | null = null;

  // High score / name entry state
  private nameEntryState: NameEntryState = "none";
  private currentEntryPlayerIndex: number = 0;
  private entryName: string = "";
  private nameEntryQueue: PlayerScore[] = [];
  private newHighScoreRanks: Map<number, number> = new Map(); // playerId -> rank achieved
  private highScoreCelebrationTime: number = 0;

  // Animation state
  private animationTime: number = 0;
  private showScores: boolean = false;
  private showPrompt: boolean = false;
  private crownBob: number = 0;
  private confettiParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    size: number;
  }> = [];

  // Extra celebration particles for new high score
  private celebrationStars: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string;
  }> = [];

  // Input handling
  private inputHandler: ((e: KeyboardEvent) => void) | null = null;
  private gamepadPollInterval: number | null = null;

  constructor(
    canvas: Canvas,
    scores: Map<number, number>,
    players: PlayerSlot[],
    boardSize: BoardSize,
    callbacks: GameOverCallbacks
  ) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.players = players;
    this.boardSize = boardSize;

    this.processScores(scores);
    this.initConfetti();
  }

  private processScores(scores: Map<number, number>): void {
    this.playerScores = [];
    this.nameEntryQueue = [];

    for (const [playerId, score] of scores) {
      const player = this.players.find((p) => p.playerId === playerId);
      const qualifies = highScoreManager.isHighScore(score, this.boardSize);
      const rank = qualifies
        ? highScoreManager.getRank(score, this.boardSize)
        : 0;

      const playerScore: PlayerScore = {
        playerId,
        name: player?.name || `Player ${playerId}`,
        score,
        color: player?.color ? PLAYER_COLOR_VALUES[player.color] : "#FFFFFF",
        qualifiesForHighScore: qualifies,
        highScoreRank: rank,
      };

      this.playerScores.push(playerScore);

      // Queue players who qualify for name entry
      if (qualifies && score > 0) {
        this.nameEntryQueue.push(playerScore);
      }
    }

    // Sort by score descending
    this.playerScores.sort((a, b) => b.score - a.score);
    // Also sort name entry queue by score
    this.nameEntryQueue.sort((a, b) => b.score - a.score);

    // Determine winner (highest score)
    if (this.playerScores.length > 0) {
      this.winner = this.playerScores[0];
    }

    // Start name entry if anyone qualifies
    if (this.nameEntryQueue.length > 0) {
      this.nameEntryState = "entering";
      this.currentEntryPlayerIndex = 0;
      this.entryName = this.nameEntryQueue[0].name.substring(0, 10); // Pre-fill with player name
    }
  }

  private initConfetti(): void {
    const width = this.canvas.getWidth();
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
    ];

    for (let i = 0; i < 100; i++) {
      this.confettiParticles.push({
        x: Math.random() * width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        size: 8 + Math.random() * 8,
      });
    }
  }

  onEnter(): void {
    this.animationTime = 0;
    this.showScores = false;
    this.showPrompt = false;

    // Setup input handling
    this.inputHandler = (e: KeyboardEvent) => {
      if (this.nameEntryState === "entering") {
        this.handleNameEntryInput(e);
      } else if (
        this.nameEntryState === "none" ||
        this.nameEntryState === "complete"
      ) {
        if (e.code === "Space" || e.code === "Enter") {
          this.callbacks.onPlayAgain();
        }
      }
    };
    window.addEventListener("keydown", this.inputHandler);

    // Setup gamepad polling
    this.gamepadPollInterval = window.setInterval(() => {
      // Only check gamepad for play again when not entering name
      if (this.nameEntryState !== "entering") {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
          if (gamepad) {
            // A button (index 0) or Start button (index 9)
            if (gamepad.buttons[0]?.pressed || gamepad.buttons[9]?.pressed) {
              this.callbacks.onPlayAgain();
              break;
            }
          }
        }
      }
    }, 100);
  }

  private handleNameEntryInput(e: KeyboardEvent): void {
    e.preventDefault();

    if (e.code === "Enter") {
      // Submit current name
      this.submitHighScore();
    } else if (e.code === "Backspace") {
      // Delete last character
      this.entryName = this.entryName.slice(0, -1);
    } else if (e.code === "Escape") {
      // Skip name entry for this player (use default name)
      this.submitHighScore();
    } else if (e.key.length === 1 && this.entryName.length < 10) {
      // Add character (alphanumeric and some symbols)
      if (/^[a-zA-Z0-9 _-]$/.test(e.key)) {
        this.entryName += e.key;
      }
    }
  }

  private submitHighScore(): void {
    const currentPlayer = this.nameEntryQueue[this.currentEntryPlayerIndex];
    const name = this.entryName.trim() || currentPlayer.name;

    // Add to high scores
    const rank = highScoreManager.addScore(
      name,
      currentPlayer.score,
      this.boardSize
    );
    this.newHighScoreRanks.set(currentPlayer.playerId, rank);

    // Play celebration sound if it's a top 3 score
    if (rank <= 3) {
      audioManager.play("combo_activate");
      this.triggerCelebration();
    }

    // Move to next player or finish
    this.currentEntryPlayerIndex++;
    if (this.currentEntryPlayerIndex < this.nameEntryQueue.length) {
      // More players to enter
      const nextPlayer = this.nameEntryQueue[this.currentEntryPlayerIndex];
      this.entryName = nextPlayer.name.substring(0, 10);
    } else {
      // All done
      this.nameEntryState = "complete";
      this.highScoreCelebrationTime = this.animationTime;
    }
  }

  private triggerCelebration(): void {
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();
    const colors = ["#FFD700", "#FFA500", "#FFFF00", "#FFFFFF"];

    // Create burst of stars
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const speed = 3 + Math.random() * 5;
      this.celebrationStars.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 10 + Math.random() * 15,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  onExit(): void {
    if (this.inputHandler) {
      window.removeEventListener("keydown", this.inputHandler);
      this.inputHandler = null;
    }

    if (this.gamepadPollInterval !== null) {
      clearInterval(this.gamepadPollInterval);
      this.gamepadPollInterval = null;
    }
  }

  update(deltaTime: number): void {
    this.animationTime += deltaTime;
    this.crownBob = Math.sin(this.animationTime * 0.003) * 5;

    // Reveal scores after 500ms (or immediately if name entry is done)
    if (this.animationTime > 500 && !this.showScores) {
      this.showScores = true;
    }

    // Show prompt after 1500ms (only if not entering name)
    if (
      this.animationTime > 1500 &&
      !this.showPrompt &&
      this.nameEntryState !== "entering"
    ) {
      this.showPrompt = true;
    }

    // Update confetti
    const height = this.canvas.getHeight();
    const width = this.canvas.getWidth();

    for (const particle of this.confettiParticles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;
      particle.vy += 0.05; // Gravity

      // Reset if off screen
      if (particle.y > height + 20) {
        particle.y = -20;
        particle.x = Math.random() * width;
        particle.vy = 2 + Math.random() * 3;
      }
    }

    // Update celebration stars
    for (let i = this.celebrationStars.length - 1; i >= 0; i--) {
      const star = this.celebrationStars[i];
      star.x += star.vx;
      star.y += star.vy;
      star.vy += 0.1; // Gravity
      star.alpha -= 0.02;
      star.size *= 0.98;

      if (star.alpha <= 0) {
        this.celebrationStars.splice(i, 1);
      }
    }
  }

  render(_interpolation: number): void {
    const ctx = this.canvas.ctx;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Confetti (behind everything)
    this.renderConfetti(ctx);

    // Celebration stars
    this.renderCelebrationStars(ctx);

    // Title
    this.renderTitle(ctx, width, height);

    // Winner announcement
    if (this.winner) {
      this.renderWinner(ctx, width, height);
    }

    // Scores
    if (this.showScores) {
      this.renderScores(ctx, width, height);
    }

    // Name entry overlay
    if (this.nameEntryState === "entering") {
      this.renderNameEntry(ctx, width, height);
    }

    // High score notification after entry complete
    if (this.nameEntryState === "complete" && this.newHighScoreRanks.size > 0) {
      this.renderHighScoreNotification(ctx, width, height);
    }

    // Play again prompt
    if (this.showPrompt && this.nameEntryState !== "entering") {
      this.renderPrompt(ctx, width, height);
    }
  }

  private renderCelebrationStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.celebrationStars) {
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.color;

      // Draw star shape
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const innerAngle = angle + Math.PI / 5;
        const outerRadius = star.size;
        const innerRadius = star.size * 0.4;

        if (i === 0) {
          ctx.moveTo(
            Math.cos(angle) * outerRadius,
            Math.sin(angle) * outerRadius
          );
        } else {
          ctx.lineTo(
            Math.cos(angle) * outerRadius,
            Math.sin(angle) * outerRadius
          );
        }
        ctx.lineTo(
          Math.cos(innerAngle) * innerRadius,
          Math.sin(innerAngle) * innerRadius
        );
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private renderConfetti(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.confettiParticles) {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        -particle.size / 2,
        -particle.size / 4,
        particle.size,
        particle.size / 2
      );
      ctx.restore();
    }
  }

  private renderTitle(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const titleY = height * 0.12;

    // Glow effect
    ctx.shadowColor = "#FF4444";
    ctx.shadowBlur = 20;

    ctx.fillStyle = "#FF4444";
    ctx.font = "bold 72px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GAME OVER", width / 2, titleY);

    ctx.shadowBlur = 0;
  }

  private renderWinner(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    if (!this.winner) return;

    const winnerY = height * 0.28;

    // Crown
    this.renderCrown(ctx, width / 2, winnerY - 50 + this.crownBob);

    // Winner text
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 28px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑 WINNER 👑", width / 2, winnerY);

    // Winner name with their color
    ctx.fillStyle = this.winner.color;
    ctx.font = "bold 48px 'Segoe UI', sans-serif";
    ctx.fillText(this.winner.name, width / 2, winnerY + 50);

    // Winner score
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "36px 'Segoe UI', sans-serif";
    ctx.fillText(`${this.winner.score} points`, width / 2, winnerY + 100);
  }

  private renderCrown(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // Crown body
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(-30, 20);
    ctx.lineTo(-30, 0);
    ctx.lineTo(-20, 10);
    ctx.lineTo(-10, -15);
    ctx.lineTo(0, 5);
    ctx.lineTo(10, -15);
    ctx.lineTo(20, 10);
    ctx.lineTo(30, 0);
    ctx.lineTo(30, 20);
    ctx.closePath();
    ctx.fill();

    // Crown jewels
    ctx.fillStyle = "#FF0000";
    ctx.beginPath();
    ctx.arc(-10, -5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0000FF";
    ctx.beginPath();
    ctx.arc(10, -5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#00FF00";
    ctx.beginPath();
    ctx.arc(0, 10, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderScores(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const startY = height * 0.52;
    const lineHeight = 45;

    ctx.font = "bold 24px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";

    // Header
    ctx.fillStyle = "#888888";
    ctx.fillText("FINAL SCORES", width / 2, startY - 20);

    // All scores (including winner again for completeness)
    this.playerScores.forEach((player, index) => {
      const y = startY + 20 + index * lineHeight;
      const isWinner = player === this.winner;

      // Rank
      ctx.fillStyle = isWinner ? "#FFD700" : "#666666";
      ctx.textAlign = "right";
      ctx.fillText(`#${index + 1}`, width / 2 - 150, y);

      // Name
      ctx.fillStyle = player.color;
      ctx.textAlign = "left";
      ctx.fillText(player.name, width / 2 - 130, y);

      // Score
      ctx.fillStyle = isWinner ? "#FFD700" : "#FFFFFF";
      ctx.textAlign = "right";
      ctx.fillText(player.score.toString(), width / 2 + 150, y);
    });
  }

  private renderPrompt(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const promptY = height * 0.88;
    const pulse = Math.sin(this.animationTime * 0.005) * 0.3 + 0.7;

    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.font = "24px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Press SPACE or A to play again", width / 2, promptY);
  }

  private renderNameEntry(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const currentPlayer = this.nameEntryQueue[this.currentEntryPlayerIndex];
    if (!currentPlayer) return;

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, width, height);

    // Modal box
    const boxWidth = 500;
    const boxHeight = 280;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    // Box background
    ctx.fillStyle = "#2a2a4e";
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 15);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 32px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🏆 NEW HIGH SCORE! 🏆", width / 2, boxY + 50);

    // Player info
    ctx.fillStyle = currentPlayer.color;
    ctx.font = "bold 24px 'Segoe UI', sans-serif";
    ctx.fillText(
      `${currentPlayer.name} - ${currentPlayer.score} points`,
      width / 2,
      boxY + 95
    );

    // Rank info
    ctx.fillStyle = "#AAAAAA";
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText(
      `Rank #${currentPlayer.highScoreRank} on ${this.boardSize}×${this.boardSize} board`,
      width / 2,
      boxY + 125
    );

    // Name entry label
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "20px 'Segoe UI', sans-serif";
    ctx.fillText("Enter your name:", width / 2, boxY + 165);

    // Name input box
    const inputWidth = 300;
    const inputHeight = 40;
    const inputX = (width - inputWidth) / 2;
    const inputY = boxY + 180;

    ctx.fillStyle = "#1a1a2e";
    ctx.strokeStyle = "#4ECDC4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(inputX, inputY, inputWidth, inputHeight, 5);
    ctx.fill();
    ctx.stroke();

    // Name text with cursor
    const cursorVisible = Math.floor(this.animationTime / 500) % 2 === 0;
    const displayText = this.entryName + (cursorVisible ? "|" : "");

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "24px 'Segoe UI', sans-serif";
    ctx.fillText(displayText, width / 2, inputY + 28);

    // Instructions
    ctx.fillStyle = "#888888";
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.fillText("Press ENTER to confirm • ESC to skip", width / 2, boxY + 255);
  }

  private renderHighScoreNotification(
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number
  ): void {
    // Only show briefly after completion
    const timeSinceComplete =
      this.animationTime - this.highScoreCelebrationTime;
    if (timeSinceComplete > 3000) return;

    const alpha = Math.min(
      1,
      Math.max(0, 1 - (timeSinceComplete - 2000) / 1000)
    );
    if (alpha <= 0) return;

    // Count how many new high scores
    const count = this.newHighScoreRanks.size;
    const bestRank = Math.min(...this.newHighScoreRanks.values());

    ctx.save();
    ctx.globalAlpha = alpha;

    // Notification bar at top
    const barHeight = 60;
    ctx.fillStyle = "rgba(255, 215, 0, 0.9)";
    ctx.fillRect(0, 0, width, barHeight);

    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 28px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";

    if (count === 1) {
      ctx.fillText(
        `🎉 New #${bestRank} High Score! 🎉`,
        width / 2,
        barHeight / 2 + 10
      );
    } else {
      ctx.fillText(
        `🎉 ${count} New High Scores! Best: #${bestRank} 🎉`,
        width / 2,
        barHeight / 2 + 10
      );
    }

    ctx.restore();
  }
}
