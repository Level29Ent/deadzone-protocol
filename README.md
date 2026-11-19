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


## Survivor and realism pass

The survivor and infected now use proportioned articulated bodies with facial features, joints, boots, gloves and layered garments. Survivor gear includes a vest, pouches, cap and backpack. Walk/run, breathing, crouching, weapon recoil and reload poses are animated procedurally rather than motion-captured. The pause/start screen has a rotating 3D survivor preview and three cosmetic outfits (ranger/scout/urban), with no armor advantage.

- **X** toggles crouch: slower movement, lower camera/stance and a 55% reduction in normal infected detection range while the flashlight is off. The seventh-night horde ignores stealth.
- **L** toggles a real spotlight. Using it removes crouch concealment; there is no battery mechanic.
- **H** crafts one field dressing from two scrap and one water. Use it with **3** like other bandages.
- Ranged headshots kill in one hit; body shots require two. Melee damage is unchanged. The crosshair remains the authoritative aim point.
- **Balanced** graphics limits pixel density to 1.25 and sun shadows to 1024; **High** allows pixel density 2 and 2048 sun shadows. Select it in the start/pause screen. Both use distance-culled infected, instanced vegetation and the same gameplay rules.

Environment changes include higher-resolution generated surface relief, stained/clapboard siding, weathered asphalt and roof tiles, layered pine foliage, gutters/downspouts, collidable abandoned cars, procedural environment reflections and darker/wetter road surfaces during rain. Ambient fill and reflections now dim at night.

These are original procedural assets and browser-friendly PBR-style materials, **not photoreal scanned assets or a full realistic art replacement**. No downloaded character models or external texture services are used. Photorealism, full skeletal/IK animation, interiors, sound, save persistence, multiplayer and realistic physics remain out of scope. The first-person reload is an animated pose, not a physical magazine simulation.

## Operation Dead Air — county campaign

Every fresh survival session now has a complete objective loop:

1. Find the field radio relay on the main road in each town (8m ahead of the starting position).
2. Get within 2.6m and press **E** to repair it for **3 scrap**. Each relay can reward you only once: **12 reserve rounds and 1 water**. Repairing relays does not make a town safe.
3. Restore all six, in any order. The HUD points to the nearest offline relay; the atlas shows gold offline / green online markers and exact relay status for each settlement.
4. Reach the **north highway checkpoint** at (0, -185). Within its marked circle, press **E** to complete extraction. It stays locked until all six relays are online.
5. Review the completed-run summary or start a new county run. Extraction freezes survival simulation; restarting resets relays, rewards, resources, enemies, clock and world state together.

Nearby contextual prompts cover relay repair, cache searches and extraction. Relays take interaction priority over caches. The navigation arrow rotates relative to the player's look direction; distance is in world meters. Starting-town selection is not fast travel and a restart never retains campaign progress. Progress is still session-only. Extraction is an immediate radio-confirmed ending, not a helicopter cinematic or timed defense event.

Validation adds campaign checks for repair costs, duplicate reward prevention, unknown IDs, all six accessible relay sites, extraction gating, fresh template immutability, nearest objectives and navigation bearings. Long-session balance and a full six-town browser playthrough still require testing.
