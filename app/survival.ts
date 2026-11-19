import { WORLD_LIMIT, WORLD_OBSTACLES } from './world'
export type Obstacle = { x: number; z: number; halfX: number; halfZ: number }
export type Clock = { day: number; hour: number }
export const MAGAZINE = 12
export const DAY_SECONDS = 360
export const OBSTACLES: Obstacle[] = WORLD_OBSTACLES
export function blocked(x: number, z: number, obstacles: Obstacle[], radius = 0.4) {
  return Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT || obstacles.some(o => Math.abs(x - o.x) < o.halfX + radius && Math.abs(z - o.z) < o.halfZ + radius)
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

export function movementAxes(keys: Record<string, boolean>) {
  return {
    forward: Number(Boolean(keys.KeyW || keys.ArrowUp)) - Number(Boolean(keys.KeyS || keys.ArrowDown)),
    side: Number(Boolean(keys.KeyD || keys.ArrowRight)) - Number(Boolean(keys.KeyA || keys.ArrowLeft)),
  }
}

export function hitDamage(ranged: boolean, headshot: boolean) { return ranged ? headshot ? 3 : 2 : 1 }
export function detectionRadius({ horde, night, crouched, flashlight }: { horde: boolean; night: boolean; crouched: boolean; flashlight: boolean }) {
  if (horde) return 95
  return (night ? 30 : 20) * (crouched && !flashlight ? 0.45 : 1)
}
export function craftBandage<T extends { scrap: number; water: number; bandage: number }>(inventory: T): T | null {
  if (inventory.scrap < 2 || inventory.water < 1) return null
  return { ...inventory, scrap: inventory.scrap - 2, water: inventory.water - 1, bandage: inventory.bandage + 1 }
}
