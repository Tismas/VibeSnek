import "./style.css";
import { Game } from "./core/Game";
import { InputManager } from "./systems/InputManager";
import { LobbyScreen } from "./screens/LobbyScreen";
import { CountdownScreen } from "./screens/CountdownScreen";
import { GameScreen } from "./screens/GameScreen";

// Initialize the game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App container not found");
  }

  const game = new Game(app);
  const inputManager = new InputManager();

  // Store game config and players for creating game screen
  let pendingGameConfig: { boardSize: number; difficulty: string } | null =
    null;

  // Create countdown screen
  const countdownScreen = new CountdownScreen(game.getCanvas(), {
    onComplete: () => {
      console.log("Countdown complete! Starting game...");
      game.setState("playing");

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
              // TODO: Show game over screen
              // For now, just show scores
              game.setScreen({
                update: () => {},
                render: () => {
                  const ctx = game.getCanvas().ctx;
                  const width = game.getCanvas().getWidth();
                  const height = game.getCanvas().getHeight();

                  ctx.fillStyle = "#1a1a2e";
                  ctx.fillRect(0, 0, width, height);

                  ctx.fillStyle = "#FF4444";
                  ctx.font = "bold 64px 'Segoe UI', sans-serif";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText("GAME OVER", width / 2, height / 2 - 80);

                  ctx.fillStyle = "#FFFFFF";
                  ctx.font = "32px 'Segoe UI', sans-serif";
                  let yOffset = 0;
                  for (const [playerId, score] of scores) {
                    const player = inputManager
                      .getAllPlayers()
                      .find((p) => p.playerId === playerId);
                    const name = player?.name || `Player ${playerId}`;
                    ctx.fillText(
                      `${name}: ${score}`,
                      width / 2,
                      height / 2 + yOffset
                    );
                    yOffset += 50;
                  }

                  ctx.fillStyle = "#888888";
                  ctx.font = "20px 'Segoe UI', sans-serif";
                  ctx.fillText(
                    "Press SPACE to return to lobby",
                    width / 2,
                    height / 2 + yOffset + 50
                  );
                },
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
