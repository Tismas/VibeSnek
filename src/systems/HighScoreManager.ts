import type { BoardSize } from "../utils/constants";

export interface HighScoreEntry {
  name: string;
  score: number;
  date: string; // ISO date string
  boardSize: BoardSize;
}

const STORAGE_KEY = "snek_high_scores";
const MAX_ENTRIES_PER_BOARD = 10;

export class HighScoreManager {
  private scores: Map<BoardSize, HighScoreEntry[]> = new Map();

  constructor() {
    this.load();
  }

  // Load scores from localStorage
  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Record<string, HighScoreEntry[]>;

        // Initialize maps for each board size
        for (const boardSize of [15, 25, 50] as BoardSize[]) {
          const key = boardSize.toString();
          if (data[key] && Array.isArray(data[key])) {
            this.scores.set(boardSize, data[key]);
          } else {
            this.scores.set(boardSize, []);
          }
        }
      } else {
        // Initialize empty leaderboards
        this.scores.set(15, []);
        this.scores.set(25, []);
        this.scores.set(50, []);
      }
    } catch (e) {
      console.error("Failed to load high scores:", e);
      // Initialize empty on error
      this.scores.set(15, []);
      this.scores.set(25, []);
      this.scores.set(50, []);
    }
  }

  // Save scores to localStorage
  private save(): void {
    try {
      const data: Record<string, HighScoreEntry[]> = {};
      for (const [boardSize, entries] of this.scores) {
        data[boardSize.toString()] = entries;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save high scores:", e);
    }
  }

  // Get scores for a specific board size
  getScores(boardSize: BoardSize): ReadonlyArray<HighScoreEntry> {
    return this.scores.get(boardSize) || [];
  }

  // Get all scores across all board sizes
  getAllScores(): Map<BoardSize, ReadonlyArray<HighScoreEntry>> {
    return new Map(this.scores);
  }

  // Check if a score qualifies for the leaderboard
  isHighScore(score: number, boardSize: BoardSize): boolean {
    const entries = this.scores.get(boardSize) || [];

    if (entries.length < MAX_ENTRIES_PER_BOARD) {
      return true;
    }

    // Check if score beats the lowest entry
    const lowestScore = entries[entries.length - 1]?.score || 0;
    return score > lowestScore;
  }

  // Get the rank a score would achieve (1-indexed, 0 if not qualified)
  getRank(score: number, boardSize: BoardSize): number {
    const entries = this.scores.get(boardSize) || [];

    for (let i = 0; i < entries.length; i++) {
      if (score > entries[i].score) {
        return i + 1;
      }
    }

    if (entries.length < MAX_ENTRIES_PER_BOARD) {
      return entries.length + 1;
    }

    return 0; // Not qualified
  }

  // Add a new high score
  addScore(name: string, score: number, boardSize: BoardSize): number {
    const entries = this.scores.get(boardSize) || [];
    const rank = this.getRank(score, boardSize);

    if (rank === 0) {
      return 0; // Didn't qualify
    }

    const newEntry: HighScoreEntry = {
      name,
      score,
      date: new Date().toISOString(),
      boardSize,
    };

    // Insert at correct position
    entries.splice(rank - 1, 0, newEntry);

    // Trim to max entries
    if (entries.length > MAX_ENTRIES_PER_BOARD) {
      entries.pop();
    }

    this.scores.set(boardSize, entries);
    this.save();

    return rank;
  }

  // Get the minimum score needed to make the leaderboard
  getMinimumQualifyingScore(boardSize: BoardSize): number {
    const entries = this.scores.get(boardSize) || [];

    if (entries.length < MAX_ENTRIES_PER_BOARD) {
      return 0;
    }

    return entries[entries.length - 1]?.score || 0;
  }

  // Get top score for a board size
  getTopScore(boardSize: BoardSize): HighScoreEntry | null {
    const entries = this.scores.get(boardSize) || [];
    return entries[0] || null;
  }

  // Clear all scores (for testing)
  clearAll(): void {
    this.scores.set(15, []);
    this.scores.set(25, []);
    this.scores.set(50, []);
    this.save();
  }
}

// Singleton instance
export const highScoreManager = new HighScoreManager();
