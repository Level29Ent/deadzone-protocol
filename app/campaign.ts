import { TOWNS } from './world'

export const RELAY_COST = 3
export const RELAYS = TOWNS.map(t => ({ id: t.id, name: t.name, x: t.x, z: t.z - 10 }))
export const EXTRACTION = { x: 0, z: -185, name: 'North highway checkpoint' }
export type Campaign = { repaired: string[]; extracted: boolean }
export const NEW_CAMPAIGN: Campaign = { repaired: [], extracted: false }
export function repairRelay(campaign: Campaign, id: string, scrap: number) {
  if (campaign.extracted || !RELAYS.some(r => r.id === id) || campaign.repaired.includes(id) || scrap < RELAY_COST) return null
  return { campaign: { ...campaign, repaired: [...campaign.repaired, id] }, scrap: scrap - RELAY_COST, reserveReward: 12, waterReward: 1 }
}
export function canExtract(campaign: Campaign) { return RELAYS.every(r => campaign.repaired.includes(r.id)) && !campaign.extracted }
export function objectiveAt(campaign: Campaign, x: number, z: number) {
  const remaining = RELAYS.filter(r => !campaign.repaired.includes(r.id))
  if (!remaining.length) return { ...EXTRACTION, id: 'extraction', distance: Math.hypot(EXTRACTION.x - x, EXTRACTION.z - z) }
  const nearest = remaining.reduce((a, b) => Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b)
  return { ...nearest, distance: Math.hypot(nearest.x - x, nearest.z - z) }
}
export function bearingTo(x: number, z: number, heading: number, targetX: number, targetZ: number) {
  const degrees = (Math.atan2(targetX - x, targetZ - z) - heading) * 180 / Math.PI
  return ((degrees + 540) % 360) - 180
}
