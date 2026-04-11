# CLAUDE.md — CityHero Academy

## What Is This?
A mobile-first educational game for kids 5–8 years old. Players complete mini-games across 5 missions to earn City Points (CP) and unlock jigsaw puzzle pieces. Each mission has 20 levels of increasing difficulty. Built as a web app, deployed to mobile browser (Cloudflare Pages).

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| UI framework | React 19 + TypeScript |
| Game engine | Phaser 3.90 (arcade physics) |
| Build tool | Vite 6 |
| Routing | React Router v7 |
| State | Zustand + localStorage persistence |
| Animation | Framer Motion |
| Icons | Lucide React |
| Styling | CSS custom properties (no Tailwind, no CSS modules) |
| Fonts | Outfit (UI), Fredoka One (titles/dialogs) |

No backend. No API. No environment variables. Everything runs client-side.

---

## Folder Structure
```
src/
├── main.tsx              # React entry point (StrictMode)
├── App.tsx               # BrowserRouter + route definitions
├── index.css             # Global CSS vars, fonts, .btn classes
├── pages/
│   ├── Home.tsx          # Landing screen: Play Now → /map
│   ├── MissionMap.tsx    # 6 mission cards (5 active, 1 locked)
│   ├── GameWindow.tsx    # ★ Main game host (Phaser + all overlays)
│   └── Profile.tsx       # Rank, CP, badges
├── game/
│   ├── EventBus.ts       # Phaser EventEmitter singleton (bridge to React)
│   ├── GameConfig.ts     # Phaser game config factory function
│   └── scenes/
│       ├── ThrowToBinScene.ts   # Mission 1: slingshot trash
│       ├── CrossingScene.ts     # Mission 2: traffic crossing
│       ├── LightsOutScene.ts    # Mission 3: click lights off
│       ├── WaterSaverScene.ts   # Mission 4: shut faucets
│       └── NotMyDogScene.ts     # Mission 5: maze + dog rescue
├── components/
│   ├── Layout.tsx         # Bottom nav (hidden on /game routes)
│   └── PuzzleReveal.tsx   # 4×5 jigsaw puzzle piece reveal
└── store/
    └── progressStore.ts   # Zustand: CP, highScores, puzzlePieces, ranks
```

---

## Key Files
- **`GameWindow.tsx`** (719 lines) — orchestrates everything: creates Phaser, listens to EventBus, renders all overlays (level complete, time up, puzzle reveal, tutorials). Any new overlay or mission integration goes here.
- **`progressStore.ts`** — single source of truth for all player progress. Key: `cityhero-progress-v3` in localStorage.
- **`EventBus.ts`** — the only bridge between Phaser scenes and React. Scenes emit, GameWindow listens.
- **`NotMyDogScene.ts`** (~700 lines) — most complex scene. Uses BFS pathfinding, maze generation, door/lever system, cat AI, owner callouts.

---

## Routing
```
/            → Home.tsx
/map         → MissionMap.tsx
/game/:missionId → GameWindow.tsx (Phaser initialized here)
/profile     → Profile.tsx
*            → redirect to /
```
Layout (bottom nav) is hidden on `/game/*` routes.

---

## Mission → Scene Flow
```
MissionMap: click mission → navigate('/game/2')
  └─ GameWindow: SCENE_MAP[missionId] → CrossingScene
       └─ Phaser.Game created in useEffect with scene class
            └─ Scene.create() emits 'current-scene-ready'
                 └─ GameWindow registers EventBus listeners
                      └─ scene emits game-level-complete / game-time-up
                           └─ GameWindow calls completeLevel() → store update
```

**SCENE_MAP** (in GameWindow.tsx):
```typescript
{ 1: ThrowToBinScene, 2: CrossingScene, 3: LightsOutScene,
  4: WaterSaverScene, 5: NotMyDogScene }
```
To add Mission 6: add scene class, add to SCENE_MAP, activate in MissionMap.

---

## Scene Architecture Pattern
Every scene follows this contract:
```typescript
class XScene extends Phaser.Scene {
  init(data?: { level?: number })   // receives level, resets state
  create()                          // layout, sprites, EventBus listeners
  update()                          // game loop (Phaser calls every frame)
}
```
- Timer: `this.time.addEvent({ delay:1000, loop:true })` → emits `game-timer`
- Level complete: `EventBus.emit('game-level-complete', this.level)`
- Time up: `EventBus.emit('game-time-up', this.score)`
- Restart: listens for `restart-scene` → `this.scene.restart(data)`
- Shutdown cleanup: `this.events.once(SHUTDOWN, () => EventBus.off(...))`

---

## EventBus Events Reference
| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `current-scene-ready` | Scene→React | EventBus ref | Scene mounted |
| `game-timer` | Scene→React | number (seconds left) | Update HUD |
| `game-scored-update` | Scene→React | string (display text) | Update score badge |
| `game-level-complete` | Scene→React | number (level) | Trigger overlay |
| `game-time-up` | Scene→React | any | Trigger time-up overlay |
| `restart-scene` | React→Scene | `{level}` | Restart current level |
| `show-dog-tutorial` | Scene→React | — | Mission 5 tutorial overlay |
| `show-dog-prelevel` | Scene→React | `{level, cfg}` | Mission 5 level preview |
| `show-dog-message` | Scene→React | string | Mission 5 toast message |
| `dog-tutorial-done` | React→Scene | — | Dismiss tutorial |
| `dog-prelevel-done` | React→Scene | — | Dismiss pre-level |

---

## Progress Store
```typescript
cityPoints: number                           // total CP earned
highScores: Record<missionId, score>
highestLevel: Record<missionId, level>       // 1-indexed
puzzlePieces: Record<missionId, count>       // 0-20
```
- `completeLevel(mId, level)` → +20 CP if new level, +1 puzzle piece
- `getRankInfo()` → `{ rank, emoji, currentCP, nextCP, progress }`
- Persist key: `cityhero-progress-v3` — **do not change this key** (breaks existing saves)

**Rank thresholds:** 0 Newbie → 100 Explorer → 300 Helper → 600 Guardian → 1000 Hero → 2000 Master

---

## CSS Conventions
- All colors via CSS vars in `index.css`: `--primary`, `--secondary`, `--accent-1/2/3`
- Inline styles for component-specific layout (React inline style objects)
- Global `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-accent` classes
- Font: Fredoka One for all game UI text, Outfit for nav/stats
- No Tailwind. No CSS modules. No styled-components.
- Animations via `@keyframes` in index.css + Framer Motion for overlays

---

## Architecture Patterns
1. **Phaser draws, React overlays** — Phaser canvas is full-screen underneath; React divs are `position:absolute` overlays on top (zIndex 60+)
2. **EventBus = only coupling** — scenes never import React; React never imports scene internals
3. **Level data in scene** — each scene has its own `LEVELS` array defining per-level config
4. **Procedural graphics** — no external image assets; all sprites drawn with `this.add.graphics()` or emoji text objects
5. **BFS for pathfinding** — NotMyDogScene uses BFS for dog movement, distance checks, and main-path detection
6. **Single Phaser instance** — destroyed and recreated on each `/game/` mount via useEffect cleanup

---

## Sensitive / Careful Areas
- **`progressStore.ts` persist key** — changing `cityhero-progress-v3` wipes all user saves
- **`GameWindow.tsx` useEffect** — Phaser game is created/destroyed here; async race conditions possible if not careful with cleanup
- **Scene `init()` must reset ALL state** — Phaser reuses scene objects on restart; any field not reset in `init()` will carry over
- **EventBus listeners leak** — every `EventBus.on()` in a scene MUST be cleaned up in the SHUTDOWN event or they accumulate across levels
- **Phaser autoSize** — game canvas uses RESIZE mode; `W` and `H` in `create()` reflect actual device size and change between levels if orientation changes

---

## Adding a New Mission (Checklist)
1. Create `src/game/scenes/NewScene.ts` extending `Phaser.Scene`
2. Implement `init / create / update` with EventBus contract above
3. Add to `SCENE_MAP` in `GameWindow.tsx`
4. Add tutorial/prelevel overlays in `GameWindow.tsx` if needed
5. Add mission entry in `MISSIONS` array in `MissionMap.tsx`
6. Activate it (remove `locked: true`)
7. Add mission-specific text to `LevelCompleteOverlay` in `GameWindow.tsx`

---

## Build & Deploy
```bash
npm run dev          # Vite dev server :5173
npm run dev -- --host  # Expose to network (mobile testing)
npm run build        # tsc + vite build → /dist
npm run preview      # Preview /dist locally
```
Deployed to Cloudflare Pages. No server. Static files only.
No `.env` files — zero environment variables in this project.
