'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { advanceClock, blocked, HOUSE_POSITIONS, isHorde, isNight, MAGAZINE, movementAxes, OBSTACLES, reloadAmmo, type Clock, type Obstacle } from './survival'
import { Crosshair, Heart, Droplets, Utensils, Zap, Clock3, Eye, EyeOff, Shield } from 'lucide-react'

type Stats = { health: number; stamina: number; hunger: number; thirst: number; ammo: number; reserve: number; kills: number }
type LootKind = 'ration' | 'water' | 'bandage' | 'ammo' | 'scrap'
type LootDrop = { kind: LootKind; amount: number }
type Inventory = { ration: number; water: number; bandage: number; scrap: number }
const INITIAL: Stats = { health: 86, stamina: 78, hunger: 69, thirst: 58, ammo: 12, reserve: 48, kills: 0 }
const INITIAL_INVENTORY: Inventory = { ration: 1, water: 1, bandage: 1, scrap: 14 }
type WorldProps = { perspective: boolean; stats: Stats; clock: Clock; active: boolean; aiming: boolean; onStats: React.Dispatch<React.SetStateAction<Stats>>; onMessage: (message: string) => void; onLoot: (loot: LootDrop) => void }

function Player({ perspective, onStats, positionTracker, obstacles, stats, active, aiming }: Pick<WorldProps, 'perspective' | 'onStats' | 'stats' | 'active' | 'aiming'> & { positionTracker: React.RefObject<THREE.Vector3>; obstacles: React.RefObject<Obstacle[]> }) {
  const group = useRef<THREE.Group>(null)
  const weapon = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null), kick = useRef(0)
  const { camera, gl, scene } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const heading = useRef(0), pitch = useRef(0), jumpVelocity = useRef(0), elapsed = useRef(0)
  const cameraRay = useMemo(() => new THREE.Raycaster(), [])
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault(); keys.current[event.code] = true }
    const up = (event: KeyboardEvent) => { keys.current[event.code] = false }
    const clear = () => { keys.current = {} }
    const move = (event: MouseEvent) => { if (active && document.pointerLockElement === gl.domElement) { heading.current -= event.movementX * 0.002; pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0015, -1.1, 1.1) } }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('mousemove', move); window.addEventListener('blur', clear); document.addEventListener('pointerlockchange', clear)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('mousemove', move); window.removeEventListener('blur', clear); document.removeEventListener('pointerlockchange', clear) }
  }, [active, gl])
  useEffect(() => {
    const shot = (e: Event) => { if ((e as CustomEvent<{ ranged: boolean }>).detail.ranged) kick.current = 0.045 }
    window.addEventListener('deadzone-attack', shot)
    return () => window.removeEventListener('deadzone-attack', shot)
  }, [])
  useFrame((_, delta) => {
    if (!group.current) return
    const dt = Math.min(delta, 0.05)
    const { forward, side } = movementAxes(active ? keys.current : {})
    const moving = forward !== 0 || side !== 0
    const sprint = moving && !aiming && stats.stamina > 5 && (keys.current.ShiftLeft || keys.current.ShiftRight)
    const pace = aiming ? 2 : sprint ? 7.1 : 4.1
    const dirX = Math.sin(heading.current), dirZ = Math.cos(heading.current)
    const norm = Math.max(1, Math.hypot(forward, side))
    const nextX = group.current.position.x + (dirX * forward - Math.cos(heading.current) * side) / norm * pace * dt
    const nextZ = group.current.position.z + (dirZ * forward + Math.sin(heading.current) * side) / norm * pace * dt
    if (!blocked(nextX, group.current.position.z, obstacles.current)) group.current.position.x = nextX
    if (!blocked(group.current.position.x, nextZ, obstacles.current)) group.current.position.z = nextZ
    if (active) {
      if (keys.current.Space && group.current.position.y <= 0.02 && stats.stamina > 8) { jumpVelocity.current = 5.6; onStats(s => ({ ...s, stamina: Math.max(0, s.stamina - 8) })) }
      jumpVelocity.current -= 13 * dt; group.current.position.y = Math.max(0, group.current.position.y + jumpVelocity.current * dt); if (group.current.position.y === 0) jumpVelocity.current = 0
      elapsed.current += dt
      if (elapsed.current >= 1) { elapsed.current = 0; onStats(prev => ({ ...prev, stamina: THREE.MathUtils.clamp(prev.stamina + (sprint ? -9 : 6), 0, 100), hunger: Math.max(0, prev.hunger - 0.09), thirst: Math.max(0, prev.thirst - (sprint ? 0.2 : 0.12)), health: Math.max(0, prev.health - (prev.hunger <= 0 || prev.thirst <= 0 ? 2 : 0)) })) }
    }
    group.current.rotation.y = heading.current
    positionTracker.current.copy(group.current.position)
    const eye = group.current.position.clone().add(new THREE.Vector3(0, 1.62, 0))
    const destination = perspective ? eye.clone() : eye.clone().add(new THREE.Vector3(-dirX * (aiming ? 2.8 : 4.8), 1, -dirZ * (aiming ? 2.8 : 4.8)))
    if (!perspective) {
      const offset = destination.clone().sub(eye)
      cameraRay.set(eye, offset.clone().normalize()); cameraRay.far = offset.length()
      const obstruction = cameraRay.intersectObjects(scene.children, true).find(hit => hit.object.userData.cameraSolid && hit.object.visible)
      if (obstruction) destination.copy(eye).addScaledVector(offset.normalize(), Math.max(0.25, obstruction.distance - 0.25))
    }
    camera.position.copy(destination)
    kick.current = Math.max(0, kick.current - dt * 0.25)
    if (flash.current) flash.current.visible = kick.current > 0.03
    camera.rotation.set(pitch.current + kick.current - (perspective ? 0 : 0.16), heading.current + Math.PI, 0, 'YXZ')
    if (camera instanceof THREE.PerspectiveCamera) { camera.fov = THREE.MathUtils.lerp(camera.fov, aiming ? 48 : 70, 1 - Math.exp(-12 * dt)); camera.updateProjectionMatrix() }
    if (weapon.current) { weapon.current.position.copy(camera.position); weapon.current.quaternion.copy(camera.quaternion) }
  })
  return <><group ref={group} userData={{ player: true }}><group visible={!perspective}><mesh position={[0, 0.9, 0]} castShadow><capsuleGeometry args={[0.3, 0.65, 5, 8]} /><meshStandardMaterial color="#58604b" /></mesh><mesh position={[0, 1.58, 0]} castShadow><sphereGeometry args={[0.23, 8, 6]} /><meshStandardMaterial color="#b6a68b" /></mesh><mesh position={[0, 1.08, -0.27]} castShadow><boxGeometry args={[0.5, 0.65, 0.25]} /><meshStandardMaterial color="#393c31" /></mesh>{[-1, 1].map(side => <mesh key={side} position={[side * 0.18, 0.25, 0]} castShadow><boxGeometry args={[0.2, 0.5, 0.24]} /><meshStandardMaterial color="#34392e" /></mesh>)}<mesh position={[0.34, 1.15, 0.4]} castShadow><boxGeometry args={[0.12, 0.16, 0.65]} /><meshStandardMaterial color="#272d2c" metalness={0.6} roughness={0.4} /></mesh></group></group><group ref={weapon} visible={perspective} userData={{ viewWeapon: true }}><group position={[aiming ? 0 : 0.24, -0.23, -0.46]}><mesh ref={flash} position={[0, 0, -0.24]} visible={false}><octahedronGeometry args={[0.075]} /><meshBasicMaterial color="#ffcf72" /></mesh><mesh><boxGeometry args={[0.09, 0.11, 0.36]} /><meshStandardMaterial color="#343d3b" metalness={0.65} roughness={0.3} /></mesh><mesh position={[0, -0.1, 0.09]} rotation={[-0.2, 0, 0]}><boxGeometry args={[0.08, 0.18, 0.1]} /><meshStandardMaterial color="#4e493a" /></mesh><mesh position={[0, 0.07, -0.13]}><boxGeometry args={[0.025, 0.035, 0.03]} /><meshStandardMaterial color="#c1b77f" /></mesh><mesh position={[0, -0.15, 0.2]}><boxGeometry args={[0.12, 0.1, 0.35]} /><meshStandardMaterial color="#7e8161" /></mesh></group></group></>
}

function House({ position, color, seed, facing = 0 }: { position: [number, number, number]; color: string; seed: number; facing?: number }) {
  const lean = seed % 2 ? 0.035 : -0.025
  const boards = seed % 3 === 0 ? [-1.82, -1.48, -1.14] : [-1.64, -1.3]
  return <group position={position} rotation={[0, facing + lean, 0]}><mesh userData={{ cameraSolid: true }} position={[0, 1.05, 0]} castShadow receiveShadow><boxGeometry args={[5.5, 2.8, 4.5]} /><meshStandardMaterial color={color} roughness={1} /></mesh><mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.1, 1.65, 4]} /><meshStandardMaterial color={seed % 2 ? '#393c35' : '#45463d'} roughness={1} /></mesh><mesh position={[2.15, 1.55, -1.45]} castShadow><boxGeometry args={[0.72, 1.9, 0.72]} /><meshStandardMaterial color="#51483b" /></mesh><mesh position={[-1.5, 1.25, 2.27]}><boxGeometry args={[0.95, 0.95, 0.08]} /><meshStandardMaterial color="#242b29" emissive="#c17538" emissiveIntensity={0.12} /></mesh><mesh position={[0.25, 0.72, 2.31]}><boxGeometry args={[0.92, 1.48, 0.12]} /><meshStandardMaterial color="#504535" /></mesh><mesh position={[0.85, 0.7, 2.38]}><boxGeometry args={[0.08, 0.08, 0.06]} /><meshStandardMaterial color="#b7a179" /></mesh><mesh position={[1.65, 1.25, 2.27]}><boxGeometry args={[0.95, 0.95, 0.08]} /><meshStandardMaterial color="#29312d" /></mesh>{boards.map((x, i) => <mesh key={x} position={[x, 1.25 + (i % 2) * 0.22, 2.34]} rotation={[0, 0, i % 2 ? -0.1 : 0.08]}><boxGeometry args={[0.08, 1.28, 0.12]} /><meshStandardMaterial color="#765e42" /></mesh>)}<mesh position={[0.25, 0.03, 2.6]} castShadow><boxGeometry args={[1.5, 0.14, 0.95]} /><meshStandardMaterial color="#66583f" /></mesh><mesh position={[-1.15, 0.04, 2.45]} rotation={[0.1, 0.2, -0.35]}><boxGeometry args={[1.2, 0.11, 0.62]} /><meshStandardMaterial color="#7b6646" /></mesh></group>
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) { return <group position={position} scale={scale}><mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[0.15, 0.27, 2.6, 6]} /><meshStandardMaterial color="#51483a" /></mesh><mesh position={[0, 3, 0]} castShadow><icosahedronGeometry args={[1.25, 1]} /><meshStandardMaterial color="#354435" flatShading /></mesh><mesh position={[0.5, 3.45, -0.1]} castShadow><icosahedronGeometry args={[0.78, 1]} /><meshStandardMaterial color="#46533e" flatShading /></mesh></group> }

function Car({ position, color }: { position: [number, number, number]; color: string }) { return <group position={position} rotation={[0, -0.18, 0]}><mesh userData={{ cameraSolid: true }} position={[0, 0.58, 0]} castShadow><boxGeometry args={[3.2, 0.85, 1.55]} /><meshStandardMaterial color={color} metalness={0.3} roughness={0.8} /></mesh><mesh position={[-0.22, 1.1, 0]} castShadow><boxGeometry args={[1.65, 0.62, 1.35]} /><meshStandardMaterial color="#464e49" roughness={1} /></mesh>{[-1, 1].map(x => [-0.57, 0.57].map(z => <mesh key={`${x}-${z}`} position={[x, 0.28, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.32, 0.32, 0.18, 8]} /><meshStandardMaterial color="#171918" /></mesh>))}</group> }

function YardFence({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) { return <group position={position} rotation={[0, rotation, 0]}>{Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[(i - 3) * 0.55, 0.62, 0]} rotation={[0, 0, i % 3 === 0 ? 0.08 : 0]} castShadow><boxGeometry args={[0.1, 1.25 - (i % 3) * 0.12, 0.13]} /><meshStandardMaterial color={i % 2 ? '#635941' : '#766348'} roughness={1} /></mesh>)}<mesh position={[0, 0.78, 0]}><boxGeometry args={[4.1, 0.12, 0.12]} /><meshStandardMaterial color="#504936" /></mesh><mesh position={[0, 0.38, 0]}><boxGeometry args={[4.1, 0.1, 0.1]} /><meshStandardMaterial color="#504936" /></mesh></group> }

function WaterTower({ position }: { position: [number, number, number] }) { return <group position={position}><mesh position={[0, 4.3, 0]}><cylinderGeometry args={[0.13, 0.2, 8.6, 6]} /><meshStandardMaterial color="#4d493e" /></mesh>{[-1, 1].map(x => [-1, 1].map(z => <mesh key={`${x}-${z}`} position={[x * 1.2, 4.2, z * 1.2]} rotation={[0, 0, x * 0.18]}><cylinderGeometry args={[0.09, 0.13, 8.2, 5]} /><meshStandardMaterial color="#514b3e" /></mesh>))}<mesh position={[0, 9, 0]} castShadow><cylinderGeometry args={[2.9, 2.35, 2.9, 8]} /><meshStandardMaterial color="#62685a" metalness={0.4} roughness={0.8} /></mesh><mesh position={[0, 10.55, 0]}><coneGeometry args={[3, 0.6, 8]} /><meshStandardMaterial color="#494b42" /></mesh><mesh position={[0, 9, 2.42]}><boxGeometry args={[1.1, 0.42, 0.08]} /><meshStandardMaterial color="#a48953" /></mesh></group> }

function PowerPole({ position }: { position: [number, number, number] }) { return <group position={position}><mesh position={[0, 4, 0]} castShadow><cylinderGeometry args={[0.13, 0.19, 8, 5]} /><meshStandardMaterial color="#4b4438" roughness={1} /></mesh><mesh position={[0, 7.15, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.09, 2.4, 5]} /><meshStandardMaterial color="#51483a" /></mesh>{[-0.8, 0, 0.8].map((x, i) => <mesh key={i} position={[x, 7.42, 0]}><cylinderGeometry args={[0.06, 0.08, 0.48, 5]} /><meshStandardMaterial color="#393b36" /></mesh>)}</group> }

function StreetLamp({ position, broken = false }: { position: [number, number, number]; broken?: boolean }) { return <group position={position}><mesh position={[0, 2.5, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 5, 6]} /><meshStandardMaterial color="#343833" metalness={0.6} roughness={0.8} /></mesh><mesh position={[broken ? 0.2 : 0, 5, 0]} rotation={[0, 0, broken ? -0.28 : 0]}><boxGeometry args={[0.85, 0.12, 0.16]} /><meshStandardMaterial color="#393d37" /></mesh><mesh position={[broken ? 0.48 : 0, 4.92, 0]}><sphereGeometry args={[0.14, 6, 5]} /><meshStandardMaterial color={broken ? '#565348' : '#d4b975'} emissive={broken ? '#000000' : '#c89345'} emissiveIntensity={broken ? 0 : 0.35} /></mesh></group> }

function Mailbox({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) { return <group position={position} rotation={[0, rotation, 0]}><mesh position={[0, 0.85, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, 1.7, 5]} /><meshStandardMaterial color="#514b3e" /></mesh><mesh position={[0, 1.55, 0]} castShadow><boxGeometry args={[0.55, 0.38, 0.4]} /><meshStandardMaterial color="#796b52" metalness={0.25} /></mesh><mesh position={[0, 1.52, 0.21]}><boxGeometry args={[0.22, 0.025, 0.012]} /><meshStandardMaterial color="#272b25" /></mesh></group> }

function Debris({ position, rotation = 0, seed = 0 }: { position: [number, number, number]; rotation?: number; seed?: number }) { const color = ['#514e43', '#77705a', '#403f37', '#66583f'][seed % 4]; return <group position={position} rotation={[0, rotation, 0]}><mesh position={[0, 0.12, 0]} rotation={[0.1, 0.2, 0.25]} castShadow><boxGeometry args={[0.9, 0.22, 0.72]} /><meshStandardMaterial color={color} roughness={1} /></mesh><mesh position={[0.62, 0.08, -0.18]} rotation={[0, 0.4, 0.16]}><boxGeometry args={[0.45, 0.14, 0.32]} /><meshStandardMaterial color="#393a33" /></mesh><mesh position={[-0.48, 0.05, 0.27]} rotation={[0, -0.7, 0]}><boxGeometry args={[0.48, 0.1, 0.2]} /><meshStandardMaterial color="#827052" /></mesh></group> }

function GrassClump({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) { return <group position={position} scale={scale}>{[0, 1, 2, 3].map(i => <mesh key={i} position={[(i - 1.5) * 0.09, 0.28 + (i % 2) * 0.08, 0]} rotation={[0, 0, (i - 1.5) * 0.18]}><coneGeometry args={[0.12, 0.68, 4]} /><meshStandardMaterial color={i % 2 ? '#64704a' : '#7b8051'} flatShading /></mesh>)}</group> }

function Barrel({ position }: { position: [number, number, number] }) { return <group position={position}><mesh position={[0, 0.48, 0]} castShadow><cylinderGeometry args={[0.38, 0.4, 0.95, 8]} /><meshStandardMaterial color="#6b5237" metalness={0.45} roughness={0.75} /></mesh><mesh position={[0, 0.22, 0]}><torusGeometry args={[0.39, 0.035, 4, 8]} /><meshStandardMaterial color="#383a34" metalness={0.65} /></mesh><mesh position={[0, 0.76, 0]}><torusGeometry args={[0.38, 0.035, 4, 8]} /><meshStandardMaterial color="#383a34" metalness={0.65} /></mesh></group> }

function LootContainer({ position, loot, variant = 0 }: { position: [number, number, number]; loot: LootDrop; variant?: number }) {
  const colors: Record<LootKind, string> = { ration: '#9e7948', water: '#648b88', bandage: '#9d8b74', ammo: '#7b7655', scrap: '#706957' }
  return <group position={position} userData={{ lootCache: loot }}><mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[0.9, 0.72, 0.72]} /><meshStandardMaterial color={colors[loot.kind]} roughness={0.92} /></mesh><mesh position={[0, 0.82, 0]} rotation={[0, variant % 2 ? 0.06 : -0.04, 0]} castShadow><boxGeometry args={[0.98, 0.12, 0.8]} /><meshStandardMaterial color="#514b3e" metalness={0.2} /></mesh><mesh position={[0, 0.43, 0.37]}><boxGeometry args={[0.28, 0.18, 0.03]} /><meshStandardMaterial color="#c6b37a" emissive="#a98a4f" emissiveIntensity={0.12} /></mesh><mesh position={[0, 1.05, 0]}><octahedronGeometry args={[0.13, 0]} /><meshBasicMaterial color="#d7bf72" /></mesh></group>
}

function Zombie({ position, index, onStats, playerPosition, active, clock, obstacles, barriers }: { active: boolean; clock: Clock; obstacles: React.RefObject<Obstacle[]>; barriers: React.RefObject<Barrier[]>; position: [number, number, number]; index: number; onStats: WorldProps['onStats']; playerPosition: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null); const phase = useRef(index * 1.4); const lastAttack = useRef(0)
  const outfit = ['#596457', '#5c4b43', '#67644c', '#454e4b'][index % 4]
  useFrame((_, delta) => {
    if (!active || !ref.current || !ref.current.visible) return
    const dt = Math.min(delta, 0.05); phase.current += dt
    const dx = playerPosition.current.x - ref.current.position.x; const dz = playerPosition.current.z - ref.current.position.z
    const distance = Math.hypot(dx, dz)
    const horde = isHorde(clock), night = isNight(clock.hour), alert = horde ? 100 : night ? 24 : 16
    const speed = horde ? 2.3 : night ? 1.25 : 0.75
    if (distance < alert && distance > 1.3) {
      const x = ref.current.position.x, z = ref.current.position.z
      const nx = x + dx / distance * dt * speed, nz = z + dz / distance * dt * speed
      if (!blocked(nx, z, obstacles.current, 0.3)) ref.current.position.x = nx
      if (!blocked(ref.current.position.x, nz, obstacles.current, 0.3)) ref.current.position.z = nz
      ref.current.rotation.y = Math.atan2(dx, dz)
      const barrier = barriers.current.find(b => b.hp > 0 && Math.hypot(b.x - x, b.z - z) < 2)
      if (barrier && phase.current - lastAttack.current > 1) { lastAttack.current = phase.current; barrier.hp = Math.max(0, barrier.hp - (horde ? 20 : 10)); if (!barrier.hp) { barrier.mesh.visible = false; obstacles.current = obstacles.current.filter(o => o !== barrier.obstacle) } }
    }
    if (distance < 1.7 && phase.current - lastAttack.current > 1.3) { lastAttack.current = phase.current; onStats(s => ({ ...s, health: Math.max(0, s.health - (horde ? 12 : 7)) })) }
    ref.current.position.y = Math.abs(Math.sin(phase.current * 3.3)) * (distance < 13 ? 0.025 : 0.012)
  })
  return <group ref={ref} userData={{ infected: true }} position={position}><mesh position={[0, 0.84, 0]} castShadow><capsuleGeometry args={[0.36, 0.76, 4, 7]} /><meshStandardMaterial color={outfit} roughness={1} /></mesh><mesh position={[0, 1.49, 0]} castShadow><sphereGeometry args={[0.26, 7, 6]} /><meshStandardMaterial color="#91a17c" /></mesh><mesh position={[0.1, 1.52, 0.23]}><sphereGeometry args={[0.06, 6, 5]} /><meshBasicMaterial color="#d54e35" /></mesh><mesh position={[-0.47, 0.86, 0.13]} rotation={[0, 0, -0.24]} castShadow><capsuleGeometry args={[0.11, 0.65, 3, 5]} /><meshStandardMaterial color={outfit} /></mesh><mesh position={[0.47, 0.88, 0.08]} rotation={[0, 0, 0.28]} castShadow><capsuleGeometry args={[0.11, 0.64, 3, 5]} /><meshStandardMaterial color={outfit} /></mesh><mesh position={[-0.19, 0.12, 0]} castShadow><capsuleGeometry args={[0.13, 0.45, 3, 5]} /><meshStandardMaterial color="#383a32" /></mesh><mesh position={[0.19, 0.12, 0]} castShadow><capsuleGeometry args={[0.13, 0.45, 3, 5]} /><meshStandardMaterial color="#383a32" /></mesh></group>
}

type Barrier = { x: number; z: number; hp: number; mesh: THREE.Mesh; obstacle: Obstacle }

function World({ perspective, onStats, onMessage, onLoot, stats, clock, active, aiming }: WorldProps) {
  const obstacles = useRef([...OBSTACLES]); const barriers = useRef<Barrier[]>([])
  const daylight = useRef<THREE.DirectionalLight>(null)
  const { camera, scene } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const zombieHealth = useRef(new WeakMap<THREE.Object3D, number>())
  const playerPosition = useRef(new THREE.Vector3())
  useEffect(() => {
    const handleAttack = (event: Event) => {
      if (!active) return
      const ranged = (event as CustomEvent<{ ranged: boolean }>).detail.ranged
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
      const hit = raycaster.intersectObjects(scene.children, true).find(intersection => {
        let node: THREE.Object3D | null = intersection.object
        while (node) { if (!node.visible || node.userData.player || node.userData.viewWeapon) return false; node = node.parent }
        return true
      })
      let target: THREE.Object3D | null = hit?.object ?? null
      while (target && !target.userData.infected) target = target.parent
      if (!target || (!ranged && target.position.distanceTo(playerPosition.current) > 3) || (ranged && (hit?.distance ?? Infinity) > 36)) { onMessage('NO INFECTED IN YOUR SIGHTS'); return }
      const health = (zombieHealth.current.get(target) ?? 3) - (ranged ? 2 : 1)
      zombieHealth.current.set(target, health)
      if (health <= 0) { target.visible = false; onStats(value => ({ ...value, kills: value.kills + 1 })); onMessage(ranged ? 'TARGET DOWN  ·  +1 INFECTED' : 'INFECTED ELIMINATED') }
      else onMessage('HIT CONFIRMED  ·  KEEP GOING')
    }
    window.addEventListener('deadzone-attack', handleAttack)
    return () => window.removeEventListener('deadzone-attack', handleAttack)
  }, [active, camera, onMessage, onStats, raycaster, scene])
  useEffect(() => {
    const handleInteract = () => {
      if (!active) return
      let nearest: { target: THREE.Object3D; loot: LootDrop; distance: number } | null = null
      scene.traverse(object => {
        const loot = object.userData.lootCache as LootDrop | undefined
        if (!loot || !object.visible) return
        const distance = object.getWorldPosition(new THREE.Vector3()).distanceTo(playerPosition.current)
        if (distance < 3.2 && (!nearest || distance < nearest.distance)) nearest = { target: object, loot, distance }
      })
      if (!nearest) { onMessage('MOVE CLOSER TO A SUPPLY CACHE'); return }
      const cache = nearest as { target: THREE.Object3D; loot: LootDrop; distance: number }
      cache.target.visible = false
      onLoot(cache.loot)
      onMessage(`SCAVENGED ${cache.loot.amount} ${cache.loot.kind.toUpperCase()}`)
    }
    window.addEventListener('deadzone-interact', handleInteract)
    return () => window.removeEventListener('deadzone-interact', handleInteract)
  }, [active, onLoot, onMessage, scene])
  useEffect(() => {
    const build = () => {
      if (!active) return
      const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize()
      const x = Math.round(playerPosition.current.x + forward.x * 3), z = Math.round(playerPosition.current.z + forward.z * 3)
      if (blocked(x, z, obstacles.current, 1.6) || barriers.current.filter(b => b.hp > 0).length >= 12) { onMessage('NEED OPEN GROUND · MAX 12 BARRICADES'); return }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1), new THREE.MeshStandardMaterial({ color: '#856542', roughness: 1 }))
      mesh.position.set(x, 0.7, z); mesh.castShadow = true; mesh.userData.cameraSolid = true; scene.add(mesh)
      const obstacle = { x, z, halfX: 1, halfZ: 0.5 }; obstacles.current.push(obstacle); barriers.current.push({ x, z, hp: 100, mesh, obstacle })
      window.dispatchEvent(new Event('deadzone-built')); onMessage('BARRICADE PLACED · 100 HP · -4 SCRAP')
    }
    window.addEventListener('deadzone-build', build)
    return () => window.removeEventListener('deadzone-build', build)
  }, [active, camera, onMessage, scene])
  useEffect(() => () => { barriers.current.forEach(b => { scene.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose() }) }, [scene])
  const houses = useMemo(() => HOUSE_POSITIONS.map(([x, z], i) => ({ position: [x, 0, z] as [number, number, number], color: ['#817c68', '#8c8169', '#6f776d', '#8a7561'][i % 4], seed: i, facing: z > 0 ? Math.PI : 0 })), [])
  const trees = useMemo(() => Array.from({ length: 46 }, (_, i) => { const angle = i * 2.399; const radius = 14 + (i * 13 % 37); return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], scale: 0.7 + i % 4 * 0.15 } }), [])
  const grasses = useMemo(() => Array.from({ length: 112 }, (_, i) => { const angle = i * 2.41; const radius = 6 + (i * 17 % 41); return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], scale: 0.55 + i % 5 * 0.14 } }), [])
  const debris = useMemo(() => Array.from({ length: 42 }, (_, i) => { const angle = i * 2.17; const radius = 5 + (i * 11 % 38); return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number], rotation: i * 0.73, seed: i } }), [])
  const zombies = useMemo(() => [[6, 0, 12], [-7, 0, 15], [12, 0, 7], [-20, 0, -13], [28, 0, 20], [-31, 0, 19], [31, 0, -25], [-35, 0, -22], [8, 0, 33], [42, 0, -8]] as [number, number, number][], [])
  const lamps = useMemo(() => [[-5.2, 0, -36], [5.2, 0, -14], [-5.2, 0, 12], [5.2, 0, 36]] as [number, number, number][], [])
  const mailboxes = useMemo(() => [[-13, 0, -22], [13, 0, -21], [-16, 0, -6], [17, 0, -4], [-14, 0, 13], [14, 0, 15], [-13, 0, 31], [14, 0, 32]] as [number, number, number][], [])
  const barrels = useMemo(() => [[-7.5, 0, -18], [8, 0, -23], [-8, 0, 9], [8, 0, 17], [-30, 0, -3], [30, 0, 4]] as [number, number, number][], [])
  const poles = useMemo(() => [-40, -14, 14, 40].flatMap(z => [[-8, 0, z], [8, 0, z]] as [number, number, number][]), [])
  const lootCaches = useMemo(() => [
    { position: [0, 0, 4.5] as [number, number, number], loot: { kind: 'ration', amount: 2 } as LootDrop },
    { position: [-14, 0, 13] as [number, number, number], loot: { kind: 'water', amount: 1 } as LootDrop },
    { position: [12, 0, 25] as [number, number, number], loot: { kind: 'bandage', amount: 1 } as LootDrop },
    { position: [-26, 0, 4] as [number, number, number], loot: { kind: 'ammo', amount: 18 } as LootDrop },
    { position: [28, 0, -12] as [number, number, number], loot: { kind: 'scrap', amount: 4 } as LootDrop },
  ], [])
  const night = isNight(clock.hour), horde = isHorde(clock)
  const lootCycle = clock.hour >= 6 ? clock.day : clock.day - 1
  useFrame(() => { if (daylight.current) daylight.current.intensity = night ? 0.18 : 1.2 })
  return <><color attach="background" args={[night ? '#18232b' : '#99a18b']} /><fog attach="fog" args={[horde ? '#452c2c' : night ? '#18232b' : '#99a18b', 18, night ? 55 : 92]} /><ambientLight intensity={night ? 0.35 : 0.65} /><hemisphereLight args={['#abbcd4', '#33352b', night ? 0.5 : 0.8]} /><directionalLight ref={daylight} position={[15, 20, 10]} castShadow shadow-mapSize={[1024, 1024]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#626850" roughness={1} /></mesh>
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6.2, 110]} /><meshStandardMaterial color="#55554b" roughness={1} /></mesh><mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.13, 110]} /><meshStandardMaterial color="#b39b67" /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 4.1, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.25, 110]} /><meshStandardMaterial color="#777766" roughness={1} /></mesh>)}
    {houses.map((h, i) => <House key={i} {...h} />)}{trees.map((t, i) => <Tree key={i} {...t} />)}{grasses.map((g, i) => <GrassClump key={`grass-${i}`} {...g} />)}{debris.map((d, i) => <Debris key={`debris-${i}`} {...d} />)}
    {houses.slice(0, 8).map((h, i) => <YardFence key={`fence-${i}`} position={[h.position[0] + (i % 2 ? 2.5 : -2.5), 0, h.position[2] + 3.1]} rotation={i % 2 ? -0.08 : 0.08} />)}
    {lamps.map((p, i) => <StreetLamp key={`lamp-${i}`} position={p} broken={i !== 1} />)}
    {mailboxes.map((p, i) => <Mailbox key={`mail-${i}`} position={p} rotation={i % 2 ? -0.15 : 0.12} />)}
    {barrels.map((p, i) => <Barrel key={`barrel-${i}`} position={p} />)}
    {lootCaches.map((cache, i) => <LootContainer key={`cache-${lootCycle}-${i}`} position={cache.position} loot={cache.loot} variant={i} />)}
    {poles.map((p, i) => <PowerPole key={`pole-${i}`} position={p} />)}
    <Line points={[[-8, 7.45, -40], [-8, 6.8, -14], [-8, 6.8, 14], [-8, 7.45, 40]]} color="#292d2b" lineWidth={1} /><Line points={[[8, 7.45, -40], [8, 6.8, -14], [8, 6.8, 14], [8, 7.45, 40]]} color="#292d2b" lineWidth={1} />
    <WaterTower position={[39, 0, -39]} />
    <Car position={[-5.1, 0, 4.5]} color="#82574a" /><Car position={[8.5, 0, -2.6]} color="#6d766e" /><Car position={[-8, 0, 22]} color="#6e634c" /><Car position={[10, 0, -27]} color="#674f47" /><Car position={[31, 0, 7]} color="#797365" />
    {[[-2.7, 0.03, -17], [2.8, 0.03, -8], [-2.4, 0.03, 21], [2.3, 0.03, 31], [-3, 0.03, 39]].map((p, i) => <mesh key={`road-crack-${i}`} position={p as [number, number, number]} rotation={[0, 0, i % 2 ? 0.3 : -0.18]}><boxGeometry args={[0.12, 0.02, 2.7]} /><meshStandardMaterial color="#262b28" /></mesh>)}
    {[...zombies, ...(horde ? Array.from({ length: 18 }, (_, i) => [Math.sin(i * 2.4) * 43, 0, Math.cos(i * 2.4) * 43] as [number, number, number]) : [])].map((z, i) => <Zombie key={i} position={z} index={i} onStats={onStats} playerPosition={playerPosition} active={active} clock={clock} obstacles={obstacles} barriers={barriers} />)}
    <Player perspective={perspective} onStats={onStats} positionTracker={playerPosition} obstacles={obstacles} stats={stats} active={active} aiming={aiming} />
  </>
}

function WastelandFallback() {
  const trees = [{ left: '3%', scale: 1.25 }, { left: '25%', scale: 0.82 }, { left: '74%', scale: 0.9 }, { left: '92%', scale: 1.2 }]
  const infected = [{ left: '43%', scale: 0.74 }, { left: '53%', scale: 0.86 }, { left: '64%', scale: 0.66 }]
  return <div className="scene-fallback" aria-hidden="true"><div className="scene-sky" /><div className="scene-ridge scene-ridge-back" /><div className="scene-ridge scene-ridge-front" /><div className="scene-ground" /><div className="scene-road"><i /><b /><b /><b /></div><div className="scene-home scene-home-left"><i /><b /><em /><span /></div><div className="scene-home scene-home-right"><i /><b /><em /><span /></div>{trees.map((tree, i) => <div className="scene-tree" key={i} style={{ left: tree.left, transform: `scale(${tree.scale})` }}><i /><b /></div>)}<div className="scene-car scene-car-left"><i /><b /></div><div className="scene-car scene-car-right"><i /><b /></div><div className="scene-pole scene-pole-left"><i /><b /></div><div className="scene-pole scene-pole-right"><i /><b /></div><div className="scene-wire" /><div className="scene-tower"><i /><b /></div><div className="scene-cache scene-cache-left"><i /><b /></div><div className="scene-cache scene-cache-right"><i /><b /></div>{infected.map((zombie, i) => <div className="scene-zombie" key={i} style={{ left: zombie.left, transform: `scale(${zombie.scale})`, animationDelay: `${i * 0.42}s` }}><i /><b /><em /><span /></div>)}<div className="scene-haze" /></div>
}

type SceneBoundaryState = { failed: boolean }
class SceneBoundary extends Component<{ children: React.ReactNode; onFailure: () => void }, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }
  static getDerivedStateFromError(): SceneBoundaryState { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? <WastelandFallback /> : this.props.children }
}

function Meter({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: typeof Heart }) { return <div className="meter"><div className="meter-label"><span><Icon size={13} strokeWidth={2.2} />{label}</span><b>{Math.round(value)}%</b></div><div className="meter-track"><div className="meter-fill" style={{ width: `${value}%`, backgroundColor: color }} /></div></div> }

export default function Game() {
  const [stats, setStats] = useState<Stats>(INITIAL)
  const [inventory, setInventory] = useState<Inventory>(INITIAL_INVENTORY)
  const [perspective, setPerspective] = useState(true)
  const [clock, setClock] = useState<Clock>({ day: 1, hour: 8 })
  const [message, setMessage] = useState('')
  const [started, setStarted] = useState(false), [paused, setPaused] = useState(false)
  const [aiming, setAiming] = useState(false), [reloading, setReloading] = useState(false)
  const [session, setSession] = useState(0)
  const [graphicsAvailable, setGraphicsAvailable] = useState(false), [graphicsChecked, setGraphicsChecked] = useState(false), [sceneFailed, setSceneFailed] = useState(false)
  const stateRef = useRef({ stats, inventory, active: false, reloading })
  const reloadProgress = useRef(0), lastAttack = useRef(0), toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = started && !paused && stats.health > 0 && graphicsAvailable && !sceneFailed
  stateRef.current = { stats, inventory, active, reloading }
  const night = isNight(clock.hour), horde = isHorde(clock)
  useEffect(() => {
    const probe = document.createElement('canvas')
    let context: WebGLRenderingContext | WebGL2RenderingContext | null = null
    try { context = probe.getContext('webgl2') ?? probe.getContext('webgl') } catch { context = null }
    setGraphicsAvailable(context !== null); setGraphicsChecked(true)
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])
  const addMessage = useCallback((text: string) => { setMessage(text); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setMessage(''), 2600) }, [])
  const collectLoot = useCallback((loot: LootDrop) => {
    if (loot.kind === 'ammo') { setStats(state => ({ ...state, reserve: state.reserve + loot.amount })); return }
    const kind = loot.kind as keyof Inventory
    setInventory(state => ({ ...state, [kind]: state[kind] + loot.amount }))
  }, [])
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setClock(c => advanceClock(c, 0.1))
      if (reloadProgress.current > 0) {
        reloadProgress.current = Math.max(0, reloadProgress.current - 0.1)
        if (!reloadProgress.current) { setStats(s => ({ ...s, ...reloadAmmo(s.ammo, s.reserve) })); setReloading(false); addMessage('MAGAZINE READY') }
      }
    }, 100)
    return () => clearInterval(id)
  }, [active, addMessage])
  useEffect(() => {
    if (!active) { setAiming(false); if (document.pointerLockElement) document.exitPointerLock() }
  }, [active])
  const lockMouse = () => {
    const canvas = document.querySelector('canvas')
    const request = canvas?.requestPointerLock?.()
    request?.catch(() => addMessage('CLICK THE WORLD TO CAPTURE YOUR MOUSE'))
  }
  const start = (hordeDrill = false) => {
    setStats(INITIAL); setInventory(INITIAL_INVENTORY); setClock({ day: hordeDrill ? 7 : 1, hour: hordeDrill ? 21.5 : 8 }); setSession(v => v + 1)
    setStarted(true); setPaused(false); setReloading(false); reloadProgress.current = 0; lastAttack.current = 0
    lockMouse(); addMessage(hordeDrill ? 'HORDE DRILL · PREPARE BARRICADES NOW' : 'FIND THE GOLD SUPPLY MARKERS · E TO SEARCH')
  }
  const attack = useCallback((ranged: boolean) => {
    const state = stateRef.current
    if (!state.active || state.reloading) return
    const now = performance.now()
    if (now - lastAttack.current < (ranged ? 260 : 650)) return
    if (ranged && state.stats.ammo <= 0) { addMessage('MAGAZINE EMPTY · R TO RELOAD'); return }
    if (!ranged && state.stats.stamina < 10) { addMessage('NOT ENOUGH STAMINA'); return }
    lastAttack.current = now
    if (ranged) { state.stats = { ...state.stats, ammo: state.stats.ammo - 1 }; setStats(s => ({ ...s, ammo: Math.max(0, s.ammo - 1) })) }
    else setStats(s => ({ ...s, stamina: Math.max(0, s.stamina - 10) }))
    window.dispatchEvent(new CustomEvent('deadzone-attack', { detail: { ranged } }))
  }, [addMessage])
  const reload = useCallback(() => {
    const s = stateRef.current
    if (!s.active || s.reloading) return
    if (s.stats.ammo === MAGAZINE || s.stats.reserve === 0) { addMessage(s.stats.reserve === 0 ? 'NO RESERVE AMMO · SCAVENGE OR CRAFT' : 'MAGAZINE FULL'); return }
    s.reloading = true; reloadProgress.current = 1.5; setReloading(true); addMessage('RELOADING…')
  }, [addMessage])
  const consume = useCallback((kind: 'ration' | 'water' | 'bandage') => {
    const s = stateRef.current
    if (!s.active) return
    if (!s.inventory[kind]) { addMessage(`NO ${kind.toUpperCase()} LEFT`); return }
    s.inventory = { ...s.inventory, [kind]: s.inventory[kind] - 1 }
    setInventory(state => ({ ...state, [kind]: Math.max(0, state[kind] - 1) }))
    const field = kind === 'ration' ? 'hunger' : kind === 'water' ? 'thirst' : 'health'
    setStats(state => ({ ...state, [field]: Math.min(100, state[field] + (kind === 'ration' ? 36 : kind === 'water' ? 42 : 24)) }))
    addMessage(`${kind.toUpperCase()} USED · ${field.toUpperCase()} RESTORED`)
  }, [addMessage])
  const craft = useCallback((build: boolean) => {
    const s = stateRef.current, cost = build ? 4 : 3
    if (!s.active) return
    if (s.inventory.scrap < cost) { addMessage(`NEED ${cost} SCRAP · SEARCH THE NEIGHBORHOOD`); return }
    if (build) window.dispatchEvent(new Event('deadzone-build'))
    else { s.inventory = { ...s.inventory, scrap: s.inventory.scrap - cost }; setInventory(i => ({ ...i, scrap: i.scrap - cost })); setStats(v => ({ ...v, reserve: v.reserve + 6 })); addMessage('CRAFTED 6 ROUNDS · -3 SCRAP') }
  }, [addMessage])
  useEffect(() => {
    const built = () => { stateRef.current.inventory = { ...stateRef.current.inventory, scrap: stateRef.current.inventory.scrap - 4 }; setInventory(i => ({ ...i, scrap: i.scrap - 4 })) }
    const action = (e: KeyboardEvent) => {
      if (e.repeat || (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName))) return
      if (e.code === 'Escape' && started) { setPaused(true); return }
      if (!stateRef.current.active) return
      if (e.code === 'KeyV') setPerspective(v => !v)
      if (e.code === 'KeyR') reload()
      if (e.code === 'KeyF') attack(false)
      if (e.code === 'KeyE') window.dispatchEvent(new Event('deadzone-interact'))
      if (e.code === 'KeyB') craft(true)
      if (e.code === 'KeyC') craft(false)
      if (e.code === 'Digit1') consume('ration')
      if (e.code === 'Digit2') consume('water')
      if (e.code === 'Digit3') consume('bandage')
    }
    const mouse = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLCanvasElement) && !document.pointerLockElement) return
      if (!stateRef.current.active) return
      if (!document.pointerLockElement) { lockMouse(); return }
      if (e.button === 0) attack(true)
      if (e.button === 2) { e.preventDefault(); setAiming(true) }
    }
    const release = () => setAiming(false)
    const blur = () => { if (started) setPaused(true) }
    const unlocked = () => { if (!document.pointerLockElement && started) { setAiming(false); setPaused(true) } }
    window.addEventListener('keydown', action); window.addEventListener('mousedown', mouse); window.addEventListener('mouseup', release); window.addEventListener('blur', blur); window.addEventListener('deadzone-built', built); document.addEventListener('pointerlockchange', unlocked)
    return () => { window.removeEventListener('keydown', action); window.removeEventListener('mousedown', mouse); window.removeEventListener('mouseup', release); window.removeEventListener('blur', blur); window.removeEventListener('deadzone-built', built); document.removeEventListener('pointerlockchange', unlocked) }
  }, [attack, consume, craft, reload, started])
  const time = `${String(Math.floor(clock.hour)).padStart(2, '0')}:${String(Math.floor(clock.hour % 1 * 60)).padStart(2, '0')}`
  const unsupported = graphicsChecked && (!graphicsAvailable || sceneFailed)
  return <main className={`game-shell ${horde ? 'horde-active' : ''}`} onContextMenu={e => e.preventDefault()}>
    <div className="world-canvas"><WastelandFallback />{graphicsAvailable && <SceneBoundary onFailure={() => setSceneFailed(true)}><Canvas className="scene-canvas" shadows dpr={[1, 1.5]} gl={{ alpha: false, antialias: true }} camera={{ position: [0, 1.62, 0], fov: 70 }}><Suspense fallback={null}><World key={session} perspective={perspective} onStats={setStats} onMessage={addMessage} onLoot={collectLoot} stats={stats} clock={clock} active={active} aiming={aiming} /></Suspense></Canvas></SceneBoundary>}</div>
    <div className="vignette" aria-hidden="true" />
    <header className="topbar"><div className="brand"><div className="brand-mark">D<span>Z</span></div><div><div className="brand-name">DEADZONE <span>PROTOCOL</span></div><div className="brand-sub">SURVIVAL SANDBOX · SINGLE PLAYER</div></div></div><div className="top-status"><div className="status-live"><i />{horde ? 'HORDE NIGHT' : night ? 'AFTER DARK' : 'DAYLIGHT'}</div><div className="day-counter">DAY <b>{String(clock.day).padStart(2, '0')}</b></div><div className="clock"><Clock3 size={14} />{time}</div><button className="icon-button" onClick={() => setPaused(true)} aria-label="Pause game">Ⅱ</button></div></header>
    <section className="mission-card"><div className="eyebrow"><span className="eyebrow-mark" />{horde ? 'DEFEND YOUR GROUND' : 'SCAVENGE · CRAFT · SURVIVE'}</div><h1>{horde ? <>THE DEAD<br />ARE HERE</> : <>SEVEN DAYS.<br />ONE LIFE.</>}</h1><p>{horde ? 'The horde hunts until 06:00. Barricades buy time. Keep moving.' : 'Search gold-marked caches; they restock at 06:00. Craft ammo and barricades before the seventh night.'}</p><div className="mission-line" /><div className="mission-meta"><span><Shield size={13} /> NO SAFE ZONES</span><span>{horde ? 'THREAT: EXTREME' : night ? 'THREAT: HIGH' : 'THREAT: ACTIVE'}</span></div><p className="cycle-note">6 real minutes per day · Horde at day 7, 22:00</p></section>
    <div className="location-chip"><span className="location-dot" /> MAPLEWOOD ESTATES <span className="coords">{perspective ? 'FIRST PERSON' : 'THIRD PERSON'}</span></div>
    <section className="survival-panel"><div className="panel-heading"><span>SURVIVAL STATUS</span><span>{stats.kills} KILLS</span></div><Meter label="HEALTH" value={stats.health} color="#c45a48" icon={Heart} /><Meter label="STAMINA" value={stats.stamina} color="#d5b864" icon={Zap} /><Meter label="HUNGER" value={stats.hunger} color="#b98353" icon={Utensils} /><Meter label="THIRST" value={stats.thirst} color="#6ea7a0" icon={Droplets} /></section>
    <div className={`crosshair ${aiming ? 'aiming' : ''}`} aria-hidden="true"><span /><span /><i /></div>
    {message && <div className="toast" role="status">{message}</div>}
    <div className="craft-tray" aria-label="Crafting"><span>FIELD CRAFT · {inventory.scrap} SCRAP</span><button onClick={() => craft(true)} disabled={!active}>B · BARRICADE <b>4 SCRAP</b></button><button onClick={() => craft(false)} disabled={!active}>C · 6 ROUNDS <b>3 SCRAP</b></button></div>
    <div className="supply-tray" aria-label="Quick-use survival supplies"><button onClick={() => consume('ration')} disabled={!active} aria-label={`Use ration, ${inventory.ration} remaining`}>FOOD <b>{inventory.ration}</b><kbd>1</kbd></button><button onClick={() => consume('water')} disabled={!active} aria-label={`Drink water, ${inventory.water} remaining`}>WATER <b>{inventory.water}</b><kbd>2</kbd></button><button onClick={() => consume('bandage')} disabled={!active} aria-label={`Use bandage, ${inventory.bandage} remaining`}>MED <b>{inventory.bandage}</b><kbd>3</kbd></button></div>
    <div className="center-bottom"><div className="weapon-card"><div className="weapon-icon"><Crosshair size={19} /></div><div className="weapon-info"><span>{reloading ? 'RELOADING…' : aiming ? 'AIM DOWN SIGHTS' : 'SCAVENGED 9MM'}</span><button className="reload-button" onClick={reload}>R · RELOAD</button></div><div className="ammo"><strong>{String(stats.ammo).padStart(2, '0')}</strong><span>/ {stats.reserve}</span><span className="ammo-label">LOADED / RESERVE</span></div></div><div className="quick-slots"><button className="quick-slot active" onClick={() => setPerspective(p => !p)} aria-label="Toggle camera view"><span>{perspective ? <Eye size={17} /> : <EyeOff size={17} />}</span><b>{perspective ? 'FPS' : '3PS'}</b><small>V</small></button><button className="quick-slot" onClick={() => attack(false)} aria-label="Melee attack"><span>╱</span><b>MELEE</b><small>F</small></button><button className="quick-slot" onClick={() => attack(true)} aria-label="Fire weapon"><span><Crosshair size={16} /></span><b>FIRE</b><small>LMB</small></button></div></div>
    <div className="controls-hint"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>RMB</kbd> AIM</span><span><kbd>E</kbd> SEARCH</span><span><kbd>ESC</kbd> PAUSE</span></div>
    {(!started || paused || stats.health <= 0 || unsupported) && <div className="survival-overlay"><section className="survival-dialog"><div className="eyebrow">DEADZONE PROTOCOL · PLAYABLE PROTOTYPE</div><h2>{unsupported ? '3D unavailable' : stats.health <= 0 ? 'YOU DID NOT MAKE IT.' : paused ? 'TAKE A BREATH.' : 'OUTLAST THE DEAD.'}</h2><p>{unsupported ? 'This game needs WebGL hardware acceleration. Enable it in a desktop browser and reload. The background is only a static illustration; gameplay is disabled.' : stats.health <= 0 ? `Survived to day ${clock.day} with ${stats.kills} infected eliminated. Start again with a fresh world.` : 'An original survival sandbox: explore a ruined neighborhood, scavenge supplies, craft defenses, and survive the seventh-night horde. V switches first- and third-person views.'}</p>{!unsupported && <><div className="briefing-grid"><span><b>WASD + MOUSE</b>Move / look · click world to capture</span><span><b>LMB / RMB / R</b>Fire / aim / reload</span><span><b>E / 1 · 2 · 3</b>Scavenge / food · water · med</span><span><b>B / C / F</b>Build / craft ammo / melee</span></div><p className="session-note">Desktop keyboard + mouse · Session-only progress · Buildings are solid exteriors, not enterable.</p>{paused && stats.health > 0 && <button className="start-survival" onClick={() => { setPaused(false); lockMouse() }}>RESUME SURVIVAL →</button>}<button className="start-survival" onClick={() => start()}>{started ? 'RESTART · DAY 1' : 'START SURVIVAL →'}</button><button className="horde-drill" onClick={() => start(true)}>QUICK HORDE DRILL · DAY 7, 21:30</button></>}</section></div>}
  </main>
}
