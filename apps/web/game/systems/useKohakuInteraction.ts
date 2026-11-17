'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CLUB_NPCS } from './characterAssets';
import type { HinataActionMode, KohakuNpcId } from './kohakuNpcMotion';
import { planHinataKiss, type PlayerKissCue } from './hinataKiss';

export type KohakuPersona = {
  id: KohakuNpcId;
  name: string;
  badge: string;
  title: string;
  description: string;
};

export const KOHAKU_NPC_PERSONAS: Record<KohakuNpcId, KohakuPersona> = {
  shinku: {
    id: 'shinku',
    name: 'Shinku',
    badge: '琥珀 KOHAKU · DEALER BÀN POKER VIP',
    title: 'Xin mời quý khách ngồi vào bàn Poker 琥珀 Kohaku',
    description:
      'Bàn Poker trung tâm Tầng 1 phục vụ tối đa 4 người chơi tại ghế PLAYER 1–4. Ngay khi quý khách ngồi vào ghế chơi, tôi sẽ ngồi vào ghế Dealer đối diện để chuẩn bị chia bài; ghế của Dealer dành riêng cho NPC vận hành bàn chơi.',
  },
  hinata: {
    id: 'hinata',
    name: 'Hinata',
    badge: '琥珀 KOHAKU · LỄ TÂN THẢM ĐỎ VIP',
    title: 'Chào mừng quý khách ghé thăm Kohaku Private Members Club!',
    description:
      'Rất hân hạnh được đón tiếp quý khách tại thảm đỏ sảnh chính. Xin mời quý khách vào bàn Poker VIP ở giữa sảnh, thưởng thức Whisky & Xì gà cổ điển ở quầy Bar cánh trái, hoặc bước lên cầu thang cánh phải để tham quan Tầng 2 Gallery và Tầng 3 Penthouse.',
  },
  bartender: {
    id: 'bartender',
    name: 'Caca',
    badge: '琥珀 KOHAKU · WHISKY & CIGAR BARTENDER',
    title: 'Quý khách muốn dùng thức uống đặc biệt nào tối nay?',
    description:
      'Quầy Bar Whisky cánh trái luôn chuẩn bị sẵn những dòng rượu mạch nha đơn cất lâu năm và cocktail cổ điển. Chọn một món để tôi pha chế, hoặc hỏi tôi luật chơi của các bàn trong Kohaku trước khi ngồi vào nhé.',
  },
};

const KOHAKU_NPC_IDS: readonly KohakuNpcId[] = ['shinku', 'hinata', 'bartender'];

/** Tìm NPC Kohaku ở gần người chơi trên Tầng 1 (y < 1.5m) trong phạm vi bấm phím F. */
export function nearestKohakuNpc(
  player?: { x: number; y?: number; z: number; seatId?: string },
  dealerPosition?: [number, number],
): KohakuNpcId | null {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z) || (player.y ?? 0) >= 1.5) {
    return null;
  }
  let bestId: KohakuNpcId | null = null;
  let bestDist = Infinity;
  for (const id of KOHAKU_NPC_IDS) {
    const pos = id === 'shinku' && dealerPosition ? dealerPosition : [CLUB_NPCS[id].position[0], CLUB_NPCS[id].position[2]];
    const maxRadius = id === 'bartender' ? 3.05 : player.seatId?.startsWith('kohaku-player-') && id === 'shinku' ? 2.65 : 2.3;
    const dist = Math.hypot(player.x - pos[0], player.z - pos[1]);
    if (dist <= maxRadius && dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }
  return bestId;
}

/** Quản lý hộp thoại tương tác phím F cho 3 NPC Tầng 1 của Kohaku Club và trạng thái gọi đồ uống. */
export function useKohakuInteraction({
  player,
  enabled,
  present,
  dealerSeated,
}: {
  player?: { x: number; y?: number; z: number; seatId?: string };
  enabled: boolean;
  /** Khách đang ở trong Kohaku và cảnh đã sẵn sàng (kể cả khi đang ngồi bàn): mỗi lần bật lên, Hinata cúi chào một lần. */
  present: boolean;
  dealerSeated: boolean;
}) {
  const [openNpc, setOpenNpc] = useState<KohakuNpcId | null>(null);
  const [nearNpc, setNearNpc] = useState<KohakuNpcId | null>(null);
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const [hinataMode, setHinataMode] = useState<HinataActionMode>('idle');
  const [hinataActionKey, setHinataActionKey] = useState(0);
  const [hinataFeedback, setHinataFeedback] = useState<string | null>(null);
  const [kissCue, setKissCue] = useState<PlayerKissCue | null>(null);
  const kissTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearKissTimer = useCallback(() => {
    kissTimers.current.forEach(clearTimeout);
    kissTimers.current = [];
  }, []);

  const dealerPos: [number, number] = dealerSeated
    ? [0, -1.88]
    : [CLUB_NPCS.shinku.position[0], CLUB_NPCS.shinku.position[2]];

  const context = useRef({ player, enabled, dealerPos });
  context.current = { player, enabled, dealerPos };

  const open = useCallback(() => {
    const current = context.current;
    if (!current.enabled) return;
    const target = nearestKohakuNpc(current.player, current.dealerPos);
    if (target) setOpenNpc(target);
  }, []);

  const close = useCallback(() => setOpenNpc(null), []);

  const orderDrink = useCallback((drinkName: string) => {
    setLastOrder(`Bartender Caca vừa pha chế & phục vụ quý khách ly ${drinkName}. Chúc quý khách ngon miệng!`);
  }, []);

  /** Người chơi bước tới trước mặt Hinata; khi tới nơi cả hai cùng bắt đầu clip Kiss để môi chạm đúng nhịp. */
  const triggerHinataKiss = useCallback(() => {
    const current = context.current.player;
    if (!current) return;
    clearKissTimer();
    const hinata = CLUB_NPCS.hinata;
    const { cue, approachMs } = planHinataKiss(
      current,
      { x: hinata.position[0], z: hinata.position[2], yaw: hinata.yaw },
      performance.now(),
      Date.now(),
    );
    setKissCue(cue);
    // Đóng hộp thoại để khách xem trọn cảnh hôn thay vì bị modal che.
    setOpenNpc(null);
    setHinataMode('idle');
    setHinataFeedback('Hinata vừa trao nụ hôn chào đón ngọt ngào dành riêng cho quý khách ♥');
    kissTimers.current = [
      setTimeout(() => {
        setHinataMode('kiss');
        setHinataActionKey(prev => prev + 1);
      }, approachMs),
      setTimeout(() => {
        setHinataMode('idle');
        setKissCue(null);
        kissTimers.current = [];
      }, cue.endAt - performance.now()),
    ];
  }, [clearKissTimer]);

  // Cúi chào một lần mỗi lượt khách vào Kohaku; sau đó Hinata đứng chờ, không lặp lại động tác chào.
  useEffect(() => {
    if (!present) return;
    setHinataMode(mode => (mode === 'kiss' ? mode : 'bow'));
    setHinataActionKey(prev => prev + 1);
  }, [present]);

  useEffect(() => {
    const check = () => {
      const current = context.current;
      if (!current.enabled) {
        setNearNpc(null);
        setOpenNpc(null);
        return;
      }
      const target = nearestKohakuNpc(current.player, current.dealerPos);
      setNearNpc(target);
      setOpenNpc(prev => (prev && prev === target ? prev : null));
    };
    check();
    const timer = setInterval(check, 100);

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.repeat ||
        event.key.toLowerCase() !== 'f' ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))
      ) {
        return;
      }
      const current = context.current;
      if (!current.enabled) return;
      const nearest = nearestKohakuNpc(current.player, current.dealerPos);
      if (nearest) {
        event.preventDefault();
        setOpenNpc(nearest);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearKissTimer();
      setHinataMode(mode => (mode === 'kiss' ? 'idle' : mode));
      setKissCue(null);
      setHinataFeedback(null);
      setNearNpc(null);
      setOpenNpc(null);
    }
  }, [enabled, clearKissTimer]);

  useEffect(() => () => clearKissTimer(), [clearKissTimer]);

  return {
    nearNpc,
    openNpc,
    lastOrder,
    hinataMode,
    hinataActionKey,
    hinataFeedback,
    kissCue,
    open,
    close,
    orderDrink,
    triggerHinataKiss,
  };
}
