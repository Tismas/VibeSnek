type EventCallback<T = unknown> = (data: T) => void;

interface EventSubscription {
  unsubscribe: () => void;
}

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T = unknown>(
    event: string,
    callback: EventCallback<T>
  ): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback as EventCallback);

    return {
      unsubscribe: () => {
        callbacks.delete(callback as EventCallback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      },
    };
  }

  once<T = unknown>(
    event: string,
    callback: EventCallback<T>
  ): EventSubscription {
    const subscription = this.on<T>(event, (data) => {
      subscription.unsubscribe();
      callback(data);
    });
    return subscription;
  }

  emit<T = unknown>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  off(event: string): void {
    this.listeners.delete(event);
  }

  clear(): void {
    this.listeners.clear();
  }
}

// Game event types
export type GameEvents = {
  // State changes
  "state:change": { from: string; to: string };

  // Player events
  "player:join": { playerId: number; inputType: "keyboard" | "gamepad" };
  "player:leave": { playerId: number };
  "player:ready": { playerId: number; isReady: boolean };
  "player:nameChange": { playerId: number; name: string };
  "player:colorChange": { playerId: number; color: string };

  // Game events
  "game:start": void;
  "game:over": { winnerId: number; scores: Record<number, number> };
  "game:countdown": { count: number };

  // Snake events
  "snake:eat": { playerId: number; appleColor: string };
  "snake:die": { playerId: number };
  "snake:shed": { playerId: number; blocks: Array<{ x: number; y: number }> };
  "snake:combo": { playerId: number; color: string; effect: string };

  // Effect events
  "effect:speed": { playerId: number; multiplier: number; duration: number };
  "effect:rain": { duration: number };
  "effect:projectile": { playerId: number; direction: string };
  "effect:appleRain": { count: number };

  // Audio events
  "audio:play": { sound: string };

  // Input events
  "input:direction": { playerId: number; direction: string };
  "input:action": { playerId: number; action: string };
};

// Singleton event bus for the game
export const gameEventBus = new EventBus();
