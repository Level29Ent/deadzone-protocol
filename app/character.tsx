'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const OUTFITS = {
  ranger: { label: 'Forest ranger', jacket: '#505f49', pants: '#484c40', vest: '#363e31', pack: '#73745a' },
  scout: { label: 'Desert scout', jacket: '#8d7f65', pants: '#58564a', vest: '#534b3e', pack: '#6c6252' },
  urban: { label: 'Urban survivor', jacket: '#465562', pants: '#343c43', vest: '#292f33', pack: '#565f61' },
}
export type Outfit = keyof typeof OUTFITS
export type Motion = { speed: number; crouched: boolean; aiming: boolean; reloading: boolean; active: boolean }
export const IDLE_MOTION: Motion = { speed: 0, crouched: false, aiming: false, reloading: false, active: false }

type PartProps = { position?: [number, number, number]; scale: [number, number, number]; color: string; rotation?: [number, number, number]; cloth?: boolean; metal?: boolean; torso?: boolean }
function fabricTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#b9b9b9'; ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 128; i += 2) { ctx.fillStyle = i % 4 ? '#a1a1a1' : '#d2d2d2'; ctx.fillRect(i, 0, 1, 128); ctx.fillStyle = '#88888833'; ctx.fillRect(0, i, 128, 1) }
  for (let i = 0; i < 150; i++) { const x = Math.sin(i * 13) * 60 + 64, y = Math.cos(i * 7) * 60 + 64; ctx.fillStyle = '#48483a20'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2, i, 0, Math.PI * 2); ctx.fill() }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); texture.colorSpace = THREE.SRGBColorSpace; return texture
}
export const Survivor = memo(function Survivor({ motion, outfit = 'ranger', infected = false, variant = 0 }: { motion: React.RefObject<Motion>; outfit?: Outfit; infected?: boolean; variant?: number }) {
  const root = useRef<THREE.Group>(null), leftLeg = useRef<THREE.Group>(null), rightLeg = useRef<THREE.Group>(null), leftArm = useRef<THREE.Group>(null), rightArm = useRef<THREE.Group>(null), chest = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null)
  const leftKnee = useRef<THREE.Group>(null), rightKnee = useRef<THREE.Group>(null)
  const phase = useRef(variant * 1.7)
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  const resources = useMemo(() => ({ box: new RoundedBoxGeometry(1, 1, 1, 3, 0.2), limb: new THREE.CapsuleGeometry(0.5, 1, 6, 16), torso: new THREE.LatheGeometry([new THREE.Vector2(0.38, -0.5), new THREE.Vector2(0.43, -0.36), new THREE.Vector2(0.48, 0.08), new THREE.Vector2(0.5, 0.32), new THREE.Vector2(0.36, 0.5)], 24), cloth: fabricTexture() }), [])
  useEffect(() => () => { resources.box.dispose(); resources.limb.dispose(); resources.torso.dispose(); resources.cloth.dispose() }, [resources])
  const palette = OUTFITS[outfit], skin = infected ? '#8b907a' : '#b68c70'
  const Part = useMemo(() => function Part({ position = [0, 0, 0], scale, color, rotation = [0, 0, 0], cloth, metal, torso }: PartProps) {
    const limb = !torso && scale[1] > scale[0] * 1.5 && scale[1] > 0.2
    const dimensions: [number, number, number] = limb ? [scale[0], scale[1] / 2, scale[2]] : scale
    return <mesh geometry={torso ? resources.torso : limb ? resources.limb : resources.box} position={position} rotation={rotation} scale={dimensions} castShadow receiveShadow><meshStandardMaterial color={color} map={cloth ? resources.cloth : undefined} bumpMap={cloth ? resources.cloth : undefined} bumpScale={0.003} roughness={metal ? 0.38 : cloth ? 0.95 : 0.7} metalness={metal ? 0.7 : 0} /></mesh>
  }, [resources])
  useFrame(({ camera }, delta) => {
    if (root.current && infected) { root.current.getWorldPosition(worldPosition); root.current.visible = camera.position.distanceToSquared(worldPosition) < 120 * 120; if (!root.current.visible) return }
    const m = motion.current, dt = Math.min(delta, 0.05)
    if (m.active) phase.current += dt * (m.speed > 0.1 ? m.speed * 2.5 : 1)
    const stride = Math.sin(phase.current) * Math.min(m.speed / 6, 0.65), breathe = Math.sin(phase.current * 0.7) * 0.005
    if (root.current) root.current.position.y = (m.crouched ? -0.42 : 0) + (m.speed > 0.1 ? Math.abs(Math.cos(phase.current)) * 0.025 : breathe)
    if (leftLeg.current) leftLeg.current.rotation.x = stride + (m.crouched ? -1 : 0)
    if (rightLeg.current) rightLeg.current.rotation.x = -stride + (m.crouched ? -1 : 0)
    if (leftKnee.current) leftKnee.current.rotation.x = m.crouched ? 1.9 : 0.08 + Math.max(0, -stride) * 0.6
    if (rightKnee.current) rightKnee.current.rotation.x = m.crouched ? 1.9 : 0.08 + Math.max(0, stride) * 0.6
    if (chest.current) { chest.current.rotation.z = stride * 0.045; chest.current.rotation.x = m.crouched ? 0.2 : 0 }
    if (head.current) head.current.rotation.x = infected ? 0.15 + Math.sin(phase.current * 0.4) * 0.06 : -0.03
    if (leftArm.current) leftArm.current.rotation.x = infected ? -0.75 + stride * 0.2 : m.reloading ? -1.35 : m.aiming ? -1.05 : -0.85 - stride * 0.08
    if (rightArm.current) rightArm.current.rotation.x = infected ? -0.65 - stride * 0.2 : m.reloading ? -0.5 : -1.1 + stride * 0.04
  })
  return <group ref={root}>
    <Part position={[0, 0.88, 0]} scale={[0.34, 0.22, 0.23]} color={palette.pants} cloth />
    <Part position={[0, 0.98, 0]} scale={[0.36, 0.055, 0.245]} color="#292b25" /><Part position={[0, 0.98, 0.132]} scale={[0.065, 0.05, 0.012]} color="#807b60" metal />
    {[-1, 1].map(side => <group key={side} ref={side === -1 ? leftLeg : rightLeg} position={[side * 0.105, 0.85, 0]}>
      <Part position={[0, -0.18, 0]} scale={[0.18, 0.38, 0.22]} color={palette.pants} cloth />
      <group ref={side === -1 ? leftKnee : rightKnee} position={[0, -0.37, 0]} rotation={[0.08, 0, 0]}><Part position={[0, -0.17, -0.015]} scale={[0.155, 0.34, 0.18]} color={palette.pants} cloth /><Part position={[0, -0.02, 0.1]} scale={[0.14, 0.16, 0.055]} color="#383b32" /><Part position={[0, -0.31, 0.035]} scale={[0.17, 0.2, 0.3]} color="#33332d" /><Part position={[0, -0.405, 0.035]} scale={[0.18, 0.035, 0.31]} color="#1f2420" />{[0, 1, 2].map(i => <Part key={i} position={[0, -0.25 - i * 0.035, 0.18]} scale={[0.1, 0.01, 0.012]} color="#94856e" />)}</group>
      <Part position={[side * 0.1, -0.18, 0.025]} scale={[0.045, 0.16, 0.14]} color={palette.pack} cloth />
    </group>)}
    <group ref={chest} position={[0, 1, 0]}>
      <Part position={[0, 0.24, 0]} scale={[0.42, 0.49, 0.255]} color={palette.jacket} cloth torso />
      <Part position={[0, 0.25, 0.14]} scale={[0.32, 0.35, 0.06]} color={palette.vest} cloth />
      <Part position={[0, 0.42, 0.16]} scale={[0.1, 0.06, 0.015]} color="#b7ae8a" />
      {!infected && <><Part position={[0, 0.27, -0.23]} scale={[0.32, 0.44, 0.23]} color={palette.pack} cloth /><Part position={[0, 0.22, -0.36]} scale={[0.25, 0.24, 0.05]} color={palette.vest} cloth />{[-1, 1].map(side => <group key={side}><Part position={[side * 0.125, 0.28, 0.18]} scale={[0.04, 0.4, 0.025]} color={palette.pack} /><Part position={[side * 0.095, 0.14, 0.205]} scale={[0.1, 0.12, 0.055]} color={palette.pack} cloth /><Part position={[side * 0.125, 0.35, -0.1]} rotation={[0.3 * side, 0, 0]} scale={[0.045, 0.33, 0.2]} color={palette.vest} /></group>)}<Part position={[-0.23, 0.1, -0.22]} scale={[0.09, 0.24, 0.09]} color="#75807a" metal /></>}
      {[-1, 1].map(side => <group key={side} ref={side === -1 ? leftArm : rightArm} position={[side * 0.255, 0.42, 0]} rotation={[0, 0, side * 0.08]}>
        <Part position={[0, -0.14, 0]} scale={[0.15, 0.32, 0.18]} color={palette.jacket} cloth />
        <group position={[0, -0.29, 0]} rotation={[-0.6, 0, 0]}><Part position={[0, -0.12, 0]} scale={[0.115, 0.27, 0.14]} color={palette.jacket} cloth /><Part position={[0, -0.265, 0.015]} scale={[0.1, 0.12, 0.12]} color={infected ? skin : '#3a3c32'} />{!infected && side === 1 && <group position={[0, -0.29, 0.12]} rotation={[Math.PI / 2, 0, 0]}><Sidearm /></group>}</group>
      </group>)}
      <Part position={[0, 0.5, 0.01]} scale={[0.12, 0.13, 0.12]} color={skin} torso />
      <group ref={head} position={[0, 0.69, 0.01]} userData={infected ? { hitZone: 'head' } : {}}>
        <mesh scale={[0.105, 0.14, 0.105]} castShadow><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color={skin} roughness={0.65} /></mesh>
        <Part position={[0, -0.055, 0.015]} scale={[0.15, 0.11, 0.16]} color={skin} />
        <Part position={[0, 0.005, 0.112]} scale={[0.035, 0.055, 0.04]} color={skin} />
        {[-1, 1].map(side => <group key={side}><Part position={[side * 0.108, -0.015, 0]} scale={[0.025, 0.06, 0.04]} color={skin} /><Part position={[side * 0.044, 0.025, 0.092]} scale={[0.042, 0.016, 0.015]} color={infected ? '#c9bd90' : '#d4d1bb'} /><Part position={[side * 0.044, 0.025, 0.103]} scale={[0.015, 0.015, 0.006]} color="#303a33" /><Part position={[side * 0.044, 0.045, 0.095]} rotation={[0, 0, side * 0.09]} scale={[0.05, 0.012, 0.012]} color="#4a3c30" /></group>)}
        <Part position={[0, -0.06, 0.097]} scale={[0.061, 0.012, 0.012]} color="#745448" />
        <mesh position={[0, 0.075, -0.017]} scale={[0.11, 0.085, 0.1]} castShadow><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={infected ? '#474b3c' : '#3c352c'} roughness={1} /></mesh>
        {!infected && <><Part position={[0, -0.09, 0.065]} scale={[0.12, 0.045, 0.085]} color="#5d4b3a" /><Part position={[0, 0.092, 0.01]} scale={[0.23, 0.035, 0.22]} color={palette.vest} cloth /><Part position={[0, 0.09, 0.115]} scale={[0.19, 0.018, 0.09]} color={palette.vest} /></>}
      </group>
    </group>
  </group>
})

export function Sidearm() {
  return <group>
    <mesh position={[0, 0, 0]} castShadow><boxGeometry args={[0.045, 0.055, 0.22]} /><meshStandardMaterial color="#58615f" metalness={0.85} roughness={0.32} /></mesh>
    <mesh position={[0, -0.028, 0.015]}><boxGeometry args={[0.043, 0.025, 0.18]} /><meshStandardMaterial color="#262d2c" roughness={0.6} /></mesh>
    <mesh position={[0, -0.085, 0.06]} rotation={[-0.18, 0, 0]}><boxGeometry args={[0.04, 0.12, 0.065]} /><meshStandardMaterial color="#363a30" roughness={0.95} /></mesh>
    <mesh position={[0, 0, -0.113]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#0c1414" metalness={0.9} roughness={0.25} /></mesh>
    {[-1, 1].map(side => <group key={side}>{Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[side * 0.023, 0, 0.045 + i * 0.006]}><boxGeometry args={[0.002, 0.045, 0.002]} /><meshStandardMaterial color="#222b2b" /></mesh>)}<mesh position={[side * 0.017, 0.033, 0.07]}><boxGeometry args={[0.008, 0.013, 0.02]} /><meshStandardMaterial color="#212b26" /></mesh></group>)}
    <mesh position={[0, 0.031, -0.08]}><boxGeometry args={[0.008, 0.015, 0.012]} /><meshStandardMaterial color="#bdc7a5" /></mesh>
    <mesh position={[0, -0.06, 0.007]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.025, 0.004, 5, 12]} /><meshStandardMaterial color="#303a37" metalness={0.65} /></mesh>
  </group>
}
export function ViewHands({ outfit, aiming, motion, kick }: { outfit: Outfit; aiming: boolean; motion: React.RefObject<Motion>; kick: React.RefObject<number> }) {
  const rig = useRef<THREE.Group>(null), flash = useRef<THREE.Mesh>(null), time = useRef(0), reloadTime = useRef(0)
  useFrame((_, dt) => {
    const m = motion.current
    if (m.active) { time.current += Math.min(dt, 0.05); reloadTime.current = m.reloading ? reloadTime.current + Math.min(dt, 0.05) : 0 }
    if (!rig.current) return
    const reload = m.reloading ? Math.sin(Math.min(1, reloadTime.current / 1.5) * Math.PI) : 0
    rig.current.position.set(aiming ? 0 : 0.2 + Math.sin(time.current * 8) * m.speed * 0.0007, (aiming ? -0.034 : -0.19) - reload * 0.19, -0.42 + kick.current * 0.6)
    rig.current.rotation.set(-reload * 0.65, -reload * 0.45, reload * 0.28)
    if (flash.current) flash.current.visible = kick.current > 0.03
  })
  return <group ref={rig}>
    <Sidearm />
    <mesh ref={flash} position={[0, 0, -0.15]} visible={false}><octahedronGeometry args={[0.05]} /><meshBasicMaterial color="#ffd49a" toneMapped={false} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 0.035, -0.09, 0.08]} rotation={[0.25, side * -0.18, side * -0.08]}>
      <mesh scale={[0.045, 0.065, 0.06]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#404438" roughness={0.9} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[side * -0.035, 0.025 - i * 0.02, -0.015]}><capsuleGeometry args={[0.009, 0.035, 3, 6]} /><meshStandardMaterial color="#555846" roughness={0.95} /></mesh>)}
      <mesh position={[side * 0.03, -0.11, 0.1]} rotation={[-0.6, 0, side * -0.2]}><capsuleGeometry args={[0.055, 0.28, 5, 12]} /><meshStandardMaterial color={OUTFITS[outfit].jacket} roughness={0.95} /></mesh>
      <mesh position={[0, -0.055, 0.015]}><cylinderGeometry args={[0.047, 0.05, 0.03, 12]} /><meshStandardMaterial color="#77735c" /></mesh>
    </group>)}
  </group>
}
