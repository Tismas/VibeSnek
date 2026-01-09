import type { Direction } from "../utils/constants";

export type GamepadAction =
  | "join"
  | "leave"
  | "ready"
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "backspace";

export interface GamepadInputEvent {
  action: GamepadAction;
  gamepadIndex: number;
}

type GamepadEventCallback = (event: GamepadInputEvent) => void;

// Standard gamepad button indices (based on Standard Gamepad mapping)
const BUTTON_A = 0;
const BUTTON_B = 1;
const BUTTON_X = 2;
const BUTTON_Y = 3;
const BUTTON_DPAD_UP = 12;
const BUTTON_DPAD_DOWN = 13;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

// Stick deadzone
const STICK_DEADZONE = 0.5;

// Input repeat delay (ms) for held buttons
const REPEAT_DELAY = 200;
const INITIAL_DELAY = 400;

interface ButtonState {
  pressed: boolean;
  timestamp: number;
  repeated: boolean;
}

interface GamepadState {
  buttons: Map<number, ButtonState>;
  stickDirection: Direction | null;
  stickTimestamp: number;
  stickRepeated: boolean;
}

export class GamepadInputHandler {
  private listeners: Set<GamepadEventCallback> = new Set();
  private isActive: boolean = false;
  private animationFrameId: number | null = null;
  private gamepadStates: Map<number, GamepadState> = new Map();

  // Track connected gamepads
  private connectedGamepads: Set<number> = new Set();
  private onConnectCallbacks: Set<(index: number) => void> = new Set();
  private onDisconnectCallbacks: Set<(index: number) => void> = new Set();

  constructor() {
    this.handleGamepadConnected = this.handleGamepadConnected.bind(this);
    this.handleGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
    this.pollGamepads = this.pollGamepads.bind(this);
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;

    window.addEventListener("gamepadconnected", this.handleGamepadConnected);
    window.addEventListener(
      "gamepaddisconnected",
      this.handleGamepadDisconnected
    );

    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.connectedGamepads.add(i);
        this.initGamepadState(i);
      }
    }

    this.pollGamepads();
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;

    window.removeEventListener("gamepadconnected", this.handleGamepadConnected);
    window.removeEventListener(
      "gamepaddisconnected",
      this.handleGamepadDisconnected
    );

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  onInput(callback: GamepadEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onConnect(callback: (index: number) => void): () => void {
    this.onConnectCallbacks.add(callback);
    return () => this.onConnectCallbacks.delete(callback);
  }

  onDisconnect(callback: (index: number) => void): () => void {
    this.onDisconnectCallbacks.add(callback);
    return () => this.onDisconnectCallbacks.delete(callback);
  }

  getConnectedGamepads(): number[] {
    return Array.from(this.connectedGamepads);
  }

  isGamepadConnected(index: number): boolean {
    return this.connectedGamepads.has(index);
  }

  private emit(event: GamepadInputEvent): void {
    this.listeners.forEach((callback) => callback(event));
  }

  private initGamepadState(index: number): void {
    this.gamepadStates.set(index, {
      buttons: new Map(),
      stickDirection: null,
      stickTimestamp: 0,
      stickRepeated: false,
    });
  }

  private handleGamepadConnected(e: globalThis.GamepadEvent): void {
    const index = e.gamepad.index;
    this.connectedGamepads.add(index);
    this.initGamepadState(index);
    this.onConnectCallbacks.forEach((cb) => cb(index));
  }

  private handleGamepadDisconnected(e: globalThis.GamepadEvent): void {
    const index = e.gamepad.index;
    this.connectedGamepads.delete(index);
    this.gamepadStates.delete(index);
    this.onDisconnectCallbacks.forEach((cb) => cb(index));
  }

  private pollGamepads(): void {
    if (!this.isActive) return;

    const gamepads = navigator.getGamepads();
    const now = performance.now();

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;

      const state = this.gamepadStates.get(i);
      if (!state) {
        this.initGamepadState(i);
        continue;
      }

      // Poll buttons
      this.pollButtons(gamepad, state, now);

      // Poll left stick for direction
      this.pollStick(gamepad, state, now);
    }

    this.animationFrameId = requestAnimationFrame(this.pollGamepads);
  }

  private pollButtons(
    gamepad: Gamepad,
    state: GamepadState,
    now: number
  ): void {
    const buttonMappings: Array<{ index: number; action: GamepadAction }> = [
      { index: BUTTON_A, action: "join" },
      { index: BUTTON_B, action: "leave" },
      { index: BUTTON_X, action: "backspace" },
      { index: BUTTON_Y, action: "ready" },
      { index: BUTTON_DPAD_UP, action: "up" },
      { index: BUTTON_DPAD_DOWN, action: "down" },
      { index: BUTTON_DPAD_LEFT, action: "left" },
      { index: BUTTON_DPAD_RIGHT, action: "right" },
    ];

    for (const { index, action } of buttonMappings) {
      const button = gamepad.buttons[index];
      if (!button) continue;

      const wasPressed = state.buttons.get(index)?.pressed ?? false;
      const isPressed = button.pressed;

      if (isPressed && !wasPressed) {
        // Button just pressed
        state.buttons.set(index, {
          pressed: true,
          timestamp: now,
          repeated: false,
        });
        this.emit({ action, gamepadIndex: gamepad.index });
      } else if (isPressed && wasPressed) {
        // Button held - check for repeat
        const buttonState = state.buttons.get(index)!;
        const elapsed = now - buttonState.timestamp;
        const delay = buttonState.repeated ? REPEAT_DELAY : INITIAL_DELAY;

        // Only repeat direction buttons
        if (this.isDirectionAction(action) && elapsed >= delay) {
          buttonState.timestamp = now;
          buttonState.repeated = true;
          this.emit({ action, gamepadIndex: gamepad.index });
        }
      } else if (!isPressed && wasPressed) {
        // Button released
        state.buttons.set(index, {
          pressed: false,
          timestamp: 0,
          repeated: false,
        });
      }
    }
  }

  private pollStick(gamepad: Gamepad, state: GamepadState, now: number): void {
    const leftStickX = gamepad.axes[0] ?? 0;
    const leftStickY = gamepad.axes[1] ?? 0;

    let direction: Direction | null = null;

    // Determine dominant direction
    if (
      Math.abs(leftStickX) > STICK_DEADZONE ||
      Math.abs(leftStickY) > STICK_DEADZONE
    ) {
      if (Math.abs(leftStickX) > Math.abs(leftStickY)) {
        direction = leftStickX > 0 ? "right" : "left";
      } else {
        direction = leftStickY > 0 ? "down" : "up";
      }
    }

    const prevDirection = state.stickDirection;

    if (direction !== prevDirection) {
      // Direction changed
      state.stickDirection = direction;
      state.stickTimestamp = now;
      state.stickRepeated = false;

      if (direction) {
        this.emit({ action: direction, gamepadIndex: gamepad.index });
      }
    } else if (direction) {
      // Same direction held - check for repeat
      const elapsed = now - state.stickTimestamp;
      const delay = state.stickRepeated ? REPEAT_DELAY : INITIAL_DELAY;

      if (elapsed >= delay) {
        state.stickTimestamp = now;
        state.stickRepeated = true;
        this.emit({ action: direction, gamepadIndex: gamepad.index });
      }
    }
  }

  private isDirectionAction(action: GamepadAction): boolean {
    return (
      action === "up" ||
      action === "down" ||
      action === "left" ||
      action === "right"
    );
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.onConnectCallbacks.clear();
    this.onDisconnectCallbacks.clear();
    this.gamepadStates.clear();
  }
}
