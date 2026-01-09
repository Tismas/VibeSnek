import type { Canvas } from "../core/Canvas";
import type {
  InputManager,
  PlayerSlot,
  PlayerInput,
} from "../systems/InputManager";
import { VirtualKeyboard } from "../ui/VirtualKeyboard";
import {
  BOARD_SIZES,
  DIFFICULTIES,
  DIFFICULTY_SPEEDS,
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
  PLAYER_COLOR_VALUES,
  PLAYER_COLORS,
  type BoardSize,
  type Difficulty,
  type PlayerColor,
} from "../utils/constants";

interface LobbyCallbacks {
  onGameStart: (config: {
    boardSize: BoardSize;
    difficulty: Difficulty;
  }) => void;
}

type LobbyFocus =
  | "slot"
  | "name"
  | "color"
  | "boardSize"
  | "difficulty"
  | "ready";

interface PlayerState {
  slot: PlayerSlot;
  focus: LobbyFocus;
  editingName: boolean;
  virtualKeyboard: VirtualKeyboard | null;
}

export class LobbyScreen {
  private canvas: Canvas;
  private inputManager: InputManager;
  private callbacks: LobbyCallbacks;

  // Lobby state
  private players: Map<number, PlayerState> = new Map();
  private boardSize: BoardSize = 25;
  private difficulty: Difficulty = "normal";

  // Animation state
  private pulsePhase: number = 0;
  private joinPromptPhase: number = 0;

  // Layout constants
  private slotWidth: number = 0;
  private slotHeight: number = 0;
  private slotPadding: number = 20;
  private slotPositions: Array<{ x: number; y: number }> = [];

  // Unsubscribe functions
  private unsubscribers: Array<() => void> = [];

  constructor(
    canvas: Canvas,
    inputManager: InputManager,
    callbacks: LobbyCallbacks
  ) {
    this.canvas = canvas;
    this.inputManager = inputManager;
    this.callbacks = callbacks;

    this.calculateLayout();
    this.setupInputHandlers();
  }

  private calculateLayout(): void {
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Calculate slot dimensions (2x2 grid)
    const availableWidth = width * 0.9;
    const availableHeight = height * 0.75;

    this.slotWidth = Math.min(availableWidth / 2 - this.slotPadding * 2, 380);
    this.slotHeight = Math.min(availableHeight / 2 - this.slotPadding * 2, 320);

    // Calculate slot positions
    const startX = (width - (this.slotWidth * 2 + this.slotPadding * 3)) / 2;
    const startY = height * 0.2;

    this.slotPositions = [
      { x: startX + this.slotPadding, y: startY },
      { x: startX + this.slotWidth + this.slotPadding * 2, y: startY },
      {
        x: startX + this.slotPadding,
        y: startY + this.slotHeight + this.slotPadding,
      },
      {
        x: startX + this.slotWidth + this.slotPadding * 2,
        y: startY + this.slotHeight + this.slotPadding,
      },
    ];
  }

  private setupInputHandlers(): void {
    // Handle player joining
    const unsubJoin = this.inputManager.onPlayerJoined((slot) => {
      const playerState: PlayerState = {
        slot,
        focus: "name",
        editingName: false,
        virtualKeyboard: null,
      };

      // Create virtual keyboard for gamepad players
      if (slot.inputType === "gamepad") {
        playerState.virtualKeyboard = new VirtualKeyboard({
          onCharacter: () => {},
          onBackspace: () => {},
          onConfirm: () => this.stopNameEditing(playerState),
          onCancel: () => this.stopNameEditing(playerState),
        });
        playerState.virtualKeyboard.setMaxLength(NAME_MAX_LENGTH);
      }

      this.players.set(slot.playerId, playerState);
    });
    this.unsubscribers.push(unsubJoin);

    // Handle player leaving
    const unsubLeave = this.inputManager.onPlayerLeft((playerId) => {
      const playerState = this.players.get(playerId);
      if (playerState?.virtualKeyboard) {
        playerState.virtualKeyboard.destroy();
      }
      this.players.delete(playerId);
    });
    this.unsubscribers.push(unsubLeave);

    // Handle input from players
    const unsubInput = this.inputManager.onInput((input) => {
      this.handlePlayerInput(input);
    });
    this.unsubscribers.push(unsubInput);

    // Allow joins by default
    this.inputManager.onJoinRequest(() => {
      return this.players.size < MAX_PLAYERS;
    });
  }

  private handlePlayerInput(input: PlayerInput): void {
    const playerState = this.players.get(input.playerId);
    if (!playerState) return;

    const slot = playerState.slot;
    const isHost = this.inputManager.isHost(input.playerId);
    const isGamepad = slot.inputType === "gamepad";

    // Handle virtual keyboard for gamepad name editing
    if (
      playerState.editingName &&
      isGamepad &&
      playerState.virtualKeyboard?.isShowing()
    ) {
      this.handleVirtualKeyboardInput(input, playerState);
      return;
    }

    // Handle keyboard text input mode
    if (playerState.editingName && !isGamepad) {
      this.handleKeyboardNameInput(input, playerState);
      return;
    }

    switch (input.action) {
      case "leave":
        if (playerState.focus === "name" && playerState.editingName) {
          // Cancel name editing
          this.stopNameEditing(playerState);
        } else if (slot.isReady) {
          // If ready, first unready instead of leaving
          this.inputManager.setPlayerReady(input.playerId, false);
        } else {
          // Leave lobby
          this.inputManager.removePlayer(input.playerId);
        }
        break;

      case "up":
        this.navigateFocus(playerState, "up", isHost);
        break;

      case "down":
        this.navigateFocus(playerState, "down", isHost);
        break;

      case "left":
        this.handleLeftRight(playerState, -1, isHost);
        break;

      case "right":
        this.handleLeftRight(playerState, 1, isHost);
        break;

      case "confirm":
      case "ready":
        this.handleConfirm(playerState, isHost, input.action === "ready");
        break;
    }
  }

  private handleVirtualKeyboardInput(
    input: PlayerInput,
    playerState: PlayerState
  ): void {
    const keyboard = playerState.virtualKeyboard;
    if (!keyboard) return;

    switch (input.action) {
      case "up":
        keyboard.moveUp();
        break;
      case "down":
        keyboard.moveDown();
        break;
      case "left":
        keyboard.moveLeft();
        break;
      case "right":
        keyboard.moveRight();
        break;
      case "confirm":
        keyboard.select();
        break;
      case "backspace":
        keyboard.backspace();
        break;
      case "leave":
        this.stopNameEditing(playerState);
        break;
    }
  }

  private handleKeyboardNameInput(
    input: PlayerInput,
    playerState: PlayerState
  ): void {
    switch (input.action) {
      case "character":
        if (input.character && playerState.slot.name.length < NAME_MAX_LENGTH) {
          // Only allow uppercase letters and spaces
          const char = input.character.toUpperCase();
          if (/^[A-Z ]$/.test(char)) {
            const newName = playerState.slot.name + char;
            this.inputManager.setPlayerName(playerState.slot.playerId, newName);
          }
        }
        break;
      case "backspace":
        const newName = playerState.slot.name.slice(0, -1);
        this.inputManager.setPlayerName(playerState.slot.playerId, newName);
        break;
      case "confirm":
      case "leave":
        this.stopNameEditing(playerState);
        break;
    }
  }

  private startNameEditing(playerState: PlayerState): void {
    playerState.editingName = true;
    const isGamepad = playerState.slot.inputType === "gamepad";

    if (isGamepad && playerState.virtualKeyboard) {
      playerState.virtualKeyboard.show(playerState.slot.name);
    } else {
      this.inputManager.setTextInputMode(true);
    }
  }

  private stopNameEditing(playerState: PlayerState): void {
    playerState.editingName = false;
    const isGamepad = playerState.slot.inputType === "gamepad";

    // Find slot index for default name
    const playersArray = Array.from(this.players.values());
    const slotIndex = playersArray.indexOf(playerState);
    const defaultName = `PLAYER ${slotIndex + 1}`;

    if (isGamepad && playerState.virtualKeyboard) {
      // Get final name from virtual keyboard
      const name =
        playerState.virtualKeyboard.getCurrentText().trim() || defaultName;
      this.inputManager.setPlayerName(playerState.slot.playerId, name);
      playerState.virtualKeyboard.hide();
    } else {
      this.inputManager.setTextInputMode(false);
      // Ensure name isn't empty
      if (!playerState.slot.name.trim()) {
        this.inputManager.setPlayerName(playerState.slot.playerId, defaultName);
      }
    }
  }

  private navigateFocus(
    playerState: PlayerState,
    direction: "up" | "down",
    isHost: boolean
  ): void {
    const focusOrder: LobbyFocus[] = isHost
      ? ["name", "color", "boardSize", "difficulty", "ready"]
      : ["name", "color", "ready"];

    const currentIndex = focusOrder.indexOf(playerState.focus);
    if (currentIndex === -1) return;

    if (direction === "up" && currentIndex > 0) {
      playerState.focus = focusOrder[currentIndex - 1];
    } else if (direction === "down" && currentIndex < focusOrder.length - 1) {
      playerState.focus = focusOrder[currentIndex + 1];
    }
  }

  private handleLeftRight(
    playerState: PlayerState,
    direction: 1 | -1,
    isHost: boolean
  ): void {
    switch (playerState.focus) {
      case "color":
        this.inputManager.cyclePlayerColor(
          playerState.slot.playerId,
          direction
        );
        break;
      case "boardSize":
        if (isHost) {
          this.cycleBoardSize(direction);
        }
        break;
      case "difficulty":
        if (isHost) {
          this.cycleDifficulty(direction);
        }
        break;
    }
  }

  private handleConfirm(
    playerState: PlayerState,
    isHost: boolean,
    isReadyButton: boolean
  ): void {
    // Ready button always toggles ready
    if (isReadyButton) {
      this.toggleReady(playerState);
      return;
    }

    switch (playerState.focus) {
      case "name":
        if (!playerState.editingName) {
          this.startNameEditing(playerState);
        } else {
          this.stopNameEditing(playerState);
        }
        break;
      case "color":
        // Color is changed with left/right, confirm moves to next
        this.navigateFocus(playerState, "down", isHost);
        break;
      case "boardSize":
      case "difficulty":
        // These are changed with left/right
        this.navigateFocus(playerState, "down", isHost);
        break;
      case "ready":
        this.toggleReady(playerState);
        break;
    }
  }

  private toggleReady(playerState: PlayerState): void {
    const newReady = !playerState.slot.isReady;
    this.inputManager.setPlayerReady(playerState.slot.playerId, newReady);

    // Check if all players are ready to start
    if (this.inputManager.areAllPlayersReady() && this.players.size > 0) {
      this.callbacks.onGameStart({
        boardSize: this.boardSize,
        difficulty: this.difficulty,
      });
    }
  }

  private cycleBoardSize(direction: 1 | -1): void {
    const currentIndex = BOARD_SIZES.indexOf(this.boardSize);
    const newIndex =
      (currentIndex + direction + BOARD_SIZES.length) % BOARD_SIZES.length;
    this.boardSize = BOARD_SIZES[newIndex];
  }

  private cycleDifficulty(direction: 1 | -1): void {
    const currentIndex = DIFFICULTIES.indexOf(this.difficulty);
    const newIndex =
      (currentIndex + direction + DIFFICULTIES.length) % DIFFICULTIES.length;
    this.difficulty = DIFFICULTIES[newIndex];
  }

  update(deltaTime: number): void {
    // Update animation phases
    this.pulsePhase += deltaTime * 0.003;
    this.joinPromptPhase += deltaTime * 0.002;

    // Sync player states with input manager
    for (const player of this.inputManager.getAllPlayers()) {
      const state = this.players.get(player.playerId);
      if (state) {
        state.slot = player;
      }
    }
  }

  render(_interpolation: number): void {
    const ctx = this.canvas.ctx;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();

    // Background
    this.drawBackground(ctx, width, height);

    // Title
    this.drawTitle(ctx, width);

    // Draw 4 player slots
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.drawSlot(ctx, i);
    }

    // Draw game settings (only shown if there's at least one player)
    if (this.players.size > 0) {
      this.drawGameSettings(ctx, width, height);
    }

    // Draw virtual keyboards for gamepad players editing names
    const playersArray = Array.from(this.players.values());
    for (let slotIndex = 0; slotIndex < playersArray.length; slotIndex++) {
      const playerState = playersArray[slotIndex];
      if (playerState.virtualKeyboard?.isShowing()) {
        const pos = this.slotPositions[slotIndex];
        if (pos) {
          // Render keyboard inside the slot area
          const keyboardPadding = 10;
          playerState.virtualKeyboard.render(ctx, {
            x: pos.x + keyboardPadding,
            y: pos.y + keyboardPadding,
            width: this.slotWidth - keyboardPadding * 2,
            height: this.slotHeight - keyboardPadding * 2,
          });
        }
      }
    }
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative snake pattern in background
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 10; i++) {
      const x = (Math.sin(this.pulsePhase + i * 0.5) * 0.5 + 0.5) * width;
      const y = (i / 10) * height;
      ctx.fillStyle = "#44FF44";
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTitle(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 48px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Add glow effect
    ctx.shadowColor = "#44FF44";
    ctx.shadowBlur = 20;
    ctx.fillText("🐍 SNEK", width / 2, 60);
    ctx.shadowBlur = 0;

    ctx.font = "20px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText("Multiplayer Snake", width / 2, 100);
  }

  private drawSlot(ctx: CanvasRenderingContext2D, slotIndex: number): void {
    const pos = this.slotPositions[slotIndex];
    if (!pos) return;

    // Find player in this slot (based on join order)
    const playersArray = Array.from(this.players.values());
    const playerState = playersArray[slotIndex];

    if (playerState) {
      this.drawJoinedSlot(ctx, pos, playerState, slotIndex);
    } else {
      this.drawEmptySlot(ctx, pos, slotIndex);
    }
  }

  private drawEmptySlot(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    slotIndex: number
  ): void {
    // Pulsing border
    const pulse = Math.sin(this.joinPromptPhase + slotIndex * 0.5) * 0.3 + 0.7;

    // Slot background
    ctx.fillStyle = `rgba(30, 30, 50, ${0.8 * pulse})`;
    this.roundRect(ctx, pos.x, pos.y, this.slotWidth, this.slotHeight, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = `rgba(100, 100, 150, ${pulse})`;
    ctx.lineWidth = 2;
    this.roundRect(ctx, pos.x, pos.y, this.slotWidth, this.slotHeight, 12);
    ctx.stroke();

    // "Press to Join" text
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.font = "bold 18px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = pos.x + this.slotWidth / 2;
    const centerY = pos.y + this.slotHeight / 2;

    ctx.fillText("Press to Join", centerX, centerY - 30);

    // Instructions
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillStyle = `rgba(150, 150, 200, ${pulse})`;
    ctx.fillText("⌨️ SPACE", centerX, centerY + 10);
    ctx.fillText("🎮 A Button", centerX, centerY + 35);
  }

  private drawJoinedSlot(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    playerState: PlayerState,
    slotIndex: number
  ): void {
    const slot = playerState.slot;
    const isHost = this.inputManager.isHost(slot.playerId);
    const colorValue = PLAYER_COLOR_VALUES[slot.color];

    // Slot background with player color tint
    const gradient = ctx.createLinearGradient(
      pos.x,
      pos.y,
      pos.x,
      pos.y + this.slotHeight
    );
    gradient.addColorStop(0, "rgba(30, 30, 50, 0.95)");
    gradient.addColorStop(1, `${colorValue}22`);
    ctx.fillStyle = gradient;
    this.roundRect(ctx, pos.x, pos.y, this.slotWidth, this.slotHeight, 12);
    ctx.fill();

    // Border (glowing if ready)
    if (slot.isReady) {
      ctx.shadowColor = "#44FF44";
      ctx.shadowBlur = 15;
    }
    ctx.strokeStyle = slot.isReady ? "#44FF44" : colorValue;
    ctx.lineWidth = 3;
    this.roundRect(ctx, pos.x, pos.y, this.slotWidth, this.slotHeight, 12);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const centerX = pos.x + this.slotWidth / 2;
    let currentY = pos.y + 25;

    // Player number and host badge
    ctx.font = "bold 14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#888888";
    const badge = isHost ? " 👑 HOST" : "";
    const deviceIcon = slot.inputType === "keyboard" ? "⌨️" : "🎮";
    ctx.fillText(
      `Player ${slotIndex + 1} ${deviceIcon}${badge}`,
      centerX,
      currentY
    );
    currentY += 30;

    // Name field
    this.drawField(
      ctx,
      pos.x + 20,
      currentY,
      this.slotWidth - 40,
      35,
      slot.name || "Enter name...",
      playerState.focus === "name",
      playerState.editingName
    );
    currentY += 50;

    // Color selector
    this.drawColorSelector(
      ctx,
      pos.x + 20,
      currentY,
      this.slotWidth - 40,
      slot.color,
      playerState.focus === "color",
      slot.playerId
    );
    currentY += 55;

    // Host-only controls
    if (isHost) {
      // Board size
      this.drawSelector(
        ctx,
        pos.x + 20,
        currentY,
        this.slotWidth - 40,
        30,
        "Board",
        `${this.boardSize}×${this.boardSize}`,
        playerState.focus === "boardSize"
      );
      currentY += 40;

      // Difficulty
      this.drawSelector(
        ctx,
        pos.x + 20,
        currentY,
        this.slotWidth - 40,
        30,
        "Speed",
        `${
          this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)
        } (${DIFFICULTY_SPEEDS[this.difficulty]}/s)`,
        playerState.focus === "difficulty"
      );
      currentY += 40;
    }

    // Ready button
    this.drawReadyButton(
      ctx,
      centerX,
      pos.y + this.slotHeight - 35,
      slot.isReady,
      playerState.focus === "ready"
    );

    // Leave instruction
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";
    const leaveKey = slot.inputType === "keyboard" ? "ESC" : "B";
    ctx.fillText(`${leaveKey} to leave`, centerX, pos.y + this.slotHeight - 10);
  }

  private drawField(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    focused: boolean,
    editing: boolean
  ): void {
    // Background
    ctx.fillStyle = focused ? "#2a2a4e" : "#1a1a3e";
    this.roundRect(ctx, x, y, width, height, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = editing ? "#FFFF44" : focused ? "#4444FF" : "#333355";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    // Text
    ctx.fillStyle = text.includes("...") ? "#666666" : "#FFFFFF";
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const displayText = editing
      ? text + (Math.floor(Date.now() / 500) % 2 === 0 ? "|" : "")
      : text;
    ctx.fillText(displayText, x + 10, y + height / 2, width - 20);

    // Edit hint
    if (focused && !editing) {
      ctx.fillStyle = "#666666";
      ctx.font = "12px 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Press A/Enter", x + width - 5, y + height / 2);
    }
  }

  private drawColorSelector(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    currentColor: PlayerColor,
    focused: boolean,
    playerId: number
  ): void {
    const colorSize = 25;
    const padding = 5;
    const totalWidth = PLAYER_COLORS.length * (colorSize + padding) - padding;
    const startX = x + (width - totalWidth) / 2;

    // Label
    ctx.fillStyle = "#888888";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Color:", x, y);

    // Draw color options
    PLAYER_COLORS.forEach((color, i) => {
      const colorX = startX + i * (colorSize + padding);
      const colorY = y + 15;
      const colorValue = PLAYER_COLOR_VALUES[color];
      const isSelected = color === currentColor;
      const isAvailable = this.inputManager.isColorAvailable(color, playerId);

      // Color circle
      ctx.beginPath();
      ctx.arc(
        colorX + colorSize / 2,
        colorY + colorSize / 2,
        colorSize / 2 - 2,
        0,
        Math.PI * 2
      );

      if (!isAvailable) {
        ctx.fillStyle = "#333333";
        ctx.fill();
        // X mark
        ctx.strokeStyle = "#666666";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(colorX + 5, colorY + 5);
        ctx.lineTo(colorX + colorSize - 5, colorY + colorSize - 5);
        ctx.moveTo(colorX + colorSize - 5, colorY + 5);
        ctx.lineTo(colorX + 5, colorY + colorSize - 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = colorValue;
        ctx.fill();
      }

      // Selection indicator
      if (isSelected) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          colorX + colorSize / 2,
          colorY + colorSize / 2,
          colorSize / 2 + 2,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    });

    // Focus indicator
    if (focused) {
      ctx.fillStyle = "#4444FF";
      ctx.font = "12px 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("◄ ►", x + width, y);
    }
  }

  private drawSelector(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    focused: boolean
  ): void {
    // Background
    ctx.fillStyle = focused ? "#2a2a4e" : "#1a1a3e";
    this.roundRect(ctx, x, y, width, height, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = focused ? "#4444FF" : "#333355";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#888888";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label + ":", x + 10, y + height / 2);

    // Value
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(value, x + width / 2 + 20, y + height / 2);

    // Arrows if focused
    if (focused) {
      ctx.fillStyle = "#4444FF";
      ctx.font = "14px 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("◄", x + width - 45, y + height / 2);
      ctx.textAlign = "right";
      ctx.fillText("►", x + width - 10, y + height / 2);
    }
  }

  private drawReadyButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isReady: boolean,
    focused: boolean
  ): void {
    const width = 120;
    const height = 35;

    // Button background
    if (isReady) {
      ctx.fillStyle = "#44AA44";
    } else {
      ctx.fillStyle = focused ? "#4444AA" : "#333366";
    }
    this.roundRect(ctx, x - width / 2, y - height / 2, width, height, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = focused ? "#6666FF" : isReady ? "#66CC66" : "#444488";
    ctx.lineWidth = 2;
    this.roundRect(ctx, x - width / 2, y - height / 2, width, height, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isReady ? "✓ READY!" : "Ready?", x, y);
  }

  private drawGameSettings(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const y = height - 60;

    // Info text
    ctx.fillStyle = "#666666";
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";

    const readyCount = Array.from(this.players.values()).filter(
      (p) => p.slot.isReady
    ).length;
    const totalPlayers = this.players.size;

    if (readyCount === totalPlayers && totalPlayers > 0) {
      ctx.fillStyle = "#44FF44";
      ctx.font = "bold 18px 'Segoe UI', sans-serif";
      ctx.fillText("🎮 All players ready! Starting game...", width / 2, y);
    } else {
      ctx.fillText(
        `${readyCount}/${totalPlayers} players ready | Board: ${this.boardSize}×${this.boardSize} | Speed: ${this.difficulty}`,
        width / 2,
        y
      );
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  getBoardSize(): BoardSize {
    return this.boardSize;
  }

  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  destroy(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.players.clear();
  }
}
