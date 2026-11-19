export const WORLD_LIMIT = 390
export const LAKE = { x: 75, z: 180, halfX: 22, halfZ: 40 }
export type Town = { id: string; name: string; x: number; z: number; color: string; biome: string; landmark: 'tower' | 'church' | 'silos' | 'motel' | 'depot' | 'radio'; specialty: string }
export const TOWNS: Town[] = [
  { id: 'pinefall', name: 'Pinefall', x: -220, z: -130, color: '#718567', biome: 'PINE FOREST', landmark: 'church', specialty: 'Medicine' },
  { id: 'maplewood', name: 'Maplewood', x: 0, z: -130, color: '#b9a26e', biome: 'OVERGROWN SUBURBS', landmark: 'tower', specialty: 'Food & water' },
  { id: 'ashford', name: 'Ashford', x: 220, z: -130, color: '#b27a5d', biome: 'INDUSTRIAL BADLANDS', landmark: 'depot', specialty: 'Scrap metal' },
  { id: 'sunvale', name: 'Sunvale', x: -220, z: 130, color: '#c6ac64', biome: 'DRY FARMLAND', landmark: 'silos', specialty: 'Rations' },
  { id: 'stillwater', name: 'Stillwater', x: 0, z: 130, color: '#709e9c', biome: 'LAKESIDE WETLANDS', landmark: 'motel', specialty: 'Water & medicine' },
  { id: 'redmesa', name: 'Red Mesa', x: 220, z: 130, color: '#bf7259', biome: 'RED ROCK RIDGE', landmark: 'radio', specialty: 'Ammunition' },
]
export const ROADS = [
  ...[-130, 130].map(z => ({ ax: -290, az: z, bx: 290, bz: z })),
  ...[-220, 0, 220].map(x => ({ ax: x, az: -200, bx: x, bz: 200 })),
]
export function roadDistance(x: number, z: number) {
  return Math.min(...ROADS.map(r => {
    const dx = r.bx - r.ax, dz = r.bz - r.az
    const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)))
    return Math.hypot(x - r.ax - dx * t, z - r.az - dz * t)
  }))
}
export function nearestTown(x: number, z: number) {
  return TOWNS.reduce((best, t) => Math.hypot(t.x - x, t.z - z) < Math.hypot(best.x - x, best.z - z) ? t : best)
}
export function terrainHeight(x: number, z: number) {
  const townDistance = Math.min(...TOWNS.map(t => Math.hypot(t.x - x, t.z - z)))
  const lakeDistance = Math.hypot(Math.max(0, Math.abs(x - LAKE.x) - LAKE.halfX - 3), Math.max(0, Math.abs(z - LAKE.z) - LAKE.halfZ - 3))
  const blend = Math.max(0, Math.min(1, (Math.min(townDistance - 48, roadDistance(x, z) - 10, lakeDistance)) / 35))
  if (blend === 0) return 0
  return (Math.sin(x * 0.023) * Math.cos(z * 0.019) * 4 + Math.sin(z * 0.041 + x * 0.012) * 2 + 3) * blend
}
export const BUILDINGS = TOWNS.flatMap((town, ti) => [-1, 1].flatMap(side => [-28, -9, 13, 32].map((z, i) => ({
  x: town.x + side * (i % 2 ? 19 : 27), z: town.z + z,
  town: town.id, color: [town.color, '#8b8672', '#8b785f', '#6e7773'][(i + ti) % 4], seed: ti * 8 + i + (side + 1) * 2,
}))))
export const WORLD_OBSTACLES = [
  ...BUILDINGS.map(b => ({ x: b.x, z: b.z, halfX: 3.4, halfZ: 3 })),
  ...TOWNS.map(t => ({ x: t.x + 34, z: t.z + 8, halfX: 6, halfZ: 6 })),
  // The lake is a non-swimmable environmental obstacle. Its bank is walkable.
  LAKE,
]
export function spawnAt(townId: string): [number, number, number] {
  const t = TOWNS.find(t => t.id === townId) ?? TOWNS[1]
  return [t.x, 0, t.z - 18]
}
export type WorldLocation = { x: number; z: number; heading: number }
export function weatherAt(day: number, hour: number): 'CLEAR' | 'OVERCAST' | 'RAIN' {
  return (Math.floor(hour / 4) + day) % 4 === 0 ? 'RAIN' : (Math.floor(hour / 4) + day) % 4 === 1 ? 'OVERCAST' : 'CLEAR'
}
