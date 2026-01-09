import { Projectile, type Position } from "../entities/Projectile";
import type { Snake } from "../entities/Snake";
import type { GrayBlockManager } from "./GrayBlockManager";
import type { BoardSize, Direction } from "../utils/constants";

export type ProjectileHitCallback = (
  projectile: Projectile,
  blockPosition: Position
) => void;

export class ProjectileManager {
  private projectiles: Map<number, Projectile> = new Map();
  private nextProjectileId: number = 1;
  private boardSize: BoardSize;

  // Reference to gray block manager for collision detection
  private grayBlockManager: GrayBlockManager | null = null;

  // Callbacks
  private onProjectileHit: ProjectileHitCallback | null = null;

  constructor(boardSize: BoardSize) {
    this.boardSize = boardSize;
  }

  // Set reference to gray block manager
  setGrayBlockManager(manager: GrayBlockManager): void {
    this.grayBlockManager = manager;
  }

  // Set callback for when projectile hits a block
  setProjectileHitCallback(callback: ProjectileHitCallback): void {
    this.onProjectileHit = callback;
  }

  // Spawn projectile from snake (orange effect)
  spawnFromSnake(snake: Snake): Projectile {
    const head = snake.getHead();
    const direction = snake.getDirection();

    // Spawn one tile in front of the snake head
    const deltas: Record<Direction, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    const delta = deltas[direction];
    const spawnPos: Position = {
      x: head.x + delta.dx,
      y: head.y + delta.dy,
    };

    // Wrap spawn position if needed (so it doesn't immediately expire)
    if (spawnPos.x < 0) spawnPos.x = this.boardSize - 1;
    if (spawnPos.x >= this.boardSize) spawnPos.x = 0;
    if (spawnPos.y < 0) spawnPos.y = this.boardSize - 1;
    if (spawnPos.y >= this.boardSize) spawnPos.y = 0;

    const projectile = new Projectile(
      this.nextProjectileId++,
      snake.playerId,
      spawnPos,
      direction,
      this.boardSize
    );

    this.projectiles.set(projectile.id, projectile);
    return projectile;
  }

  // Update all projectiles
  update(deltaTime: number): void {
    const toRemove: number[] = [];

    for (const projectile of this.projectiles.values()) {
      if (!projectile.isActive()) {
        toRemove.push(projectile.id);
        continue;
      }

      // Update projectile movement
      projectile.update(deltaTime);

      // Check if still active after movement
      if (!projectile.isActive()) {
        toRemove.push(projectile.id);
        continue;
      }

      // Check collision with gray blocks
      if (this.grayBlockManager) {
        const pos = projectile.getPosition();
        const block = this.grayBlockManager.getBlockAt(pos);

        if (block) {
          projectile.hit();
          this.grayBlockManager.convertBlock(block);

          if (this.onProjectileHit) {
            this.onProjectileHit(projectile, pos);
          }

          toRemove.push(projectile.id);
        }
      }
    }

    // Clean up inactive projectiles
    for (const id of toRemove) {
      this.projectiles.delete(id);
    }
  }

  // Get all projectiles for rendering
  getProjectiles(): ReadonlyArray<Projectile> {
    return Array.from(this.projectiles.values());
  }

  // Get active projectile count
  getProjectileCount(): number {
    return this.projectiles.size;
  }

  // Reset for new game
  reset(boardSize: BoardSize): void {
    this.projectiles.clear();
    this.nextProjectileId = 1;
    this.boardSize = boardSize;
  }
}
