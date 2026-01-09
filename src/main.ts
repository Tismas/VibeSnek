import "./style.css";
import { Game } from "./core/Game";

// Initialize the game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App container not found");
  }

  const game = new Game(app);

  // Start the game loop
  game.start();

  // For debugging in development
  if (import.meta.env.DEV) {
    (window as Window & { game?: Game }).game = game;
  }
});
