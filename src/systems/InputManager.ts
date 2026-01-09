import type { PlayerColor } from "../utils/constants";
import { PLAYER_COLORS } from "../utils/constants";
import {
  KeyboardInputHandler,
  type KeyboardEvent,
} from "./KeyboardInputHandler";
import {
  GamepadInputHandler,
  type GamepadInputEvent,
} from "./GamepadInputHandler";

export type InputType = "keyboard" | "gamepad";

export type InputAction =
  | "join"
  | "leave"
  | "ready"
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "backspace"
  | "character"
  | "colorNext"
  | "colorPrev";

export interface PlayerInput {
  playerId: number;
  action: InputAction;
  character?: string;
}

export interface PlayerSlot {
  playerId: number;
  inputType: InputType;
  inputIndex: number; // -1 for keyboard, gamepad index for gamepads
  name: string;
  color: PlayerColor;
  isReady: boolean;
}

type InputCallback = (input: PlayerInput) => void;
type JoinRequestCallback = (
  inputType: InputType,
  inputIndex: number
) => boolean;

export class InputManager {
  private keyboardHandler: KeyboardInputHandler;
  private gamepadHandler: GamepadInputHandler;

  private players: Map<number, PlayerSlot> = new Map();
  private nextPlayerId: number = 1;

  // Track which input devices are assigned
  private keyboardAssigned: boolean = false;
  private assignedGamepads: Set<number> = new Set();

  // Callbacks
  private inputCallbacks: Set<InputCallback> = new Set();
  private joinRequestCallback: JoinRequestCallback | null = null;
  private playerJoinedCallbacks: Set<(slot: PlayerSlot) => void> = new Set();
  private playerLeftCallbacks: Set<(playerId: number) => void> = new Set();

  constructor() {
    this.keyboardHandler = new KeyboardInputHandler();
    this.gamepadHandler = new GamepadInputHandler();

    this.setupKeyboardHandler();
    this.setupGamepadHandler();
  }

  private setupKeyboardHandler(): void {
    this.keyboardHandler.onInput((event: KeyboardEvent) => {
      this.handleKeyboardInput(event);
    });
  }

  private setupGamepadHandler(): void {
    this.gamepadHandler.onInput((event: GamepadInputEvent) => {
      this.handleGamepadInput(event);
    });

    this.gamepadHandler.onDisconnect((index: number) => {
      // Find and remove player using this gamepad
      for (const [playerId, slot] of this.players) {
        if (slot.inputType === "gamepad" && slot.inputIndex === index) {
          this.removePlayer(playerId);
          break;
        }
      }
    });
  }

  private handleKeyboardInput(event: KeyboardEvent): void {
    // If keyboard not assigned and trying to join
    if (!this.keyboardAssigned && event.action === "join") {
      this.tryJoinPlayer("keyboard", -1);
      return;
    }

    // Find the player using keyboard
    const player = this.getPlayerByInput("keyboard", -1);
    if (!player) return;

    // Map keyboard event to player input
    const input: PlayerInput = {
      playerId: player.playerId,
      action: event.action,
      character: event.character,
    };

    this.emitInput(input);
  }

  private handleGamepadInput(event: GamepadInputEvent): void {
    const gamepadIndex = event.gamepadIndex;

    // If this gamepad not assigned and trying to join
    if (!this.assignedGamepads.has(gamepadIndex) && event.action === "join") {
      this.tryJoinPlayer("gamepad", gamepadIndex);
      return;
    }

    // Find the player using this gamepad
    const player = this.getPlayerByInput("gamepad", gamepadIndex);
    if (!player) return;

    // Map gamepad A button to "confirm" in addition to "join"
    let action = event.action;
    if (action === "join") {
      action = "confirm";
    }

    // Map left/right to color selection when appropriate
    // This will be handled by the lobby screen based on context

    const input: PlayerInput = {
      playerId: player.playerId,
      action,
    };

    this.emitInput(input);
  }

  private tryJoinPlayer(inputType: InputType, inputIndex: number): void {
    // Check if we can add more players
    if (this.players.size >= 4) return;

    // Check with callback if join is allowed
    if (
      this.joinRequestCallback &&
      !this.joinRequestCallback(inputType, inputIndex)
    ) {
      return;
    }

    // Assign input device
    if (inputType === "keyboard") {
      this.keyboardAssigned = true;
    } else {
      this.assignedGamepads.add(inputIndex);
    }

    // Create player slot
    const playerId = this.nextPlayerId++;
    const availableColor = this.getNextAvailableColor();

    const slot: PlayerSlot = {
      playerId,
      inputType,
      inputIndex,
      name: `Player ${playerId}`,
      color: availableColor,
      isReady: false,
    };

    this.players.set(playerId, slot);

    // Notify listeners
    this.playerJoinedCallbacks.forEach((cb) => cb(slot));
  }

  removePlayer(playerId: number): void {
    const slot = this.players.get(playerId);
    if (!slot) return;

    // Release input device
    if (slot.inputType === "keyboard") {
      this.keyboardAssigned = false;
    } else {
      this.assignedGamepads.delete(slot.inputIndex);
    }

    this.players.delete(playerId);

    // Notify listeners
    this.playerLeftCallbacks.forEach((cb) => cb(playerId));
  }

  private getPlayerByInput(
    inputType: InputType,
    inputIndex: number
  ): PlayerSlot | undefined {
    for (const slot of this.players.values()) {
      if (slot.inputType === inputType && slot.inputIndex === inputIndex) {
        return slot;
      }
    }
    return undefined;
  }

  private getNextAvailableColor(): PlayerColor {
    const usedColors = new Set(
      Array.from(this.players.values()).map((p) => p.color)
    );
    for (const color of PLAYER_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    return PLAYER_COLORS[0]; // Fallback, shouldn't happen with max 4 players
  }

  getAvailableColors(): PlayerColor[] {
    const usedColors = new Set(
      Array.from(this.players.values()).map((p) => p.color)
    );
    return PLAYER_COLORS.filter((c) => !usedColors.has(c));
  }

  isColorAvailable(color: PlayerColor, excludePlayerId?: number): boolean {
    for (const [playerId, slot] of this.players) {
      if (excludePlayerId !== undefined && playerId === excludePlayerId) {
        continue;
      }
      if (slot.color === color) {
        return false;
      }
    }
    return true;
  }

  // Player state modifications
  setPlayerName(playerId: number, name: string): void {
    const slot = this.players.get(playerId);
    if (slot) {
      slot.name = name;
    }
  }

  setPlayerColor(playerId: number, color: PlayerColor): void {
    const slot = this.players.get(playerId);
    if (slot && this.isColorAvailable(color, playerId)) {
      slot.color = color;
    }
  }

  setPlayerReady(playerId: number, isReady: boolean): void {
    const slot = this.players.get(playerId);
    if (slot) {
      slot.isReady = isReady;
    }
  }

  cyclePlayerColor(playerId: number, direction: 1 | -1): void {
    const slot = this.players.get(playerId);
    if (!slot) return;

    const currentIndex = PLAYER_COLORS.indexOf(slot.color);
    let newIndex = currentIndex;

    // Find next available color in the given direction
    for (let i = 1; i < PLAYER_COLORS.length; i++) {
      const checkIndex =
        (currentIndex + i * direction + PLAYER_COLORS.length) %
        PLAYER_COLORS.length;
      if (this.isColorAvailable(PLAYER_COLORS[checkIndex], playerId)) {
        newIndex = checkIndex;
        break;
      }
    }

    slot.color = PLAYER_COLORS[newIndex];
  }

  // Getters
  getPlayer(playerId: number): PlayerSlot | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): PlayerSlot[] {
    return Array.from(this.players.values());
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  areAllPlayersReady(): boolean {
    if (this.players.size === 0) return false;
    for (const slot of this.players.values()) {
      if (!slot.isReady) return false;
    }
    return true;
  }

  getHostPlayer(): PlayerSlot | undefined {
    // First player is the host
    const players = this.getAllPlayers();
    return players.length > 0 ? players[0] : undefined;
  }

  isHost(playerId: number): boolean {
    const host = this.getHostPlayer();
    return host?.playerId === playerId;
  }

  // Keyboard text input mode
  setTextInputMode(enabled: boolean): void {
    this.keyboardHandler.setTextInputMode(enabled);
  }

  isTextInputMode(): boolean {
    return this.keyboardHandler.isTextInputMode();
  }

  // Callbacks
  onInput(callback: InputCallback): () => void {
    this.inputCallbacks.add(callback);
    return () => this.inputCallbacks.delete(callback);
  }

  onJoinRequest(callback: JoinRequestCallback): () => void {
    this.joinRequestCallback = callback;
    return () => {
      this.joinRequestCallback = null;
    };
  }

  onPlayerJoined(callback: (slot: PlayerSlot) => void): () => void {
    this.playerJoinedCallbacks.add(callback);
    return () => this.playerJoinedCallbacks.delete(callback);
  }

  onPlayerLeft(callback: (playerId: number) => void): () => void {
    this.playerLeftCallbacks.add(callback);
    return () => this.playerLeftCallbacks.delete(callback);
  }

  private emitInput(input: PlayerInput): void {
    this.inputCallbacks.forEach((cb) => cb(input));
  }

  // Lifecycle
  start(): void {
    this.keyboardHandler.start();
    this.gamepadHandler.start();
  }

  stop(): void {
    this.keyboardHandler.stop();
    this.gamepadHandler.stop();
  }

  reset(): void {
    // Clear all players
    const playerIds = Array.from(this.players.keys());
    for (const playerId of playerIds) {
      this.removePlayer(playerId);
    }
    this.nextPlayerId = 1;
  }

  destroy(): void {
    this.stop();
    this.keyboardHandler.destroy();
    this.gamepadHandler.destroy();
    this.inputCallbacks.clear();
    this.playerJoinedCallbacks.clear();
    this.playerLeftCallbacks.clear();
    this.players.clear();
  }
}
