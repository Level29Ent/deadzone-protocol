'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BUILDINGS, LAKE, nearestTown, roadDistance, ROADS, terrainHeight, TOWNS, weatherAt, type Town } from './world'
import type { Clock } from './survival'

function random(seed: number) { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n) }
function surface(kind: 'ground' | 'wall' | 'roof' | 'road') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = kind === 'ground' ? '#8d9278' : kind === 'road' ? '#767674' : kind === 'roof' ? '#777a78' : '#d5d1ba'; ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 22000; i++) { const v = Math.floor(random(i + 32) * 80); ctx.fillStyle = `rgba(${v},${v},${v},.18)`; ctx.fillRect(random(i) * 512, random(i + 15) * 512, 1 + random(i + 4) * 3, 1 + random(i + 5) * 3) }
  for (let i = 0; i < 80; i++) { const x = random(i + 9) * 512, y = random(i + 10) * 512; const stain = ctx.createRadialGradient(x, y, 1, x, y, 20 + random(i) * 50); stain.addColorStop(0, kind === 'ground' ? '#555f3860' : '#322b2329'); stain.addColorStop(1, '#00000000'); ctx.fillStyle = stain; ctx.fillRect(x - 70, y - 70, 140, 140) }
  if (kind === 'wall' || kind === 'roof') for (let y = 0; y < 512; y += kind === 'roof' ? 32 : 28) {
    ctx.fillStyle = '#292b2865'; ctx.fillRect(0, y, 512, 3); ctx.fillStyle = '#ffffff25'; ctx.fillRect(0, y + 3, 512, 2)
    for (let x = (y % 64) * 2; x < 512; x += kind === 'roof' ? 64 : 256) { ctx.fillStyle = '#302d2a60'; ctx.fillRect(x, y, 2, 28); ctx.fillStyle = '#34352f90'; ctx.fillRect(x + 6, y + 6, 2, 2) }
  }
  if (kind === 'road' || kind === 'ground') for (let i = 0; i < 22; i++) {
    let x = random(i + 5) * 512, y = random(i + 45) * 512
    ctx.strokeStyle = kind === 'road' ? '#282e2eb0' : '#56563e50'; ctx.lineWidth = kind === 'road' ? 1.5 : 0.7; ctx.beginPath(); ctx.moveTo(x, y)
    for (let j = 0; j < 8; j++) { x += random(i * 15 + j) * 20 - 10; y += 7; ctx.lineTo(x, y) } ctx.stroke()
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(kind === 'ground' ? 100 : kind === 'road' ? 3 : 2, kind === 'ground' ? 100 : 2); t.anisotropy = 4
  return t
}
function useSurfaces() {
  const maps = useMemo(() => {
    const ground = surface('ground'), wall = surface('wall'), roof = surface('roof'), road = surface('road')
    const relief = (t: THREE.CanvasTexture) => { const texture = t.clone(); texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true; return texture }
    return { ground, wall, roof, road, groundBump: relief(ground), wallBump: relief(wall), roofBump: relief(roof), roadBump: relief(road) }
  }, [])
  useEffect(() => () => Object.values(maps).forEach(t => t.dispose()), [maps]); return maps
}
function Label({ text, position, color = '#d9cba5' }: { text: string; position: [number, number, number]; color?: string }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const ctx = c.getContext('2d')!
    ctx.fillStyle = '#1d302c'; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112)
    ctx.fillStyle = color; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text.toUpperCase(), 256, 78, 460)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [text, color])
  useEffect(() => () => texture.dispose(), [texture])
  return <group position={position}><mesh position={[0, -1.3, 0]}><boxGeometry args={[0.12, 3, 0.12]} /><meshStandardMaterial color="#53554b" /></mesh><mesh><boxGeometry args={[4.5, 1.15, 0.12]} /><meshStandardMaterial map={texture} roughness={0.9} /></mesh><mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.07]}><planeGeometry args={[4.5, 1.15]} /><meshStandardMaterial map={texture} /></mesh></group>
}
function Building({ data, maps }: { data: typeof BUILDINGS[number]; maps: ReturnType<typeof useSurfaces> }) {
  const tall = data.seed % 3 === 0, height = tall ? 5.6 : 3.4
  return <group position={[data.x, 0, data.z]}>
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow userData={{ cameraSolid: true }}><boxGeometry args={[6, height, 5]} /><meshStandardMaterial color={data.color} map={maps.wall} bumpMap={maps.wallBump} bumpScale={0.035} roughness={0.96} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 1.7, height + 0.7, 0]} rotation={[0, 0, side * -0.4]} castShadow><boxGeometry args={[3.8, 0.22, 6.2]} /><meshStandardMaterial color={data.seed % 2 ? '#59504b' : '#68706b'} map={maps.roof} bumpMap={maps.roofBump} bumpScale={0.05} roughness={0.9} /></mesh>)}
    <mesh position={[1.9, height + 1, -1.2]} castShadow><boxGeometry args={[0.6, 2.1, 0.6]} /><meshStandardMaterial color="#745b49" map={maps.wall} /></mesh>
    <mesh position={[0, 0.08, 2.8]} receiveShadow><boxGeometry args={[6.6, 0.16, 1.4]} /><meshStandardMaterial color="#777a70" /></mesh>
    <mesh position={[0, 1, 2.54]}><boxGeometry args={[1.1, 2, 0.1]} /><meshStandardMaterial color="#3d4a43" map={maps.wall} /></mesh>
    {Array.from({ length: tall ? 2 : 1 }, (_, floor) => [-1, 1].map(side => <group key={`${floor}-${side}`} position={[side * 1.9, 1.65 + floor * 2.4, 2.54]}>
      <mesh><boxGeometry args={[1.4, 1.5, 0.12]} /><meshStandardMaterial color="#c5bfa5" /></mesh><mesh position={[0, 0, 0.08]}><planeGeometry args={[1.15, 1.25]} /><meshStandardMaterial color="#203940" metalness={0.6} roughness={0.25} emissive="#a68446" emissiveIntensity={data.seed % 3 === 0 ? 0.25 : 0.04} /></mesh>
      <mesh position={[0, 0, 0.14]} rotation={[0, 0, side * 0.2]}><boxGeometry args={[1.5, 0.16, 0.08]} /><meshStandardMaterial color="#6e5b42" map={maps.wall} /></mesh>
    </group>))}
    {[-1, 1].map(side => <group key={`trim-${side}`}><mesh position={[side * 3.03, height / 2, 2.52]}><boxGeometry args={[0.1, height, 0.12]} /><meshStandardMaterial color="#b2b09c" /></mesh><mesh position={[side * 3.2, height + 0.02, 0]}><boxGeometry args={[0.13, 0.14, 6]} /><meshStandardMaterial color="#777e78" metalness={0.6} roughness={0.5} /></mesh><mesh position={[side * 3.1, height / 2, -2.5]}><cylinderGeometry args={[0.045, 0.045, height, 8]} /><meshStandardMaterial color="#777e78" metalness={0.6} /></mesh></group>)}
    {data.seed % 2 === 0 && <mesh position={[-2.6, 0.5, 3.5]}><boxGeometry args={[0.9, 1, 0.9]} /><meshStandardMaterial color="#454f3e" /></mesh>}
  </group>
}
function Landmark({ town, maps }: { town: Town; maps: ReturnType<typeof useSurfaces> }) {
  const common = <meshStandardMaterial color={town.color} map={maps.wall} bumpMap={maps.wallBump} bumpScale={0.035} roughness={0.85} />
  return <group position={[town.x + 34, 0, town.z + 8]}>
    <mesh position={[0, 2, 0]} castShadow receiveShadow userData={{ cameraSolid: true }}><boxGeometry args={[10, 4, 10]} />{common}</mesh>
    {town.landmark === 'tower' && <><mesh position={[0, 10, 0]} castShadow><cylinderGeometry args={[3.2, 3, 4, 20]} /><meshStandardMaterial color="#a5b2aa" metalness={0.65} roughness={0.55} /></mesh>{[-1, 1].map(x => [-1, 1].map(z => <mesh key={`${x}${z}`} position={[x * 2.5, 7, z * 2.5]}><cylinderGeometry args={[0.12, 0.2, 8]} /><meshStandardMaterial color="#505d58" /></mesh>))}</>}
    {town.landmark === 'church' && <><mesh position={[0, 6, 0]} castShadow><boxGeometry args={[3.5, 7, 3.5]} />{common}</mesh><mesh position={[0, 11, 0]} castShadow><coneGeometry args={[3, 4, 4]} /><meshStandardMaterial color="#394f43" /></mesh><mesh position={[0, 13.7, 0]}><boxGeometry args={[0.18, 2, 0.18]} /><meshStandardMaterial color="#d6c7a1" /></mesh><mesh position={[0, 14, 0]}><boxGeometry args={[1, 0.18, 0.18]} /><meshStandardMaterial color="#d6c7a1" /></mesh></>}
    {town.landmark === 'silos' && [-3, 3].map(x => <group key={x} position={[x, 0, 0]}><mesh position={[0, 7, 0]} castShadow><cylinderGeometry args={[2.4, 2.4, 12, 16]} /><meshStandardMaterial color="#b6b2a0" metalness={0.45} roughness={0.65} /></mesh><mesh position={[0, 13.8, 0]}><coneGeometry args={[2.6, 1.8, 16]} /><meshStandardMaterial color="#817968" /></mesh></group>)}
    {town.landmark === 'depot' && <><mesh position={[0, 4.3, 0]}><boxGeometry args={[11, 0.5, 11]} /><meshStandardMaterial color="#494b47" /></mesh>{[-3, 3].map(x => <mesh key={x} position={[x, 10, -2]} castShadow><cylinderGeometry args={[0.8, 1.3, 16, 12]} /><meshStandardMaterial color="#73564b" map={maps.wall} /></mesh>)}</>}
    {town.landmark === 'motel' && <><mesh position={[0, 5, 0]} castShadow><boxGeometry args={[10, 3, 10]} />{common}</mesh><Label text="LAKEVIEW MOTEL" position={[0, 7, 5.1]} />{[-3, 0, 3].map(x => <mesh key={x} position={[x, 4.8, 5.05]}><boxGeometry args={[1.6, 1.6, 0.1]} /><meshStandardMaterial color="#263a3d" /></mesh>)}</>}
    {town.landmark === 'radio' && <><mesh position={[0, 12, 0]}><cylinderGeometry args={[0.15, 1.2, 24, 4]} /><meshStandardMaterial color="#9b6454" wireframe /></mesh><mesh position={[0, 18, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[2, 0.2, 5, 16]} /><meshStandardMaterial color="#a7aaa3" /></mesh><mesh position={[0, 24.5, 0]}><sphereGeometry args={[0.3, 8, 6]} /><meshBasicMaterial color="#ee5b43" /></mesh></>}
    <Label text={town.name} color="#e5d1a6" position={[0, 2.5, -5.1]} />
  </group>
}
function AbandonedCar({ position, color }: { position: [number, number, number]; color: string }) {
  return <group position={position}>
    <mesh position={[0, 0.55, 0]} castShadow userData={{ cameraSolid: true }}><boxGeometry args={[1.7, 0.55, 3.8]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.72} /></mesh>
    <mesh position={[0, 1.05, -0.2]} castShadow><boxGeometry args={[1.45, 0.65, 1.9]} /><meshStandardMaterial color="#4c6264" metalness={0.55} roughness={0.3} /></mesh>
    <mesh position={[0, 1.4, -0.2]}><boxGeometry args={[1.55, 0.09, 2]} /><meshStandardMaterial color={color} roughness={0.8} metalness={0.5} /></mesh>
    {[-1, 1].map(side => <group key={side}>{[-1.2, 1.2].map(z => <mesh key={z} position={[side * 0.82, 0.32, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.33, 0.33, 0.2, 16]} /><meshStandardMaterial color="#242827" roughness={0.95} /></mesh>)}<mesh position={[side * 0.55, 0.6, 1.92]}><boxGeometry args={[0.4, 0.22, 0.04]} /><meshStandardMaterial color="#bbba9f" metalness={0.35} roughness={0.45} /></mesh></group>)}
    <mesh position={[0, 0.35, 1.95]}><boxGeometry args={[1.65, 0.15, 0.08]} /><meshStandardMaterial color="#777871" metalness={0.8} roughness={0.5} /></mesh>
    <mesh position={[0.4, 0.84, 1.1]} rotation={[0.02, 0.02, -0.04]}><boxGeometry args={[0.7, 0.02, 1.2]} /><meshStandardMaterial color="#785d48" roughness={1} /></mesh>
  </group>
}
const TownScene = memo(function TownScene({ town, maps }: { town: Town; maps: ReturnType<typeof useSurfaces> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ camera }) => { if (group.current) group.current.visible = Math.hypot(camera.position.x - town.x, camera.position.z - town.z) < 235 })
  return <group ref={group}><AbandonedCar position={[town.x - 12, 0, town.z - 30]} color={town.color} />{BUILDINGS.filter(b => b.town === town.id).map(b => <Building key={b.seed} data={b} maps={maps} />)}<Landmark town={town} maps={maps} /><Label text={`${town.name} · ${town.biome.split(' ')[0]}`} position={[town.x - 6, 2.5, town.z - 44]} />
    {[-1, 1].map(side => <group key={side}><mesh position={[town.x + side * 7, 0.06, town.z]} receiveShadow><boxGeometry args={[2.7, 0.12, 86]} /><meshStandardMaterial color="#929382" /></mesh>{[-30, 0, 30].map(z => <group key={z} position={[town.x + side * 8, 0, town.z + z]}><mesh position={[0, 3, 0]}><cylinderGeometry args={[0.06, 0.12, 6, 6]} /><meshStandardMaterial color="#464e47" /></mesh><mesh position={[0, 6, 0]}><boxGeometry args={[1.2, 0.15, 0.4]} /><meshStandardMaterial color="#d8c18b" emissive="#dda95e" emissiveIntensity={0.5} /></mesh></group>)}</group>)}
  </group>
})
function Scatter() {
  const foliage = useMemo(() => {
    const pieces = [0, 1, 2].map(i => { const g = new THREE.ConeGeometry(1 - i * 0.22, 1.2, 12, 2); g.translate(0, i * 0.4 - 0.35, 0); return g })
    const result = mergeGeometries(pieces); pieces.forEach(g => g.dispose()); return result
  }, [])
  useEffect(() => () => foliage.dispose(), [foliage])
  const trunks = useRef<THREE.InstancedMesh>(null), leaves = useRef<THREE.InstancedMesh>(null), rocks = useRef<THREE.InstancedMesh>(null), grass = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), color = new THREE.Color()
    for (let i = 0; i < 950; i++) {
      const x = (random(i * 3) - 0.5) * 750, z = (random(i * 3 + 1) - 0.5) * 750
      const clear = roadDistance(x, z) < 11 || TOWNS.some(t => Math.hypot(t.x - x, t.z - z) < 49) || (Math.abs(x - LAKE.x) < 25 && Math.abs(z - LAKE.z) < 44)
      const y = terrainHeight(x, z), scale = clear ? 0 : 0.8 + random(i * 3 + 2) * 1.3
      matrix.compose(new THREE.Vector3(x, y + scale * 2, z), rotation, new THREE.Vector3(scale, scale * 2, scale)); trunks.current?.setMatrixAt(i, matrix)
      matrix.compose(new THREE.Vector3(x, y + scale * 5.5, z), rotation, new THREE.Vector3(scale * 2.2, scale * 4.5, scale * 2.2)); leaves.current?.setMatrixAt(i, matrix)
      const t = nearestTown(x, z); color.set(t.id === 'redmesa' || t.id === 'ashford' ? '#777343' : t.id === 'sunvale' ? '#8b8b45' : '#47674d').multiplyScalar(0.7 + random(i) * 0.5); leaves.current?.setColorAt(i, color)
    }
    for (let i = 0; i < 600; i++) {
      const x = (random(i + 5000) - 0.5) * 750, z = (random(i + 7000) - 0.5) * 750, s = roadDistance(x, z) < 8 || TOWNS.some(t => Math.hypot(t.x - x, t.z - z) < 46) ? 0 : 0.3 + random(i) * 2
      matrix.compose(new THREE.Vector3(x, terrainHeight(x, z) + s * 0.3, z), rotation, new THREE.Vector3(s * 1.8, s, s)); rocks.current?.setMatrixAt(i, matrix)
    }
    for (let i = 0; i < 7000; i++) {
      const x = (random(i + 11000) - 0.5) * 720, z = (random(i + 19000) - 0.5) * 720, s = roadDistance(x, z) < 7 || TOWNS.some(t => Math.hypot(t.x - x, t.z - z) < 10) || (Math.abs(x - LAKE.x) < 25 && Math.abs(z - LAKE.z) < 44) ? 0 : 0.3 + random(i + 3) * 0.6
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random(i) * Math.PI); matrix.compose(new THREE.Vector3(x, terrainHeight(x, z) + s * 0.4, z), rotation, new THREE.Vector3(s, s, s)); grass.current?.setMatrixAt(i, matrix)
    }
    for (const ref of [trunks, leaves, rocks, grass]) if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true }
  }, [])
  return <><instancedMesh ref={trunks} args={[undefined, undefined, 950]}><cylinderGeometry args={[0.18, 0.28, 2, 5]} /><meshStandardMaterial color="#655b47" /></instancedMesh><instancedMesh ref={leaves} args={[foliage, undefined, 950]}><meshStandardMaterial roughness={1} /></instancedMesh><instancedMesh ref={rocks} args={[undefined, undefined, 600]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#8b8270" roughness={1} /></instancedMesh><instancedMesh ref={grass} args={[undefined, undefined, 7000]}><coneGeometry args={[0.3, 1, 3]} /><meshStandardMaterial color="#8c9561" side={THREE.DoubleSide} /></instancedMesh></>
}
function LakeWater() {
  const material = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => { if (material.current) material.current.roughness = 0.22 + Math.sin(clock.elapsedTime * 1.5) * 0.035 })
  return <mesh position={[LAKE.x, -0.01, LAKE.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[44, 80]} /><meshStandardMaterial ref={material} color="#4b7e79" metalness={0.6} roughness={0.24} transparent opacity={0.88} /></mesh>
}

function Road({ road: r, maps, wet }: { road: typeof ROADS[number]; maps: ReturnType<typeof useSurfaces>; wet: boolean }) {
  const vertical = r.ax === r.bx, length = Math.hypot(r.bx - r.ax, r.bz - r.az)
  const textures = useMemo(() => { const color = maps.road.clone(), bump = maps.roadBump.clone(); for (const t of [color, bump]) { t.repeat.set(1, length / 8); t.needsUpdate = true } return { color, bump } }, [maps, length])
  useEffect(() => () => { textures.color.dispose(); textures.bump.dispose() }, [textures])
  return <group position={[(r.ax + r.bx) / 2, 0.015, (r.az + r.bz) / 2]} rotation={[0, vertical ? 0 : Math.PI / 2, 0]}><mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[9, length]} /><meshStandardMaterial map={textures.color} bumpMap={textures.bump} bumpScale={0.045} roughness={wet ? 0.32 : 0.94} color={wet ? '#404a49' : '#6c706e'} /></mesh>{[-1, 1].map(side => <mesh key={side} position={[side * 3.9, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.1, length]} /><meshStandardMaterial color="#d2d0b2" /></mesh>)}{Array.from({ length: Math.floor(length / 10) }, (_, j) => <mesh key={j} position={[0, 0.009, j * 10 - length / 2 + 4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.16, 3.8]} /><meshStandardMaterial color="#d2b975" /></mesh>)}</group>
}

export const Landscape = memo(function Landscape({ wet = false }: { wet?: boolean }) {
  const maps = useSurfaces()
  const { gl, scene } = useThree()
  useEffect(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const ctx = c.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, 128); gradient.addColorStop(0, '#7b9dad'); gradient.addColorStop(0.48, '#d8cfb4'); gradient.addColorStop(0.52, '#7b806c'); gradient.addColorStop(1, '#3d4438'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 128)
    const texture = new THREE.CanvasTexture(c); texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace
    const generator = new THREE.PMREMGenerator(gl), target = generator.fromEquirectangular(texture); const previous = scene.environment; scene.environment = target.texture
    generator.dispose(); texture.dispose()
    return () => { scene.environment = previous; target.dispose() }
  }, [gl, scene])
  const terrain = useMemo(() => {
    const g = new THREE.PlaneGeometry(800, 800, 160, 160); g.rotateX(-Math.PI / 2)
    const p = g.attributes.position, colors: number[] = [], color = new THREE.Color()
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, terrainHeight(x, z) - 0.06); const town = nearestTown(x, z); color.set(town.id === 'redmesa' ? '#bd977b' : town.id === 'ashford' ? '#9c947e' : town.id === 'sunvale' ? '#b9b28a' : '#91a789').multiplyScalar(0.88 + random(i) * 0.22); colors.push(color.r, color.g, color.b) }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g
  }, [])
  useEffect(() => () => terrain.dispose(), [terrain])
  return <><mesh geometry={terrain} receiveShadow userData={{ blocksShots: true }}><meshStandardMaterial map={maps.ground} bumpMap={maps.groundBump} bumpScale={0.12} vertexColors roughness={wet ? 0.72 : 1} /></mesh>
    {ROADS.map((road, i) => <Road key={i} road={road} maps={maps} wet={wet} />)}
    {TOWNS.map(town => <TownScene key={town.id} town={town} maps={maps} />)}<Scatter />
    <LakeWater />
    {Array.from({ length: 18 }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * 400, 14, Math.sin(i * 2.4) * 400]} scale={[45, 30 + i % 4 * 14, 45]}><coneGeometry args={[1, 2, 6]} /><meshStandardMaterial color={i % 2 ? '#6a7a75' : '#879185'} roughness={1} /></mesh>)}
  </>
})

export function Atmosphere({ clock, active, playerPosition, highQuality = false }: { highQuality?: boolean; clock: Clock; active: boolean; playerPosition: React.RefObject<THREE.Vector3> }) {
  const sun = useRef<THREE.DirectionalLight>(null), sky = useRef<THREE.Mesh>(null), clouds = useRef<THREE.InstancedMesh>(null), rain = useRef<THREE.Points>(null)
  const birds = useRef<THREE.InstancedMesh>(null), ambientTime = useRef(0)
  const birdMatrix = useMemo(() => new THREE.Matrix4(), [])
  const hemi = useRef<THREE.HemisphereLight>(null)
  const weather = weatherAt(clock.day, clock.hour)
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color('#527c96') }, bottom: { value: new THREE.Color('#e5d3a3') } }), [])
  const rainGeometry = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1800 }, (_, i) => random(i) * 50 - (i % 3 === 1 ? 0 : 25)), 3)); return g }, [])
  useEffect(() => () => rainGeometry.dispose(), [rainGeometry])
  useEffect(() => {
    if (!clouds.current) return
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < 36; i++) { matrix.makeScale(25 + random(i) * 40, 3 + random(i + 5) * 4, 12 + random(i + 7) * 20); matrix.setPosition((random(i + 1) - 0.5) * 800, 65 + random(i + 10) * 25, (random(i + 3) - 0.5) * 800); clouds.current.setMatrixAt(i, matrix) }
    clouds.current.instanceMatrix.needsUpdate = true; clouds.current.computeBoundingSphere()
  }, [])
  useFrame(({ scene }, delta) => {
    const angle = (clock.hour - 6) / 24 * Math.PI * 2, daylight = Math.max(0, Math.sin(angle)), dusk = Math.max(0, 1 - Math.abs(daylight - 0.1) * 4)
    const overcast = weather !== 'CLEAR', p = playerPosition.current
    uniforms.top.value.set(daylight < 0.01 ? '#0c1c30' : overcast ? '#61747b' : '#568bac')
    uniforms.bottom.value.set(daylight < 0.01 ? '#344a5d' : overcast ? '#a4b3ab' : dusk > 0.5 ? '#e3a66d' : '#e9d7ad')
    if (scene.fog instanceof THREE.Fog) { scene.fog.color.copy(uniforms.bottom.value); scene.fog.far = weather === 'RAIN' ? 165 : overcast ? 230 : 320 }
    scene.environmentIntensity = 0.15 + daylight * 0.45
    if (hemi.current) hemi.current.intensity = 0.22 + daylight * 0.65
    if (sky.current) sky.current.position.copy(p)
    if (sun.current) { sun.current.intensity = 0.15 + daylight * (overcast ? 0.7 : 2.2); sun.current.color.set(dusk > 0.5 ? '#ffbb7f' : '#fff1d1'); sun.current.position.set(p.x + Math.cos(angle) * 65, p.y + Math.max(12, Math.sin(angle) * 85), p.z + 35); sun.current.target.position.copy(p); sun.current.target.updateMatrixWorld() }
    if (active) {
      ambientTime.current += Math.min(delta, 0.1)
      if (birds.current) {
        for (let i = 0; i < 24; i++) { const town = TOWNS[Math.floor(i / 4)], a = ambientTime.current * 0.14 + i * 1.3; birdMatrix.makeRotationY(-a); birdMatrix.scale(new THREE.Vector3(0.8, 0.1 + Math.abs(Math.sin(ambientTime.current * 6 + i)) * 0.6, 0.5)); birdMatrix.setPosition(town.x + Math.cos(a) * (25 + i % 4 * 3), 19 + Math.sin(a * 2) * 2, town.z + Math.sin(a) * 25); birds.current.setMatrixAt(i, birdMatrix) }
        birds.current.instanceMatrix.needsUpdate = true
      }
      if (clouds.current) clouds.current.position.x = (clouds.current.position.x + Math.min(delta, 0.1) * 0.7) % 120
      if (rain.current && weather === 'RAIN') { rain.current.position.set(p.x, p.y, p.z); const a = rainGeometry.attributes.position; for (let i = 0; i < a.count; i++) a.setY(i, (a.getY(i) - Math.min(delta, 0.05) * 18 + 50) % 50); a.needsUpdate = true }
    }
  })
  return <><fog attach="fog" args={['#e9d7ad', 50, 320]} /><hemisphereLight ref={hemi} args={['#bad9e8', '#62513c', 1.1]} /><ambientLight intensity={0.2} /><directionalLight key={highQuality ? 'high' : 'balanced'} ref={sun} castShadow shadow-mapSize={highQuality ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-camera-far={220} shadow-normalBias={0.08} />
    <mesh ref={sky} frustumCulled={false}><sphereGeometry args={[700, 24, 16]} /><shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms} vertexShader="varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="varying vec3 v; uniform vec3 top; uniform vec3 bottom; void main(){float h=clamp(normalize(v).y*1.6,0.,1.);gl_FragColor=vec4(mix(bottom,top,h),1.);}" /></mesh>
    <instancedMesh ref={clouds} args={[undefined, undefined, 36]}><sphereGeometry args={[1, 8, 5]} /><meshStandardMaterial color={weather === 'CLEAR' ? '#e2e0cd' : '#899798'} transparent opacity={0.65} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={birds} args={[undefined, undefined, 24]} frustumCulled={false} userData={{ decorative: true }}><coneGeometry args={[0.6, 0.5, 3]} /><meshBasicMaterial color="#283932" side={THREE.DoubleSide} /></instancedMesh>
    <points ref={rain} geometry={rainGeometry} visible={weather === 'RAIN'}><pointsMaterial color="#c1d7e1" size={0.06} transparent opacity={0.55} depthWrite={false} /></points>
  </>
}
