'use client';
import { Stars, Sparkles, Text } from '@react-three/drei';
import type { ReactNode } from 'react';
function Building({ x, z, label, height, color }: { x: number; z: number; label: string; height: number; color: string }) {
  return <group position={[x,0,z]}>
    <mesh position={[0,height/2,0]} castShadow receiveShadow><boxGeometry args={[5.6,height,5.6]}/><meshStandardMaterial color={color} roughness={0.7}/></mesh>
    <mesh position={[0,height*0.7,2.86]}><planeGeometry args={[5.4, 1.05]}/><meshBasicMaterial color="#1f1435"/></mesh>
    <Text position={[0,height*0.7,2.89]} fontSize={0.4} color="#ffc7f3" anchorX="center" outlineWidth={0.01} outlineColor="#68306f">{label}</Text>
    {[1.5,3,4.5].map(y => y < height - 1 && <mesh key={y} position={[0,y,2.84]}><boxGeometry args={[5.6,0.07,0.08]}/><meshBasicMaterial color="#f472b6"/></mesh>)}
    <pointLight position={[0,3,3]} color="#f472b6" intensity={3} distance={9}/>
  </group>;
}
function Lantern({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}><mesh position={[0, 2, 0]}><cylinderGeometry args={[0.08,0.1,4,8]}/><meshStandardMaterial color="#6b5b84"/></mesh><mesh position={[0,4,0]}><sphereGeometry args={[0.28,10,10]}/><meshBasicMaterial color="#ff91cf"/></mesh></group>;
}
export function SakuraBlockout({ children }: { children?: ReactNode }) {
  return <>
    <color attach="background" args={['#130c2b']}/><fog attach="fog" args={['#130c2b',19,64]}/>
    <ambientLight intensity={1.15}/><hemisphereLight color="#d9b9ff" groundColor="#181025" intensity={0.6}/>
    <directionalLight position={[8,16,7]} intensity={1.6}/>
    <Stars radius={80} depth={20} count={700} factor={2.5} fade/>
    <Sparkles count={70} scale={[42,8,42]} size={1.8} speed={0.2} color="#ffc6ea"/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[120,120]}/><meshStandardMaterial color="#201936"/></mesh>
    <mesh position={[0,0.014,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[8,54]}/><meshStandardMaterial color="#34324f"/></mesh>
    <mesh position={[0,0.016,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[54,8]}/><meshStandardMaterial color="#34324f"/></mesh>
    {Array.from({length:11}, (_,i)=><mesh key={i} position={[0,0.028,-20+i*4]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[0.11,1.7]}/><meshBasicMaterial color="#fdd6f5"/></mesh>)}
    <Building x={-9} z={-10} label="SAKURA CLUB" height={8} color="#5b285e"/>
    <Building x={9} z={-10} label="MOON LOUNGE" height={7} color="#264d69"/>
    <Building x={-9} z={9} label="AVATAR SHOP" height={6} color="#78405f"/>
    <Building x={9} z={9} label="VIP TOWER" height={10} color="#62447b"/>
    {[-1,1].flatMap(side => Array.from({length:7},(_,i)=><Lantern key={`${side}-${i}`} x={side*3.75} z={-17+i*5}/>))}
    {children}
  </>;
}

