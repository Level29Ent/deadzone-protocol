'use client'

import { memo } from 'react'
import { EXTRACTION, RELAYS, canExtract, type Campaign } from './campaign'

export const RelayNetwork = memo(function RelayNetwork({ campaign }: { campaign: Campaign }) {
  const ready = canExtract(campaign)
  return <group>{RELAYS.map(relay => {
    const online = campaign.repaired.includes(relay.id), color = online ? '#8ed3ad' : '#e2af6b'
    return <group key={relay.id} position={[relay.x, 0, relay.z]} userData={{ relayId: relay.id }}>
      <mesh position={[0, 0.08, 0]} receiveShadow><cylinderGeometry args={[1.1, 1.2, 0.15, 16]} /><meshStandardMaterial color="#596058" /></mesh>
      <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[0.75, 1.5, 0.5]} /><meshStandardMaterial color="#46594e" metalness={0.5} roughness={0.65} /></mesh>
      <mesh position={[0, 1.12, -0.26]}><boxGeometry args={[0.48, 0.28, 0.02]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.25, 2.5, 0]}><cylinderGeometry args={[0.025, 0.04, 3.4, 8]} /><meshStandardMaterial color="#8e9487" metalness={0.7} /></mesh>
      <mesh position={[0.25, 3.8, 0]} rotation={[0, 0, 0.4]}><torusGeometry args={[0.35, 0.035, 6, 18]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={online ? 0.5 : 0.1} /></mesh>
      <mesh position={[0, 2.2, 0]}><octahedronGeometry args={[0.16]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  })}<group position={[EXTRACTION.x, 0, EXTRACTION.z]}>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.8, 4.1, 48]} /><meshBasicMaterial color={ready ? '#90d8b0' : '#7b806a'} transparent opacity={0.8} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 4.5, 0, 0]}><mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[1.3, 1.2, 1.4]} /><meshStandardMaterial color="#646852" /></mesh><mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.14, 12, 8]} /><meshBasicMaterial color={ready ? '#9bdfb0' : '#9a5f49'} /></mesh></group>)}
  </group></group>
})
