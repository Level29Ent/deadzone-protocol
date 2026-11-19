# Deadzone Protocol

An original, single-player browser survival-shooter prototype. Requires desktop keyboard/mouse and WebGL. This is not a recreation of another game's assets or a full voxel survival engine.

## Play

Choose **Start Survival** for day 1, or **Quick Horde Drill** to start at day 7, 21:30 (about 7.5 seconds before the horde).

- WASD / arrows: move; mouse: look after clicking the world; Shift: sprint; Space: jump.
- V: switch first/third person. Right mouse: aim. Left mouse: fire. R: reload (1.5 seconds, 12-round magazine). F: melee (10 stamina).
- E: search a gold-marked cache within 3.2 meters. Caches restock at 06:00 each day.
- 1 / 2 / 3: food / water / bandage. Starvation and dehydration damage health.
- B: place a 100-HP barricade ahead for 4 scrap (12 active maximum). Infected can break it.
- C: craft 6 reserve rounds for 3 scrap.
- Escape, losing mouse capture, or leaving the window: pause. Resume captures the mouse again.

Days last six active real-time minutes. Night is 22:00–06:00, with faster infected. Every seventh night spawns 18 additional infected that hunt until dawn. Death ends the session. Restart resets the world, caches, barricades, inventory, clock, and enemies together.

## Prototype limits

Progress is session-only, replacing the old partial stats-only save that could disagree with world state. No multiplayer, sound, terrain destruction, building interiors, or mobile touch controls. Houses, cars, and barricades have planar collision; trees, fences, and small props are decorative. The WebGL fallback is explicitly a static illustration, not simulated gameplay.

## Development and checks

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
pnpm dev
```

Manual acceptance: toggle V in both views, move/strafe and collide with a house, shoot an infected twice, confirm walls block shots, reload and check reserve conservation, search a cache only once before dawn, craft ammunition, place a barricade and watch infected break it, pause/resume, run the horde drill, die, then restart and confirm a fresh world. Also check that a WebGL-disabled browser shows the unsupported message with no playable fallback.
