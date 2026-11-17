'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorldZone } from '@metaverse/game-protocol';
import { nearestLoungeNpc, type LoungeNpcId, type LoungeNpcMode } from './loungeNpcMotion';

export type HostessPersona = {
  id: LoungeNpcId;
  name: string;
  badge: string;
  greetingTitle: string;
  companionLine: string;
  hotelLine: string;
  lines: Record<LoungeNpcMode, string>;
};

export const LOUNGE_HOSTESS_PERSONAS: Record<LoungeNpcId, HostessPersona> = {
  yuzu: {
    id: 'yuzu',
    name: 'Yuzu',
    badge: 'REIKA LOUNGE · ĐÀO ĐÓN KHÁCH (20+)',
    greetingTitle: 'Đêm nay anh muốn em chiều kiểu nào đây~?',
    companionLine: 'Em đang khoác tay đi cùng anh đây~ Anh ra phố dạo, vào Club nhảy hay dắt em leo cầu thang bộ lên Tầng 2 Love Hotel là Yuzu cũng theo sát anh hết đêm nay luôn ♥',
    hotelLine: 'Ưm~ Anh dắt Yuzu từ sảnh Lounge leo cầu thang bộ lên thẳng phòng Love Hotel tầng 2 thế này làm tim em đập thình thịch rồi nè… Mau khóa cửa lại đi anh yêu, chiếc giường King-size và bồn Jacuzzi đang chờ hai đứa mình kìa ♥',
    lines: {
      idle: 'Vừa bước vào cửa là em đã để ý ánh mắt của anh rồi đó… Lại gần đây thêm chút nữa đi, hương nước hoa của em đêm nay dành riêng cho anh đấy.',
      walk: 'Đi chậm thôi anh yêu, để em sóng bước sát bên anh nào~ ♥',
      flirt: 'Ưm~ Anh nhìn em chăm chú thế làm tim em đập loạn nhịp rồi nè… Nhận lấy nụ hôn gió của Yuzu nhé, cưng ơi ♥',
      toast: 'Một ly Champagne hồng ướp lạnh mở màn đêm phố đèn đỏ nhé? Uống cạn ly này từ tay em rồi dắt em lên cầu thang tầng 2 tâm sự…',
      dance: 'Ánh đèn mờ thế này mà không nhảy sát bên anh thì phí lắm~ Nhìn đường cong của em chuyển động theo nhịp nhạc dành riêng cho anh nè!',
    },
  },
  bunny: {
    id: 'bunny',
    name: 'Bunny',
    badge: 'REIKA LOUNGE · NÀNG THỎ QUẦY BAR (20+)',
    greetingTitle: 'Khát rượu hay khát em vậy anh trai~?',
    companionLine: 'Nàng thỏ Bunny đã thuộc về riêng anh đêm nay rồi đó~ Dắt tay Bunny leo cầu thang bộ lên Tầng 2 Love Hotel khóa trái cửa lại đi nào ♥',
    hotelLine: 'Lên tới tầng 2 Love Hotel rồi thì khóa chặt cửa lại nhé anh~ Nước bồn tắm Jacuzzi đang ấm sẵn, rượu Champagne trên Minibar cũng mở rồi… Anh lại giường King-size ngồi đi để nàng thỏ nhảy riêng phục vụ anh tận nơi nhé ♥',
    lines: {
      idle: 'Ở quầy Champagne này, loại rượu ngọt và dễ say nhất chính là đôi môi của Bunny đó… Anh dám thử một ngụm không?',
      walk: 'Đợi Bunny bước theo với nào anh trai~ ♥',
      flirt: 'Bộ đồ thỏ đêm nay hơi bó sát một chút… Anh thấy có hợp mắt anh không? Đừng chỉ nhìn từ xa thế chứ~ ♥',
      toast: 'Ly Dom Pérignon đặc biệt do chính tay Bunny rót cho anh đây. Nhấp một ngụm trên môi em rồi nói nhỏ điều anh muốn đêm nay nhé…',
      dance: 'Xem nàng thỏ của anh lắc hông bên quầy bar nè~ Nhịp điệu càng về khuya càng nóng bỏng đó nha!',
    },
  },
  zankou: {
    id: 'zankou',
    name: 'Zankou',
    badge: 'REIKA LOUNGE · ĐÀO VIP ĐẦU BẢNG (20+)',
    greetingTitle: 'Ghé khu Sofa VIP cùng em đêm nay chứ?',
    companionLine: 'Đào VIP đầu bảng Zankou đêm nay chỉ sánh bước bên một mình anh thôi… Dắt tay em theo cầu thang bộ lên phòng Tầng 2 Love Hotel em chiều anh tới bến ♥',
    hotelLine: 'Phòng Suite tầng 2 của toà Reika đúng chuẩn gu sang trọng của Zankou và anh đấy… Đèn neon đỏ rực, đệm nhung êm và gương phản chiếu trên trần. Hãy chỉnh màu đèn anh thích, bật một bản nhạc thật tình rồi lại giường King-size để Zankou chiều chuộng anh suốt đêm nay nhé ♥',
    lines: {
      idle: 'Không phải vị khách nào cũng được bước tới góc nhung đỏ của Zankou đâu… Ngồi xuống ghế VIP đi, để em chăm sóc anh từ đầu tới cuối.',
      walk: 'Cứ dẫn đường đi anh, Zankou luôn ở ngay cạnh anh đây~ ♥',
      flirt: 'Ánh đèn tím khu VIP chỉ làm làn da em thêm rực lửa thôi… Lại sát đây, em thì thầm điều bí mật chỉ hai đứa mình biết nhé ♥',
      toast: 'Rượu quý chỉ dành cho khách VIP biết thưởng thức cái đẹp. Cụng ly với Zankou nào, đêm ở lầu Reika còn dài lắm…',
      dance: 'Điệu nhảy uốn lượn nóng bỏng nhất của khu VIP xin dâng trọn cho ánh nhìn của anh~ Cứ ngồi tựa lưng vào sofa và tận hưởng em đi.',
    },
  },
};

/** Quản lý tương tác phím F, chế độ biểu diễn 20+ và tính năng "Đi với anh nhé" xuyên suốt các phòng. */
export function useLoungeInteraction({
  player,
  zone = 'lounge',
  enabled,
  rosettaNear = false,
}: {
  player?: { x: number; z: number };
  zone?: WorldZone;
  enabled: boolean;
  rosettaNear?: boolean;
}) {
  const [openNpc, setOpenNpc] = useState<LoungeNpcId | null>(null);
  const [nearNpc, setNearNpc] = useState<LoungeNpcId | null>(null);
  const [companionId, setCompanionId] = useState<LoungeNpcId | null>(null);
  const [modes, setModes] = useState<Record<LoungeNpcId, LoungeNpcMode>>({
    yuzu: 'idle',
    bunny: 'idle',
    zankou: 'idle',
  });
  const context = useRef({ player, zone, enabled, companionId, rosettaNear });
  context.current = { player, zone, enabled, companionId, rosettaNear };

  const close = useCallback(() => setOpenNpc(null), []);
  const open = useCallback(() => {
    const current = context.current;
    if (!current.enabled) return;
    if (current.zone === 'lounge') {
      const nearest = nearestLoungeNpc(current.player);
      if (nearest) {
        setOpenNpc(nearest.id);
        return;
      }
    }
    if (current.companionId && !current.rosettaNear) {
      setOpenNpc(current.companionId);
    }
  }, []);

  const setNpcMode = useCallback((id: LoungeNpcId, mode: LoungeNpcMode) => {
    setModes(prev => ({ ...prev, [id]: mode }));
  }, []);

  const toggleCompanion = useCallback((id: LoungeNpcId) => {
    setCompanionId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        setModes(m => ({ ...m, [id]: m[id] === 'idle' ? 'flirt' : m[id] }));
      }
      return next;
    });
    setOpenNpc(null);
  }, []);

  useEffect(() => {
    const check = () => {
      const current = context.current;
      if (!current.enabled) {
        setNearNpc(null);
        setOpenNpc(null);
        return;
      }
      const nearestInLounge = current.zone === 'lounge' ? nearestLoungeNpc(current.player) : undefined;
      const targetId = nearestInLounge?.id ?? (!current.rosettaNear ? current.companionId : null);
      setNearNpc(targetId ?? null);
      setOpenNpc(prev => (prev && (prev === nearestInLounge?.id || prev === current.companionId) ? prev : null));
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
      if (!current.enabled || current.rosettaNear) return;
      const nearestInLounge = current.zone === 'lounge' ? nearestLoungeNpc(current.player) : undefined;
      const targetId = nearestInLounge?.id ?? current.companionId;
      if (targetId) {
        event.preventDefault();
        setOpenNpc(targetId);
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
      setNearNpc(null);
      setOpenNpc(null);
    }
  }, [enabled]);

  return {
    nearNpc,
    openNpc,
    companionId,
    modes,
    open,
    close,
    setNpcMode,
    toggleCompanion,
  };
}
