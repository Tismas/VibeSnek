import "./style.css";
import { Game } from "./core/Game";
import { InputManager } from "./systems/InputManager";
import { LobbyScreen } from "./screens/LobbyScreen";
import { CountdownScreen } from "./screens/CountdownScreen";
import { GameScreen } from "./screens/GameScreen";
import { GameOverScreen } from "./screens/GameOverScreen";
import { audioManager } from "./systems/AudioManager";

// Initialize the game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App container not found");
  }

  const game = new Game(app);
  const inputManager = new InputManager();

  // Initialize audio on first user interaction
  const initAudio = () => {
    audioManager.initialize();
    document.removeEventListener("click", initAudio);
    document.removeEventListener("keydown", initAudio);
  };
  document.addEventListener("click", initAudio);
  document.addEventListener("keydown", initAudio);

  // Store game config and players for creating game screen
  let pendingGameConfig: { boardSize: number; difficulty: string } | null =
    null;

  // Create countdown screen
  const countdownScreen = new CountdownScreen(game.getCanvas(), {
    onComplete: () => {
      console.log("Countdown complete! Starting game...");
      game.setState("playing");

      // Start background music
      audioManager.startMusic();

      if (pendingGameConfig) {
        // Create the actual game screen
        const gameScreen = new GameScreen(
          game.getCanvas(),
          inputManager,
          {
            boardSize: pendingGameConfig.boardSize as 15 | 25 | 50,
            difficulty: pendingGameConfig.difficulty as
              | "easy"
              | "normal"
              | "hard"
              | "insane",
            players: inputManager.getAllPlayers(),
          },
          {
            onGameOver: (scores) => {
              console.log("Game over! Scores:", scores);
              game.setState("gameOver");

              // Stop background music
              audioManager.stopMusic();

              // Create and show game over screen
              const gameOverScreen = new GameOverScreen(
                game.getCanvas(),
                scores,
                inputManager.getAllPlayers(),
                pendingGameConfig!.boardSize as 15 | 25 | 50,
                {
                  onPlayAgain: () => {
                    // Clean up game over screen
                    gameOverScreen.onExit?.();
                    // Reset players ready state
                    for (const player of inputManager.getAllPlayers()) {
                      inputManager.setPlayerReady(player.playerId, false);
                    }
                    // Return to lobby
                    game.setState("lobby");
                    setLobbyScreen();
                  },
                }
              );

              gameOverScreen.onEnter?.();

              game.setScreen({
                update: (deltaTime) => gameOverScreen.update(deltaTime),
                render: (interpolation) => gameOverScreen.render(interpolation),
              });
            },
          }
        );

        game.setScreen({
          update: (deltaTime) => gameScreen.update(deltaTime),
          render: (interpolation) => gameScreen.render(interpolation),
        });
      }
    },
  });

  // Helper function to set lobby as current screen
  const setLobbyScreen = () => {
    game.setScreen({
      update: (deltaTime) => lobbyScreen.update(deltaTime),
      render: (interpolation) => lobbyScreen.render(interpolation),
    });
  };

  // Create and set up lobby screen
  const lobbyScreen = new LobbyScreen(game.getCanvas(), inputManager, {
    onGameStart: (config) => {
      console.log("Game starting with config:", config);
      pendingGameConfig = config;
      game.setConfig(config);
      game.setState("countdown");
      countdownScreen.start();
      // Switch to countdown screen
      game.setScreen({
        update: (deltaTime) => {
          lobbyScreen.update(deltaTime); // Keep lobby rendering in background
          countdownScreen.update(deltaTime);
        },
        render: (interpolation) => {
          lobbyScreen.render(interpolation); // Render lobby as background
          countdownScreen.render(interpolation); // Overlay countdown
        },
      });
    },
    onCountdownCancel: () => {
      console.log("Countdown cancelled - returning to lobby");
      countdownScreen.stop();
      game.setState("lobby");
      setLobbyScreen();
    },
  });

  // Set lobby as the current screen
  setLobbyScreen();

  // Start input handling
  inputManager.start();

  // Start the game loop
  game.start();

  // For debugging in development
  if (import.meta.env.DEV) {
    (window as Window & { game?: Game; inputManager?: InputManager }).game =
      game;
    (
      window as Window & { game?: Game; inputManager?: InputManager }
    ).inputManager = inputManager;
  }
});
