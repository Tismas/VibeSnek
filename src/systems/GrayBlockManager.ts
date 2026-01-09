import { GrayBlock, type Position } from "../entities/GrayBlock";

export type BlockConvertedCallback = (block: GrayBlock) => void;

export class GrayBlockManager {
  private blocks: Map<number, GrayBlock> = new Map();
  private nextBlockId: number = 1;

  // Callbacks
  private onBlockConverted: BlockConvertedCallback | null = null;

  constructor() {}

  // Set callback for when a block is converted to apple
  setBlockConvertedCallback(callback: BlockConvertedCallback): void {
    this.onBlockConverted = callback;
  }

  // Spawn blocks from snake tail shedding
  spawnBlocks(positions: Position[]): GrayBlock[] {
    const spawned: GrayBlock[] = [];

    for (const pos of positions) {
      const block = new GrayBlock(this.nextBlockId++, pos);
      this.blocks.set(block.id, block);
      spawned.push(block);
    }

    return spawned;
  }

  // Spawn a single block
  spawnBlock(position: Position): GrayBlock {
    const block = new GrayBlock(this.nextBlockId++, position);
    this.blocks.set(block.id, block);
    return block;
  }

  // Update all blocks
  update(deltaTime: number): void {
    const toRemove: number[] = [];

    for (const block of this.blocks.values()) {
      block.update(deltaTime);

      // Remove blocks that finished conversion
      if (block.isRemoved()) {
        toRemove.push(block.id);
      }
    }

    // Clean up removed blocks
    for (const id of toRemove) {
      this.blocks.delete(id);
    }
  }

  // Check if a position has a block
  getBlockAt(pos: Position): GrayBlock | null {
    for (const block of this.blocks.values()) {
      if (block.isActive() && block.isAt(pos)) {
        return block;
      }
    }
    return null;
  }

  // Check collision with a position
  hasBlockAt(pos: Position): boolean {
    return this.getBlockAt(pos) !== null;
  }

  // Convert a block to apple (hit by projectile)
  convertBlock(block: GrayBlock): void {
    if (!block.isActive()) return;

    block.startConversion();

    if (this.onBlockConverted) {
      this.onBlockConverted(block);
    }
  }

  // Get all blocks for rendering
  getBlocks(): ReadonlyArray<GrayBlock> {
    return Array.from(this.blocks.values());
  }

  // Get all active block positions (for collision/spawning checks)
  getOccupiedPositions(): Position[] {
    const positions: Position[] = [];
    for (const block of this.blocks.values()) {
      if (block.isActive()) {
        positions.push({ ...block.position });
      }
    }
    return positions;
  }

  // Get block count
  getBlockCount(): number {
    let count = 0;
    for (const block of this.blocks.values()) {
      if (block.isActive()) {
        count++;
      }
    }
    return count;
  }

  // Reset for new game
  reset(): void {
    this.blocks.clear();
    this.nextBlockId = 1;
  }
}
