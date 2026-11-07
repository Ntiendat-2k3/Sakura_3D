'use client';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, AnimationMixer, Color, ConeGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, SpotLight, Vector3 } from 'three';
import type { ClubShow } from '@metaverse/game-protocol';
import { getClubBeat, type ClubVisualSettings } from './BeatSyncController';
import layout from '../scenes/club-lighting-layout.json';
import { CLUB_DJ_LAYOUT as djLayout } from '@metaverse/game-protocol';

const movers = [...layout.filter(e => e.role === 'moving' || e.role === 'surround'),
  { id: '34104', role: 'dj-key', position: djLayout.keyLight.position, rotation: [0, Math.PI, Math.PI] },
  { id: '34104', role: 'dj-rim', position: djLayout.rimLight.position, rotation: [0, Math.PI, Math.PI] }];
const spectrum = ['#ff315e', '#ff8a35', '#ffe16b', '#55ed87', '#39d9ff', '#6266ff', '#cf63ff'].map(color => new Color(color));
const surroundActive = { low: [0, 5], medium: [0, 2, 4], high: [0, 2, 3, 5] };
const stageKeyColor = new Color('#ffe8dd');

export function ClubFixture({ id, position, rotation }: { id: string; position: number[]; rotation: number[] }) {
  const { scene } = useGLTF(`/assets/props/club/${id}.glb`);
  const instance = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={instance} position={position} rotation={rotation} dispose={null}/>;
}

function MovingHead({ index, epoch, show, settings }: { index: number; epoch: number; show: ClubShow; settings: ClubVisualSettings }) {
  const { gl } = useThree();
  const lastMetric = useRef(0);
  const entry = movers[index];
  const surround = entry.role === 'surround';
  const dj = entry.role.startsWith('dj-');
  const djLight = entry.role === 'dj-rim' ? djLayout.rimLight : djLayout.keyLight;
  const stageKey = dj || !surround && index >= 2;
  const { scene } = useGLTF('/assets/props/club/34104.glb');
  const rig = useMemo(() => {
    const model = scene.clone(true);
    const head = model.getObjectByName('head')!;
    const yoke = model.getObjectByName('yoke')!;
    const color = new Color(index % 2 ? '#69d9ff' : '#f557ad');
    const light = new SpotLight(color, 24, 14, .37, .65, 1.4);
    light.position.set(0, 0, .23);
    const target = new Object3D(); target.position.set(0, 0, 10);
    head.add(light, target); light.target = target;
    const material = new MeshBasicMaterial({ color, transparent: true, opacity: .055, depthWrite: false, blending: AdditiveBlending });
    const length = surround ? 9.6 : 7;
    const geometry = new ConeGeometry(surround ? 1.6 : 1.9, length, 16, 1, true);
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, length / 2 + .2);
    const beam = new Mesh(geometry, material); head.add(beam);
    const lensMaterials: MeshStandardMaterial[] = [];
    model.getObjectByName('lens')?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const clone = (source: MeshStandardMaterial) => {
        const copy = source.clone(); lensMaterials.push(copy); return copy;
      };
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
    });
    return { model, head, yoke, light, beam, material, geometry, lensMaterials, target: new Vector3() };
  }, [scene, index, surround]);
  useEffect(() => () => { rig.light.dispose(); rig.geometry.dispose(); rig.material.dispose(); rig.lensMaterials.forEach(m => m.dispose()); delete gl.domElement.dataset[`movingHead${index}`]; }, [rig, gl, index]);
  useFrame(() => {
    const clock = getClubBeat(epoch, show);
    const beat = clock.elapsedBeat;
    const slow = Math.sin(beat * Math.PI / 16 + index * Math.PI / 2);
    if (surround) {
      // Đổi điểm ngắm thế giới sang không gian fixture để model và tia thật luôn cùng hướng.
      const angle = beat * Math.PI / (settings.reducedFlashing ? 32 : 16) + index;
      rig.model.worldToLocal(rig.target.set(Math.cos(angle) * 3.6, .15, Math.sin(angle) * 3.8));
    } else if (dj) {
      rig.model.worldToLocal(rig.target.fromArray(djLight.target));
    } else {
      const dancerX = index % 2 ? 2 : -2;
      rig.model.worldToLocal(rig.target.set(dancerX + (stageKey ? 0 : .45 * slow), stageKey ? 1.8 : 1.65 + .2 * Math.sin(beat * Math.PI / 8), -5.3));
    }
    rig.target.sub(rig.yoke.position); rig.target.y -= rig.head.position.y;
    rig.yoke.rotation.y = Math.atan2(rig.target.x, rig.target.z);
    rig.head.rotation.x = Math.atan2(-rig.target.y, Math.hypot(rig.target.x, rig.target.z));
    const ringIndex = index - 4;
    const enabled = surround
      ? surroundActive[settings.quality].includes(ringIndex)
      : settings.quality === 'high' || index >= 2;
    const colorPosition = beat / (settings.reducedFlashing ? 16 : 4) + index * .93;
    const colorIndex = Math.floor(colorPosition) % spectrum.length;
    const blend = colorPosition % 1;
    rig.light.color.lerpColors(spectrum[colorIndex], spectrum[(colorIndex + 1) % spectrum.length], blend * blend * (3 - 2 * blend));
    if (stageKey) { if (dj) rig.light.color.set(djLight.color); else rig.light.color.copy(stageKeyColor); }
    rig.material.color.copy(rig.light.color);
    rig.lensMaterials.forEach(material => { material.color.copy(rig.light.color); material.emissive.copy(rig.light.color); });
    const energy = clock.cue === 'lounge' ? .5 : clock.cue === 'peak' ? 1.2 : .85;
    const pulse = settings.reducedFlashing ? .9 + .1 * slow : .78 + .22 * Math.cos(beat * Math.PI / 2);
    rig.light.intensity = enabled ? (dj ? djLight.intensity : stageKey ? 42 : (surround ? 42 : 22) * energy * pulse) : 0;
    rig.light.visible = enabled;
    rig.beam.visible = enabled && (surround || settings.quality !== 'low');
    rig.material.opacity = settings.reducedFlashing ? .035 : .05 * energy;
    if (process.env.NODE_ENV === 'development' && Date.now() - lastMetric.current > 200) {
      lastMetric.current = Date.now();
      gl.domElement.dataset[`movingHead${index}`] = JSON.stringify({ pan: rig.yoke.rotation.y, tilt: rig.head.rotation.x, color: rig.light.color.getHexString(), mode: stageKey ? 'steady-key' : 'spectrum', spectrumIndex: stageKey ? null : colorIndex, intensity: rig.light.intensity, active: rig.light.visible });
    }
  });
  return <primitive object={rig.model} position={entry.position} rotation={entry.rotation} dispose={null}/>;
}

function SpinningFixture({ entry, epoch, show }: { entry: typeof layout[number]; epoch: number; show: ClubShow }) {
  const { scene, animations } = useGLTF(`/assets/props/club/${entry.id}.glb`);
  const instance = useMemo(() => scene.clone(true), [scene]);
  const mixer = useMemo(() => new AnimationMixer(instance), [instance]);
  useEffect(() => {
    animations.forEach(a => mixer.clipAction(a).play());
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(instance); };
  }, [mixer, instance, animations]);
  useFrame(() => mixer.setTime(getClubBeat(epoch, show).seconds * .25));
  return <primitive object={instance} position={entry.position} rotation={entry.rotation} dispose={null}/>;
}

/** Model và SpotLight cùng gắn vào pivot đầu đèn, nên pan/tilt luôn đúng hướng chiếu thực. */
export function StageLightingSystem({ epoch, show, settings }: { epoch: number; show: ClubShow; settings: ClubVisualSettings }) {
  const { gl } = useThree();
  useEffect(() => { gl.domElement.dataset.clubFixtures = 'gltf-cc0'; return () => { delete gl.domElement.dataset.clubFixtures; }; }, [gl]);
  return <>
    {movers.map((_, index) => <MovingHead key={index} index={index} epoch={epoch} show={show} settings={settings}/>)}
    {layout.filter(e => ['booth', 'mixer', 'laser'].includes(e.role)).map((e, i) => <ClubFixture key={i} {...e}/>)}
    {layout.filter(e => ['deck', 'disco'].includes(e.role)).map((entry, i) => <SpinningFixture key={i} entry={entry} epoch={epoch} show={show}/>)}
    <SpinningFixture entry={djLayout.booth} epoch={epoch} show={show}/>
  </>;
}
