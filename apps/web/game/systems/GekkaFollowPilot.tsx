'use client';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject, type RefObject } from 'react';
import type { Group } from 'three';
import type { GekkaEscortPlan, MoveInput, PokerTableView } from '@metaverse/game-protocol';
import { escortPlanCache } from './gekkaExecutioner';
import { followPilotStep, followRoute, followSlot, type FollowRoute } from './gekkaFollow';

/**
 * Lái nhân vật của mình theo đoàn bị lôi xuống hầm: ghi input vào autoMove để PlayerInput gửi như phím bấm.
 * Luôn ghi nhớ lộ trình đoàn gần nhất (kể cả khi chưa bấm đi theo) để còn đi tiếp xuống hầm sau khi đoàn tới nơi.
 */
export function GekkaFollowPilot({ table, sessionId, avatar, autoMove, active, onArrive }: {
  table: PokerTableView;
  sessionId: string;
  avatar: RefObject<Group | null>;
  autoMove: MutableRefObject<MoveInput | null>;
  active: boolean;
  onArrive: () => void;
}) {
  const planFor = useMemo(() => escortPlanCache(), []);
  const slot = useMemo(() => followSlot(sessionId), [sessionId]);
  const last = useRef<{ plan: GekkaEscortPlan; route: FollowRoute } | null>(null);
  const latest = useRef({ table, active, onArrive });
  latest.current = { table, active, onArrive };

  // Chạy trước PlayerInput (-3) để input lái có hiệu lực ngay frame này.
  useFrame(() => {
    const { table: current, active: following } = latest.current;
    const plan = planFor(current.escort);
    if (plan && last.current?.plan !== plan) last.current = { plan, route: followRoute(plan, slot) };
    const root = avatar.current;
    if (!following || !root || !last.current) { autoMove.current = null; return; }
    const result = followPilotStep({
      plan: last.current.plan, route: last.current.route, slot,
      escortSeconds: plan ? (Date.now() - current.escort.startedAt) / 1000 : null,
      position: { x: root.position.x, y: root.position.y, z: root.position.z },
    });
    autoMove.current = result.arrived ? null : result.move;
    if (result.arrived) latest.current.onArrive();
  }, -4);

  return null;
}
