# 🐍 Multiplayer Snake Game - Development Plan

## Overview

A colorful, cartoonish multiplayer snake game supporting up to 4 players with keyboard and gamepad controls, featuring unique apple power-ups, combo systems, and persistent high scores.

Avoid using `any` type, Enums (prefer string union) or any libraries - stick to vanilla typescript and web APIs.

---

## Phase 1: Project Foundation & Architecture

### 1.1 Project Setup

- [x] Initialize TypeScript project with Vite
- [x] Set up folder structure:
  ```
  src/
    core/           # Game engine basics
    entities/       # Snake, Apple, Projectile, etc.
    systems/        # Input, Rendering, Collision, Audio
    screens/        # Lobby, Game, GameOver
    ui/             # UI components
    utils/          # Helpers, constants
    assets/         # Sprites, sounds
  ```
- [x] Configure canvas rendering with proper scaling
- [x] Set up game loop with fixed timestep (60 FPS target)

### 1.2 Core Game Engine

- [x] Create `Game` class with state machine (LOBBY → PLAYING → GAME_OVER)
- [x] Implement `GameLoop` with delta time handling
- [x] Create `EventBus` for decoupled communication
- [x] Build `EntityManager` for game objects

---

## Phase 2: Input System

### 2.1 Keyboard Input Handler

- [x] Create `KeyboardInputHandler` class
- [x] Map arrow keys / WASD to directions
- [x] Handle SPACE for joining lobby
- [x] Handle ESC for leaving lobby
- [x] Handle ENTER for ready toggle
- [x] Support text input mode for name entry

### 2.2 Gamepad Input Handler

- [x] Create `GamepadInputHandler` class using Gamepad API
- [x] Poll gamepads each frame (`navigator.getGamepads()`)
- [x] Map D-pad / left stick to directions
- [x] Handle A button for joining
- [x] Handle B button for leaving
- [x] Handle Y button for ready toggle
- [x] Track gamepad connection/disconnection events

### 2.3 Virtual Keyboard (for Gamepad Name Entry)

- [x] Create on-screen QWERTY keyboard UI
- [x] Navigate with D-pad, select with A
- [x] Backspace and confirm buttons
- [x] Visual feedback on key hover/press

### 2.4 Unified Input Manager

- [x] Create `InputManager` that abstracts keyboard/gamepad
- [x] Assign input sources to player slots
- [x] Prevent duplicate device assignments
- [x] Track which input method each player uses

---

## Phase 3: Lobby System

### 3.1 Lobby Screen Layout

- [x] Create 4 player slot rectangles in 2x2 grid
- [x] Slots assigned in join order (first to join = slot 1, etc.)
- [x] Design "Join" state UI:
  - "Press SPACE (Keyboard)" or "Press A (Controller)"
  - Animated pulse effect to draw attention
  - Controller icon / keyboard icon

### 3.2 Player Slot (Joined State)

- [x] Display editable player name (default: "Player 1-4")
- [x] Name max length: 16 characters
- [x] Color picker carousel (8 colors):
  - 🔴 Red, 🟢 Green, 🔵 Blue, 🟡 Yellow
  - 🟣 Purple, 🟠 Orange, ⚪ White, 🩷 Pink
- [x] Colors already taken by other players are disabled/grayed out
- [x] Auto-assign first available color on join
- [x] Show input device icon (keyboard/gamepad)
- [x] "Leave" instruction (ESC / B button)
- [x] Ready checkbox/button
- [x] Visual distinction when ready (glow/checkmark)

### 3.3 Host Controls (First Player)

- [x] Board size selector: 15×15, 25×25, 50×50
- [x] Difficulty selector:

  - Easy: 2 tiles/sec
  - Normal: 4 tiles/sec
  - Hard: 8 tiles/sec
  - Insane: 16 tiles/sec

- [x] Game starts when all joined players are ready
- [x] Minimum 1 player required
- [x] 3-2-1 countdown animation before game starts

---

## Phase 4: Snake Entity

### 4.1 Snake Base Implementation

- [x] Create `Snake` class with:
  - Position array (segments)
  - Direction (current + queued)
  - Speed (tiles per second)
  - Color
  - Player reference
- [x] Starting length: 3 segments
- [x] Spawn at fixed positions based on player slot:
  - Player 1: Top-left corner area
  - Player 2: Top-right corner area
  - Player 3: Bottom-left corner area
  - Player 4: Bottom-right corner area
- [x] Initial direction facing toward center

### 4.2 Snake Movement

- [x] Grid-based movement with smooth interpolation
- [x] Direction queue to prevent 180° turns
- [x] Screen wrapping (exit right → enter left, etc.)
- [x] Variable speed support (for power-ups)

### 4.3 Snake Growth & Tail Shedding

- [x] Grow by 1 segment when eating apple
- [x] Track body length
- [x] When length > 20:
  - Convert excess segments to gray blocks
  - Reduce snake to 5 segments
  - Play shedding animation/sound

### 4.4 Snake Collision

- [x] Self-collision detection → death
- [x] Collision with other snakes → death
- [x] Collision with gray blocks → death
- [x] Collision with apples → consume

### 4.5 Death Behavior

- [x] On death, snake body converts to gray blocks
- [x] Dead player enters spectator mode
- [x] Game continues until ALL players are dead
- [x] Last surviving player has advantage to increase score

---

## Phase 5: Apple System

### 5.1 Apple Entity

- [x] Create `Apple` class with:
  - Position
  - Color (Red, Green, Blue, Orange, Purple)
  - Spawn animation
- [x] 5 colors with equal spawn probability

### 5.2 Apple Spawning

- [x] Maintain minimum 5 apples on map
- [x] Spawn at random empty tiles
- [x] Avoid spawning on snakes or gray blocks
- [x] No respawn if count > 5 (from purple effect)

### 5.3 Combo System

- [x] Track consecutive same-color apples per snake
- [x] Display colored dots above snake head showing current streak (0-2 dots)
- [x] Dots match the color of the streak
- [x] Trigger effect when 3rd same color is eaten (3-combo)
- [x] Reset streak to 1 (new color) when different color eaten

### 5.4 Apple Effects (3-Combo Triggers)

Make sure effects are properly cleared if 2 effects are applied at the same time. Also modifiers that change the same thing (eg. green and red change speed) should cancled previous effect before applying new one.

#### 🔴 Red - Speed Boost

- [x] Increase snake speed by 50% for 10 seconds
- [x] Speed lines visual effect
- [x] Timer indicator on snake

#### 🟢 Green - Slow Down

- [x] Decrease snake speed by 50% for 10 seconds
- [x] Drowsy visual effect (wavy movement)
- [x] Timer indicator on snake

#### 🔵 Blue - Rain Distortion

- [x] Apply screen-wide rain shader effect
- [x] Distort/blur the game view
- [x] Covers entire map, affects ALL players (including triggering player)
- [x] Duration: 10 seconds
- [x] Rain drops animation overlay

#### 🟠 Orange - Projectile

- [x] Spawn projectile in snake's facing direction
- [x] Projectile travels until hitting edge or block
- [x] Gray block hit → transforms into random apple
- [x] Visual: glowing orb with trail

#### 🟣 Purple - Apple Rain

- [x] Spawn 10 additional apples instantly
- [x] Spawn animation (falling from top)
- [x] Can exceed 5 apple minimum temporarily

---

## Phase 6: Game Objects

### 6.1 Gray Blocks

- [x] Create `GrayBlock` class
- [x] Spawned from snake tail shedding
- [x] Solid collision (kills snakes)
- [x] Can be converted to apple by orange projectile
- [x] Subtle pulsing animation

### 6.2 Projectiles

- [x] Create `Projectile` class
- [x] Linear movement in one direction
- [x] No screen wrapping - disappears on collision with walls
- [x] Pass through snakes (no collision with snakes)
- [x] Collision with gray blocks only
- [x] Despawn after hitting block or timeout (5 seconds)
- [x] Trail particle effect

---

## Phase 7: Rendering System

### 7.1 Canvas Setup

- [x] Create responsive canvas (fit to window)
- [x] Calculate tile size based on board dimensions
- [x] Support multiple board sizes (15×15, 25×25, 50×50)
- [x] Maintain aspect ratio

### 7.2 Visual Style - Cartoonish Theme

- [x] Bright, saturated color palette
- [x] Rounded corners on all elements
- [x] Subtle drop shadows
- [x] Gradient fills for depth
- [x] Googly eyes on snake heads
- [x] Bouncy animations

### 7.3 Snake Rendering

- [x] Head: Rounded rectangle with eyes
- [x] Body: Connected rounded segments
- [x] Tail: Tapered end
- [x] Color tint per player
- [x] Death animation (explosion/fade)

### 7.4 Apple Rendering

- [x] Circular with highlight/shine
- [x] Leaf on top (small green triangle)
- [x] Subtle bobbing animation
- [x] Spawn: pop-in scale animation
- [x] Consume: shrink + particles

### 7.5 UI Rendering

- [x] Combo indicator above snake (colored dots)
- [x] Active effect timers (circular progress)
- [x] Score display per player
- [x] Game timer (optional)

### 7.6 Effects

- [x] Screen shake on death
- [x] Particle system for:
  - Apple consumption
  - Tail shedding
  - Power-up activation
- [x] Rain overlay (blue combo effect)
- [x] Speed lines (red combo effect)

---

## Phase 8: Audio System

### 8.1 Sound Manager

- [x] Create `AudioManager` with Web Audio API
- [x] Sound pooling for frequent sounds
- [x] Volume controls
- [x] Mute toggle

### 8.2 Sound Effects (Generate with Web Audio)

- [x] `eat_apple` - Short "pop" or "chomp"
- [x] `combo_activate` - Magical chime
- [x] `snake_death` - Sad trombone / splat
- [x] `tail_shed` - Crumbling sound
- [x] `projectile_fire` - Whoosh
- [x] `projectile_hit` - Ding/transform sound
- [x] `player_join` - Welcome jingle
- [x] `player_ready` - Confirmation beep
- [x] `game_start` - Energetic fanfare
- [x] `countdown_tick` - Tick sound
- [x] `ui_navigate` - Soft click
- [x] `rain_ambient` - Rain loop (for blue effect)

### 8.3 Background Music (Optional)

- [x] Upbeat chiptune-style loop
- [x] Fade in/out on game state changes

---

## Phase 9: Game Flow & Screens

### 9.1 Screen Manager

- [x] Create `ScreenManager` for transitions
- [x] Fade transitions between screens

### 9.2 Lobby Screen

- [x] Render 4 player slots
- [x] Handle all lobby logic from Phase 3
- [x] Animated background (moving snakes?)

### 9.3 Game Screen

- [x] Render game board
- [x] HUD overlay:
  - Player scores (corners)
  - Active effects
  - Time elapsed
- [ ] Pause functionality (optional)

### 9.4 Game Over Screen

- [x] Show final scores for all players
- [x] Winner = highest score (not last survivor)
- [x] Highlight winner with crown/celebration
- [x] Display high scores from localStorage
- [x] "Play Again" → Lobby
- [x] Name entry for high score (if qualified)

---

## Phase 10: High Score System

### 10.1 Score Calculation

- [x] Points per apple eaten
- [x] Bonus for combos
- [x] Survival time bonus
- [x] Final length bonus

### 10.2 LocalStorage Integration

- [x] Save top 10 scores per board size category (3 leaderboards)
- [x] Store: name, score, date
- [x] Separate leaderboards: 15×15, 25×25, 50×50
- [x] Load on game start
- [x] Update after each game
- [x] Global rankings (not per-player)

### 10.3 High Score Display

- [x] Leaderboard in lobby (toggle view)
- [x] Highlight current players' best scores
- [x] New high score celebration animation

---

## Phase 11: Polish & Testing

### 11.1 Performance Optimization

- [ ] Object pooling for particles/projectiles
- [ ] Efficient collision detection (spatial hashing if needed)
- [ ] RequestAnimationFrame optimization
- [ ] Memory leak prevention

### 11.2 Edge Cases

- [ ] Handle gamepad disconnect mid-game
- [ ] Handle all players dying simultaneously
- [ ] Handle rapid input spam
- [ ] Handle browser tab visibility changes

### 11.3 Accessibility

- [ ] Color-blind friendly apple indicators (shapes)
- [ ] High contrast mode option
- [ ] Screen reader support for menus

### 11.4 Testing

- [ ] Test with multiple gamepads
- [ ] Test all board sizes
- [ ] Test all power-up combinations
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

---

## Implementation Order (Recommended)

```
Week 1: Foundation
├── Day 1-2: Project setup, game loop, canvas rendering
├── Day 3-4: Input system (keyboard + gamepad)
└── Day 5-7: Basic snake movement & collision

Week 2: Core Gameplay
├── Day 1-2: Apple system & basic eating
├── Day 3-4: Combo system & effects framework
└── Day 5-7: All 5 apple effects implementation

Week 3: Multiplayer & Lobby
├── Day 1-2: Lobby UI & player slots
├── Day 3-4: Player joining/leaving, name entry, virtual keyboard
└── Day 5-7: Ready system, game start flow

Week 4: Polish
├── Day 1-2: Visual polish, animations, particles
├── Day 3-4: Audio implementation
├── Day 5: High score system
└── Day 6-7: Testing & bug fixes
```

---

## Technical Notes

### State Management

```typescript
enum GameState {
  LOBBY,
  COUNTDOWN,
  PLAYING,
  PAUSED,
  GAME_OVER,
}
```

### Player Data Structure

```typescript
interface Player {
  id: number;
  name: string;
  color: PlayerColor;
  inputType: "keyboard" | "gamepad";
  inputIndex: number; // gamepad index or -1 for keyboard
  isReady: boolean;
  snake: Snake | null;
  score: number;
  comboStack: AppleColor[];
  activeEffects: Effect[];
}
```

### Board Configuration

```typescript
interface BoardConfig {
  width: number; // 15, 25, or 50
  height: number; // 15, 25, or 50
  tileSize: number; // calculated based on canvas size
}
```

---

## Asset Checklist

### Sprites/Graphics (Create with Canvas or SVG)

- [ ] Snake head (with eyes, per color)
- [ ] Snake body segment (per color)
- [ ] Snake tail (per color)
- [ ] Apple (5 colors + shine effect)
- [ ] Gray block
- [ ] Projectile
- [ ] Keyboard icon
- [ ] Gamepad icon
- [ ] Ready checkmark
- [ ] Crown (for winner)
- [ ] Virtual keyboard keys

### Particle Effects

- [ ] Apple eat particles (colored)
- [ ] Death explosion
- [ ] Tail shed crumbles
- [ ] Speed boost lines
- [ ] Rain drops
- [ ] Combo activation burst

---

## Success Criteria

✅ 4 players can join and play simultaneously  
✅ Keyboard and gamepad inputs work correctly  
✅ All 5 apple effects function as specified  
✅ Combo system triggers at 3 consecutive same-color apples  
✅ Tail shedding occurs at length > 20  
✅ Screen wrapping works in all directions  
✅ High scores persist in localStorage  
✅ Visual style is cohesive and cartoonish  
✅ Game runs smoothly at 60 FPS  
✅ All sounds play appropriately
