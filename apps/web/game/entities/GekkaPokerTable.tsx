'use client';
import { Billboard, Text } from '@react-three/drei';
import { GEKKA_SEATS, type PokerCard, type PokerTableView } from '@metaverse/game-protocol';
import { describeCard } from '../systems/gekkaPokerView';

const TABLE_CENTER = { x: 0, z: -1.5 };
const TABLE_Y = 0.78;
const CARD_W = 0.11;
const CARD_H = 0.155;
// Đặt bài/chip của từng ghế trên đường nối ghế → tâm bàn, lùi vào trong mép bàn.
const SEAT_INSET = 0.42;

const seatOf = (id: string) => GEKKA_SEATS.find(seat => seat.id === id);

function toward(seatId: string, ratio: number) {
  const seat = seatOf(seatId);
  if (!seat) return { x: TABLE_CENTER.x, z: TABLE_CENTER.z, yaw: 0 };
  return {
    x: seat.x + (TABLE_CENTER.x - seat.x) * ratio,
    z: seat.z + (TABLE_CENTER.z - seat.z) * ratio,
    yaw: seat.yaw,
  };
}

/** Lá bài vẽ bằng hình phẳng + chữ, không cần texture; card null là lá úp. */
function FlatCard({ card, position, yaw }: { card: PokerCard | null; position: [number, number, number]; yaw: number }) {
  const face = card ? describeCard(card) : null;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial color={face ? '#fbf6ea' : '#7a1020'} roughness={0.6} />
      </mesh>
      {face ? (
        <Text position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.045} color={face.red ? '#c41a2a' : '#141414'} anchorX="center" anchorY="middle">
          {`${face.rank}${face.suit}`}
        </Text>
      ) : (
        <Text position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.05} color="#e7c46b" anchorX="center" anchorY="middle">月</Text>
      )}
    </group>
  );
}

function ChipStack({ amount, position }: { amount: number; position: [number, number, number] }) {
  if (amount <= 0) return null;
  // Chiều cao chồng chip chỉ để gợi cảm giác nhiều/ít; con số chính xác nằm ở nhãn.
  const layers = Math.min(12, Math.max(1, Math.ceil(Math.log2(amount / 10 + 1))));
  return (
    <group position={position}>
      {Array.from({ length: layers }, (_, index) => (
        <mesh key={index} position={[0, 0.006 + index * 0.012, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.011, 18]} />
          <meshStandardMaterial color={index % 2 ? '#c8a24a' : '#8c1424'} metalness={0.3} roughness={0.4} />
        </mesh>
      ))}
      <Billboard position={[0, 0.06 + layers * 0.012, 0]}>
        <Text fontSize={0.05} color="#ffe9b0" outlineWidth={0.004} outlineColor="#000">{amount.toLocaleString('vi-VN')}</Text>
      </Billboard>
    </group>
  );
}

/** Mặt bàn công khai: lá chung, pot, cược từng ghế, lá tẩy úp và bài lật ở showdown. Không bao giờ có bài tẩy của người khác. */
export function GekkaPokerTable({ table, names = {} }: { table: PokerTableView; names?: Record<string, string> }) {
  const shown = new Map(table.showdown.map(entry => [entry.seatId, entry]));
  const button = toward(table.buttonSeat, 0.3);
  return (
    <group>
      {table.board.map((card, index) => (
        <FlatCard key={`${card}-${index}`} card={card} position={[TABLE_CENTER.x - 0.28 + index * 0.14, TABLE_Y + 0.003, TABLE_CENTER.z]} yaw={0} />
      ))}
      <ChipStack amount={table.pot} position={[TABLE_CENTER.x, TABLE_Y, TABLE_CENTER.z - 0.3]} />
      {table.buttonSeat && (
        <mesh position={[button.x, TABLE_Y + 0.008, button.z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.012, 20]} />
          <meshStandardMaterial color="#fafafa" emissive="#ffffff" emissiveIntensity={0.15} />
        </mesh>
      )}
      {table.seats.map(seat => {
        if (!seat.inMatch || seat.out || seat.captive !== 'none') return null;
        const spot = toward(seat.seatId, SEAT_INSET);
        const reveal = shown.get(seat.seatId);
        const isTurn = table.phase === 'betting' && table.turnSeat === seat.seatId;
        return (
          <group key={seat.seatId}>
            {!seat.folded && [0, 1].map(index => (
              <FlatCard
                key={index}
                card={reveal?.cards[index] ?? null}
                position={[spot.x + Math.cos(spot.yaw) * (index - 0.5) * 0.12, TABLE_Y + 0.003 + index * 0.001, spot.z - Math.sin(spot.yaw) * (index - 0.5) * 0.12]}
                yaw={spot.yaw}
              />
            ))}
            <ChipStack amount={seat.bet} position={[spot.x + (TABLE_CENTER.x - spot.x) * 0.35, TABLE_Y, spot.z + (TABLE_CENTER.z - spot.z) * 0.35]} />
            <Billboard position={[seatOf(seat.seatId)!.x, 1.85, seatOf(seat.seatId)!.z]}>
              <Text fontSize={0.085} color={isTurn ? '#ffd76a' : '#f3e6cf'} outlineWidth={0.006} outlineColor="#000">
                {`${names[seat.sessionId] ?? 'Khách'} · ${seat.chips.toLocaleString('vi-VN')}${seat.debt ? ` · nợ ${seat.debt}` : ''}`}
              </Text>
              {(reveal?.label || seat.lastAction) && (
                <Text position={[0, -0.11, 0]} fontSize={0.065} color={reveal ? '#9fe6ff' : '#d9c39a'} outlineWidth={0.005} outlineColor="#000">
                  {reveal ? `${reveal.label}${reveal.won ? ` +${reveal.won}` : ''}` : seat.lastAction.toUpperCase()}
                </Text>
              )}
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
