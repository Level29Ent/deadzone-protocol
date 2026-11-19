# Deadzone Protocol — Blackwater County

An original single-player browser survival world with six connected towns across a seamless 780×780-meter playable county. Desktop keyboard/mouse and WebGL required.

## The county

| Town | Environment / landmark | Supply specialty |
| --- | --- | --- |
| Pinefall | Pine forest / church steeple | Medicine |
| Maplewood | Overgrown suburb / water tower | Food and water |
| Ashford | Industrial badlands / factory stacks | Scrap |
| Sunvale | Dry farmland / twin grain silos | Rations |
| Stillwater | Lakeside wetlands / Lakeview Motel | Water and medicine |
| Red Mesa | Red-rock ridge / radio mast | Ammunition |

Each town has eight buildings, its own landmark, five searchable supply caches, and six resident infected. Highways form a connected network between all towns; travel is on foot without loading gates. Roads and towns are flat, while wilderness terrain rises into hills. The lake is non-swimmable and has collision. Each town can be chosen as a **new session's** starting point; changing this selection while paused does not teleport the current player.

The county atlas (**M**) shows roads, all six towns, discovered settlements, your position/direction, distances, and the active supply drop. Discovery requires entering a town, not merely viewing its map marker. Positive Z is south on the atlas.

## Active-world simulation

- Thirty-six resident infected roam independently, chase nearby players, collide with structures, and damage barricades. No server or multiplayer simulation is implied.
- A single shared clock drives lighting, weather, cache restocks, supply events and the seventh-night horde.
- Weather cycles among clear, overcast and rain in four-hour blocks; rain lowers the fog distance. Clouds drift, birds circle towns, and lake highlights ripple.
- A radio supply drop rotates between towns every four in-game hours, providing a one-use 24-round ammunition cache marked on the atlas and by orange smoke. It does not affect normal cache restocking.
- Every seventh night adds 18 hunters near the player's current location, not at the original spawn. They disappear at dawn. Resident infected remain dead until a new session.
- Town geometry is distance-culled; forests, rocks and grass use instancing. Terrain and siding/roof/asphalt textures are generated locally—no external models, texture downloads, or font services are needed.

## Play

Choose **Start Survival** for day 1, or **Quick Horde Drill** for day 7, 21:30. Pick any starting town before beginning or restarting.

- WASD / arrows: move; click world to capture mouse; Shift: sprint; Space: jump.
- V: first/third person. Right mouse: aim. Left mouse: fire. R: reload (1.5 seconds, 12-round magazine). F: melee (10 stamina).
- E: search a gold-marked cache within 3.2 meters. Normal caches restock at 06:00.
- 1 / 2 / 3: food / water / bandage. Starvation and dehydration damage health.
- B: place a destructible 100-HP barricade ahead for 4 scrap (12 active maximum).
- C: craft 6 reserve rounds for 3 scrap.
- M: open the atlas and pause. Use **Resume** to return to play; Escape closes the atlas to the pause menu.
- Escape, losing mouse capture or window focus: pause. Restart resets the entire world and discovery record.

Days last six active real-time minutes. Night is 22:00–06:00, with faster infected. Death ends the session.

## Scope and limits

This is a larger live **single-player simulation**, not a persistent online service or a finished AAA game. Session-only progress; no multiplayer, saved world, audio, terrain destruction, enterable buildings or mobile touch controls. Trees, rocks, street furniture and grass are decorative rather than full physics obstacles. Buildings, landmarks, lake and barricades have planar collision. AI uses local collision/steering, not a full navigation mesh. WebGL failure is explicitly reported instead of presenting the static fallback as gameplay.

## Development and validation

```sh
pnpm install --frozen-lockfile
pnpm exec node scripts/check-world.mjs
pnpm exec tsc --noEmit
pnpm run build
pnpm dev
```

The focused checks cover all six clear spawns, building foundations/collision, infected spawns, flat/unobstructed travel corridors, map boundaries, finite terrain, weather states and core survival regressions. Typecheck is separate because the repository's existing Next config skips build-time type validation.

Browser acceptance: start at every town; verify V, M and pause/resume; search a cache and confirm it cannot be taken twice; craft ammunition/barricades; cross a town boundary along a highway; verify map position/discovery; inspect rain and the horde drill. Long-session balance, full-map traversal, mobile GPUs and a seven-day playthrough require further testing.
