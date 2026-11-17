'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { MathUtils, Object3D, type Group, type Light, type SpotLight } from 'three';
import { KOHAKU_SEATS, type BluffTableView } from '@metaverse/game-protocol';
import { STAGING_DIM, stagingDim } from '../systems/bluffStaging';

/** Thời gian chuyển sáng ↔ tối (giây). */
const FADE_SECONDS = 0.6;
const SPOT_COLOR = '#fff1d6';
const SPOT_HEIGHT = 3.2;
/** Đủ sáng để người cầm súng nổi bật khi đèn phòng chỉ còn 25%. */
const SPOT_INTENSITY = 40;

/**
 * Lúc bóp cò: hạ mọi đèn trong `roomLights` về STAGING_DIM và bật spotlight rọi ghế người cầm súng.
 * Độ sáng gốc lưu một lần trong userData nên nhân hệ số mỗi frame không bị cộng dồn.
 */
export function BluffStagingLights({ table, roomLights }: { table: BluffTableView; roomLights: RefObject<Group | null> }) {
  const spot = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const factor = useRef(1);
  const seat = KOHAKU_SEATS.find(item => item.id === table.shooterSeat);
  const goal = stagingDim(table);

  useEffect(() => { if (spot.current) spot.current.target = target; }, [target]);
  // Component chỉ mount khi có ván bóp cò; unmount thì trả hệ số về 1 để đèn pool không kẹt ở mức mờ.
  useEffect(() => () => {
    const group = roomLights.current;
    if (group) group.userData.stagingFactor = 1;
  }, [roomLights]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1) * (1 - STAGING_DIM) / FADE_SECONDS;
    factor.current = factor.current < goal ? Math.min(goal, factor.current + step) : Math.max(goal, factor.current - step);
    // Đèn pool tự nhân hệ số này (PooledPointLights) để mỗi đèn chỉ có một nơi ghi intensity, không chớp.
    if (roomLights.current) roomLights.current.userData.stagingFactor = factor.current;
    roomLights.current?.traverse(node => {
      const light = node as Light;
      if (!light.isLight || light.userData.pooled) return;
      light.userData.baseIntensity ??= light.intensity;
      light.intensity = light.userData.baseIntensity * factor.current;
    });
    if (!spot.current) return;
    // Spotlight sáng lên đúng nhịp đèn phòng tối đi, và giữ ở ghế cũ khi tắt dần.
    spot.current.intensity = SPOT_INTENSITY * MathUtils.clamp((1 - factor.current) / (1 - STAGING_DIM), 0, 1);
    if (seat) {
      spot.current.position.set(seat.x, SPOT_HEIGHT, seat.z);
      target.position.set(seat.x, 0.9, seat.z);
      target.updateMatrixWorld();
    }
  });

  return <>
    <spotLight ref={spot} color={SPOT_COLOR} intensity={0} angle={0.38} penumbra={0.6} distance={6} decay={1.5} />
    <primitive object={target} />
  </>;
}
