import type { Direction } from "../utils/constants";

export type KeyboardAction =
  | "join"
  | "leave"
  | "ready"
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "backspace"
  | "character";

export interface KeyboardEvent {
  action: KeyboardAction;
  character?: string; // For text input mode
}

type KeyboardEventCallback = (event: KeyboardEvent) => void;

export class KeyboardInputHandler {
  private listeners: Set<KeyboardEventCallback> = new Set();
  private textInputMode: boolean = false;
  private isActive: boolean = false;

  // Key mappings
  private readonly directionKeys: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    window.addEventListener("keydown", this.handleKeyDown);
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  setTextInputMode(enabled: boolean): void {
    this.textInputMode = enabled;
  }

  isTextInputMode(): boolean {
    return this.textInputMode;
  }

  onInput(callback: KeyboardEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: KeyboardEvent): void {
    this.listeners.forEach((callback) => callback(event));
  }

  private handleKeyDown(e: globalThis.KeyboardEvent): void {
    // Prevent default for game keys
    if (this.shouldPreventDefault(e.code)) {
      e.preventDefault();
    }

    // Text input mode - handle character input
    if (this.textInputMode) {
      if (e.code === "Backspace") {
        this.emit({ action: "backspace" });
        return;
      }

      if (e.code === "Enter") {
        this.emit({ action: "confirm" });
        return;
      }

      if (e.code === "Escape") {
        this.emit({ action: "leave" });
        return;
      }

      // Single character keys
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.emit({ action: "character", character: e.key });
        return;
      }

      return;
    }

    // Game mode - handle actions
    const direction = this.directionKeys[e.code];
    if (direction) {
      this.emit({ action: direction });
      return;
    }

    switch (e.code) {
      case "Space":
        this.emit({ action: "join" });
        break;
      case "Escape":
        this.emit({ action: "leave" });
        break;
      case "Enter":
        this.emit({ action: "confirm" });
        break;
    }
  }

  private shouldPreventDefault(code: string): boolean {
    const preventCodes = [
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
    ];
    return preventCodes.includes(code);
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}
