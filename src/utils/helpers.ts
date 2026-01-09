import type { Direction } from "./constants";

export interface Vector2 {
  x: number;
  y: number;
}

export function createVector(x: number, y: number): Vector2 {
  return { x, y };
}

export function vectorEquals(a: Vector2, b: Vector2): boolean {
  return a.x === b.x && a.y === b.y;
}

export function vectorAdd(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function getDirectionVector(direction: Direction): Vector2 {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

export function getOppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

export function wrapPosition(position: Vector2, boardSize: number): Vector2 {
  return {
    x: ((position.x % boardSize) + boardSize) % boardSize,
    y: ((position.y % boardSize) + boardSize) % boardSize,
  };
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomElement<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
