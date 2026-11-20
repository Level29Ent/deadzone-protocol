'use client'

import { LAKE, ROADS, TOWNS, weatherAt, type WorldLocation } from './world'
import { EXTRACTION, RELAYS, canExtract, type Campaign } from './campaign'
import type { Clock } from './survival'

export function RegionMap({ location, visited, clock, onClose, campaign }: { campaign: Campaign; location: WorldLocation; visited: string[]; clock: Clock; onClose: () => void }) {
  const cycle = Math.floor((clock.day * 24 + clock.hour) / 4)
  const drop = TOWNS[cycle % TOWNS.length]
  return <section className="county-map" role="dialog" aria-modal="true" aria-labelledby="county-map-title">
    <div className="map-heading"><div><div className="eyebrow">FIELD ATLAS · SIMULATION PAUSED</div><h2 id="county-map-title">BLACKWATER COUNTY</h2><p>Six connected settlements · {visited.length}/6 discovered · {weatherAt(clock.day, clock.hour)}</p></div><button autoFocus onClick={onClose}>RESUME →</button></div>
    <div className="map-content"><svg viewBox="-400 -400 800 800" role="img" aria-label="County road map with six towns, your position and the active supply drop">
      <defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c7c7a5" strokeOpacity=".07" /></pattern></defs>
      <rect x="-390" y="-390" width="780" height="780" fill="#1d2c27" stroke="#617362" /><rect x="-390" y="-390" width="780" height="780" fill="url(#map-grid)" />
      {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={-250 + i * 96} cy={i % 2 ? -260 : 255} rx="85" ry="65" fill="none" stroke="#799174" strokeOpacity=".17" strokeWidth="8" />)}
      <rect x={LAKE.x - LAKE.halfX} y={LAKE.z - LAKE.halfZ} width="44" height="80" rx="10" fill="#527f80" /><text x="105" y="210" fill="#86aeaa" fontSize="10">LAKE GREY</text>
      {ROADS.map((r, i) => <line key={i} x1={r.ax} y1={r.az} x2={r.bx} y2={r.bz} stroke="#b8a879" strokeWidth="5" strokeOpacity=".6" />)}
      {TOWNS.map(t => <g key={t.id}><rect x={t.x - 42} y={t.z - 45} width="84" height="90" rx="5" fill={t.color} fillOpacity=".13" stroke={t.color} strokeOpacity=".4" /><circle cx={t.x} cy={t.z} r="7" fill={visited.includes(t.id) ? t.color : '#25332a'} stroke={t.color} strokeWidth="2" /><text x={t.x} y={t.z - 59} textAnchor="middle" fill="#ebe4cb" fontSize="14" fontWeight="bold">{t.name.toUpperCase()}</text><text x={t.x} y={t.z + 61} textAnchor="middle" fill="#a4b49d" fontSize="10">{t.specialty}</text></g>)}
      <g transform={`translate(${drop.x + 3} ${drop.z + 8})`}><rect x="-6" y="-6" width="12" height="12" fill="#e4a15c" transform="rotate(45)" /><circle r="19" fill="none" stroke="#e4a15c" strokeDasharray="3 4" /></g>
      {RELAYS.map(r => <g key={r.id} transform={`translate(${r.x} ${r.z})`}><rect x="-5" y="-5" width="10" height="10" fill={campaign.repaired.includes(r.id) ? '#8dd6ac' : '#d6bd75'} /><circle r="12" fill="none" stroke={campaign.repaired.includes(r.id) ? '#8dd6ac' : '#d6bd75'} /></g>)}
      <g transform={`translate(${EXTRACTION.x} ${EXTRACTION.z})`}><path d="M -9 -9 L 9 9 M 9 -9 L -9 9" stroke={canExtract(campaign) ? '#92e6b3' : '#b4b39c'} strokeWidth="3" /><text x="16" y="4" fill="#d6d9c0" fontSize="10">EXTRACTION</text></g>
      <g transform={`translate(${location.x} ${location.z}) rotate(${-location.heading * 180 / Math.PI})`}><circle r="16" fill="#e2efd1" fillOpacity=".12" /><path d="M 0 11 L -7 -7 L 0 -3 L 7 -7 Z" fill="#f7f4d8" stroke="#243c30" strokeWidth="2" /></g>
      <text x="-365" y="-350" fill="#d8ce9b" fontSize="18">N ↑</text><text x="200" y="350" fill="#b9c4a6" fontSize="11">100 METERS</text><path d="M 200 360 h 100" stroke="#b9c4a6" strokeWidth="2" />
    </svg><aside><h3>OPERATION DEAD AIR · {campaign.repaired.length}/6</h3><p>Square relay markers: gold = offline, green = online. Repair each for 3 scrap with E. Then reach the north checkpoint (X) and press E to extract.</p><p>Highways connect every town. Walk freely between them—there are no travel menus or loading gates.</p><div className="radio-report"><b>ACTIVE SUPPLY DROP</b><span>{drop.name} town center</span><small>24 rounds · Moves every four in-game hours. Orange smoke marks the cache.</small></div><h3>SETTLEMENTS</h3>{TOWNS.map(t => <div className="town-entry" key={t.id}><span style={{ color: t.color }}>● {t.name}</span><small>{Math.round(Math.hypot(t.x - location.x, t.z - location.z))}m · {campaign.repaired.includes(t.id) ? 'RELAY ONLINE' : 'RELAY OFFLINE'}</small></div>)}<p>Rain reduces visibility. Infected roam during the day and hunt faster after dark. All towns are dangerous.</p></aside></div>
  </section>
}
