import "./style.css";
import { Game } from "./core/Game";
import { InputManager } from "./systems/InputManager";
import { LobbyScreen } from "./screens/LobbyScreen";

// Initialize the game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App container not found");
  }

  const game = new Game(app);
  const inputManager = new InputManager();

  // Create and set up lobby screen
  const lobbyScreen = new LobbyScreen(game.getCanvas(), inputManager, {
    onGameStart: (config) => {
      console.log("Game starting with config:", config);
      game.setConfig(config);
      game.setState("countdown");
      // TODO: Transition to game screen
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
