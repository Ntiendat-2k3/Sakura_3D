import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLLIDERS, STREET_LAYOUT, STREET_DECOR, isWalkable, isKohakuWalkable, resolveKohakuStep, getKohakuSurfaceY, KOHAKU_COLLIDERS, KOHAKU_SEATS, nearestKohakuSeat, nearestZoneSeat, nearestStreetPortal, getZoneSeats, GEKKA_SEATS, GEKKA_UPPER_BLOCKERS, GEKKA_RACK, POKER_SEATS, getGekkaSurfaceY, resolveGekkaStep, canUsePortal, normalizeDanceInput, normalizeMoveInput, validateClubShow, DEFAULT_CLUB_TRACK, DEFAULT_CLUB_SHOW, getClubPlaybackSeconds, getClubTrackCue, getLoungeSurfaceY, getWalkThroughTarget } from '../src';

test('bảy kiểu nhảy hợp lệ, lệnh dừng luôn cất đàn và từ chối khóa prototype', () => {
  assert.deepEqual(normalizeDanceInput({ dancing: true }), { dancing: true, style: 'normal' });
  assert.deepEqual(normalizeDanceInput({ dancing: true, style: 'guitar' }), { dancing: true, style: 'guitar' });
  assert.deepEqual(normalizeDanceInput({ dancing: true, style: 'flair' }), { dancing: true, style: 'flair' });
  assert.deepEqual(normalizeDanceInput({ dancing: true, style: 'hiphop' }), { dancing: true, style: 'hiphop' });
  assert.deepEqual(normalizeDanceInput({ dancing: false, style: 'hiphop' }), { dancing: false, style: 'normal' });
  assert.deepEqual(normalizeDanceInput({ dancing: false, style: 'flair' }), { dancing: false, style: 'normal' });
  assert.deepEqual(normalizeDanceInput({ dancing: false, style: 'guitar' }), { dancing: false, style: 'normal' });
  for (const style of ['maraschino', 'swing', 'snakehiphop']) {
    assert.deepEqual(normalizeDanceInput({ dancing: true, style }), { dancing: true, style });
    assert.deepEqual(normalizeDanceInput({ dancing: false, style }), { dancing: false, style: 'normal' });
  }
  for (const input of [null, {}, { dancing: 'true' }, { dancing: true, style: 'invalid' }, { dancing: true, style: 2 }, { dancing: true, style: '__proto__' }, { dancing: true, style: 'constructor' }, { dancing: true, style: null }]) assert.equal(normalizeDanceInput(input), null);
});

test('nhạc chung lặp cùng epoch, bù offset và cue theo track', () => {
  assert.ok(DEFAULT_CLUB_TRACK.durationSeconds > 0);
  assert.equal(DEFAULT_CLUB_SHOW.bpm, DEFAULT_CLUB_TRACK.bpm);
  assert.equal(DEFAULT_CLUB_SHOW.cue, 'auto');
  assert.equal(getClubPlaybackSeconds(1000, 10, 3500), 2.5);
  assert.equal(getClubPlaybackSeconds(1000, 10, 23500), 2.5);
  assert.equal(getClubPlaybackSeconds(1000, 10, 500), 0);
  assert.equal(getClubPlaybackSeconds(1000, 0, 3500), 0);
  for (const cue of DEFAULT_CLUB_TRACK.cues) assert.equal(getClubTrackCue(cue.atSeconds), cue.cue);
  assert.ok(validateClubShow(DEFAULT_CLUB_SHOW));
});
test('metadata club loại số không hữu hạn, cue lạ và không truyền file âm thanh', () => {
  assert.equal(validateClubShow({ bpm: NaN, offset: 0, cue: 'peak' }), null);
  assert.equal(validateClubShow({ bpm: 120, offset: Infinity, cue: 'peak' }), null);
  assert.equal(validateClubShow({ bpm: 120, offset: 0, cue: 'unknown' }), null);
  assert.equal(validateClubShow({ bpm: 1000, offset: 0, cue: 'groove' }), null);
  assert.deepEqual(validateClubShow({ bpm: 128, offset: .2, cue: 'peak', audio: 'discard' }), { bpm: 128, offset: .2, cue: 'peak' });
});
test('rejects NaN and out-of-range move commands', () => {
  assert.equal(normalizeMoveInput({ x: NaN, z: 0 }), null);
  assert.equal(normalizeMoveInput({ x: 5, z: 0 }), null);
  const normalized = normalizeMoveInput({ x: 1, z: 1 });
  assert.ok(normalized && Math.abs(Math.hypot(normalized.x, normalized.z) - 1) < 1e-9);
});
test('server collisions: road allowed, buildings denied', () => {
  assert.equal(isWalkable(0, 0), true);
  assert.equal(isWalkable(9, 9), false);
  assert.equal(isWalkable(50, 0), false);
});

test('mọi công trình GLB có collider, đường và khoảng hở vẫn đi được', () => {
  assert.equal(STREET_LAYOUT.length, 8);
  assert.equal(COLLIDERS.length, STREET_LAYOUT.length);
  for (const block of STREET_LAYOUT) {
    assert.equal(isWalkable(block.x, block.z), false, block.id);
    assert.equal(isWalkable(Math.sign(block.x) * 4.8, block.z), true, `vỉa hè ${block.id}`);
    assert.equal(isWalkable(block.x, block.z + 3.8), true, `khe giữa nhà ${block.id}`);
  }
});

test('đồ trang trí phố (street-decor.json) có collider, cửa vào các tòa và lối đi vẫn thông', () => {
  for (const tree of STREET_DECOR.trees) assert.equal(isWalkable(tree.x, tree.z), false, `gốc cây ${tree.x},${tree.z}`);
  for (const lantern of STREET_DECOR.stoneLanterns) assert.equal(isWalkable(lantern.x, lantern.z), false, 'đèn đá');
  for (const kind of ['planters', 'benches', 'bicycles', 'poles'] as const) for (const item of STREET_DECOR[kind]) assert.equal(isWalkable(item.x, item.z), false, `${kind} ${item.z}`);
  assert.equal(isWalkable(STREET_DECOR.gate.x, STREET_DECOR.gate.z), false, 'trụ cổng bắc');
  assert.equal(isWalkable(0, STREET_DECOR.gate.z), true, 'đi qua giữa cổng bắc');
  assert.equal(isWalkable(0, 18.5), true, 'đi qua giữa cổng torii');
  // Cửa vào mọi tòa có portal: đứng trước cửa và bước qua ngưỡng đều không bị đồ trang trí chặn.
  for (const [x, z] of [[4.2, 1], [-4.2, -7], [-4.2, -9.6], [-4.2, -15], [4.2, -15]]) {
    assert.equal(isWalkable(x, z), true, `trước cửa ${x},${z}`);
    assert.equal(isWalkable(Math.sign(x) * 3.2, z), true, `lối tới cửa ${x},${z}`);
  }
  // Lòng đường giữa hai hàng vỉa hè luôn đi xuyên suốt từ đầu tới cuối phố.
  for (let z = -23; z <= 23; z += 0.5) assert.equal(isWalkable(0, z), true, `lòng đường z=${z}`);
});

test('thang bộ Reika Lounge dốc từ sàn 1F lên chiếu nghỉ 2F và cửa phòng 201', () => {
  assert.equal(getLoungeSurfaceY(0, 0), 0);
  assert.equal(getLoungeSurfaceY(5.3, 2.0), 0);
  assert.equal(getLoungeSurfaceY(5.3, 4.4), 2.32);
  assert.equal(getLoungeSurfaceY(5.3, 6.0), 2.32);
  assert.ok(getLoungeSurfaceY(5.3, 3.425) > 1.0 && getLoungeSurfaceY(5.3, 3.425) < 1.3);
  assert.equal(getLoungeSurfaceY(2.0, 3.425), 0);
});

test('bước qua ngưỡng cửa tự động chuyển phòng liền mạch không cần bấm E', () => {
  // Phố Sakura -> Denmu Club
  assert.equal(getWalkThroughTarget('street', 4.3, 1.0), 'club');
  // Phố Sakura -> Reika Lounge
  assert.equal(getWalkThroughTarget('street', -4.3, -7.0), 'lounge');
  // Phố Sakura -> Love Hotel
  assert.equal(getWalkThroughTarget('street', -4.3, -9.6), 'hotel');
  // Reika Lounge 1F -> Phố Sakura
  assert.equal(getWalkThroughTarget('lounge', 0, 5.6), 'street');
  // Reika Lounge 2F -> Love Hotel Room 201
  assert.equal(getWalkThroughTarget('lounge', 5.3, 6.0), 'hotel');
  // Denmu Club -> Phố Sakura
  assert.equal(getWalkThroughTarget('club', 0, 6.2), 'street');
  // Love Hotel -> Reika Lounge 2F
  assert.equal(getWalkThroughTarget('hotel', 0, 4.6), 'lounge');
  // Phố Sakura -> Kohaku Club Tầng 1
  assert.equal(getWalkThroughTarget('street', -4.3, -15.0), 'kohaku');
  // Kohaku Club -> Phố Sakura
  assert.equal(getWalkThroughTarget('kohaku', 0, 6.9), 'street');
  // Khi ở xa ngưỡng cửa
  assert.equal(getWalkThroughTarget('street', 0, 0), undefined);
  assert.equal(getWalkThroughTarget('lounge', 0, 0), undefined);
  assert.equal(getWalkThroughTarget('lounge', 5.3, 3.5), undefined);
  assert.equal(getWalkThroughTarget('kohaku', 0, 0), undefined);
});

test('Kohaku Club: colliders, ghế ngồi bàn tròn poker và tương tác portal', () => {
  // Khoảng hở sàn đi bộ trong Kohaku
  assert.equal(isKohakuWalkable(0, 5.2), true, 'lối thảm đỏ từ cửa vào');
  assert.equal(isKohakuWalkable(0, 3.5), true, 'lối đi gần cửa');
  assert.equal(isKohakuWalkable(-3.0, 0), true, 'lối đi bên trái bàn tròn');
  assert.equal(isKohakuWalkable(3.0, 0), true, 'lối đi bên phải bàn tròn');

  // Chặn va chạm: tâm bàn tròn poker (0, 0) & đồ decor Tầng 1
  assert.equal(isKohakuWalkable(0, 0), false, 'bàn tròn poker trung tâm');
  assert.equal(isKohakuWalkable(-6.5, -0.9), false, 'quầy bar whisky');
  assert.equal(isKohakuWalkable(-6.8, 4.6), false, 'tủ kính rượu quý');
  assert.equal(isKohakuWalkable(-4.2, 4.6), false, 'bàn tròn cocktail đứng');
  assert.equal(isKohakuWalkable(-2.55, 6.65), false, 'đôn cây bonsai trái');
  assert.equal(isKohakuWalkable(2.55, 6.65), false, 'đôn cây bonsai phải');
  assert.equal(isKohakuWalkable(-6.7, -6.65), false, 'đồng hồ quả lắc cổ');
  assert.equal(isKohakuWalkable(-1.45, 5.0), false, 'dải dây nhung VIP');
  assert.equal(isKohakuWalkable(0, -7.0), false, 'lò sưởi gia huy');
  assert.equal(isKohakuWalkable(-6.6, -5.0), false, 'tháp thùng sake komodaru');
  assert.equal(isKohakuWalkable(4.0, -6.95), false, 'bệ bình ikebana');
  assert.equal(isKohakuWalkable(5.7, 6.3), false, 'góc trà tatami tầng 1');
  assert.equal(isKohakuWalkable(-3.0, -7.0, 3.6), false, 'bình phong byobu tầng 2');
  assert.equal(isKohakuWalkable(-3.0, -5.8, 3.6), true, 'hành lang tầng 2 trước byobu vẫn đi được');
  assert.equal(isKohakuWalkable(6.3, -4.2, 7.2), false, 'góc trà tatami tầng 3');
  assert.equal(isKohakuWalkable(5.1, -4.2, 7.2), true, 'lối đi cạnh góc trà tầng 3');
  assert.equal(isKohakuWalkable(5.6, -4.0), false, 'cầu thang tầng 2');
  assert.equal(isKohakuWalkable(10.0, 0), false, 'ngoài tường phòng');

  // Danh sách ghế ngồi quanh bàn tròn Poker: 1 Dealer + 4 Players + 2 Sofa
  assert.ok(KOHAKU_SEATS.length >= 7);
  const dealerSeat = KOHAKU_SEATS.find(s => s.id === 'kohaku-dealer');
  assert.ok(dealerSeat, 'phải có ghế dealer');
  assert.equal(dealerSeat.x, 0);
  assert.equal(dealerSeat.z, -1.88);

  const player1 = KOHAKU_SEATS.find(s => s.id === 'kohaku-player-1');
  const player2 = KOHAKU_SEATS.find(s => s.id === 'kohaku-player-2');
  const player3 = KOHAKU_SEATS.find(s => s.id === 'kohaku-player-3');
  const player4 = KOHAKU_SEATS.find(s => s.id === 'kohaku-player-4');
  assert.ok(player1 && player2 && player3 && player4, 'phải có đủ 4 ghế người chơi');
  // Đảm bảo vector nhìn của cả 4 ghế đều hướng vào tâm bàn (0, 0)
  for (const s of [player1, player2, player3, player4]) {
    const dot = Math.sin(s.yaw) * (-s.x) + Math.cos(s.yaw) * (-s.z);
    assert.ok(dot > 1.5, `ghế ${s.id} phải quay mặt vào giữa bàn`);
  }

  // Tìm ghế gần nhất (không trả về ghế kohaku-dealer dành riêng cho NPC)
  assert.equal(nearestKohakuSeat(0, -1.9), undefined, 'người chơi không được ngồi vào ghế dealer của NPC');
  assert.equal(nearestZoneSeat('kohaku', -1.8, -0.45)?.id, 'kohaku-player-1');
  assert.equal(nearestZoneSeat('kohaku', -1.3, 1.3)?.id, 'kohaku-player-2');
  assert.equal(nearestZoneSeat('kohaku', 1.3, 1.3)?.id, 'kohaku-player-3');
  assert.equal(nearestZoneSeat('kohaku', 1.8, -0.45)?.id, 'kohaku-player-4');

  // Kiểm tra quyền dùng portal
  assert.equal(canUsePortal('street', -4.2, -15.0, 'kohaku'), true);
  assert.equal(canUsePortal('kohaku', 0, 7.1, undefined, 0), true);
  assert.equal(canUsePortal('kohaku', 0, 7.0, undefined, 7.2), false, 'tầng 3 không thoát ra phố');
  assert.equal(getWalkThroughTarget('kohaku', 0, 6.9, 7.2), undefined, 'tầng 3 không kích hoạt walk-through ra phố');
  assert.equal(nearestZoneSeat('kohaku', 5.2, 3.1, 7.2), undefined, 'tầng 3 không ngồi nhầm sofa tầng 1');
  assert.equal(canUsePortal('kohaku', 0, 0), false);
});

test('Kohaku Club 3 tầng: đi bộ leo cầu thang 1 -> 2 -> 3, xuống thang và chống rớt giếng trời', () => {
  // Mô phỏng đi từ sàn Tầng 1 lên cầu thang cánh phải (x = 5.9, z: -1.35 -> -6.1)
  let y = 0;
  let step = resolveKohakuStep(5.9, y, -1.35, 5.9, -1.55);
  assert.equal(step.allowed, true, 'bước lên đầu cầu thang 1->2');
  assert.ok(step.y > 0.10 && step.y < 0.25);
  y = step.y;

  for (const z of [-2.0, -2.5, -3.0, -3.5, -4.0, -4.5, -5.0, -5.5]) {
    step = resolveKohakuStep(5.9, y, z + 0.4, 5.9, z);
    assert.equal(step.allowed, true, `leo thang 1->2 tại z=${z}`);
    assert.ok(step.y > y, `độ cao tăng dần tại z=${z}`);
    const stepIndex = Math.max(0, Math.min(23, Math.floor((-1.6 - z) / (4.4 / 24))));
    const stepTop = (stepIndex + 1) * (3.6 / 24);
    assert.ok(step.y >= stepTop - 0.01, `chân phải đứng trên mặt bậc đá 1->2 tại z=${z} (y=${step.y}, top=${stepTop})`);
    y = step.y;
  }

  // Lên chiếu nghỉ Tầng 2 (z = -6.1)
  step = resolveKohakuStep(5.9, y, -5.7, 5.9, -6.1);
  assert.equal(step.allowed, true, 'bước vào chiếu nghỉ Tầng 2');
  assert.equal(step.y, 3.6);
  y = step.y;

  // Chống đi xuyên hông từ Tầng 1 lên giữa cầu thang
  assert.equal(resolveKohakuStep(4.0, 0, -4.0, 5.5, -4.0).allowed, false, 'không cho nhảy từ sàn tầng 1 sang giữa thang');

  // Chống đi xuyên rào chắn kính góc cua Tầng 2 -> cầu thang 1->2
  assert.equal(resolveKohakuStep(4.0, 3.6, -5.2, 4.8, -5.2).allowed, false, 'không cho đi xuyên lan can kính góc cua cầu thang 1->2');
  assert.equal(resolveKohakuStep(4.25, 3.6, -5.6, 5.05, -5.6).allowed, false, 'không cho lọt qua trụ lan can kính tại x=4.68 để sang cầu thang');
  assert.equal(resolveKohakuStep(5.9, 3.6, -6.5, 4.2, -6.5).allowed, true, 'vòng qua sau trụ góc cua (z < -6.22) thì đi bình thường');

  // Đi dọc Sảnh Sau Tầng 2 sang Cánh Trái (x: 5.9 -> 0 -> -5.9)
  step = resolveKohakuStep(5.9, 3.6, -6.5, 5.0, -6.5);
  assert.equal(step.allowed, true);
  step = resolveKohakuStep(2.0, 3.6, -5.2, -2.0, -5.2);
  assert.equal(step.allowed, true, 'đi ngang Sảnh Sau Tầng 2 không bị vách tầng 1 chặn');
  assert.equal(step.y, 3.6);

  // Chống rớt xuống giếng trời từ lan can Tầng 2
  assert.equal(resolveKohakuStep(0, 3.6, -4.76, 0, -4.4).allowed, false, 'lan can Tầng 2 chặn rớt giếng trời');

  // Đi sang Cánh Trái Tầng 2 và bước lên cầu thang 2 -> 3 (x = -5.9, z: -4.8 -> -1.9 -> +2.9)
  step = resolveKohakuStep(-5.9, 3.6, -4.8, -5.9, -2.0);
  assert.equal(step.allowed, true);
  y = step.y;

  for (const z of [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5]) {
    step = resolveKohakuStep(-5.9, y, z - 0.3, -5.9, z);
    assert.equal(step.allowed, true, `leo thang 2->3 tại z=${z}`);
    assert.ok(step.y > y, `độ cao tăng dần 3.6->7.2 tại z=${z}`);
    const stepIndex = Math.max(0, Math.min(23, Math.floor((z - (-1.6)) / (4.4 / 24))));
    const stepTop = 3.6 + (stepIndex + 1) * (3.6 / 24);
    assert.ok(step.y >= stepTop - 0.01, `chân phải đứng trên mặt bậc đá 2->3 tại z=${z} (y=${step.y}, top=${stepTop})`);
    y = step.y;
  }

  // Bước lên Sảnh Trước Tầng 3 (z = 2.9)
  step = resolveKohakuStep(-5.9, y, 2.55, -5.9, 2.9);
  assert.equal(step.allowed, true, 'lên Sảnh Trước Tầng 3');
  assert.equal(step.y, 7.2);

  // Đi dạo trên Sảnh Trước Tầng 3 và Hành Lang Phải Tầng 3
  assert.equal(resolveKohakuStep(0, 7.2, 4.0, 5.5, 4.0).allowed, true);
  assert.equal(resolveKohakuStep(5.8, 7.2, 4.0, 5.8, -2.0).allowed, true, 'hành lang Phải Tầng 3 bên trên cầu thang 1->2');
  assert.equal(resolveKohakuStep(0, 7.2, 3.15, 0, 2.7).allowed, false, 'lan can Tầng 3 chặn rớt giếng trời');

  // Độ cao surface check
  assert.equal(getKohakuSurfaceY(0, 3.5, 0), 0);
  assert.equal(getKohakuSurfaceY(0, 4.0, 7.2), 7.2);
});

test('gekka: cầu thang hầm dốc đều 0 → -3.2 và tầng trên không đi xuyên lỗ cầu thang', () => {
  assert.equal(getGekkaSurfaceY(5.9, 3.5, 0), 0);
  assert.ok(Math.abs(getGekkaSurfaceY(5.9, 1, -1.6) + 1.6) < 0.05);
  assert.equal(getGekkaSurfaceY(0, -3, -3.2), -3.2);
  assert.equal(resolveGekkaStep(5.9, 0, 0.5, 5.9, 0.4).allowed, false);
  assert.equal(resolveGekkaStep(5.2, -0.32, 3, 5.19, 3).allowed, false, 'không thoát ngang sang sàn trên ở giữa thang');
  assert.equal(resolveGekkaStep(5.19, 0, 3, 5.2, 3).allowed, false, 'không bước ngang từ sàn trên vào giữa thang');
  assert.equal(resolveGekkaStep(6.6, -0.32, 3, 6.61, 3).allowed, false, 'mép phải cũng chặn thoát ngang');
  assert.equal(resolveGekkaStep(5.19, 0, 3.4, 5.2, 3.4).allowed, true, 'đầu thang vẫn nối với sàn trên');
  let y = 0;
  for (const z of [3, 2.5, 2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2]) {
    const step = resolveGekkaStep(5.9, y, z + 0.5, 5.9, z);
    assert.equal(step.allowed, true, `xuống hầm tại z=${z}`);
    assert.ok(step.y <= y, `độ cao giảm tại z=${z}`);
    y = step.y;
  }
  assert.equal(y, -3.2);
  assert.equal(resolveGekkaStep(0, 0, -3, 0, -3).allowed, true);
  assert.equal(resolveGekkaStep(0, -3.2, -3, 0, -3).allowed, true);
});

test('gekka: không đi xuyên quầy rượu, góc sofa, bình phong và khung trói chữ A', () => {
  for (const box of Object.values(GEKKA_UPPER_BLOCKERS)) {
    assert.equal(resolveGekkaStep((box.xMin + box.xMax) / 2, 0, box.zMax + 0.4, (box.xMin + box.xMax) / 2, (box.zMin + box.zMax) / 2).allowed, false);
  }
  assert.equal(resolveGekkaStep(GEKKA_RACK.x + 0.8, -3.2, GEKKA_RACK.z + 0.6, GEKKA_RACK.x + 0.8, GEKKA_RACK.z).allowed, false);
  // Lối từ cửa vào tới đầu cầu thang vẫn thông.
  assert.equal(resolveGekkaStep(5.9, 0, 4.2, 5.9, 3.5).allowed, true);
  assert.equal(resolveGekkaStep(0, 0, 6.2, 0, 5.4).allowed, true);
});

test('gekka: cổng phố và cửa ra chỉ hoạt động ở tầng trên', () => {
  assert.equal(nearestStreetPortal(4.2, -15)?.destination, 'gekka');
  assert.equal(canUsePortal('gekka', 0, 6.6, undefined, 0), true);
  assert.equal(canUsePortal('gekka', 0, 6.6, undefined, -3.2), false);
  assert.equal(getWalkThroughTarget('street', 4.6, -15), 'gekka');
});

test('gekka: sáu ghế poker, dealer, cột và sáu chỗ xích', () => {
  assert.equal(POKER_SEATS.length, 6);
  assert.equal(GEKKA_SEATS.length, 14);
  for (const seat of GEKKA_SEATS.filter(seat => seat.id === 'gekka-dealer' || seat.id === 'gekka-post' || seat.id.startsWith('gekka-cell-'))) {
    assert.equal(seat.npcOnly, true, seat.id);
  }
  assert.equal(getZoneSeats('gekka'), GEKKA_SEATS);
});
