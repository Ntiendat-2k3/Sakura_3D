'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useMemo, useState, useRef, useEffect, type RefObject } from 'react';
import type { Group } from 'three';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { canUsePortal, CLUB_PORTAL, LOUNGE_PORTAL, HOTEL_PORTAL, DEFAULT_PLAYER_CHARACTER, KOHAKU_SEATS, GEKKA_PORTAL, POKER_SEATS, getWalkThroughTarget, findKohakuJumpSpot, findPunchTarget, streetBenchPartnerSeat, nearestStreetPortal, nearestLoungePortal, nearestZoneSeat, PLAYER_CHARACTERS, type MoveInput, type PlayerCharacterId, type PlayerDanceStyle, type WorldZone } from '@metaverse/game-protocol';
import { KohakuBluffHud } from '../game/ui/KohakuBluffHud';
import { GekkaPokerHud } from '../game/ui/GekkaPokerHud';
import { GekkaDungeonDialog } from '../game/ui/GekkaDungeonDialog';
import { GekkaEscortPrompt } from '../game/ui/GekkaEscortPrompt';
import { useGekkaEscortFollow } from '../game/systems/useGekkaEscortFollow';
import { GekkaFollowPilot } from '../game/systems/GekkaFollowPilot';
import { useGekkaTauntKeys } from '../game/systems/useGekkaTauntKeys';
import { useGekkaPunchCue } from '../game/systems/useGekkaPunchCue';
import { gekkaRestraintCue } from '../game/systems/gekkaPokerView';
import { GekkaHostess } from '../game/entities/GekkaStaff';
import { useCityConnection } from '../game/networking/useCityConnection';
import { SakuraScene, SceneLoadBoundary } from '../game/scenes/SakuraScene';
import type { HotelMoodId } from '../game/scenes/HotelScene';
import { Avatar } from '../game/entities/Avatar';
import { useBluffEffects } from '../game/systems/useBluffEffects';
import { useBluffTauntKeys } from '../game/systems/useBluffTauntKeys';
import { useBluffTaunts } from '../game/systems/useBluffTaunts';
import { useShootingSince } from '../game/systems/useShootingSince';
import { BLUFF_SEATED_HEAD_HEIGHT, resolveAvatarPose, type BluffPose } from '../game/systems/bluffPose';
import { FollowCamera, type CameraViewMode } from '../game/systems/FollowCamera';
import { PlayerInput } from '../game/systems/PlayerInput';
import { WorldHud } from '../game/ui/WorldHud';
import { PortalInteraction } from '../game/systems/PortalInteraction';
import { SeatInteraction } from '../game/systems/SeatInteraction';
import { ClubShowControls } from '../game/ui/ClubShowControls';
import type { ClubVisualSettings } from '../game/systems/BeatSyncController';
import { WelcomeNpc } from '../game/entities/WelcomeNpc';
import { CompanionNpc } from '../game/entities/LoungeNpc';
import { ClubAssetWarmup, CLUB_PRELOAD_URLS } from '../game/systems/ClubAssetWarmup';
import { ZoneShaderWarmup } from '../game/systems/ZoneShaderWarmup';
import { retainCharacterAssets } from '../game/systems/characterAssets';
import { useClubAudio } from '../game/systems/useClubAudio';
import { useRosettaInteraction } from '../game/systems/useRosettaInteraction';
import { useLoungeInteraction } from '../game/systems/useLoungeInteraction';
import { useDjInteraction } from '../game/systems/useDjInteraction';
import { useKohakuInteraction } from '../game/systems/useKohakuInteraction';
import { DjMusicDialog } from '../game/ui/DjMusicDialog';
import { RosettaDialog } from '../game/ui/RosettaDialog';
import { LoungeHostessDialog } from '../game/ui/LoungeHostessDialog';
import { KohakuNpcDialog } from '../game/ui/KohakuNpcDialog';
import { KohakuJumpPrompt } from '../game/ui/KohakuJumpPrompt';
import { StreetSocialPrompt } from '../game/ui/StreetSocialPrompt';
import { buildStreetActionCues } from '../game/systems/streetSocialCues';
import { InteractiveEntranceDoor } from '../game/entities/InteractiveEntranceDoor';
import { ToriiWindChimeGate } from '../game/entities/ToriiWindChimeGate';
import { GameLoadingScreen } from '../game/ui/GameLoadingScreen';
import { useProximityVoice } from '../game/systems/useProximityVoice';
import { VoiceSpatialAudio } from '../game/systems/VoiceSpatialAudio';
import { VoicePanel } from '../game/ui/VoicePanel';

const loadClubScene = () => import('../game/scenes/ClubScene').then(module => ({ default: module.ClubScene }));
const loadLoungeScene = () => import('../game/scenes/LoungeScene').then(module => ({ default: module.LoungeScene }));
const loadHotelScene = () => import('../game/scenes/HotelScene').then(module => ({ default: module.HotelScene }));
const loadKohakuScene = () => import('../game/scenes/KohakuScene').then(module => ({ default: module.KohakuScene }));
const loadGekkaScene = () => import('../game/scenes/GekkaScene').then(module => ({ default: module.GekkaScene }));
const ClubScene = lazy(loadClubScene);
const LoungeScene = lazy(loadLoungeScene);
const HotelScene = lazy(loadHotelScene);
const KohakuScene = lazy(loadKohakuScene);
const GekkaScene = lazy(loadGekkaScene);

/** Tự động bước qua ngưỡng cửa chuyển phòng liền mạch khi người chơi đi bộ tiến sát vào cửa mà không cần bấm phím E. */
function DoorWalkThroughTrigger({
  zone,
  avatarRef,
  enabled,
  onTrigger,
}: {
  zone: WorldZone;
  avatarRef: RefObject<Group | null>;
  enabled: boolean;
  onTrigger: (target: WorldZone) => void;
}) {
  const lastCheck = useRef(0);
  useFrame(() => {
    if (!enabled || !avatarRef.current) return;
    const now = performance.now();
    if (now - lastCheck.current < 60) return;
    lastCheck.current = now;
    const { x, y, z } = avatarRef.current.position;
    const target = getWalkThroughTarget(zone, x, z, y);
    if (target) onTrigger(target);
  });
  return null;
}

export default function World({ characterId = DEFAULT_PLAYER_CHARACTER, chooseCharacter }: { characterId?: PlayerCharacterId; chooseCharacter?: () => void }) {
  // mountedZone: scene đã mount; readyZone: shader của scene đó đã biên dịch xong, mới cho tương tác.
  const [mountedZone, setMountedZone] = useState<WorldZone | null>(null);
  const [readyZone, setReadyZone] = useState<WorldZone | null>(null);
  const [errorZone, setErrorZone] = useState<WorldZone | null>(null);
  const [bloom, setBloom] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('overview');
  const [hotelMood, setHotelMood] = useState<HotelMoodId>('magenta');
  const [clubReady, setClubReady] = useState(false);
  const [codeReady, setCodeReady] = useState(false);
  const [preparationError, setPreparationError] = useState(false);
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Đang khởi tạo Neon Sakura City…');
  const handleWarmupProgress = useCallback((prog: number, label: string) => {
    setLoadingProgress(prog);
    setLoadingStatus(label);
  }, []);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [isDoorOpening, setIsDoorOpening] = useState(false);
  const [clubSettings, setClubSettings] = useState<ClubVisualSettings>({ quality: 'low', reducedFlashing: true });
  const { dj, holdDj, cancelDj, selectDjTrack, selectLoungeTrack, status, message, sessionId, roomId, zone, danceEpoch, show, setClubShow, switching, players, chat, sendMove, sendChat, changeZone, toggleSeat, jumpDown, streetFx, streetKiss, streetPunch, setDancing, bluff, bluffHand, bluffReady, bluffPlay, bluffLiar, bluffTaunt, bluffTaunts, poker, pokerHole, pokerReady, pokerAct, pokerChoose, pokerTaunt, pokerTaunts, setVoiceEnabled, sendVoiceSignal, reportVoice, onVoiceSignal, voiceReportAck } = useCityConnection(characterId);
  const voiceConnection = useMemo(() => ({ setVoiceEnabled, sendVoiceSignal, reportVoice, onVoiceSignal }), [setVoiceEnabled, sendVoiceSignal, reportVoice, onVoiceSignal]);
  const voice = useProximityVoice({ sessionId, roomId, online: status === 'online', players, connection: voiceConnection, reportAck: voiceReportAck });
  const localAvatar = useRef<Group>(null);
  const localMove = useRef<MoveInput>({ x: 0, z: 0 });
  const gekkaAutoMove = useRef<MoveInput | null>(null);
  const onAssetsReady = useCallback(() => { setMountedZone(zone); setErrorZone(null); }, [zone]);
  const onAssetsError = useCallback(() => setErrorZone(zone), [zone]);
  useBluffEffects(bluff, zone === 'kohaku', bluffTaunts);
  useBluffTauntKeys(bluff, sessionId, bluffTaunt, zone === 'kohaku');
  const taunts = useBluffTaunts(bluffTaunts, bluff.seats);
  // Người bắn: chĩa súng khi shooting hoặc result mà chưa nổ; gục khi result là bang. Chỉ áp dụng trong phòng Kohaku.
  const shooting = zone === 'kohaku' && (bluff.phase === 'shooting' || bluff.phase === 'result');
  const shooterSession = shooting ? bluff.seats.find(seat => seat.seatId === bluff.shooterSeat)?.sessionId : undefined;
  const shooterPose: BluffPose = !shooterSession ? null : bluff.phase === 'result' && bluff.shotResult === 'bang' ? 'slump' : 'aim';
  const shooterSeatDef = shooting ? KOHAKU_SEATS.find(seat => seat.id === bluff.shooterSeat) : undefined;
  const shooterAvatar = shooterSession ? players[shooterSession] : undefined;
  // Nhắm vào tâm đầu người bắn (gốc ghế + độ cao đầu khi ngồi đo trên mọi mẫu), không phải gốc avatar: như cũ đầu rơi lên mép trên khung hình, dưới bảng trạng thái Bluff.
  const shootingSince = useShootingSince(bluff, zone === 'kohaku');
  const closeup = shooterSeatDef ? { x: shooterSeatDef.x, y: (shooterAvatar?.y ?? 0) + BLUFF_SEATED_HEAD_HEIGHT, z: shooterSeatDef.z, yaw: shooterSeatDef.yaw, pushSince: shootingSince ?? undefined } : null;
  const clubAudio = useClubAudio({ active: zone === 'club' || ((zone === 'lounge' || zone === 'hotel') && !!show.trackId), zone, switching, epoch: danceEpoch, trackId: show.trackId });
  const prepareFailed = !prepared && (preparationError || clubAudio.bufferError);
  const assets = errorZone === zone || prepareFailed ? 'error' : readyZone === zone && prepared ? 'ready' : 'loading';
  useEffect(() => {
    if (assets === 'ready' && !hasLoadedInitial) {
      const timer = setTimeout(() => {
        setHasLoadedInitial(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [assets, hasLoadedInitial]);
  const current = players[sessionId];
  const mySeatId = current?.seatId ?? '';
  useGekkaTauntKeys(poker, sessionId, mySeatId, pokerTaunt, zone === 'gekka');
  const punchCue = useGekkaPunchCue(poker);
  // Người thua sạch (kể cả lúc đang bị đao phủ lôi đi, khi đã rời ghế) không tự điều khiển được nhân vật.
  const gekkaCaptive = zone === 'gekka' && poker.seats.some(seat => seat.sessionId === sessionId && seat.captive !== 'none');
  const seatedAtPokerTable = zone === 'gekka' && POKER_SEATS.includes(mySeatId);
  const gekkaFollow = useGekkaEscortFollow(poker, sessionId, zone === 'gekka', seatedAtPokerTable);
  const playerNames = Object.fromEntries(Object.entries(players).map(([id, player]) => [id, player.name]));
  const rosettaRoot = useRef<Group>(null);
  const rosetta = useRosettaInteraction({ npc: rosettaRoot, player: current, enabled: zone === 'street' && status === 'online' && assets === 'ready' && !switching });
  const lounge = useLoungeInteraction({ player: current, zone, enabled: status === 'online' && assets === 'ready' && !switching, rosettaNear: rosetta.near });
  const djInteraction = useDjInteraction({ enabled: zone === 'club' && status === 'online' && assets === 'ready' && !switching, visit: dj, sessionId, player: current, hold: holdDj, cancel: cancelDj });
  const kohakuSeatedCount = zone === 'kohaku'
    ? Object.values(players).filter(player => player.seatId?.startsWith('kohaku-player-')).length
    : 0;
  const kohakuDealerSeated = kohakuSeatedCount > 0;
  // Ngồi ghế Bluff thì Shinku luôn ở gần: gợi ý "F · Trò chuyện" (z-index 5, đáy giữa) che nút Sẵn sàng/Úp bài/NÓI DỐI!
  // và phím F mở hộp thoại modal giữa ván, nên tắt tương tác NPC Kohaku khi người chơi local đang ngồi ở ghế Bluff.
  const seatedAtBluff = !!current?.seatId?.startsWith('kohaku-player-');
  const kohakuInteraction = useKohakuInteraction({
    player: current,
    enabled: zone === 'kohaku' && status === 'online' && assets === 'ready' && !switching && !seatedAtBluff,
    present: zone === 'kohaku' && status === 'online' && assets === 'ready' && !switching,
    dealerSeated: kohakuDealerSeated,
  });
  // Đang hôn Hinata cũng khóa di chuyển: avatar đang đứng trước mặt Hinata, đi lúc này sẽ lệch khỏi cảnh hôn.
  const npcBusy = rosetta.mode !== 'greeting' || !!lounge.openNpc || djInteraction.own || !!kohakuInteraction.openNpc || !!kohakuInteraction.kissCue;
  const streetPortal = zone === 'street' && current ? nearestStreetPortal(current.x, current.z) : undefined;
  const loungePortal = zone === 'lounge' && current ? nearestLoungePortal(current.x, current.z) : undefined;
  const nearPortal = !!current && !current.seatId && canUsePortal(zone, current.x, current.z, undefined, current.y ?? 0);
  useEffect(() => retainCharacterAssets(), []);
  const onClubReady = useCallback(() => setClubReady(true), []);
  const onPreparationError = useCallback(() => setPreparationError(true), []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadClubScene(), loadLoungeScene(), loadHotelScene(), loadKohakuScene(), loadGekkaScene()]).then(() => { if (!cancelled) setCodeReady(true); }).catch(() => { if (!cancelled) setPreparationError(true); });
    return () => { cancelled = true; };
  }, [preparationAttempt]);
  useEffect(() => { if (clubReady && codeReady && clubAudio.ready && !preparationError && !clubAudio.bufferError) setPrepared(true); }, [clubReady, codeReady, clubAudio.ready, preparationError, clubAudio.bufferError]);
  const retryPreparation = useCallback(() => {
    CLUB_PRELOAD_URLS.forEach(url => useGLTF.clear(url));
    setClubReady(false); setPreparationError(false); setPreparationAttempt(value => value + 1);
    clubAudio.retryPreparation();
  }, [clubAudio.retryPreparation]);
  const nearSeat = (zone === 'club' || zone === 'lounge' || zone === 'hotel' || zone === 'kohaku' || zone === 'gekka' || zone === 'street') && current ? nearestZoneSeat(zone, current.x, current.z, current.y ?? 0) : undefined;
  const seatOccupied = !!nearSeat && Object.values(players).some(player => player.seatId === nearSeat.id && player.id !== current?.id);
  // Ngoài phố: gợi ý hôn người ngồi cạnh trên ghế đá / đấm người đứng gần; server tự chọn lại người khi nhận lệnh.
  const streetCues = useMemo(() => (zone === 'street' ? buildStreetActionCues(streetFx, players) : {}), [zone, streetFx, players]);
  const benchPartnerSeat = zone === 'street' && current?.seatId ? streetBenchPartnerSeat(current.seatId) : undefined;
  const kissPartner = benchPartnerSeat ? Object.values(players).find(player => player.seatId === benchPartnerSeat.id) : undefined;
  const punchTarget = zone === 'street' && current && !current.seatId
    ? findPunchTarget({ ...current, id: sessionId }, Object.entries(players).map(([id, player]) => ({ ...player, id })))
    : undefined;

  // Chỉ là gợi ý hiển thị; server tự xác định điểm nhảy từ vị trí authoritative.
  const jumpSpot = zone === 'kohaku' && current && !current.seatId && !current.jumpSpot ? findKohakuJumpSpot(current.x, current.y ?? 0, current.z) : undefined;
  const seatEnabled = (zone === 'club' || zone === 'lounge' || zone === 'hotel' || zone === 'kohaku' || zone === 'gekka' || zone === 'street') && (!!current?.seatId || (!!nearSeat && !seatOccupied));
  const sit = useCallback(() => {
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    toggleSeat(current?.seatId ? '' : nearSeat?.id ?? '');
  }, [toggleSeat, current?.seatId, nearSeat?.id]);
  const dance = useCallback((style: PlayerDanceStyle = 'normal') => {
    if (style === 'guitar' && !PLAYER_CHARACTERS[characterId].guitar) return;
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    setDancing(!(current?.dancing && (current.danceStyle ?? 'normal') === style), style);
  }, [setDancing, current?.dancing, current?.danceStyle, characterId]);
  const lastZoneTransition = useRef(Date.now());
  useEffect(() => {
    lastZoneTransition.current = Date.now();
  }, [zone]);

  const handleDoorWalkThrough = useCallback((targetZone: WorldZone) => {
    if (isDoorOpening || switching || Date.now() - lastZoneTransition.current < 1600) return;
    setIsDoorOpening(true);
    lastZoneTransition.current = Date.now();
    setTimeout(() => {
      if (targetZone === 'club') clubAudio.prepareEntry();
      changeZone(targetZone);
      setIsDoorOpening(false);
    }, 280);
  }, [changeZone, clubAudio.prepareEntry, isDoorOpening, switching]);

  const interact = useCallback(() => {
    // Tránh giữ focus ở nút vừa bị disabled khi đổi phòng, làm WASD không phát sự kiện.
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    if (isDoorOpening || switching || Date.now() - lastZoneTransition.current < 1600) return;
    const targetZone: WorldZone = zone === 'street'
      ? (streetPortal?.destination ?? 'club')
      : zone === 'lounge'
        ? (loungePortal?.destination ?? 'street')
        : zone === 'hotel'
          ? 'lounge'
          : zone === 'kohaku'
            ? 'street'
            : 'street';
    setIsDoorOpening(true);
    lastZoneTransition.current = Date.now();
    setTimeout(() => {
      if (targetZone === 'club') clubAudio.prepareEntry();
      changeZone(targetZone);
      setIsDoorOpening(false);
    }, 280);
  }, [changeZone, zone, streetPortal?.destination, loungePortal?.destination, clubAudio.prepareEntry, isDoorOpening, switching]);
  // Phím tắt V để chuyển nhanh giữa Góc nhìn Tổng thể Đảo và Góc nhìn Nhân vật
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.code === 'KeyV') {
        setCameraMode(prev => (prev === 'overview' ? 'character' : 'overview'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Giữ entities cố định ở cấp Scene, với khóa an toàn cho người chơi
  const entities = <>
    <SceneLoadBoundary key={`players-${zone}`} onError={onAssetsError}>
      {Object.entries(players).map(([session, player]) => (
        <Avatar
          key={session}
          player={player}
          local={session === sessionId}
          objectRef={session === sessionId ? localAvatar : undefined}
          // Đang bị đao phủ lôi đi thì không có input để dự đoán: hiển thị theo nội suy server như người khác để có dáng bước.
          localMove={session === sessionId && !gekkaCaptive ? localMove : undefined}
          epoch={danceEpoch}
          show={show}
          zone={zone}
          bluffPose={resolveAvatarPose(session === shooterSession ? shooterPose : null, zone === 'kohaku' ? taunts[session]?.pose ?? null : null)}
          bluffTarget={taunts[session]?.target}
          kiss={session === sessionId && zone === 'kohaku' ? kohakuInteraction.kissCue : undefined}
          restraint={zone === 'gekka' ? gekkaRestraintCue(player.seatId, punchCue) : undefined}
          voice={voice.indicators[session]}
          action={zone === 'street' ? streetCues[session] ?? null : undefined}
        />
      ))}
      {lounge.companionId && <CompanionNpc id={lounge.companionId} player={current} localAvatar={localAvatar} zone={zone} mode={lounge.modes[lounge.companionId]} epoch={danceEpoch}/>}
    </SceneLoadBoundary>
    {zone === 'gekka' && <GekkaFollowPilot table={poker} sessionId={sessionId} avatar={localAvatar} autoMove={gekkaAutoMove} active={gekkaFollow.mode === 'walking'} onArrive={gekkaFollow.stop}/>}
    <PlayerInput
      enabled={status === 'online' && assets === 'ready' && !switching && !current?.seatId && !npcBusy && !gekkaCaptive}
      sendMove={sendMove}
      localMove={localMove}
      toggleDance={(zone === 'club' || zone === 'lounge') ? dance : undefined}
      autoMove={gekkaAutoMove}
      onManualMove={gekkaFollow.stop}
    />
    <VoiceSpatialAudio engine={voice.engineRef} players={players} sessionId={sessionId} localAvatar={localAvatar}/>
    <FollowCamera target={current} targetObject={localAvatar} zone={zone} mode={cameraMode} focusOverride={closeup ?? gekkaFollow.focus}/>
    <DoorWalkThroughTrigger zone={zone} avatarRef={localAvatar} enabled={status === 'online' && assets === 'ready' && !switching && !current?.seatId && !npcBusy && !gekkaCaptive} onTrigger={handleDoorWalkThrough}/>
  </>;
  return <div className="world-root" data-zone={zone} data-room-id={roomId} data-switching={switching} data-camera-mode={cameraMode}>
    <Canvas camera={{ position:[0, 18, -36], fov:58 }} dpr={1} gl={{ antialias: true }}>
      {zone === 'street' ? <SakuraScene onReady={onAssetsReady} onError={onAssetsError} bloom={bloom}>
        {/* Cổng Torii ở cuối đường hướng Mặt Trăng Khuyết (+Z) kèm chuông gió Fuurin kêu khi đến gần */}
        <ToriiWindChimeGate position={[0, 0, 18.5]} player={current} avatarRef={localAvatar}/>
        {/* Cầu thang bộ ngoài trời toà Reika dẫn lên Tầng 2 Cyber Love Hotel */}
        <group position={[-5.76, 0.04, -9.6]}>
          {[0, 1, 2, 3].map(i => (
            <mesh key={i} position={[0.7 - i * 0.22, i * 0.16 + 0.08, 0]}>
              <boxGeometry args={[0.26, 0.16, 1.8]} />
              <meshStandardMaterial color="#1a1426" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0.35, 0.42, 0.92]}>
            <boxGeometry args={[1.1, 0.04, 0.04]} />
            <meshStandardMaterial color="#ff4fa3" emissive="#ff3399" emissiveIntensity={2.5} />
          </mesh>
          <Billboard position={[0, 2.65, 0]}>
            <Text fontSize={0.2} color="#ff99dd">2F · CYBER LOVE HOTEL</Text>
          </Billboard>
        </group>
        <InteractiveEntranceDoor
          id="denmu-club"
          position={[5.76, 0.04, 1.0]}
          yaw={-Math.PI / 2}
          player={current}
          isInteracting={isDoorOpening && streetPortal?.destination === 'club'}
          theme="modern"
        />
        <InteractiveEntranceDoor
          id="reika-lounge"
          position={[-5.76, 0.04, -7.0]}
          yaw={Math.PI / 2}
          player={current}
          isInteracting={isDoorOpening && streetPortal?.destination === 'lounge'}
          theme="traditional"
        />
        <InteractiveEntranceDoor
          id="love-hotel"
          position={[-5.76, 0.04, -9.6]}
          yaw={Math.PI / 2}
          player={current}
          isInteracting={isDoorOpening && streetPortal?.destination === 'hotel'}
          theme="modern"
        />
        {/* Biển hiệu & Cửa vào Câu Lạc Bộ Thượng Lưu 琥珀 (Kohaku Club) */}
        <group position={[-5.76, 0.04, -15.0]}>
          <Billboard position={[0, 3.2, 0]}>
            <Text fontSize={0.24} color="#f5d485" letterSpacing={0.08}>琥珀 · KOHAKU</Text>
            <Text position={[0, -0.26, 0]} fontSize={0.11} color="#d4b06a">PRIVATE MEMBERS CLUB · 1F CASINO</Text>
          </Billboard>
          {/* Đèn lồng vàng hổ phách ấm áp hai bên cửa */}
          <pointLight position={[0.4, 2.2, -1.2]} intensity={8} distance={6} color="#ffaa33" />
          <pointLight position={[0.4, 2.2, 1.2]} intensity={8} distance={6} color="#ffaa33" />
        </group>
        <InteractiveEntranceDoor
          id="kohaku-club"
          position={[-5.76, 0.04, -15.0]}
          yaw={Math.PI / 2}
          player={current}
          isInteracting={isDoorOpening && streetPortal?.destination === 'kohaku'}
          theme="traditional"
        />
        {/* Biển hiệu & cửa vào sòng 月華楼 Gekkarō, mặt tiền đối diện Kohaku */}
        <group position={[5.76, 0.04, GEKKA_PORTAL.z]}>
          <Billboard position={[0, 3.2, 0]}>
            <Text fontSize={0.24} color="#e7c46b" letterSpacing={0.08}>月華楼 · GEKKARŌ</Text>
            <Text position={[0, -0.26, 0]} fontSize={0.11} color="#d8c08a">TAISHŌ POKER SALON</Text>
          </Billboard>
          <pointLight position={[-0.4, 2.2, -1.2]} intensity={8} distance={6} color="#ffd27a" />
          <pointLight position={[-0.4, 2.2, 1.2]} intensity={8} distance={6} color="#ffd27a" />
        </group>
        <InteractiveEntranceDoor
          id="gekka-casino"
          position={[5.76, 0.04, GEKKA_PORTAL.z]}
          yaw={-Math.PI / 2}
          player={current}
          isInteracting={isDoorOpening && streetPortal?.destination === 'gekka'}
          theme="traditional"
        />
        <GekkaHostess where="street" player={current} />
        <WelcomeNpc id="rosetta" objectRef={rosettaRoot} mode={rosetta.mode} player={current} onDanceError={rosetta.failDance}/>
        {entities}
      </SakuraScene> : zone === 'lounge' ? <SceneLoadBoundary key="lounge" onError={onAssetsError}><Suspense fallback={null}>
        <LoungeScene onReady={onAssetsReady} player={current} npcModes={lounge.modes} companionId={lounge.companionId} isDoorOpening={isDoorOpening} nearHotelStairs={loungePortal?.destination === 'hotel'}>{entities}</LoungeScene>
      </Suspense></SceneLoadBoundary> : zone === 'hotel' ? <SceneLoadBoundary key="hotel" onError={onAssetsError}><Suspense fallback={null}>
        <HotelScene onReady={onAssetsReady} player={current} mood={hotelMood} isDoorOpening={isDoorOpening}>{entities}</HotelScene>
      </Suspense></SceneLoadBoundary> : zone === 'kohaku' ? <SceneLoadBoundary key="kohaku" onError={onAssetsError}><Suspense fallback={null}>
        <KohakuScene onReady={onAssetsReady} player={current} isDoorOpening={isDoorOpening} dealerSeated={kohakuDealerSeated} nearNpc={kohakuInteraction.nearNpc} hinataMode={kohakuInteraction.hinataMode} hinataActionKey={kohakuInteraction.hinataActionKey} bluff={bluff} names={Object.fromEntries(Object.entries(players).map(([id, player]) => [id, player.name]))}>{entities}</KohakuScene>
      </Suspense></SceneLoadBoundary> : zone === 'gekka' ? <SceneLoadBoundary key="gekka" onError={onAssetsError}><Suspense fallback={null}>
        <GekkaScene onReady={onAssetsReady} player={current} isDoorOpening={isDoorOpening} poker={poker} names={playerNames} players={players} punch={punchCue}>{entities}</GekkaScene>
      </Suspense></SceneLoadBoundary> : <SceneLoadBoundary key="club" onError={onAssetsError}><Suspense fallback={null}>
        <ClubScene dj={dj} epoch={danceEpoch} show={show} settings={clubSettings} bloom={bloom} onReady={onAssetsReady} player={current} isDoorOpening={isDoorOpening}>{entities}</ClubScene>
      </Suspense></SceneLoadBoundary>}
      <SceneLoadBoundary key={`prepare-${preparationAttempt}`} onError={onPreparationError}>
        <ClubAssetWarmup onReady={onClubReady} onError={onPreparationError} onProgress={handleWarmupProgress}/>
      </SceneLoadBoundary>
      <ZoneShaderWarmup zone={zone} mountedZone={mountedZone} readyZone={readyZone} prepared={prepared} onCompiled={setReadyZone}/>
    </Canvas>
    {clubAudio.element}
    {!hasLoadedInitial && (
      <GameLoadingScreen
        progress={assets === 'ready' ? 100 : loadingProgress}
        statusText={assets === 'ready' ? 'Đồ họa đã tải hoàn tất 100%!' : loadingStatus}
        ready={assets === 'ready'}
      />
    )}
    <RosettaDialog interaction={rosetta}/>
    {(zone === 'lounge' || zone === 'hotel' || !!lounge.companionId) && <LoungeHostessDialog interaction={lounge} audio={clubAudio} activeTrackId={show.trackId} selectTrack={selectLoungeTrack} inLounge={zone === 'lounge'} inHotel={zone === 'hotel'} hotelMood={hotelMood} setHotelMood={setHotelMood}/>}
    {zone === 'club' && <DjMusicDialog interaction={djInteraction} audio={clubAudio} activeTrackId={show.trackId} select={selectDjTrack}/>}
    {zone === 'kohaku' && <KohakuBluffHud table={bluff} hand={bluffHand} sessionId={sessionId} names={Object.fromEntries(Object.entries(players).map(([id, player]) => [id, player.name]))} ready={bluffReady} play={bluffPlay} liar={bluffLiar}/>}
    {zone === 'gekka' && <GekkaPokerHud table={poker} hole={pokerHole} sessionId={sessionId} mySeatId={mySeatId} names={playerNames} taunts={pokerTaunts} ready={pokerReady} act={pokerAct}/>}
    {zone === 'gekka' && <GekkaDungeonDialog table={poker} mySeatId={mySeatId} choose={pokerChoose}/>}
    {zone === 'gekka' && <GekkaEscortPrompt table={poker} names={playerNames} mode={gekkaFollow.mode} seatedAtTable={seatedAtPokerTable} follow={gekkaFollow.follow} stop={gekkaFollow.stop}/>}
    {zone === 'street' && status === 'online' && assets === 'ready' && !switching && !npcBusy && <StreetSocialPrompt kissName={kissPartner?.name} punchName={punchTarget ? players[punchTarget.id]?.name : undefined} kiss={streetKiss} punch={streetPunch}/>}
    {zone === 'kohaku' && <KohakuJumpPrompt enabled={status === 'online' && !!jumpSpot && !switching && assets === 'ready' && !npcBusy} floor={jumpSpot?.label} jump={jumpDown}/>}
    {zone === 'kohaku' && <KohakuNpcDialog interaction={kohakuInteraction} dealerSeated={kohakuDealerSeated} seatedPlayersCount={kohakuSeatedCount}/>}
    {zone === 'club' && <ClubShowControls audio={clubAudio} show={show} settings={clubSettings} setSettings={setClubSettings} setShow={setClubShow} isDJ={Object.keys(players)[0] === sessionId}/>}
    {prepareFailed && <div role="alert" style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translateX(-50%)', zIndex: 100000, padding: 20, background: '#191329', color: '#ffe3ef', borderRadius: 12, textAlign: 'center' }}>
      <p style={{ margin: '0 0 12px' }}>Không tải được tài nguyên. Hãy kiểm tra kết nối và thử lại.</p>
      <button type="button" className="graphics-toggle" onClick={retryPreparation}>Thử tải lại</button>
    </div>}
    <VoicePanel voice={voice} online={status === 'online'}/>
    <PortalInteraction enabled={status === 'online' && nearPortal && !switching && assets === 'ready' && !npcBusy} interact={interact}/>
    <SeatInteraction enabled={status === 'online' && seatEnabled && !npcBusy && !switching && assets === 'ready'} interact={sit}/>
    <WorldHud online={status === 'online'} connection={message} count={Object.keys(players).length} chat={chat} sendChat={sendChat} bloom={bloom} toggleBloom={() => setBloom(value => !value)} zone={zone} nearPortal={nearPortal} portalLabel={zone === 'street' ? streetPortal?.label : zone === 'lounge' ? loungePortal?.label : zone === 'hotel' ? 'Xuống tầng 1 Reika Lounge' : zone === 'kohaku' || zone === 'gekka' ? 'Cửa ra Phố Sakura' : 'Cửa ra phố'} switching={switching || assets !== 'ready' || npcBusy} isDoorOpening={isDoorOpening} interact={interact} seated={!!current?.seatId} seatEnabled={seatEnabled} seatOccupied={seatOccupied} sit={sit} dancing={!!current?.dancing} danceStyle={current?.danceStyle ?? 'normal'} dance={dance} characterName={PLAYER_CHARACTERS[characterId].name} hasGuitar={PLAYER_CHARACTERS[characterId].guitar} chooseCharacter={chooseCharacter} hotelMood={hotelMood} setHotelMood={setHotelMood} cameraMode={cameraMode} setCameraMode={setCameraMode}/>
  </div>;
}
