'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Crosshair, Heart, Droplets, Utensils, Radiation, Zap, Clock3, Eye, EyeOff, Volume2, VolumeX, RotateCcw, Shield, Package, Target } from 'lucide-react'

type Stats = { health: number; stamina: number; hunger: number; thirst: number; radiation: number; ammo: number; kills: number }
const INITIAL: Stats = { health: 86, stamina: 78, hunger: 69, thirst: 58, radiation: 8, ammo: 12, kills: 0 }
type WorldProps = { perspective: boolean; onStats: React.Dispatch<React.SetStateAction<Stats>>; onMessage: (message: string) => void }

function Player({ perspective, onStats, positionTracker }: { perspective: boolean; onStats: WorldProps['onStats']; positionTracker: React.RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const heading = useRef(0)
  const pitch = useRef(0)
  const velocity = useRef(0)
  const jumpVelocity = useRef(0)
  const elapsed = useRef(0)
  useEffect(() => {
    const down = (event: KeyboardEvent) => { keys.current[event.code] = true }
    const up = (event: KeyboardEvent) => { keys.current[event.code] = false }
    const move = (event: MouseEvent) => { if (document.pointerLockElement) { heading.current -= event.movementX * 0.002; pitch.current = THREE.MathUtils.clamp(pitch.current + event.movementY * 0.0015, -0.7, 0.65) } }
    const click = (event: MouseEvent) => { const canvas = document.querySelector('canvas'); if (canvas && event.target === canvas && document.pointerLockElement !== canvas) canvas.requestPointerLock?.() }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('mousemove', move); window.addEventListener('click', click)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('mousemove', move); window.removeEventListener('click', click); if (document.pointerLockElement) document.exitPointerLock() }
  }, [])
  useFrame((_, delta) => {
    if (!group.current) return
    const dt = Math.min(delta, 0.05); elapsed.current += dt
    const forward = Number(keys.current.KeyW || keys.current.ArrowUp) - Number(keys.current.KeyS || keys.current.ArrowDown)
    const side = Number(keys.current.KeyD || keys.current.ArrowRight) - Number(keys.current.KeyA || keys.current.ArrowLeft)
    const moving = forward !== 0 || side !== 0; const sprint = keys.current.ShiftLeft || keys.current.ShiftRight
    const pace = sprint ? 7.1 : 4.1
    const dirX = Math.sin(heading.current), dirZ = Math.cos(heading.current)
    group.current.position.x += (dirX * forward + Math.cos(heading.current) * side) * pace * dt
    group.current.position.z += (dirZ * forward - Math.sin(heading.current) * side) * pace * dt
    group.current.position.x = THREE.MathUtils.clamp(group.current.position.x, -48, 48); group.current.position.z = THREE.MathUtils.clamp(group.current.position.z, -48, 48)
    if (keys.current.Space && group.current.position.y <= 0.02) jumpVelocity.current = 5.6
    jumpVelocity.current -= 13 * dt; group.current.position.y = Math.max(0, group.current.position.y + jumpVelocity.current * dt); if (group.current.position.y === 0) jumpVelocity.current = 0
    group.current.rotation.y = heading.current
    positionTracker.current.copy(group.current.position)
    const destination = perspective ? new THREE.Vector3(group.current.position.x, group.current.position.y + 1.52, group.current.position.z) : new THREE.Vector3(group.current.position.x - dirX * 5.8, group.current.position.y + 2.7, group.current.position.z - dirZ * 5.8)
    camera.position.lerp(destination, 1 - Math.exp(-7 * dt))
    camera.rotation.set(pitch.current + (perspective ? 0 : 0.22), heading.current + Math.PI, 0, 'YXZ')
    if (Math.floor(elapsed.current) !== Math.floor(elapsed.current - dt)) onStats(prev => ({ ...prev, stamina: Math.max(0, Math.min(100, prev.stamina + (moving && sprint ? -3.8 : 1.5))), hunger: Math.max(0, prev.hunger - 0.035), thirst: Math.max(0, prev.thirst - (moving && sprint ? 0.08 : 0.025)) }))
  })
  return <><group ref={group}><mesh position={[0, 0.88, 0]} castShadow><capsuleGeometry args={[0.34, 0.78, 5, 8]} /><meshStandardMaterial color="#827b68" roughness={1} /></mesh><mesh position={[0, 1.58, 0]} castShadow><sphereGeometry args={[0.25, 8, 6]} /><meshStandardMaterial color="#b6a68b" /></mesh><mesh position={[0.42, 0.85, 0.2]} rotation={[0, 0, -0.2]} castShadow><boxGeometry args={[0.1, 0.78, 0.11]} /><meshStandardMaterial color="#a87541" /></mesh></group></>
}

function House({ position, color, seed, facing = 0 }: { position: [number, number, number]; color: string; seed: number; facing?: number }) {
  const lean = seed % 2 ? 0.035 : -0.025
  const boards = seed % 3 === 0 ? [-1.82, -1.48, -1.14] : [-1.64, -1.3]
  return <group position={position} rotation={[0, facing + lean, 0]}><mesh position={[0, 1.05, 0]} castShadow receiveShadow><boxGeometry args={[5.5, 2.8, 4.5]} /><meshStandardMaterial color={color} roughness={1} /></mesh><mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.1, 1.65, 4]} /><meshStandardMaterial color={seed % 2 ? '#393c35' : '#45463d'} roughness={1} /></mesh><mesh position={[2.15, 1.55, -1.45]} castShadow><boxGeometry args={[0.72, 1.9, 0.72]} /><meshStandardMaterial color="#51483b" /></mesh><mesh position={[-1.5, 1.25, 2.27]}><boxGeometry args={[0.95, 0.95, 0.08]} /><meshStandardMaterial color="#242b29" emissive="#c17538" emissiveIntensity={0.12} /></mesh><mesh position={[0.25, 0.72, 2.31]}><boxGeometry args={[0.92, 1.48, 0.12]} /><meshStandardMaterial color="#504535" /></mesh><mesh position={[0.85, 0.7, 2.38]}><boxGeometry args={[0.08, 0.08, 0.06]} /><meshStandardMaterial color="#b7a179" /></mesh><mesh position={[1.65, 1.25, 2.27]}><boxGeometry args={[0.95, 0.95, 0.08]} /><meshStandardMaterial color="#29312d" /></mesh>{boards.map((x, i) => <mesh key={x} position={[x, 1.25 + (i % 2) * 0.22, 2.34]} rotation={[0, 0, i % 2 ? -0.1 : 0.08]}><boxGeometry args={[0.08, 1.28, 0.12]} /><meshStandardMaterial color="#765e42" /></mesh>)}<mesh position={[0.25, 0.03, 2.6]} castShadow><boxGeometry args={[1.5, 0.14, 0.95]} /><meshStandardMaterial color="#66583f" /></mesh><mesh position={[-1.15, 0.04, 2.45]} rotation={[0.1, 0.2, -0.35]}><boxGeometry args={[1.2, 0.11, 0.62]} /><meshStandardMaterial color="#7b6646" /></mesh></group>
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) { return <group position={position} scale={scale}><mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[0.15, 0.27, 2.6, 6]} /><meshStandardMaterial color="#51483a" /></mesh><mesh position={[0, 3, 0]} castShadow><icosahedronGeometry args={[1.25, 1]} /><meshStandardMaterial color="#354435" flatShading /></mesh><mesh position={[0.5, 3.45, -0.1]} castShadow><icosahedronGeometry args={[0.78, 1]} /><meshStandardMaterial color="#46533e" flatShading /></mesh></group> }

function Car({ position, color }: { position: [number, number, number]; color: string }) { return <group position={position} rotation={[0, -0.18, 0]}><mesh position={[0, 0.58, 0]} castShadow><boxGeometry args={[3.2, 0.85, 1.55]} /><meshStandardMaterial color={color} metalness={0.3} roughness={0.8} /></mesh><mesh position={[-0.22, 1.1, 0]} castShadow><boxGeometry args={[1.65, 0.62, 1.35]} /><meshStandardMaterial color="#464e49" roughness={1} /></mesh>{[-1, 1].map(x => [-0.57, 0.57].map(z => <mesh key={`${x}-${z}`} position={[x, 0.28, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.32, 0.32, 0.18, 8]} /><meshStandardMaterial color="#171918" /></mesh>))}</group> }

function YardFence({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) { return <group position={position} rotation={[0, rotation, 0]}>{Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[(i - 3) * 0.55, 0.62, 0]} rotation={[0, 0, i % 3 === 0 ? 0.08 : 0]} castShadow><boxGeometry args={[0.1, 1.25 - (i % 3) * 0.12, 0.13]} /><meshStandardMaterial color={i % 2 ? '#635941' : '#766348'} roughness={1} /></mesh>)}<mesh position={[0, 0.78, 0]}><boxGeometry args={[4.1, 0.12, 0.12]} /><meshStandardMaterial color="#504936" /></mesh><mesh position={[0, 0.38, 0]}><boxGeometry args={[4.1, 0.1, 0.1]} /><meshStandardMaterial color="#504936" /></mesh></group> }

function WaterTower({ position }: { position: [number, number, number] }) { return <group position={position}><mesh position={[0, 4.3, 0]}><cylinderGeometry args={[0.13, 0.2, 8.6, 6]} /><meshStandardMaterial color="#4d493e" /></mesh>{[-1, 1].map(x => [-1, 1].map(z => <mesh key={`${x}-${z}`} position={[x * 1.2, 4.2, z * 1.2]} rotation={[0, 0, x * 0.18]}><cylinderGeometry args={[0.09, 0.13, 8.2, 5]} /><meshStandardMaterial color="#514b3e" /></mesh>))}<mesh position={[0, 9, 0]} castShadow><cylinderGeometry args={[2.9, 2.35, 2.9, 8]} /><meshStandardMaterial color="#62685a" metalness={0.4} roughness={0.8} /></mesh><mesh position={[0, 10.55, 0]}><coneGeometry args={[3, 0.6, 8]} /><meshStandardMaterial color="#494b42" /></mesh><mesh position={[0, 9, 2.42]}><boxGeometry args={[1.1, 0.42, 0.08]} /><meshStandardMaterial color="#a48953" /></mesh></group> }

function PowerPole({ position }: { position: [number, number, number] }) { return <group position={position}><mesh position={[0, 4, 0]} castShadow><cylinderGeometry args={[0.13, 0.19, 8, 5]} /><meshStandardMaterial color="#4b4438" roughness={1} /></mesh><mesh position={[0, 7.15, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.09, 2.4, 5]} /><meshStandardMaterial color="#51483a" /></mesh>{[-0.8, 0, 0.8].map((x, i) => <mesh key={i} position={[x, 7.42, 0]}><cylinderGeometry args={[0.06, 0.08, 0.48, 5]} /><meshStandardMaterial color="#393b36" /></mesh>)}</group> }

function StreetLamp({ position, broken = false }: { position: [number, number, number]; broken?: boolean }) { return <group position={position}><mesh position={[0, 2.5, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 5, 6]} /><meshStandardMaterial color="#343833" metalness={0.6} roughness={0.8} /></mesh><mesh position={[broken ? 0.2 : 0, 5, 0]} rotation={[0, 0, broken ? -0.28 : 0]}><boxGeometry args={[0.85, 0.12, 0.16]} /><meshStandardMaterial color="#393d37" /></mesh><mesh position={[broken ? 0.48 : 0, 4.92, 0]}><sphereGeometry args={[0.14, 6, 5]} /><meshStandardMaterial color={broken ? '#565348' : '#d4b975'} emissive={broken ? '#000000' : '#c89345'} emissiveIntensity={broken ? 0 : 0.35} /></mesh></group> }

function Mailbox({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) { return <group position={position} rotation={[0, rotation, 0]}><mesh position={[0, 0.85, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, 1.7, 5]} /><meshStandardMaterial color="#514b3e" /></mesh><mesh position={[0, 1.55, 0]} castShadow><boxGeometry args={[0.55, 0.38, 0.4]} /><meshStandardMaterial color="#796b52" metalness={0.25} /></mesh><mesh position={[0, 1.52, 0.21]}><boxGeometry args={[0.22, 0.025, 0.012]} /><meshStandardMaterial color="#272b25" /></mesh></group> }

function Debris({ position, rotation = 0, seed = 0 }: { position: [number, number, number]; rotation?: number; seed?: number }) { const color = ['#514e43', '#77705a', '#403f37', '#66583f'][seed % 4]; return <group position={position} rotation={[0, rotation, 0]}><mesh position={[0, 0.12, 0]} rotation={[0.1, 0.2, 0.25]} castShadow><boxGeometry args={[0.9, 0.22, 0.72]} /><meshStandardMaterial color={color} roughness={1} /></mesh><mesh position={[0.62, 0.08, -0.18]} rotation={[0, 0.4, 0.16]}><boxGeometry args={[0.45, 0.14, 0.32]} /><meshStandardMaterial color="#393a33" /></mesh><mesh position={[-0.48, 0.05, 0.27]} rotation={[0, -0.7, 0]}><boxGeometry args={[0.48, 0.1, 0.2]} /><meshStandardMaterial color="#827052" /></mesh></group> }

function GrassClump({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) { return <group position={position} scale={scale}>{[0, 1, 2, 3].map(i => <mesh key={i} position={[(i - 1.5) * 0.09, 0.28 + (i % 2) * 0.08, 0]} rotation={[0, 0, (i - 1.5) * 0.18]}><coneGeometry args={[0.12, 0.68, 4]} /><meshStandardMaterial color={i % 2 ? '#64704a' : '#7b8051'} flatShading /></mesh>)}</group> }

function Barrel({ position }: { position: [number, number, number] }) { return <group position={position}><mesh position={[0, 0.48, 0]} castShadow><cylinderGeometry args={[0.38, 0.4, 0.95, 8]} /><meshStandardMaterial color="#6b5237" metalness={0.45} roughness={0.75} /></mesh><mesh position={[0, 0.22, 0]}><torusGeometry args={[0.39, 0.035, 4, 8]} /><meshStandardMaterial color="#383a34" metalness={0.65} /></mesh><mesh position={[0, 0.76, 0]}><torusGeometry args={[0.38, 0.035, 4, 8]} /><meshStandardMaterial color="#383a34" metalness={0.65} /></mesh></group> }

function Zombie({ position, index, onStats, playerPosition }: { position: [number, number, number]; index: number; onStats: WorldProps['onStats']; playerPosition: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null); const phase = useRef(index * 1.4); const lastAttack = useRef(0)
  const outfit = ['#596457', '#5c4b43', '#67644c', '#454e4b'][index % 4]
  useFrame((_, delta) => {
    if (!ref.current || !ref.current.visible) return
    const dt = Math.min(delta, 0.05); phase.current += dt
    const dx = playerPosition.current.x - ref.current.position.x; const dz = playerPosition.current.z - ref.current.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 13 && distance > 1.3) { ref.current.position.x += dx / distance * dt * 0.58; ref.current.position.z += dz / distance * dt * 0.58; ref.current.rotation.y = Math.atan2(dx, dz) }
    else if (distance >= 13) { ref.current.position.x = position[0] + Math.sin(phase.current * 0.45 + index) * 1.8; ref.current.position.z = position[2] + Math.cos(phase.current * 0.34 + index) * 1.4; ref.current.rotation.y = Math.sin(phase.current * 0.45 + index) * 0.3 }
    if (distance < 1.6 && phase.current - lastAttack.current > 3.2) { lastAttack.current = phase.current; onStats(s => ({ ...s, health: Math.max(0, s.health - 4) })) }
    ref.current.position.y = Math.abs(Math.sin(phase.current * 3.3)) * (distance < 13 ? 0.025 : 0.012)
  })
  return <group ref={ref} userData={{ infected: true }} position={position}><mesh position={[0, 0.84, 0]} castShadow><capsuleGeometry args={[0.36, 0.76, 4, 7]} /><meshStandardMaterial color={outfit} roughness={1} /></mesh><mesh position={[0, 1.49, 0]} castShadow><sphereGeometry args={[0.26, 7, 6]} /><meshStandardMaterial color="#91a17c" /></mesh><mesh position={[0.1, 1.52, 0.23]}><sphereGeometry args={[0.06, 6, 5]} /><meshBasicMaterial color="#d54e35" /></mesh><mesh position={[-0.47, 0.86, 0.13]} rotation={[0, 0, -0.24]} castShadow><capsuleGeometry args={[0.11, 0.65, 3, 5]} /><meshStandardMaterial color={outfit} /></mesh><mesh position={[0.47, 0.88, 0.08]} rotation={[0, 0, 0.28]} castShadow><capsuleGeometry args={[0.11, 0.64, 3, 5]} /><meshStandardMaterial color={outfit} /></mesh><mesh position={[-0.19, 0.12, 0]} castShadow><capsuleGeometry args={[0.13, 0.45, 3, 5]} /><meshStandardMaterial color="#383a32" /></mesh><mesh position={[0.19, 0.12, 0]} castShadow><capsuleGeometry args={[0.13, 0.45, 3, 5]} /><meshStandardMaterial color="#383a32" /></mesh></group>
}

function World({ perspective, onStats, onMessage }: WorldProps) {
  const timeRef = useRef(0.32); const daylight = useRef<THREE.DirectionalLight>(null)
  const { camera, scene } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const zombieHealth = useRef(new WeakMap<THREE.Object3D, number>())
  useEffect(() => {
    const handleAttack = (event: Event) => {
      const ranged = (event as CustomEvent<{ ranged: boolean }>).detail.ranged
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
      const intersections = raycaster.intersectObjects(scene.children, true)
      const hit = intersections.find(intersection => {
        let node: THREE.Object3D | null = intersection.object
        while (node) { if (node.userData.infected) return true; node = node.parent }
        return false
      })
      let target: THREE.Object3D | null = hit?.object ?? null
      while (target && !target.userData.infected) target = target.parent
      if (!target || (!ranged && (hit?.distance ?? Infinity) > 2.8) || (ranged && (hit?.distance ?? Infinity) > 36)) { onMessage('NO INFECTED IN YOUR SIGHTS'); return }
      const health = (zombieHealth.current.get(target) ?? 1) - 1
      zombieHealth.current.set(target, health)
      if (health <= 0) { target.visible = false; onStats(value => ({ ...value, kills: value.kills + 1 })); onMessage(ranged ? 'TARGET DOWN  ·  +1 INFECTED' : 'INFECTED ELIMINATED') }
      else onMessage('HIT CONFIRMED  ·  KEEP GOING')
    }
    window.addEventListener('deadzone-attack', handleAttack)
    return () => window.removeEventListener('deadzone-attack', handleAttack)
  }, [camera, onMessage, onStats, raycaster, scene])
  const playerPosition = useRef(new THREE.Vector3())
  const houses = useMemo(() => [[-17, 0, -25], [17, 0, -24], [-20, 0, -9], [21, 0, -7], [-8.5, 0, 14], [8.5, 0, 16], [-9, 0, 32], [9, 0, 34], [-36, 0, -1], [36, 0, 2]].map(([x, y, z], i) => ({ position: [x, y, z] as [number, number, number], color: ['#817c68', '#8c8169', '#6f776d', '#8a7561'][i % 4], seed: i, facing: z > 0 ? Math.PI : 0 })), [])
  const trees = useMemo(() => Array.from({ length: 46 }, (_, i) => { const angle = i * 2.399; const radius = 14 + (i * 13 % 37); return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], scale: 0.7 + i % 4 * 0.15 } }), [])
  const grasses = useMemo(() => Array.from({ length: 112 }, (_, i) => { const angle = i * 2.41; const radius = 6 + (i * 17 % 41); return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], scale: 0.55 + i % 5 * 0.14 } }), [])
  const debris = useMemo(() => Array.from({ length: 42 }, (_, i) => { const angle = i * 2.17; const radius = 5 + (i * 11 % 38); return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], rotation: i * 0.73, seed: i } }), [])
  const zombies = useMemo(() => [[6, 0, 12], [-7, 0, 15], [12, 0, 7], [-20, 0, -13], [28, 0, 20], [-31, 0, 19], [31, 0, -25], [-35, 0, -22], [8, 0, 33], [42, 0, -8]] as [number, number, number][], [])
  const lamps = useMemo(() => [[-5.2, 0, -36], [5.2, 0, -14], [-5.2, 0, 12], [5.2, 0, 36]] as [number, number, number][], [])
  const mailboxes = useMemo(() => [[-13, 0, -22], [13, 0, -21], [-16, 0, -6], [17, 0, -4], [-14, 0, 13], [14, 0, 15], [-13, 0, 31], [14, 0, 32]] as [number, number, number][], [])
  const barrels = useMemo(() => [[-7.5, 0, -18], [8, 0, -23], [-8, 0, 9], [8, 0, 17], [-30, 0, -3], [30, 0, 4]] as [number, number, number][], [])
  const poles = useMemo(() => [-40, -14, 14, 40].flatMap(z => [[-8, 0, z], [8, 0, z]] as [number, number, number][]), [])
  useFrame((_, dt) => { timeRef.current = (timeRef.current + dt * 0.002) % 1; if (daylight.current) daylight.current.intensity = 0.12 + Math.max(0, Math.sin(timeRef.current * Math.PI * 2)) * 1.3 })
  return <><fog attach="fog" args={['#99a18b', 28, 92]} /><ambientLight intensity={0.55} /><directionalLight ref={daylight} position={[15, 20, 10]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#626850" roughness={1} /></mesh>
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6.2, 110]} /><meshStandardMaterial color="#55554b" roughness={1} /></mesh><mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.13, 110]} /><meshStandardMaterial color="#b39b67" /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 4.1, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.25, 110]} /><meshStandardMaterial color="#777766" roughness={1} /></mesh>)}
    {houses.map((h, i) => <House key={i} {...h} />)}{trees.map((t, i) => <Tree key={i} {...t} />)}{grasses.map((g, i) => <GrassClump key={`grass-${i}`} {...g} />)}{debris.map((d, i) => <Debris key={`debris-${i}`} {...d} />)}
    {houses.slice(0, 8).map((h, i) => <YardFence key={`fence-${i}`} position={[h.position[0] + (i % 2 ? 2.5 : -2.5), 0, h.position[2] + 3.1]} rotation={i % 2 ? -0.08 : 0.08} />)}
    {lamps.map((p, i) => <StreetLamp key={`lamp-${i}`} position={p} broken={i !== 1} />)}
    {mailboxes.map((p, i) => <Mailbox key={`mail-${i}`} position={p} rotation={i % 2 ? -0.15 : 0.12} />)}
    {barrels.map((p, i) => <Barrel key={`barrel-${i}`} position={p} />)}
    {poles.map((p, i) => <PowerPole key={`pole-${i}`} position={p} />)}
    <Line points={[[-8, 7.45, -40], [-8, 6.8, -14], [-8, 6.8, 14], [-8, 7.45, 40]]} color="#292d2b" lineWidth={1} /><Line points={[[8, 7.45, -40], [8, 6.8, -14], [8, 6.8, 14], [8, 7.45, 40]]} color="#292d2b" lineWidth={1} />
    <WaterTower position={[39, 0, -39]} />
    <Car position={[-5.1, 0, 4.5]} color="#82574a" /><Car position={[8.5, 0, -2.6]} color="#6d766e" /><Car position={[-8, 0, 22]} color="#6e634c" /><Car position={[10, 0, -27]} color="#674f47" /><Car position={[31, 0, 7]} color="#797365" />
    {[[-2.7, 0.03, -17], [2.8, 0.03, -8], [-2.4, 0.03, 21], [2.3, 0.03, 31], [-3, 0.03, 39]].map((p, i) => <mesh key={`road-crack-${i}`} position={p as [number, number, number]} rotation={[0, 0, i % 2 ? 0.3 : -0.18]}><boxGeometry args={[0.12, 0.02, 2.7]} /><meshStandardMaterial color="#262b28" /></mesh>)}
    {zombies.map((z, i) => <Zombie key={i} position={z} index={i} onStats={onStats} playerPosition={playerPosition} />)}
    <Player perspective={perspective} onStats={onStats} positionTracker={playerPosition} />
  </>
}

function WastelandFallback() {
  const trees = [{ left: '3%', scale: 1.25 }, { left: '25%', scale: 0.82 }, { left: '74%', scale: 0.9 }, { left: '92%', scale: 1.2 }]
  const infected = [{ left: '43%', scale: 0.74 }, { left: '53%', scale: 0.86 }, { left: '64%', scale: 0.66 }]
  return <div className="scene-fallback" aria-hidden="true"><div className="scene-sky" /><div className="scene-ridge scene-ridge-back" /><div className="scene-ridge scene-ridge-front" /><div className="scene-ground" /><div className="scene-road"><i /><b /><b /><b /></div><div className="scene-home scene-home-left"><i /><b /><em /><span /></div><div className="scene-home scene-home-right"><i /><b /><em /><span /></div>{trees.map((tree, i) => <div className="scene-tree" key={i} style={{ left: tree.left, transform: `scale(${tree.scale})` }}><i /><b /></div>)}<div className="scene-car scene-car-left"><i /><b /></div><div className="scene-car scene-car-right"><i /><b /></div><div className="scene-pole scene-pole-left"><i /><b /></div><div className="scene-pole scene-pole-right"><i /><b /></div><div className="scene-wire" /><div className="scene-tower"><i /><b /></div>{infected.map((zombie, i) => <div className="scene-zombie" key={i} style={{ left: zombie.left, transform: `scale(${zombie.scale})` }}><i /><b /><em /><span /></div>)}<div className="scene-haze" /></div>
}

type SceneBoundaryState = { failed: boolean }
class SceneBoundary extends Component<{ children: React.ReactNode }, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }
  static getDerivedStateFromError(): SceneBoundaryState { return { failed: true } }
  render() { return this.state.failed ? <WastelandFallback /> : this.props.children }
}

function Meter({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: typeof Heart }) { return <div className="meter"><div className="meter-label"><span><Icon size={13} strokeWidth={2.2} />{label}</span><b>{Math.round(value)}%</b></div><div className="meter-track"><div className="meter-fill" style={{ width: `${value}%`, backgroundColor: color }} /></div></div> }

export default function Game() {
  const [stats, setStats] = useState<Stats>(INITIAL); const [perspective, setPerspective] = useState(false); const [time, setTime] = useState(8.25); const [message, setMessage] = useState(''); const [sound, setSound] = useState(true); const [targeting, setTargeting] = useState(false)
  const [materials, setMaterials] = useState(14); const [gameDay, setGameDay] = useState(3); const [graphicsAvailable, setGraphicsAvailable] = useState(false)
  useEffect(() => {
    const probe = document.createElement('canvas')
    let context: WebGLRenderingContext | WebGL2RenderingContext | null = null
    try { context = probe.getContext('webgl2') ?? probe.getContext('webgl') } catch { context = null }
    const available = context !== null
    setGraphicsAvailable(available)
  }, [])
  const addMessage = useCallback((text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 2400) }, [])
  useEffect(() => { try { const saved = localStorage.getItem('deadzone-save'); if (saved) { const data = JSON.parse(saved); if (data.stats) setStats({ ...INITIAL, ...data.stats }); if (typeof data.materials === 'number') setMaterials(data.materials); if (typeof data.gameDay === 'number') setGameDay(data.gameDay) } } catch { /* Invalid save data is ignored. */ } }, [])
  useEffect(() => { const id = window.setInterval(() => { setTime(t => { const next = (t + 0.008) % 24; if (next < t) setGameDay(d => d + 1); return next }) }, 1000); return () => window.clearInterval(id) }, [])
  useEffect(() => { try { localStorage.setItem('deadzone-save', JSON.stringify({ stats, materials, gameDay })) } catch { /* Storage may be unavailable in private browsing. */ } }, [stats, materials, gameDay])
  const attack = (ranged: boolean) => { if (ranged && !stats.ammo) { addMessage('OUT OF AMMO — find a supply cache'); return } if (ranged) setStats(s => ({ ...s, ammo: s.ammo - 1 })); window.dispatchEvent(new CustomEvent('deadzone-attack', { detail: { ranged } })) }
  const reset = () => { setStats(INITIAL); setMaterials(14); setGameDay(3); addMessage('Survival record restored') }
  useEffect(() => {
    const handleAction = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return
      if (event.code === 'KeyQ') setTargeting(value => !value)
      if (event.code === 'KeyF') attack(false)
      if (event.code === 'KeyE') { setMaterials(value => value + 1); addMessage('Scrap recovered  ·  +1 component') }
      if (event.code === 'KeyV') setPerspective(value => !value)
    }
    window.addEventListener('keydown', handleAction)
    return () => window.removeEventListener('keydown', handleAction)
  })
  const hour = Math.floor(time); const minute = Math.floor((time % 1) * 60); const clock = `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
  return <main className="game-shell"><div className="world-canvas"><WastelandFallback />{graphicsAvailable && <SceneBoundary><Canvas className="scene-canvas" shadows dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}><Suspense fallback={null}><World perspective={perspective} onStats={setStats} onMessage={addMessage} /></Suspense></Canvas></SceneBoundary>}</div>
    <div className="vignette" aria-hidden="true" />
    <header className="topbar"><div className="brand"><div className="brand-mark">D<span>Z</span></div><div><div className="brand-name">DEADZONE <span>PROTOCOL</span></div><div className="brand-sub">SOUTHERN DISTRICT · SECTOR 04</div></div></div><div className="top-status"><div className="status-live"><i /> LIVE WORLD</div><div className="status-divider" /><div className="day-counter">DAY <b>{String(gameDay).padStart(2, '0')}</b><span> / 07</span></div><div className="clock"><Clock3 size={14} />{clock}</div><button className="icon-button" onClick={() => setSound(!sound)} aria-label={sound ? 'Mute sound' : 'Enable sound'}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button></div></header>
    <section className="mission-card"><div className="eyebrow"><span className="eyebrow-mark" /> CURRENT OBJECTIVE</div><h1>THE QUIET<br />BEFORE</h1><p>Scavenge the neighborhood.<br />The dead are always listening.</p><div className="mission-line" /><div className="mission-meta"><span><Shield size={13} /> SAFE ZONE</span><span className="danger"><i /> THREAT: LOW</span></div></section>
    <div className="location-chip"><span className="location-dot" /> MAPLEWOOD ESTATES <span className="coords">N 34° / W 117°</span></div>
    <section className="survival-panel"><div className="panel-heading"><span>SURVIVAL STATUS</span><button onClick={reset} aria-label="Reset save" title="Reset survival save"><RotateCcw size={13} /></button></div><Meter label="HEALTH" value={stats.health} color="#c45a48" icon={Heart} /><Meter label="STAMINA" value={stats.stamina} color="#d5b864" icon={Zap} /><Meter label="HUNGER" value={stats.hunger} color="#b98353" icon={Utensils} /><Meter label="THIRST" value={stats.thirst} color="#6ea7a0" icon={Droplets} /><Meter label="RADIATION" value={stats.radiation} color="#9bba62" icon={Radiation} /></section>
    <div className="crosshair" aria-hidden="true"><span /><span /><i /></div>
    {message && <div className="toast" role="status">{message}</div>}
    {targeting && <div className="target-overlay"><div className="target-dialog"><div className="eyebrow">TACTICAL TARGETING · AP 68</div><h2>Choose your shot</h2><p>Target analysis ready. Select a zone to queue the attack.</p><div className="target-choices"><button onClick={() => { attack(true); setTargeting(false) }}><Target size={15} /> HEAD <b>72%</b></button><button onClick={() => { attack(true); setTargeting(false) }}><Target size={15} /> TORSO <b>88%</b></button><button onClick={() => { attack(true); setTargeting(false) }}><Target size={15} /> LIMBS <b>64%</b></button></div><button className="cancel-target" onClick={() => setTargeting(false)}>ESC · CANCEL</button></div></div>}
    <div className="center-bottom"><div className="weapon-card"><div className="weapon-icon"><Crosshair size={19} /></div><div className="weapon-info"><span>PRIMARY WEAPON</span><b>SCAVENGED 9MM</b></div><div className="ammo"><strong>{String(stats.ammo).padStart(2, '0')}</strong><span>/ 48</span><span className="ammo-label">AMMO</span></div></div><div className="quick-slots"><button className="quick-slot active" onClick={() => setPerspective(p => !p)} aria-label="Toggle camera view"><span>{perspective ? <EyeOff size={17} /> : <Eye size={17} />}</span><b>VIEW</b><small>V</small></button><button className="quick-slot" onClick={() => attack(false)} aria-label="Melee attack"><span className="melee-icon">╱</span><b>MELEE</b><small>F</small></button><button className="quick-slot" onClick={() => attack(true)} aria-label="Fire weapon"><span><Crosshair size={16} /></span><b>FIRE</b><small>CLICK</small></button><button className="quick-slot" onClick={() => setTargeting(true)} aria-label="Tactical targeting"><span><Target size={17} /></span><b>V.A.T.S.</b><small>Q</small></button></div></div>
    <div className="resource-chip"><Package size={14} /><span>SCRAP</span><b>{String(materials).padStart(2, '0')}</b><span className="chip-separator" /><span>INFECTED</span><b>{String(Math.max(0, 10 - stats.kills)).padStart(2, '0')}</b></div>
    <div className="controls-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>MOUSE</kbd> LOOK</span></div>
    <div className="corner-mark">DZ<span> / </span>04.17.27</div>
  </main>
}
