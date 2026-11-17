import {
  BLUFF_CHAMBERS,
  BLUFF_DECK,
  BLUFF_HAND_SIZE,
  BLUFF_MAX_PLAY,
  BLUFF_MIN_PLAYERS,
  BLUFF_SEATS,
  BLUFF_TAUNTS,
  BLUFF_TIMING,
  POKER_RULES,
  POKER_SEATS,
  POKER_TIMING,
  punchesFor,
} from '@metaverse/game-protocol';

export type KohakuGameRules = {
  id: string;
  title: string;
  where: string;
  players: string;
  sections: { heading: string; items: string[] }[];
};

const deckSize = Object.values(BLUFF_DECK).reduce((sum, count) => sum + count, 0);
const seconds = (ms: number) => Math.round(ms / 1000);
const chips = (value: number) => value.toLocaleString('vi-VN');

/**
 * Luật các trò chơi trong Kohaku mà Bartender Caca giải thích ở quầy bar. Mỗi trò mới thêm một mục vào đây.
 * Số liệu lấy từ hằng số luật trong game-protocol để luật hiển thị luôn khớp với server.
 */
export const KOHAKU_GAME_RULES: readonly KohakuGameRules[] = [
  {
    id: 'bluff',
    title: 'Bàn Hổ Phách (Kohaku Bluff)',
    where: 'Bàn tròn nỉ xanh giữa sảnh Tầng 1, ghế SEAT 1–4',
    players: `${BLUFF_MIN_PLAYERS}–${BLUFF_SEATS.length} người`,
    sections: [
      {
        heading: 'Chuẩn bị',
        items: [
          `Bộ bài ${deckSize} lá: ${BLUFF_DECK.K} K, ${BLUFF_DECK.Q} Q, ${BLUFF_DECK.A} A và ${BLUFF_DECK.JOKER} Joker. Joker luôn tính là lá thật.`,
          `Mỗi người nhận ${BLUFF_HAND_SIZE} lá, chỉ mình thấy. Mỗi vòng Shinku rút một lá chuẩn: K, Q hoặc A.`,
          `Mỗi người có một khẩu súng ${BLUFF_CHAMBERS} ngăn với 1 viên đạn ở ngăn ngẫu nhiên, giữ nguyên suốt ván. Lần bóp thứ ${BLUFF_CHAMBERS} chắc chắn nổ.`,
        ],
      },
      {
        heading: 'Lượt chơi',
        items: [
          `Đến lượt, úp 1–${BLUFF_MAX_PLAY} lá và luôn tuyên bố "toàn là lá chuẩn". Nói dối hay không là tùy bạn.`,
          'Người kế tiếp còn bài chọn Tin (đến lượt họ úp) hoặc hô NÓI DỐI! để lật lần úp vừa rồi.',
          'Lật ra có lá sai (không phải lá chuẩn, không phải Joker) thì người úp bóp cò. Toàn lá thật thì người hô bóp cò.',
          '"Cạch" là sống sót. "Đoàng" là gục xuống bàn và bị loại. Sau mỗi lần bóp cò, bài được chia lại và rút lá chuẩn mới.',
        ],
      },
      {
        heading: 'Cà khịa',
        items: [
          `Đang ngồi trong ván thì bấm phím để cà khịa, kể cả khi đang tới lượt mình: ${Object.values(BLUFF_TAUNTS).map(t => `${t.key}: ${t.label}`).join(', ')}.`,
          'Không cần chọn ai: cà khịa nhắm vào người đang tới lượt, người vừa úp bài nếu đang là lượt bạn, hoặc người đang cầm súng.',
          `Người đang cầm súng không cà khịa được. Mỗi người phải chờ ${seconds(BLUFF_TIMING.tauntCooldownMs)} giây giữa hai lần.`,
        ],
      },
      {
        heading: 'Thắng thua và giờ giấc',
        items: [
          'Người cuối cùng còn sống thắng ván.',
          `Mỗi lượt có ${seconds(BLUFF_TIMING.turnMs)} giây. Hết giờ server tự úp giúp 1 lá ngẫu nhiên.`,
          `Có ít nhất ${BLUFF_MIN_PLAYERS} người ngồi và 1 người Sẵn sàng thì đếm ngược ${seconds(BLUFF_TIMING.readyCountdownMs)} giây; ai chưa sẵn sàng sẽ được mời đứng dậy.`,
          'Đứng dậy hoặc mất kết nối giữa ván tính là bị loại. Trong ván, ghế trống bị khóa.',
        ],
      },
      {
        heading: 'Ghi nguồn giọng',
        items: ['Giọng Shinku: VOICEVOX:冥鳴ひまり. Giọng cà khịa: VOICEVOX:四国めたん.'],
      },
    ],
  },
  {
    id: 'gekka-poker',
    title: "Sòng 月華楼 Gekkarō (Texas Hold'em)",
    where: 'Tòa Gekkarō đối diện Kohaku, bàn bầu dục giữa sảnh, ghế SEAT 1–6',
    players: `${POKER_RULES.minPlayers}–${POKER_SEATS.length} người`,
    sections: [
      {
        heading: 'Chuẩn bị',
        items: [
          `Mỗi người nhận ${chips(POKER_RULES.startingChips)} chip ảo, không quy ra tiền thật và không được lưu lại sau trận.`,
          `Blind khởi điểm ${POKER_RULES.smallBlind}/${POKER_RULES.bigBlind}, nhân đôi sau mỗi ${POKER_RULES.blindDoubleEveryHands} ván.`,
          `Có ít nhất ${POKER_RULES.minPlayers} người ngồi và 1 người Sẵn sàng thì đếm ngược ${seconds(POKER_TIMING.readyCountdownMs)} giây.`,
        ],
      },
      {
        heading: 'Lượt chơi',
        items: [
          'Mỗi người 2 lá tẩy chỉ mình thấy, 5 lá chung lật dần: flop 3 lá, turn 1 lá, river 1 lá.',
          `Đến lượt chọn Fold, Check, Call, Raise hoặc All-in. Mỗi lượt có ${seconds(POKER_TIMING.turnMs)} giây, hết giờ tự Check nếu được, không thì Fold.`,
          'Ai all-in thiếu vẫn được chia side pot đúng phần mình đã cược.',
        ],
      },
      {
        heading: 'Thua sạch và căn hầm',
        items: [
          `Hết chip thì đao phủ Onizuka tới tận ghế túm và lôi xuống hầm, trói dang tay chân vào khung gỗ chữ A và ăn ${punchesFor(0)} cú đấm, cộng thêm ${punchesFor(1) - punchesFor(0)} cú cho mỗi khoản nợ đang có.`,
          'Hầm còn người thì người thua sau ngồi chờ ở ghế tới khi đao phủ xong việc và quay lên.',
          'Lúc đao phủ lôi người, những người khác được hỏi có đi theo không: người đang đứng tự đi theo xuống hầm, người đang ngồi bàn chỉ xem bằng camera để không mất ghế.',
          `Sau trận đấm có ${seconds(POKER_TIMING.choiceMs)} giây để chọn: vay ${chips(POKER_RULES.startingChips)} chip quay lại bàn, hoặc rời bàn. Hết giờ tính là rời bàn.`,
          `Mỗi trận được vay tối đa ${POKER_RULES.maxLoans} lần. Thua sạch lần thứ ${POKER_RULES.maxLoans + 1} thì bị treo ở hầm tới hết trận.`,
          'Người không ngồi bàn chỉ đứng xem và cà khịa người đang bị trói; chỉ đao phủ ra đòn.',
        ],
      },
      {
        heading: 'Nhân sự & ghi công model',
        items: [
          'Bà chủ Aos đứng cửa đón và dẫn khách tới ghế; dealer Tsukimi chia bài; đao phủ Onizuka giữ hầm; Rina phục vụ quầy rượu.',
          'Model VRM (VRoid Hub): Aostylish © siroihakumai · EspeonModel © Reira · [OC] Lindsay © Mariele · Rina © Reira / Peony. Chuyển động: Mixamo.',
        ],
      },
    ],
  },
];
