// Game States
export const GAME_STATES = [
  "lobby",
  "countdown",
  "playing",
  "paused",
  "gameOver",
] as const;
export type GameState = (typeof GAME_STATES)[number];

// Directions
export const DIRECTIONS = ["up", "down", "left", "right"] as const;
export type Direction = (typeof DIRECTIONS)[number];

// Board sizes
export const BOARD_SIZES = [15, 25, 50] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];

// Difficulty levels with speeds (tiles per second)
export const DIFFICULTIES = ["easy", "normal", "hard", "insane"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 2,
  normal: 4,
  hard: 8,
  insane: 16,
};

// Apple colors
export const APPLE_COLORS = [
  "red",
  "green",
  "blue",
  "orange",
  "purple",
] as const;
export type AppleColor = (typeof APPLE_COLORS)[number];

// Player colors
export const PLAYER_COLORS = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "orange",
  "white",
  "pink",
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const PLAYER_COLOR_VALUES: Record<PlayerColor, string> = {
  red: "#FF4444",
  green: "#44FF44",
  blue: "#4444FF",
  yellow: "#FFFF44",
  purple: "#AA44FF",
  orange: "#FFAA44",
  white: "#FFFFFF",
  pink: "#FF88CC",
};

export const APPLE_COLOR_VALUES: Record<AppleColor, string> = {
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0088FF",
  orange: "#FF8800",
  purple: "#AA00FF",
};

// Game constants
export const MAX_PLAYERS = 4;
export const MIN_APPLES = 5;
export const STARTING_SNAKE_LENGTH = 3;
export const TAIL_SHED_THRESHOLD = 20;
export const TAIL_SHED_REMAINING = 5;
export const COMBO_TRIGGER_COUNT = 3;
export const EFFECT_DURATION = 10000; // 10 seconds in ms
export const PURPLE_APPLE_SPAWN_COUNT = 10;
export const SPEED_MODIFIER = 0.5; // 50% speed change for red/green effects

export const NAME_MAX_LENGTH = 16;

// Countdown
export const COUNTDOWN_SECONDS = 3;

// Fixed spawn positions (as percentage of board, will be converted to tiles)
export const SPAWN_POSITIONS = [
  { x: 0.2, y: 0.2, direction: "right" as Direction }, // Player 1: Top-left
  { x: 0.8, y: 0.2, direction: "left" as Direction }, // Player 2: Top-right
  { x: 0.2, y: 0.8, direction: "right" as Direction }, // Player 3: Bottom-left
  { x: 0.8, y: 0.8, direction: "left" as Direction }, // Player 4: Bottom-right
];
