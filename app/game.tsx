'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { advanceClock, blocked, isHorde, isNight, MAGAZINE, movementAxes, OBSTACLES, reloadAmmo, type Clock, type Obstacle } from './survival'
import { Landscape, Atmosphere } from './environment'
import { hordeSpawns, nearestTown, spawnAt, terrainHeight, TOWNS, weatherAt, type WorldLocation } from './world'
import { Survivor, ViewHands, IDLE_MOTION, type Motion, type Outfit } from './character'
import { Wardrobe } from './wardrobe'
import { hitDamage, detectionRadius, craftBandage } from './survival'
import { RegionMap } from './region-map'
import { Crosshair, Heart, Droplets, Utensils, Zap, Clock3, Eye, EyeOff, Shield, Pause, Sword } from 'lucide-react'

type Stats = { health: number; stamina: number; hunger: number; thirst: number; ammo: number; reserve: number; kills: number }
type LootKind = 'ration' | 'water' | 'bandage' | 'ammo' | 'scrap'
type LootDrop = { kind: LootKind; amount: number }
type Inventory = { ration: number; water: number; bandage: number; scrap: number }
const INITIAL: Stats = { health: 86, stamina: 78, hunger: 69, thirst: 58, ammo: 12, reserve: 48, kills: 0 }
const INITIAL_INVENTORY: Inventory = { ration: 1, water: 1, bandage: 1, scrap: 14 }
type WorldProps = { outfit: Outfit; crouched: boolean; flashlight: boolean; reloading: boolean; highQuality: boolean; spawnTown: string; onLocation: (location: WorldLocation) => void; perspective: boolean; stats: Stats; clock: Clock; active: boolean; aiming: boolean; onStats: React.Dispatch<React.SetStateAction<Stats>>; onMessage: (message: string) => void; onLoot: (loot: LootDrop) => void }

function Player({ perspective, onStats, positionTracker, obstacles, stats, active, aiming, spawnTown, onLocation, outfit, crouched, flashlight, reloading }: Pick<WorldProps, 'perspective' | 'onStats' | 'stats' | 'active' | 'aiming' | 'spawnTown' | 'onLocation' | 'outfit' | 'crouched' | 'flashlight' | 'reloading'> & { positionTracker: React.RefObject<THREE.Vector3>; obstacles: React.RefObject<Obstacle[]> }) {
  const group = useRef<THREE.Group>(null)
  const weapon = useRef<THREE.Group>(null)
  const kick = useRef(0)
  const motion = useRef<Motion>({ ...IDLE_MOTION })
  const lamp = useRef<THREE.SpotLight>(null)
  const lampTarget = useMemo(() => new THREE.Object3D(), [])
  const { camera, gl, scene } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const heading = useRef(0), pitch = useRef(0), jumpVelocity = useRef(0), elapsed = useRef(0), locationTick = useRef(0), jumpHeight = useRef(0)
  const cameraRay = useMemo(() => new THREE.Raycaster(), [])
  useEffect(() => { if (group.current) group.current.position.set(...spawnAt(spawnTown)); positionTracker.current.set(...spawnAt(spawnTown)); onLocation({ x: positionTracker.current.x, z: positionTracker.current.z, heading: 0 }) }, [spawnTown, positionTracker, onLocation])
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
    const sprint = moving && !crouched && !aiming && stats.stamina > 5 && (keys.current.ShiftLeft || keys.current.ShiftRight)
    const pace = crouched ? 1.7 : aiming ? 2 : sprint ? 7.1 : 4.1
    const dirX = Math.sin(heading.current), dirZ = Math.cos(heading.current)
    const norm = Math.max(1, Math.hypot(forward, side))
    const nextX = group.current.position.x + (dirX * forward - Math.cos(heading.current) * side) / norm * pace * dt
    const nextZ = group.current.position.z + (dirZ * forward + Math.sin(heading.current) * side) / norm * pace * dt
    if (!blocked(nextX, group.current.position.z, obstacles.current)) group.current.position.x = nextX
    if (!blocked(group.current.position.x, nextZ, obstacles.current)) group.current.position.z = nextZ
    if (active) {
      if (keys.current.Space && jumpHeight.current <= 0.02 && stats.stamina > 8) { jumpVelocity.current = 5.6; onStats(s => ({ ...s, stamina: Math.max(0, s.stamina - 8) })) }
      jumpVelocity.current -= 13 * dt; jumpHeight.current = Math.max(0, jumpHeight.current + jumpVelocity.current * dt); if (jumpHeight.current === 0) jumpVelocity.current = 0
      elapsed.current += dt
      if (elapsed.current >= 1) { elapsed.current = 0; onStats(prev => ({ ...prev, stamina: THREE.MathUtils.clamp(prev.stamina + (sprint ? -9 : 6), 0, 100), hunger: Math.max(0, prev.hunger - 0.09), thirst: Math.max(0, prev.thirst - (sprint ? 0.2 : 0.12)), health: Math.max(0, prev.health - (prev.hunger <= 0 || prev.thirst <= 0 ? 2 : 0)) })) }
    }
    group.current.position.y = terrainHeight(group.current.position.x, group.current.position.z) + jumpHeight.current
    locationTick.current += dt
    if (locationTick.current > 0.3) { locationTick.current = 0; onLocation({ x: group.current.position.x, z: group.current.position.z, heading: heading.current }) }
    motion.current = { speed: moving ? pace : 0, crouched, aiming, reloading, active }
    group.current.rotation.y = heading.current
    positionTracker.current.copy(group.current.position)
    const eye = group.current.position.clone().add(new THREE.Vector3(0, crouched ? 1.23 : 1.67, 0))
    const destination = perspective ? eye.clone() : eye.clone().add(new THREE.Vector3(-dirX * (aiming ? 1.8 : 3.2) - Math.cos(heading.current) * 0.45, 0.55, -dirZ * (aiming ? 1.8 : 3.2) + Math.sin(heading.current) * 0.45))
    if (!perspective) {
      const offset = destination.clone().sub(eye)
      cameraRay.set(eye, offset.clone().normalize()); cameraRay.camera = camera; cameraRay.far = offset.length()
      const solids: THREE.Object3D[] = []; scene.traverse(o => { if (o.userData.cameraSolid && o.visible) solids.push(o) })
      const obstruction = cameraRay.intersectObjects(solids, false)[0]
      if (obstruction) destination.copy(eye).addScaledVector(offset.normalize(), Math.max(0.25, obstruction.distance - 0.25))
    }
    camera.position.copy(destination)
    kick.current = Math.max(0, kick.current - dt * 0.25)
    camera.rotation.set(pitch.current + kick.current - (perspective ? 0 : 0.16), heading.current + Math.PI, 0, 'YXZ')
    if (camera instanceof THREE.PerspectiveCamera) { camera.fov = THREE.MathUtils.lerp(camera.fov, aiming ? 48 : 70, 1 - Math.exp(-12 * dt)); camera.updateProjectionMatrix() }
    if (weapon.current) { weapon.current.position.copy(camera.position); weapon.current.quaternion.copy(camera.quaternion) }
    if (lamp.current) { lamp.current.position.copy(eye).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 0.45); lampTarget.position.copy(eye).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 20); lampTarget.updateMatrixWorld(); lamp.current.target = lampTarget }
  })
  return <><group ref={group} userData={{ player: true }}><group visible={!perspective}><Survivor motion={motion} outfit={outfit} /></group></group><group ref={weapon} visible={perspective} userData={{ viewWeapon: true }}><ViewHands outfit={outfit} aiming={aiming} motion={motion} kick={kick} /></group><spotLight ref={lamp} visible={flashlight} color="#ffebce" intensity={36} distance={45} angle={0.35} penumbra={0.6} decay={1} /><primitive object={lampTarget} /></>
}

function LootContainer({ position, loot, variant = 0 }: { position: [number, number, number]; loot: LootDrop; variant?: number }) {
  const colors: Record<LootKind, string> = { ration: '#9e7948', water: '#648b88', bandage: '#9d8b74', ammo: '#7b7655', scrap: '#706957' }
  return <group position={position} userData={{ lootCache: loot }}><mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[0.9, 0.72, 0.72]} /><meshStandardMaterial color={colors[loot.kind]} roughness={0.92} /></mesh><mesh position={[0, 0.82, 0]} rotation={[0, variant % 2 ? 0.06 : -0.04, 0]} castShadow><boxGeometry args={[0.98, 0.12, 0.8]} /><meshStandardMaterial color="#514b3e" metalness={0.2} /></mesh><mesh position={[0, 0.43, 0.37]}><boxGeometry args={[0.28, 0.18, 0.03]} /><meshStandardMaterial color="#c6b37a" emissive="#a98a4f" emissiveIntensity={0.12} /></mesh><mesh position={[0, 1.05, 0]}><octahedronGeometry args={[0.13, 0]} /><meshBasicMaterial color="#d7bf72" /></mesh></group>
}

function Zombie({ position, index, onStats, playerPosition, active, clock, obstacles, barriers, crouched, flashlight }: { crouched: boolean; flashlight: boolean; active: boolean; clock: Clock; obstacles: React.RefObject<Obstacle[]>; barriers: React.RefObject<Barrier[]>; position: [number, number, number]; index: number; onStats: WorldProps['onStats']; playerPosition: React.RefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null); const wanderHeading = useRef(index * 2.4), wanderTimer = useRef(0); const phase = useRef(index * 1.4); const lastAttack = useRef(0)
  const motion = useRef<Motion>({ ...IDLE_MOTION })
  useFrame((_, delta) => {
    motion.current.active = active
    if (!active || !ref.current || !ref.current.visible) return
    const dt = Math.min(delta, 0.05); phase.current += dt
    const dx = playerPosition.current.x - ref.current.position.x; const dz = playerPosition.current.z - ref.current.position.z
    const distance = Math.hypot(dx, dz)
    const horde = isHorde(clock), night = isNight(clock.hour), alert = detectionRadius({ horde, night, crouched, flashlight })
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
    if (distance >= alert) {
      wanderTimer.current += dt
      if (wanderTimer.current > 5) { wanderTimer.current = 0; wanderHeading.current += 1.7 + Math.sin(phase.current) }
      const x = ref.current.position.x, z = ref.current.position.z
      const nx = x + Math.sin(wanderHeading.current) * dt * 0.45, nz = z + Math.cos(wanderHeading.current) * dt * 0.45
      if (!blocked(nx, nz, obstacles.current, 0.4) && Math.hypot(nx - position[0], nz - position[2]) < 32) { ref.current.position.x = nx; ref.current.position.z = nz; ref.current.rotation.y = wanderHeading.current } else wanderHeading.current += 1.5
    }
    if (distance < 1.7 && phase.current - lastAttack.current > 1.3) { lastAttack.current = phase.current; onStats(s => ({ ...s, health: Math.max(0, s.health - (horde ? 12 : 7)) })) }
    motion.current.speed = distance < alert ? speed : 0.45
    ref.current.position.y = terrainHeight(ref.current.position.x, ref.current.position.z) + Math.abs(Math.sin(phase.current * 3.3)) * (distance < 13 ? 0.025 : 0.012)
  })
  return <group ref={ref} userData={{ infected: true }} position={position}><Survivor motion={motion} infected outfit={(['ranger', 'scout', 'urban'] as Outfit[])[index % 3]} variant={index} /></group>
}

type Barrier = { x: number; z: number; hp: number; mesh: THREE.Mesh; obstacle: Obstacle }

function World({ perspective, onStats, onMessage, onLoot, stats, clock, active, aiming, spawnTown, onLocation, outfit, crouched, flashlight, reloading, highQuality }: WorldProps) {
  const obstacles = useRef([...OBSTACLES]); const barriers = useRef<Barrier[]>([])
  const { camera, scene } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const zombieHealth = useRef(new WeakMap<THREE.Object3D, number>())
  const playerPosition = useRef(new THREE.Vector3(...spawnAt(spawnTown)))
  const [hordeWave, setHordeWave] = useState<[number, number, number][]>([])
  const [supplyDrop, setSupplyDrop] = useState<{ position: [number, number, number]; id: number } | null>(null)
  const eventCycle = Math.floor((clock.day * 24 + clock.hour) / 4)
  const horde = isHorde(clock)
  useEffect(() => {
    if (!horde) { setHordeWave([]); return }
    const p = playerPosition.current
    setHordeWave(hordeSpawns(p.x, p.z, obstacles.current))
  }, [horde])
  useEffect(() => {
    const town = TOWNS[(eventCycle % TOWNS.length + TOWNS.length) % TOWNS.length]
    setSupplyDrop({ position: [town.x + 3, 0, town.z + 8], id: eventCycle })
    onMessage(`RADIO · SUPPLY DROP NEAR ${town.name.toUpperCase()} · CHECK MAP`)
  }, [eventCycle, onMessage])
  useEffect(() => {
    const handleAttack = (event: Event) => {
      if (!active) return
      const ranged = (event as CustomEvent<{ ranged: boolean }>).detail.ranged
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
      const candidates: THREE.Object3D[] = []
      scene.traverse(o => { if (o.userData.infected || o.userData.cameraSolid || o.userData.blocksShots) candidates.push(o) })
      const hit = raycaster.intersectObjects(candidates, true).find(intersection => {
        let node: THREE.Object3D | null = intersection.object
        while (node) { if (!node.visible || node.userData.decorative || node.userData.player || node.userData.viewWeapon) return false; node = node.parent }
        return true
      })
      let target: THREE.Object3D | null = hit?.object ?? null
      while (target && !target.userData.infected) target = target.parent
      if (!target || (!ranged && target.position.distanceTo(playerPosition.current) > 3) || (ranged && (hit?.distance ?? Infinity) > 36)) { onMessage('NO INFECTED IN YOUR SIGHTS'); return }
      let zone: THREE.Object3D | null = hit?.object ?? null
      let headshot = false
      while (zone && zone !== target) { if (zone.userData.hitZone === 'head') headshot = true; zone = zone.parent }
      const health = (zombieHealth.current.get(target) ?? 3) - hitDamage(ranged, headshot)
      zombieHealth.current.set(target, health)
      if (health <= 0) { target.visible = false; onStats(value => ({ ...value, kills: value.kills + 1 })); onMessage(headshot && ranged ? 'HEADSHOT · INFECTED ELIMINATED' : ranged ? 'TARGET DOWN · +1 INFECTED' : 'INFECTED ELIMINATED') }
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
      mesh.position.set(x, terrainHeight(x, z) + 0.7, z); mesh.castShadow = true; mesh.userData.cameraSolid = true; scene.add(mesh)
      const obstacle = { x, z, halfX: 1, halfZ: 0.5 }; obstacles.current.push(obstacle); barriers.current.push({ x, z, hp: 100, mesh, obstacle })
      window.dispatchEvent(new Event('deadzone-built')); onMessage('BARRICADE PLACED · 100 HP · -4 SCRAP')
    }
    window.addEventListener('deadzone-build', build)
    return () => window.removeEventListener('deadzone-build', build)
  }, [active, camera, onMessage, scene])
  useEffect(() => () => { barriers.current.forEach(b => { scene.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose() }) }, [scene])
  const lootCycle = clock.hour >= 6 ? clock.day : clock.day - 1
  const lootCaches = useMemo(() => TOWNS.flatMap((town, ti) => [
    { position: [town.x + 2, 0, town.z - 14] as [number, number, number], loot: { kind: 'ration', amount: town.id === 'sunvale' ? 4 : 2 } as LootDrop },
    { position: [town.x - 5, 0, town.z + 22] as [number, number, number], loot: { kind: 'water', amount: town.id === 'stillwater' ? 4 : 2 } as LootDrop },
    { position: [town.x + 8, 0, town.z - 35] as [number, number, number], loot: { kind: 'bandage', amount: town.id === 'pinefall' ? 3 : 1 } as LootDrop },
    { position: [town.x - 9, 0, town.z - 8] as [number, number, number], loot: { kind: 'ammo', amount: town.id === 'redmesa' ? 30 : 12 } as LootDrop },
    { position: [town.x + 13, 0, town.z + 33] as [number, number, number], loot: { kind: 'scrap', amount: town.id === 'ashford' ? 12 : 6 } as LootDrop },
  ].map(cache => ({ ...cache, key: `${ti}-${cache.loot.kind}` }))), [])
  const zombies = useMemo(() => TOWNS.flatMap(t => Array.from({ length: 6 }, (_, i) => { const x = t.x + (i % 2 ? -1 : 1) * 11.5, z = t.z + 12 + i * 6; return [x, terrainHeight(x, z), z] as [number, number, number] })), [])
  return <><Landscape wet={weatherAt(clock.day, clock.hour) === 'RAIN'} /><Atmosphere highQuality={highQuality} clock={clock} active={active} playerPosition={playerPosition} />
    {lootCaches.map((cache, i) => <LootContainer key={`${cache.key}-${lootCycle}`} position={cache.position} loot={cache.loot} variant={i} />)}
    {supplyDrop && <group key={supplyDrop.id} position={supplyDrop.position}><LootContainer position={[0, 0, 0]} loot={{ kind: 'ammo', amount: 24 }} /><mesh position={[0, 7, 0]} userData={{ decorative: true }}><cylinderGeometry args={[0.3, 0.8, 13, 8]} /><meshBasicMaterial color="#e3a15e" transparent opacity={0.15} depthWrite={false} /></mesh></group>}
    {[...zombies, ...hordeWave].map((z, i) => <Zombie key={`${i}-${i >= zombies.length ? clock.day - Number(clock.hour < 6) : 'resident'}`} position={z} index={i} onStats={onStats} playerPosition={playerPosition} active={active} clock={clock} obstacles={obstacles} barriers={barriers} crouched={crouched} flashlight={flashlight} />)}
    <Player perspective={perspective} onStats={onStats} positionTracker={playerPosition} obstacles={obstacles} stats={stats} active={active} aiming={aiming} spawnTown={spawnTown} onLocation={onLocation} outfit={outfit} crouched={crouched} flashlight={flashlight} reloading={reloading} />
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
  const [outfit, setOutfit] = useState<Outfit>('ranger')
  const [crouched, setCrouched] = useState(false), [flashlight, setFlashlight] = useState(false)
  const [highQuality, setHighQuality] = useState(false)
  const [spawnTown, setSpawnTown] = useState('maplewood')
  const [sessionTown, setSessionTown] = useState('maplewood')
  const [mapOpen, setMapOpen] = useState(false)
  const [location, setLocation] = useState<WorldLocation>({ x: 0, z: -148, heading: 0 })
  const [visited, setVisited] = useState<string[]>([])
  const reportLocation = useCallback((p: WorldLocation) => { setLocation(p); const t = nearestTown(p.x, p.z); if (Math.hypot(t.x - p.x, t.z - p.z) < 52) setVisited(v => v.includes(t.id) ? v : [...v, t.id]) }, [])
  const town = nearestTown(location.x, location.z)
  const inTown = Math.hypot(town.x - location.x, town.z - location.z) < 52
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
    let ticks = 0
    const id = setInterval(() => {
      if (++ticks % 10 === 0) setClock(c => advanceClock(c, 1))
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
    setCrouched(false); setFlashlight(false); setSessionTown(spawnTown); setVisited([]); setMapOpen(false); setStats(INITIAL); setInventory(INITIAL_INVENTORY); setClock({ day: hordeDrill ? 7 : 1, hour: hordeDrill ? 21.5 : 8 }); setSession(v => v + 1)
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
      if (e.repeat || (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return
      if (e.code === 'KeyM' && started) { setMapOpen(v => !v); setPaused(true); return }
      if (e.code === 'Escape' && started) { setMapOpen(false); setPaused(true); return }
      if (!stateRef.current.active) return
      if (e.code === 'KeyX') setCrouched(v => !v)
      if (e.code === 'KeyL') setFlashlight(v => !v)
      if (e.code === 'KeyH') { const result = craftBandage(stateRef.current.inventory); if (result) { stateRef.current.inventory = result; setInventory(result); addMessage('FIELD DRESSING CRAFTED · -2 SCRAP, -1 WATER') } else addMessage('NEED 2 SCRAP + 1 WATER TO CRAFT DRESSING') }
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
    <div className="world-canvas"><WastelandFallback />{graphicsAvailable && <SceneBoundary onFailure={() => setSceneFailed(true)}><Canvas className="scene-canvas" shadows dpr={highQuality ? [1, 2] : [1, 1.25]} gl={{ alpha: false, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }} camera={{ position: [0, 1.62, -148], fov: 70, far: 1000 }}><Suspense fallback={null}><World key={session} outfit={outfit} crouched={crouched} flashlight={flashlight} reloading={reloading} highQuality={highQuality} spawnTown={sessionTown} onLocation={reportLocation} perspective={perspective} onStats={setStats} onMessage={addMessage} onLoot={collectLoot} stats={stats} clock={clock} active={active} aiming={aiming} /></Suspense></Canvas></SceneBoundary>}</div>
    <div className="vignette" aria-hidden="true" />
    <header className="topbar"><div className="brand"><div className="brand-mark">D<span>Z</span></div><div><div className="brand-name">DEADZONE <span>PROTOCOL</span></div><div className="brand-sub">BLACKWATER COUNTY · SIX TOWNS</div></div></div><div className="top-status"><div className="status-live"><i />{horde ? 'HORDE NIGHT' : night ? 'AFTER DARK' : 'DAYLIGHT'}</div><div className="day-counter">DAY <b>{String(clock.day).padStart(2, '0')}</b></div><div className="clock"><Clock3 size={14} />{time}</div><button className="icon-button" onClick={() => setPaused(true)} aria-label="Pause game"><Pause size={16} /></button></div></header>
    <section className="mission-card"><div className="eyebrow"><span className="eyebrow-mark" />{horde ? 'DEFEND YOUR GROUND' : 'SCAVENGE · CRAFT · SURVIVE'}</div><h1>{horde ? <>THE DEAD<br />ARE HERE</> : <>A WORLD<br />LEFT BEHIND.</>}</h1><p>{horde ? 'The horde hunts until 06:00. Barricades buy time. Keep moving.' : 'Explore six connected towns. Follow the highways, watch the weather, and intercept radio supply drops.'}</p><div className="mission-line" /><div className="mission-meta"><span><Shield size={13} /> NO SAFE ZONES</span><span>{horde ? 'THREAT: EXTREME' : night ? 'THREAT: HIGH' : 'THREAT: ACTIVE'}</span></div><p className="cycle-note">{visited.length}/6 TOWNS DISCOVERED · M: COUNTY MAP</p></section>
    <div className="location-chip"><span className="location-dot" /> {inTown ? town.name.toUpperCase() : 'BLACKWATER WILDERNESS'} <span className="coords">{perspective ? 'FIRST PERSON' : 'THIRD PERSON'}</span></div>
    <section className="survival-panel"><div className="panel-heading"><span>SURVIVAL STATUS</span><span>{stats.kills} KILLS</span></div><Meter label="HEALTH" value={stats.health} color="#c45a48" icon={Heart} /><Meter label="STAMINA" value={stats.stamina} color="#d5b864" icon={Zap} /><Meter label="HUNGER" value={stats.hunger} color="#b98353" icon={Utensils} /><Meter label="THIRST" value={stats.thirst} color="#6ea7a0" icon={Droplets} /></section>
    <div className="world-readout"><strong>{crouched ? 'CROUCHED · LOW PROFILE' : 'STANDING'}{flashlight ? ' · LIGHT ON' : ''}</strong><span>{inTown ? town.biome : `NEAR ${town.name.toUpperCase()}`}</span><span>{weatherAt(clock.day, clock.hour)} · {Math.round(location.x)}, {Math.round(location.z)}</span><button onClick={() => { setMapOpen(true); setPaused(true) }}>M · COUNTY MAP</button></div>
    <div className={`crosshair ${aiming ? 'aiming' : ''}`} aria-hidden="true"><span /><span /><i /></div>
    {message && <div className="toast" role="status">{message}</div>}
    <div className="craft-tray" aria-label="Crafting"><span>FIELD CRAFT · {inventory.scrap} SCRAP</span><button onClick={() => craft(true)} disabled={!active}>B · BARRICADE <b>4 SCRAP</b></button><button onClick={() => craft(false)} disabled={!active}>C · 6 ROUNDS <b>3 SCRAP</b></button><span className="dressing-recipe">H · FIELD DRESSING: 2 SCRAP + 1 WATER</span></div>
    <div className="supply-tray" aria-label="Quick-use survival supplies"><button onClick={() => consume('ration')} disabled={!active} aria-label={`Use ration, ${inventory.ration} remaining`}>FOOD <b>{inventory.ration}</b><kbd>1</kbd></button><button onClick={() => consume('water')} disabled={!active} aria-label={`Drink water, ${inventory.water} remaining`}>WATER <b>{inventory.water}</b><kbd>2</kbd></button><button onClick={() => consume('bandage')} disabled={!active} aria-label={`Use bandage, ${inventory.bandage} remaining`}>MED <b>{inventory.bandage}</b><kbd>3</kbd></button></div>
    <div className="center-bottom"><div className="weapon-card"><div className="weapon-icon"><Crosshair size={19} /></div><div className="weapon-info"><span>{reloading ? 'RELOADING…' : aiming ? 'AIM DOWN SIGHTS' : 'SCAVENGED 9MM'}</span><button className="reload-button" onClick={reload}>R · RELOAD</button></div><div className="ammo"><strong>{String(stats.ammo).padStart(2, '0')}</strong><span>/ {stats.reserve}</span><span className="ammo-label">LOADED / RESERVE</span></div></div><div className="quick-slots"><button className="quick-slot active" onClick={() => setPerspective(p => !p)} aria-label="Toggle camera view"><span>{perspective ? <Eye size={17} /> : <EyeOff size={17} />}</span><b>{perspective ? 'FPS' : '3PS'}</b><small>V</small></button><button className="quick-slot" onClick={() => attack(false)} aria-label="Melee attack"><span><Sword size={17} /></span><b>MELEE</b><small>F</small></button><button className="quick-slot" onClick={() => attack(true)} aria-label="Fire weapon"><span><Crosshair size={16} /></span><b>FIRE</b><small>LMB</small></button></div></div>
    <div className="controls-hint"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>X</kbd> CROUCH</span><span><kbd>L</kbd> LIGHT</span><span><kbd>E</kbd> SEARCH</span><span><kbd>M</kbd> MAP</span><span><kbd>ESC</kbd> PAUSE</span></div>
    {mapOpen && <RegionMap location={location} visited={visited} clock={clock} onClose={() => { setMapOpen(false); setPaused(false); lockMouse() }} />}
    {!mapOpen && (!started || paused || stats.health <= 0 || unsupported) && <div className="survival-overlay"><section className="survival-dialog"><div className="eyebrow">DEADZONE PROTOCOL · PLAYABLE PROTOTYPE</div><h2>{unsupported ? '3D unavailable' : stats.health <= 0 ? 'YOU DID NOT MAKE IT.' : paused ? 'TAKE A BREATH.' : 'BUILT TO SURVIVE.'}</h2><p>{unsupported ? 'This game needs WebGL hardware acceleration. Enable it in a desktop browser and reload. The background is only a static illustration; gameplay is disabled.' : stats.health <= 0 ? `Survived to day ${clock.day} with ${stats.kills} infected eliminated. Start again with a fresh world.` : 'Explore a seamless 780m-wide county: pine forests, farmland, industrial ruins, wetlands and red-rock hills. Six towns, roaming infected, changing weather and rotating supply drops. V switches FPS / third person; M opens the county map.'}</p>{!unsupported && <><div className="briefing-grid"><span><b>WASD + MOUSE</b>Move / look · click world to capture</span><span><b>LMB / RMB / R</b>Fire / aim / reload</span><span><b>E / 1 · 2 · 3</b>Scavenge / food · water · med</span><span><b>B / C / F</b>Build / craft ammo / melee</span></div><p className="session-note">Single-player simulation · Desktop keyboard + mouse · Session-only progress · Building exteriors only.</p><Wardrobe outfit={outfit} onOutfit={setOutfit} highQuality={highQuality} onQuality={setHighQuality} /><label className="spawn-picker">STARTING TOWN<select value={spawnTown} onChange={e => setSpawnTown(e.target.value)}>{TOWNS.map(t => <option key={t.id} value={t.id}>{t.name} — {t.biome}</option>)}</select></label>{paused && stats.health > 0 && <button className="start-survival" onClick={() => { setMapOpen(false); setPaused(false); lockMouse() }}>RESUME SURVIVAL →</button>}<button className="start-survival" onClick={() => start()}>{started ? 'RESTART · DAY 1' : 'START SURVIVAL →'}</button><button className="horde-drill" onClick={() => start(true)}>QUICK HORDE DRILL · DAY 7, 21:30</button></>}</section></div>}
  </main>
}
