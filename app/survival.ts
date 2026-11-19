export type Obstacle = { x: number; z: number; halfX: number; halfZ: number }
export type Clock = { day: number; hour: number }
export const MAGAZINE = 12
export const DAY_SECONDS = 360
export const HOUSE_POSITIONS = [[-17, -25], [17, -24], [-20, -9], [21, -7], [-8.5, 14], [8.5, 16], [-9, 32], [9, 34], [-36, -1], [36, 2]]
export const OBSTACLES: Obstacle[] = [
  ...HOUSE_POSITIONS.map(([x, z]) => ({ x, z, halfX: 3, halfZ: 2.5 })),
  ...[[-5.1, 4.5], [8.5, -2.6], [-8, 22], [10, -27], [31, 7]].map(([x, z]) => ({ x, z, halfX: 1.8, halfZ: 1 })),
]
export function blocked(x: number, z: number, obstacles: Obstacle[], radius = 0.4) {
  return Math.abs(x) > 48 || Math.abs(z) > 48 || obstacles.some(o => Math.abs(x - o.x) < o.halfX + radius && Math.abs(z - o.z) < o.halfZ + radius)
}
export function advanceClock(clock: Clock, seconds: number): Clock {
  const hours = clock.hour + seconds * 24 / DAY_SECONDS
  return { day: clock.day + Math.floor(hours / 24), hour: hours % 24 }
}
export function isNight(hour: number) { return hour >= 22 || hour < 6 }
export function isHorde(clock: Clock) { return (clock.day % 7 === 0 && clock.hour >= 22) || (clock.day > 1 && (clock.day - 1) % 7 === 0 && clock.hour < 6) }
export function reloadAmmo(ammo: number, reserve: number) {
  const moved = Math.min(MAGAZINE - ammo, reserve)
  return { ammo: ammo + moved, reserve: reserve - moved }
}
