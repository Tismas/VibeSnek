import "./style.css";
import { Game } from "./core/Game";
import { InputManager } from "./systems/InputManager";
import { LobbyScreen } from "./screens/LobbyScreen";
import { CountdownScreen } from "./screens/CountdownScreen";

// Initialize the game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App container not found");
  }

  const game = new Game(app);
  const inputManager = new InputManager();

  // Create countdown screen
  const countdownScreen = new CountdownScreen(game.getCanvas(), {
    onComplete: () => {
      console.log("Countdown complete! Starting game...");
      game.setState("playing");
      // Temporary: Show a placeholder until game screen is implemented
      game.setScreen({
        update: () => {},
        render: () => {
          const ctx = game.getCanvas().ctx;
          const width = game.getCanvas().getWidth();
          const height = game.getCanvas().getHeight();
          
          // Dark background
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(0, 0, width, height);
          
          // Placeholder text
          ctx.fillStyle = "#44FF44";
          ctx.font = "bold 48px 'Segoe UI', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🎮 GAME STARTED!", width / 2, height / 2 - 30);
          
          ctx.fillStyle = "#888888";
          ctx.font = "24px 'Segoe UI', sans-serif";
          ctx.fillText("(Game screen coming in Phase 7)", width / 2, height / 2 + 30);
        },
      });
    },
  });

  // Create and set up lobby screen
  const lobbyScreen = new LobbyScreen(game.getCanvas(), inputManager, {
    onGameStart: (config) => {
      console.log("Game starting with config:", config);
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
  });

  // Set lobby as the current screen
  game.setScreen({
    update: (deltaTime) => lobbyScreen.update(deltaTime),
    render: (interpolation) => lobbyScreen.render(interpolation),
  });

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
