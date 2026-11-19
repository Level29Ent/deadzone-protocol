// Focused, deterministic world-model checks. No browser or external services required.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')
const worldUrl = compile(await readFile(new URL('../app/world.ts', import.meta.url), 'utf8'))
const world = await import(worldUrl)
const survival = await import(compile((await readFile(new URL('../app/survival.ts', import.meta.url), 'utf8')).replace("'./world'", JSON.stringify(worldUrl))))
const { TOWNS, BUILDINGS, ROADS, WORLD_LIMIT, terrainHeight, roadDistance, spawnAt, nearestTown, weatherAt } = world
const { blocked, OBSTACLES, movementAxes, advanceClock, reloadAmmo, isHorde } = survival
let checks = 0
function check(value, expected, label) { assert.deepEqual(value, expected, label); checks++ }
check(TOWNS.length, 6, 'six settlements')
check(new Set(TOWNS.map(t => t.id)).size, 6, 'unique towns')
check(new Set(TOWNS.map(t => t.landmark)).size, 6, 'distinct landmarks')
for (const t of TOWNS) {
  const [x, y, z] = spawnAt(t.id)
  const wave = world.hordeSpawns(x, z)
  check(wave.length, 18, 'complete horde near every town')
  for (const [hx, hy, hz] of wave) check(blocked(hx, hz, OBSTACLES, 0.5), false, 'horde spawns outside buildings/lake')
  check(blocked(x, z, OBSTACLES), false, `${t.name}: clear spawn`)
  check(y, terrainHeight(x, z), `${t.name}: grounded spawn`)
  check(nearestTown(x, z).id, t.id, `${t.name}: discovery matches spawn`)
  check(BUILDINGS.filter(b => b.town === t.id).length, 8, `${t.name}: populated streets`)
  for (const b of BUILDINGS.filter(b => b.town === t.id)) { check(blocked(b.x, b.z, OBSTACLES), true, 'building collision'); check(terrainHeight(b.x, b.z), 0, 'level building foundations') }
  for (let i = 0; i < 6; i++) check(blocked(t.x + (i % 2 ? -1 : 1) * 11.5, t.z + 12 + i * 6, OBSTACLES), false, 'resident infected spawn clear')
}
// Every road is flat and collision-free across its whole length; connected intersections link all towns.
for (const r of ROADS) for (let i = 0; i <= 50; i++) {
  const x = r.ax + (r.bx - r.ax) * i / 50, z = r.az + (r.bz - r.az) * i / 50
  check(terrainHeight(x, z), 0, 'flat travel corridor'); check(blocked(x, z, OBSTACLES), false, 'unobstructed road'); check(roadDistance(x, z) < 0.001, true, 'road distance')
}
check(blocked(80, 180, OBSTACLES), true, 'non-swimmable lake')
check(blocked(WORLD_LIMIT + 1, 0, []), true, 'county boundary')
check(blocked(180, 0, []), false, 'old 48m boundary removed')
check(movementAxes({}), { forward: 0, side: 0 }, 'idle movement finite')
check(movementAxes({ KeyW: true, KeyD: true }), { forward: 1, side: 1 }, 'diagonal axes')
check(reloadAmmo(2, 20), { ammo: 12, reserve: 10 }, 'reload conservation')
check(advanceClock({ day: 7, hour: 23 }, 30), { day: 8, hour: 1 }, 'midnight rollover')
check(isHorde({ day: 7, hour: 22 }), true, 'horde start')
check(isHorde({ day: 8, hour: 6 }), false, 'horde ends at dawn')
check(weatherAt(1, 8), 'CLEAR', 'initial weather')
check(new Set(Array.from({ length: 6 }, (_, i) => weatherAt(1, i * 4))).size, 3, 'weather cycles through all states')
for (let x = -WORLD_LIMIT; x <= WORLD_LIMIT; x += 10) for (let z = -WORLD_LIMIT; z <= WORLD_LIMIT; z += 10) assert.ok(Number.isFinite(terrainHeight(x, z)), 'terrain finite')
console.log(`${checks} world/survival checks passed; 6,241 terrain samples finite.`)
