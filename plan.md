# 🐍 Multiplayer Snake Game - Development Plan

## Overview

A colorful, cartoonish multiplayer snake game supporting up to 4 players with keyboard and gamepad controls, featuring unique apple power-ups, combo systems, and persistent high scores.

Avoid using `any` type, Enums (prefer string union) or any libraries - stick to vanilla typescript and web APIs.

---

## Phase 1: Project Foundation & Architecture

### 1.1 Project Setup

- [x] Initialize TypeScript project with Vite
- [ ] Set up folder structure:
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
- [ ] Configure canvas rendering with proper scaling
- [ ] Set up game loop with fixed timestep (60 FPS target)

### 1.2 Core Game Engine

- [ ] Create `Game` class with state machine (LOBBY → PLAYING → GAME_OVER)
- [ ] Implement `GameLoop` with delta time handling
- [ ] Create `EventBus` for decoupled communication
- [ ] Build `EntityManager` for game objects

---

## Phase 2: Input System

### 2.1 Keyboard Input Handler

- [ ] Create `KeyboardInputHandler` class
- [ ] Map arrow keys / WASD to directions
- [ ] Handle SPACE for joining lobby
- [ ] Handle ESC for leaving lobby
- [ ] Handle ENTER for ready toggle
- [ ] Support text input mode for name entry

### 2.2 Gamepad Input Handler

- [ ] Create `GamepadInputHandler` class using Gamepad API
- [ ] Poll gamepads each frame (`navigator.getGamepads()`)
- [ ] Map D-pad / left stick to directions
- [ ] Handle A button for joining
- [ ] Handle B button for leaving
- [ ] Handle Y button for ready toggle
- [ ] Track gamepad connection/disconnection events

### 2.3 Virtual Keyboard (for Gamepad Name Entry)

- [ ] Create on-screen QWERTY keyboard UI
- [ ] Navigate with D-pad, select with A
- [ ] Backspace and confirm buttons
- [ ] Visual feedback on key hover/press

### 2.4 Unified Input Manager

- [ ] Create `InputManager` that abstracts keyboard/gamepad
- [ ] Assign input sources to player slots
- [ ] Prevent duplicate device assignments
- [ ] Track which input method each player uses

---

## Phase 3: Lobby System

### 3.1 Lobby Screen Layout

- [ ] Create 4 player slot rectangles in 2x2 grid
- [ ] Slots assigned in join order (first to join = slot 1, etc.)
- [ ] Design "Join" state UI:
  - "Press SPACE (Keyboard)" or "Press A (Controller)"
  - Animated pulse effect to draw attention
  - Controller icon / keyboard icon

### 3.2 Player Slot (Joined State)

- [ ] Display editable player name (default: "Player 1-4")
- [ ] Name max length: 16 characters
- [ ] Color picker carousel (8 colors):
  - 🔴 Red, 🟢 Green, 🔵 Blue, 🟡 Yellow
  - 🟣 Purple, 🟠 Orange, ⚪ White, 🩷 Pink
- [ ] Colors already taken by other players are disabled/grayed out
- [ ] Auto-assign first available color on join
- [ ] Show input device icon (keyboard/gamepad)
- [ ] "Leave" instruction (ESC / B button)
- [ ] Ready checkbox/button
- [ ] Visual distinction when ready (glow/checkmark)

### 3.3 Host Controls (First Player)

- [ ] Board size selector: 15×15, 25×25, 50×50
- [ ] Difficulty selector:

  - Easy: 2 tiles/sec
  - Normal: 4 tiles/sec
  - Hard: 8 tiles/sec
  - Insane: 16 tiles/sec

- [ ] Game starts when all joined players are ready
- [ ] Minimum 1 player required
- [ ] 3-2-1 countdown animation before game starts

---

## Phase 4: Snake Entity

### 4.1 Snake Base Implementation

- [ ] Create `Snake` class with:
  - Position array (segments)
  - Direction (current + queued)
  - Speed (tiles per second)
  - Color
  - Player reference
- [ ] Starting length: 3 segments
- [ ] Spawn at fixed positions based on player slot:
  - Player 1: Top-left corner area
  - Player 2: Top-right corner area
  - Player 3: Bottom-left corner area
  - Player 4: Bottom-right corner area
- [ ] Initial direction facing toward center

### 4.2 Snake Movement

- [ ] Grid-based movement with smooth interpolation
- [ ] Direction queue to prevent 180° turns
- [ ] Screen wrapping (exit right → enter left, etc.)
- [ ] Variable speed support (for power-ups)

### 4.3 Snake Growth & Tail Shedding

- [ ] Grow by 1 segment when eating apple
- [ ] Track body length
- [ ] When length > 20:
  - Convert excess segments to gray blocks
  - Reduce snake to 5 segments
  - Play shedding animation/sound

### 4.4 Snake Collision

- [ ] Self-collision detection → death
- [ ] Collision with other snakes → death
- [ ] Collision with gray blocks → death
- [ ] Collision with apples → consume

### 4.5 Death Behavior

- [ ] On death, snake body converts to gray blocks
- [ ] Dead player enters spectator mode
- [ ] Game continues until ALL players are dead
- [ ] Last surviving player has advantage to increase score

---

## Phase 5: Apple System

### 5.1 Apple Entity

- [ ] Create `Apple` class with:
  - Position
  - Color (Red, Green, Blue, Orange, Purple)
  - Spawn animation
- [ ] 5 colors with equal spawn probability

### 5.2 Apple Spawning

- [ ] Maintain minimum 5 apples on map
- [ ] Spawn at random empty tiles
- [ ] Avoid spawning on snakes or gray blocks
- [ ] No respawn if count > 5 (from purple effect)

### 5.3 Combo System

- [ ] Track consecutive same-color apples per snake
- [ ] Display colored dots above snake head showing current streak (0-2 dots)
- [ ] Dots match the color of the streak
- [ ] Trigger effect when 3rd same color is eaten (3-combo)
- [ ] Reset streak to 1 (new color) when different color eaten

### 5.4 Apple Effects (3-Combo Triggers)

Make sure effects are properly cleared if 2 effects are applied at the same time. Also modifiers that change the same thing (eg. green and red change speed) should cancled previous effect before applying new one.

#### 🔴 Red - Speed Boost

- [ ] Increase snake speed by 50% for 10 seconds
- [ ] Speed lines visual effect
- [ ] Timer indicator on snake

#### 🟢 Green - Slow Down

- [ ] Decrease snake speed by 50% for 10 seconds
- [ ] Drowsy visual effect (wavy movement)
- [ ] Timer indicator on snake

#### 🔵 Blue - Rain Distortion

- [ ] Apply screen-wide rain shader effect
- [ ] Distort/blur the game view
- [ ] Covers entire map, affects ALL players (including triggering player)
- [ ] Duration: 10 seconds
- [ ] Rain drops animation overlay

#### 🟠 Orange - Projectile

- [ ] Spawn projectile in snake's facing direction
- [ ] Projectile travels until hitting edge or block
- [ ] Gray block hit → transforms into random apple
- [ ] Visual: glowing orb with trail

#### 🟣 Purple - Apple Rain

- [ ] Spawn 10 additional apples instantly
- [ ] Spawn animation (falling from top)
- [ ] Can exceed 5 apple minimum temporarily

---

## Phase 6: Game Objects

### 6.1 Gray Blocks

- [ ] Create `GrayBlock` class
- [ ] Spawned from snake tail shedding
- [ ] Solid collision (kills snakes)
- [ ] Can be converted to apple by orange projectile
- [ ] Subtle pulsing animation

### 6.2 Projectiles

- [ ] Create `Projectile` class
- [ ] Linear movement in one direction
- [ ] No screen wrapping - disappears on collision with walls
- [ ] Pass through snakes (no collision with snakes)
- [ ] Collision with gray blocks only
- [ ] Despawn after hitting block or timeout (5 seconds)
- [ ] Trail particle effect

---

## Phase 7: Rendering System

### 7.1 Canvas Setup

- [ ] Create responsive canvas (fit to window)
- [ ] Calculate tile size based on board dimensions
- [ ] Support multiple board sizes (15×15, 25×25, 50×50)
- [ ] Maintain aspect ratio

### 7.2 Visual Style - Cartoonish Theme

- [ ] Bright, saturated color palette
- [ ] Rounded corners on all elements
- [ ] Subtle drop shadows
- [ ] Gradient fills for depth
- [ ] Googly eyes on snake heads
- [ ] Bouncy animations

### 7.3 Snake Rendering

- [ ] Head: Rounded rectangle with eyes
- [ ] Body: Connected rounded segments
- [ ] Tail: Tapered end
- [ ] Color tint per player
- [ ] Death animation (explosion/fade)

### 7.4 Apple Rendering

- [ ] Circular with highlight/shine
- [ ] Leaf on top (small green triangle)
- [ ] Subtle bobbing animation
- [ ] Spawn: pop-in scale animation
- [ ] Consume: shrink + particles

### 7.5 UI Rendering

- [ ] Combo indicator above snake (colored dots)
- [ ] Active effect timers (circular progress)
- [ ] Score display per player
- [ ] Game timer (optional)

### 7.6 Effects

- [ ] Screen shake on death
- [ ] Particle system for:
  - Apple consumption
  - Tail shedding
  - Power-up activation
- [ ] Rain overlay (blue combo effect)
- [ ] Speed lines (red combo effect)

---

## Phase 8: Audio System

### 8.1 Sound Manager

- [ ] Create `AudioManager` with Web Audio API
- [ ] Sound pooling for frequent sounds
- [ ] Volume controls
- [ ] Mute toggle

### 8.2 Sound Effects (Generate with Web Audio)

- [ ] `eat_apple` - Short "pop" or "chomp"
- [ ] `combo_activate` - Magical chime
- [ ] `snake_death` - Sad trombone / splat
- [ ] `tail_shed` - Crumbling sound
- [ ] `projectile_fire` - Whoosh
- [ ] `projectile_hit` - Ding/transform sound
- [ ] `player_join` - Welcome jingle
- [ ] `player_ready` - Confirmation beep
- [ ] `game_start` - Energetic fanfare
- [ ] `countdown_tick` - Tick sound
- [ ] `ui_navigate` - Soft click
- [ ] `rain_ambient` - Rain loop (for blue effect)

### 8.3 Background Music (Optional)

- [ ] Upbeat chiptune-style loop
- [ ] Fade in/out on game state changes

---

## Phase 9: Game Flow & Screens

### 9.1 Screen Manager

- [ ] Create `ScreenManager` for transitions
- [ ] Fade transitions between screens

### 9.2 Lobby Screen

- [ ] Render 4 player slots
- [ ] Handle all lobby logic from Phase 3
- [ ] Animated background (moving snakes?)

### 9.3 Game Screen

- [ ] Render game board
- [ ] HUD overlay:
  - Player scores (corners)
  - Active effects
  - Time elapsed
- [ ] Pause functionality (optional)

### 9.4 Game Over Screen

- [ ] Show final scores for all players
- [ ] Winner = highest score (not last survivor)
- [ ] Highlight winner with crown/celebration
- [ ] Display high scores from localStorage
- [ ] "Play Again" → Lobby
- [ ] Name entry for high score (if qualified)

---

## Phase 10: High Score System

### 10.1 Score Calculation

- [ ] Points per apple eaten
- [ ] Bonus for combos
- [ ] Survival time bonus
- [ ] Final length bonus

### 10.2 LocalStorage Integration

- [ ] Save top 10 scores per board size category (3 leaderboards)
- [ ] Store: name, score, date
- [ ] Separate leaderboards: 15×15, 25×25, 50×50
- [ ] Load on game start
- [ ] Update after each game
- [ ] Global rankings (not per-player)

### 10.3 High Score Display

- [ ] Leaderboard in lobby (toggle view)
- [ ] Highlight current players' best scores
- [ ] New high score celebration animation

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
