'use client';
import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useState, useRef, useEffect } from 'react';
import type { Group } from 'three';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { canUsePortal, CLUB_PORTAL, DEFAULT_PLAYER_CHARACTER, nearestClubSeat, PLAYER_CHARACTERS, type PlayerCharacterId, type PlayerDanceStyle, type WorldZone } from '@metaverse/game-protocol';
import { useCityConnection } from '../game/networking/useCityConnection';
import { SakuraScene, SceneLoadBoundary } from '../game/scenes/SakuraScene';
import { Avatar } from '../game/entities/Avatar';
import { FollowCamera } from '../game/systems/FollowCamera';
import { PlayerInput } from '../game/systems/PlayerInput';
import { WorldHud } from '../game/ui/WorldHud';
import { PortalInteraction } from '../game/systems/PortalInteraction';
import { SeatInteraction } from '../game/systems/SeatInteraction';
import { ClubShowControls } from '../game/ui/ClubShowControls';
import type { ClubVisualSettings } from '../game/systems/BeatSyncController';
import { WelcomeNpc } from '../game/entities/WelcomeNpc';
import { ClubAssetWarmup, CLUB_PRELOAD_URLS } from '../game/systems/ClubAssetWarmup';
import { retainCharacterAssets } from '../game/systems/characterAssets';
import { useClubAudio } from '../game/systems/useClubAudio';
import { useRosettaInteraction } from '../game/systems/useRosettaInteraction';
import { useDjInteraction } from '../game/systems/useDjInteraction';
import { DjMusicDialog } from '../game/ui/DjMusicDialog';
import { RosettaDialog } from '../game/ui/RosettaDialog';

const loadClubScene = () => import('../game/scenes/ClubScene').then(module => ({ default: module.ClubScene }));
const ClubScene = lazy(loadClubScene);
export default function World({ characterId = DEFAULT_PLAYER_CHARACTER, chooseCharacter }: { characterId?: PlayerCharacterId; chooseCharacter?: () => void }) {
  const [readyZone, setReadyZone] = useState<WorldZone | null>(null);
  const [errorZone, setErrorZone] = useState<WorldZone | null>(null);
  const [bloom, setBloom] = useState(false);
  const [clubReady, setClubReady] = useState(false);
  const [codeReady, setCodeReady] = useState(false);
  const [preparationError, setPreparationError] = useState(false);
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [prepared, setPrepared] = useState(false);
  const [clubSettings, setClubSettings] = useState<ClubVisualSettings>({ quality: 'low', reducedFlashing: true });
  const { dj, holdDj, cancelDj, selectDjTrack, status, message, sessionId, roomId, zone, danceEpoch, show, setClubShow, switching, players, chat, sendMove, sendChat, changeZone, toggleSeat, setDancing } = useCityConnection(characterId);
  const localAvatar = useRef<Group>(null);
  const onAssetsReady = useCallback(() => { setReadyZone(zone); setErrorZone(null); }, [zone]);
  const onAssetsError = useCallback(() => setErrorZone(zone), [zone]);
  const clubAudio = useClubAudio({ active: zone === 'club', switching, epoch: danceEpoch, trackId: show.trackId });
  const prepareFailed = !prepared && (preparationError || clubAudio.bufferError);
  const assets = errorZone === zone || prepareFailed ? 'error' : readyZone === zone && prepared ? 'ready' : 'loading';
  const current = players[sessionId];
  const rosettaRoot = useRef<Group>(null);
  const rosetta = useRosettaInteraction({ npc: rosettaRoot, player: current, enabled: zone === 'street' && status === 'online' && assets === 'ready' && !switching });
  const djInteraction = useDjInteraction({ enabled: zone === 'club' && status === 'online' && assets === 'ready' && !switching, visit: dj, sessionId, player: current, hold: holdDj, cancel: cancelDj });
  const npcBusy = rosetta.mode !== 'greeting' || djInteraction.own;
  const nearPortal = !!current && !current.seatId && canUsePortal(zone, current.x, current.z);
  useEffect(() => retainCharacterAssets(), []);
  const onClubReady = useCallback(() => setClubReady(true), []);
  const onPreparationError = useCallback(() => setPreparationError(true), []);
  useEffect(() => {
    let cancelled = false;
    void loadClubScene().then(() => { if (!cancelled) setCodeReady(true); }).catch(() => { if (!cancelled) setPreparationError(true); });
    return () => { cancelled = true; };
  }, [preparationAttempt]);
  useEffect(() => { if (clubReady && codeReady && clubAudio.ready && !preparationError && !clubAudio.bufferError) setPrepared(true); }, [clubReady, codeReady, clubAudio.ready, preparationError, clubAudio.bufferError]);
  const retryPreparation = useCallback(() => {
    CLUB_PRELOAD_URLS.forEach(url => useGLTF.clear(url));
    setClubReady(false); setPreparationError(false); setPreparationAttempt(value => value + 1);
    clubAudio.retryPreparation();
  }, [clubAudio.retryPreparation]);
  const nearSeat = zone === 'club' && current ? nearestClubSeat(current.x, current.z) : undefined;
  const seatOccupied = !!nearSeat && Object.values(players).some(player => player.seatId === nearSeat.id && player.id !== current?.id);
  const seatEnabled = zone === 'club' && (!!current?.seatId || (!!nearSeat && !seatOccupied));
  const sit = useCallback(() => {
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    toggleSeat(current?.seatId ? '' : nearSeat?.id ?? '');
  }, [toggleSeat, current?.seatId, nearSeat?.id]);
  const dance = useCallback((style: PlayerDanceStyle = 'normal') => {
    if (style === 'guitar' && !PLAYER_CHARACTERS[characterId].guitar) return;
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    setDancing(!(current?.dancing && (current.danceStyle ?? 'normal') === style), style);
  }, [setDancing, current?.dancing, current?.danceStyle, characterId]);
  const interact = useCallback(() => {
    // Tránh giữ focus ở nút vừa bị disabled khi đổi phòng, làm WASD không phát sự kiện.
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    if (zone === 'street') clubAudio.prepareEntry();
    changeZone();
  }, [changeZone, zone, clubAudio.prepareEntry]);
  const entities = <>
    <SceneLoadBoundary key={`players-${zone}`} onError={onAssetsError}>
      {Object.entries(players).map(([session, player]) => <Avatar key={session} player={player} local={session === sessionId} objectRef={session === sessionId ? localAvatar : undefined} epoch={danceEpoch} show={show}/>)}
    </SceneLoadBoundary>
    <PlayerInput enabled={status === 'online' && assets === 'ready' && !switching && !current?.seatId && !npcBusy} sendMove={sendMove} toggleDance={zone === 'club' ? dance : undefined}/>
    <FollowCamera target={current} targetObject={localAvatar} zone={zone}/>
  </>;
  return <div className="world-root" data-zone={zone} data-room-id={roomId} data-switching={switching}>
    <Canvas camera={{ position:[1.8,4.6,13], fov:58 }} dpr={1} gl={{ antialias: true }}>
      {zone === 'street' ? <SakuraScene onReady={onAssetsReady} onError={onAssetsError} bloom={bloom}>
        <group position={[CLUB_PORTAL.x, .04, CLUB_PORTAL.z]}>
          <mesh rotation={[-Math.PI/2, 0, 0]}><ringGeometry args={[.55, .65, 32]}/><meshBasicMaterial color="#f976cb"/></mesh>
          <Billboard position={[.9, 2.75, 0]}><Text fontSize={.22} color="#8be7ff">DENMU · E</Text></Billboard>
        </group>
        <WelcomeNpc id="rosetta" objectRef={rosettaRoot} mode={rosetta.mode} player={current} onDanceError={rosetta.failDance}/>
        {entities}
      </SakuraScene> : <SceneLoadBoundary key="club" onError={onAssetsError}><Suspense fallback={null}>
        <ClubScene dj={dj} epoch={danceEpoch} show={show} settings={clubSettings} bloom={bloom} onReady={onAssetsReady}>{entities}</ClubScene>
      </Suspense></SceneLoadBoundary>}
      <SceneLoadBoundary key={`prepare-${preparationAttempt}`} onError={onPreparationError}>
        <ClubAssetWarmup onReady={onClubReady} onError={onPreparationError}/>
      </SceneLoadBoundary>
    </Canvas>
    {clubAudio.element}
    <RosettaDialog interaction={rosetta}/>
    {zone === 'club' && <DjMusicDialog interaction={djInteraction} audio={clubAudio} activeTrackId={show.trackId} select={selectDjTrack}/>}
    {zone === 'club' && <ClubShowControls audio={clubAudio} show={show} settings={clubSettings} setSettings={setClubSettings} setShow={setClubShow} isDJ={Object.keys(players)[0] === sessionId}/>}
    {assets !== 'ready' && <div role={assets === 'error' ? 'alert' : 'status'} style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translateX(-50%)', padding: 20, background: '#191329', color: '#ffe3ef', borderRadius: 12 }}>
      {assets === 'loading' ? (!prepared ? 'Đang chuẩn bị nhân vật, club và nhạc…' : 'Đang tải không gian…') : 'Không tải được tài nguyên. Hãy kiểm tra kết nối và thử lại.'}
      {prepareFailed && <button type="button" className="graphics-toggle" onClick={retryPreparation}>Thử tải lại</button>}
    </div>}
    <PortalInteraction enabled={status === 'online' && nearPortal && !switching && assets === 'ready' && !npcBusy} interact={interact}/>
    <SeatInteraction enabled={status === 'online' && seatEnabled && !npcBusy && !switching && assets === 'ready'} interact={sit}/>
    <WorldHud online={status === 'online'} connection={message} count={Object.keys(players).length} chat={chat} sendChat={sendChat} bloom={bloom} toggleBloom={() => setBloom(value => !value)} zone={zone} nearPortal={nearPortal} switching={switching || assets !== 'ready' || npcBusy} interact={interact} seated={!!current?.seatId} seatEnabled={seatEnabled} seatOccupied={seatOccupied} sit={sit} dancing={!!current?.dancing} danceStyle={current?.danceStyle ?? 'normal'} dance={dance} characterName={PLAYER_CHARACTERS[characterId].name} hasGuitar={PLAYER_CHARACTERS[characterId].guitar} chooseCharacter={chooseCharacter}/>
  </div>;
}
