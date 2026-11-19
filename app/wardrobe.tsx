'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { IDLE_MOTION, OUTFITS, Survivor, type Outfit } from './character'

function Turntable({ outfit }: { outfit: Outfit }) {
  const motion = useRef({ ...IDLE_MOTION, active: true }), group = useRef<THREE.Group>(null)
  useFrame(({ camera, clock }) => { camera.lookAt(0, 0.95, 0); if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.8 })
  return <><hemisphereLight args={['#dee8ef', '#504b3e', 2]} /><directionalLight position={[2, 4, 3]} intensity={3} /><directionalLight position={[-2, 2, -2]} intensity={2} color="#93adc4" /><group ref={group}><Survivor motion={motion} outfit={outfit} /></group><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><circleGeometry args={[0.65, 40]} /><meshStandardMaterial color="#3d463b" roughness={1} /></mesh></>
}
export function Wardrobe({ outfit, onOutfit, highQuality, onQuality }: { outfit: Outfit; onOutfit: (outfit: Outfit) => void; highQuality: boolean; onQuality: (high: boolean) => void }) {
  return <section className="wardrobe" aria-label="Survivor appearance and graphics">
    <div className="avatar-preview" aria-label="Rotating 3D survivor preview"><Canvas dpr={1} camera={{ position: [1.4, 1.25, 2.6], fov: 38 }} gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}><Suspense fallback={null}><Turntable outfit={outfit} /></Suspense></Canvas></div>
    <div className="wardrobe-options"><div className="eyebrow">YOUR SURVIVOR</div><p>Layered field gear, articulated limbs, gloves, boots and a weathered pack.</p><label>FIELD OUTFIT<select aria-label="FIELD OUTFIT" value={outfit} onChange={e => onOutfit(e.target.value as Outfit)}>{Object.entries(OUTFITS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><label>GRAPHICS<select aria-label="GRAPHICS" value={highQuality ? 'high' : 'balanced'} onChange={e => onQuality(e.target.value === 'high')}><option value="balanced">Balanced · lower GPU load</option><option value="high">High · sharper image & shadows</option></select></label><small>Visual outfit only; no armor bonus. X crouch · L flashlight · H craft dressing.</small></div>
  </section>
}
