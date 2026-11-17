# Kohaku Bluff: cà khịa, giọng Shinku và dàn cảnh bóp cò

Ngày: 2026-11-12 · Nhánh: `feat/kohaku-bluff`

## Vì sao

Ván nói dối ở bàn Kohaku chơi được nhưng nhạt: người chưa tới lượt chỉ ngồi chờ, dealer Shinku im lặng, lúc bóp cò chỉ có tiếng click/bang. Mục tiêu là tăng hồi hộp và cảm giác "có người thật" quanh bàn. Người dùng chọn: **âm thanh thay cho chữ** (không bong bóng thoại), Shinku nói **tiếng Nhật kiểu anime**, làm **cả ba nhóm lần lượt** theo thứ tự A → B → C.

## Mục tiêu

- **A. Cà khịa:** người chơi trong ván, trừ lúc đang cầm súng, làm động tác + âm thanh hướng về một đối thủ (giơ ngón giữa, chỉ tay, đập bàn, cười khẩy). Đây là ý chính của người dùng.
- **B. Shinku có giọng:** dealer nói câu tiếng Nhật theo diễn biến ván; Shinku liếc người đang tới lượt; Hinata/Bartender quay nhìn bàn khi súng nổ.
- **C. Dàn cảnh bóp cò:** đèn phòng tối lại, spotlight rọi người cầm súng, tiếng tim đập nhanh dần theo số lần đã bóp, camera đẩy sát trong nhịp chờ.

## Không làm (non-goals)

- Chat giọng thật giữa người chơi (AGENTS.md yêu cầu mute/report/ban trước).
- Bong bóng chữ, phụ đề trong game.
- Đổi luật bắn (vị trí đạn vẫn bốc ngẫu nhiên một lần mỗi ván, như hiện tại).
- Chế độ Liar's Dice/khác.

## Điều cấm (anti-goals: làm vậy là hỏng dù chạy được)

- **Lộ thông tin ẩn.** Giọng/hiệu ứng không được phản ứng với việc lá úp là thật hay dối trước khi lật bài; không lộ vị trí đạn (tim đập chỉ dựa trên `pulls` đã công khai, không dựa trên đạn). `shotResult` vẫn chỉ có ở pha `result`.
- **Spam cà khịa** làm ồn bàn: phải có cooldown phía server.
- Người đang tới lượt hoặc đang cầm súng bị người khác chặn thao tác: cà khịa chỉ là hiệu ứng, không đổi trạng thái ván, không chặn nút Úp bài/NÓI DỐI!.
- Âm thanh Kohaku phát khi người chơi ở zone khác.
- Thêm dịch vụ trả phí hoặc phụ thuộc mạng khi chạy game (giọng phải là file tĩnh).

## Ràng buộc

- Theo `AGENTS.md`/`CLAUDE.md`: server quyết định, client chỉ gửi ý định; luật nằm ở `apps/world-server/src/systems/kohakuBluff.ts`, room `kohaku.room.ts` chỉ nối message; kiểu và hằng số dùng chung ở `packages/game-protocol/src/kohaku-bluff.ts`; hành vi web mới đặt trong `apps/web/game/systems/`, không nhồi vào `World.tsx`.
- Test bằng `tsx --test`; spec mới phải thêm vào script `test` của package. Không chạy Playwright/trình duyệt nếu người dùng chưa cho phép.
- Asset phục vụ ở `apps/web/public/assets/`, nguồn/giấy phép ở `assets/source/`.

## Hiện trạng liên quan (đã kiểm)

- Engine Bluff: `createKohakuBluff` (pha `lobby → turn → reveal → shooting → result → gameOver`), `BLUFF_TIMING.suspenseMs = 2000` đã có nhịp chờ trước khi ra kết quả.
- Message: `BLUFF_MESSAGES = { ready, play, liar, hand }`; room đăng ký từng `onMessage` và gọi `syncBluff()`.
- Client: `useCityConnection` giữ `bluff`/`bluffHand`; `World.tsx` tính `shooterPose` (`'aim' | 'slump'`) và `closeup` camera cho người bắn; `Avatar.tsx` áp `applyBluffPose` (IK tay) với blend 0.4 s.
- Âm thanh: `bluffSfx.ts` tạo shuffle/click/bang bằng WebAudio (không file); `useBluffEffects` chọn âm theo chuyển trạng thái bằng hàm thuần `bluffSoundFor` có cơ chế "seed" để người vào giữa ván không nghe âm cũ. **Mẫu này dùng lại cho giọng Shinku.**
- Đèn Kohaku: các `pointLight`/`ambientLight` khai báo trực tiếp trong `KohakuScene.tsx`; scene đã nhận prop `bluff`.
- Mọi player GLB (bocchi, kita, mint, miorine, nijika, ryo, serie, ubel, yui) đều có xương ngón Mixamo `Left/RightHandIndex1-3`, `Middle1-3` → làm được giơ ngón giữa/chỉ tay.
- Máy có Docker và ffmpeg; VOICEVOX chưa cài.
- Phím đang dùng: N + 1..7 cho nhảy, F cho tương tác NPC (đã tắt khi ngồi ghế Bluff).

## A. Cà khịa

**Ai, khi nào (luật server):**
- Người gửi phải đang ngồi ghế Bluff, `inMatch && alive`.
- Pha `turn` và `reveal`: luôn được, dù có đang tới lượt mình hay không (người dùng chốt 2026-11-12).
- Pha `shooting` và `result`: được, trừ người đang cầm súng (`shooterSeat` là ghế mình).
- Pha `lobby` và `gameOver`: không được.
- *(Quyết định của Claude)* Trong pha `shooting` vẫn cho cà khịa nhưng **chỉ có động tác, không phát âm thanh** (cả giọng lẫn tiếng đập bàn), để giữ nhịp im lặng của phần C. Client tự tắt tiếng theo pha hiện tại; luật server không đổi.
- Đích là một ghế khác đang `inMatch && alive`.
- Cooldown 3 s mỗi người (`BLUFF_TIMING.tauntCooldownMs`).
- Sai điều kiện thì bỏ qua im lặng, giống `play`/`liar` hiện tại.
- **Không có nút tắt cà khịa.** Người dùng đã quyết định (2026-11-12): cà khịa là các câu soạn sẵn, có cooldown phía server để chống spam, nên không thuộc quy định chat/voice ở AGENTS.md.

**Truyền tin:** cà khịa là sự kiện thoáng qua, **không đưa vào Schema**. Client gửi `BLUFF_MESSAGES.taunt` (`'bluff-taunt'`) với `{ kind, targetSeat }`; server kiểm rồi `broadcast` `BLUFF_MESSAGES.tauntFx` (`'bluff-taunt-fx'`) với `{ seatId, kind, targetSeat }`. Người vào sau không cần thấy lại. Thêm `normalizeBluffTaunt(input)` vào game-protocol (cùng kiểu `normalizeBluffPlay`).

**Bốn động tác** (bảng `BLUFF_TAUNTS` trong game-protocol: id, nhãn tiếng Việt, phím, thời lượng):

| id | Nhãn | Động tác | Âm thanh |
| --- | --- | --- | --- |
| `flip` | Giơ ngón giữa | Tay phải giơ về phía đích, nắm tay trừ ngón giữa | Giọng: 「ざぁこ♡」 hoặc 「べーっだ！」 |
| `point` | Chỉ mặt | Tay phải chỉ thẳng đích, nắm tay trừ ngón trỏ | Giọng: 「嘘つき！」 hoặc 「バレバレだよ？」 |
| `slam` | Đập bàn | Hai tay đập xuống mặt bàn | WebAudio: tiếng thịch gỗ + rung chén, tổng hợp như `bluffSfx` |
| `laugh` | Cười khẩy | Nghiêng đầu, tay che miệng, vai rung nhẹ | Giọng: 「ふふっ」 hoặc 「あはははっ」 |

Thời lượng mỗi động tác khoảng 1.5 s cộng blend vào/ra. Thân trên và tay xoay về phía ghế đích (vị trí lấy từ `KOHAKU_SEATS`).

**Giao diện:** người dùng chốt ngày 2026-11-12 là **không có UI chọn cà khịa**.
- Đang ngồi trong ván thì chỉ cần bấm phím `1`–`4`.
- Phím tắt được ghi trong luật chơi (`kohakuGameRules.ts`).
- Không có nút bấm và không có bước chọn đích. Đích được chọn tự động như sau:
- Pha `turn`: người đang tới lượt. Nếu đang là lượt của mình thì chọn người vừa úp bài (`lastPlay.seatId`); nếu chưa ai úp thì chọn người sống kế tiếp.
- Các pha sau: người cầm súng.
- Không bao giờ chọn chính mình.

Đang tới lượt mình mà cà khịa thì vẫn úp bài hoặc hô NÓI DỐI! bình thường.

**Hiển thị trên avatar:** mở rộng `BluffPose` thành `'aim' | 'slump' | 'flip' | 'point' | 'slam' | 'laugh'`, áp bằng IK/xoay xương trong `bluffPose.ts`, cộng thêm phần cong ngón tay. `aim`/`slump` luôn ưu tiên hơn cà khịa. Một hook mới trong `systems/` nhận `tauntFx`, giữ động tác đang chạy theo ghế, hết thời lượng thì xóa và phát âm thanh.

## B. Giọng Shinku

**Khi nào nói** (suy ra từ chuyển trạng thái bàn ở client bằng hàm thuần `bluffVoiceFor(prev, table)`, cùng cơ chế seed như `bluffSoundFor`, mỗi tình huống 2–3 câu chọn ngẫu nhiên):

| Tình huống | Điều kiện | Ví dụ câu (giọng điềm tĩnh, lịch sự, hơi lạnh) |
| --- | --- | --- |
| Bắt đầu ván | `lobby → turn` | 「ようこそ、琥珀のテーブルへ。」 |
| Lá chủ của vòng | vào `turn` từ pha khác, theo `tableRank` | 「キングのテーブルです。」/「クイーン…」/「エース…」 |
| Có người hô dối | vào `reveal` có `accuserSeat` | 「嘘つき、ですって？」 |
| Lật bài: nói thật | vào `reveal`, `revealed` đều đúng hạng (Joker tính đúng) | 「残念。本当でしたね。」 |
| Lật bài: nói dối | vào `reveal`, có lá sai hạng | 「あら、バレましたね。」 |
| Vào bóp cò | vào `shooting` | 「さあ、運命の時間です。」 |
| Click | `shotResult → click` | 「…運がいいですね。」 |
| Bang | `shotResult → bang` | 「さようなら。」 |
| Còn 2 người | số người sống giảm còn 2 | 「残りは、お二人だけ。」 |
| Có người thắng | vào `gameOver` | 「おめでとうございます。生き残ったのは、あなたです。」 |

Phản ứng lật bài chỉ dựa trên `revealed`, vốn chỉ công khai ở pha `reveal`, nên không lộ thông tin ẩn. Lật bài khi hết bài (`accuserSeat` rỗng) dùng câu lật bài, bỏ câu "hô dối". *(Quyết định của Claude)* Giọng Shinku chạy trên **một hàng đợi**. `bluffVoiceFor` trả về **danh sách** câu theo thứ tự, và các câu được phát nối tiếp nhau, không cắt ngang:
- `lobby → turn` nói câu chào rồi tới câu lá chủ.
- `bang` khiến bàn còn 2 người thì nói 「さようなら。」 rồi tới câu còn 2 người.
- Câu chúc mừng ở `gameOver` xếp sau câu `bang`.
- Hàng đợi giữ tối đa 3 câu. Khi đầy thì bỏ câu cũ nhất chưa phát. Rời zone thì xóa hàng đợi. Giọng phát qua cùng `AudioContext` với `bluffSfx`, không định vị 3D.

**Nhìn và quay đầu:** Shinku xoay đầu/thân trên nhìn ghế `turnSeat` (pha `turn`) hoặc `shooterSeat` (pha bóp cò) bằng cách nối thêm trong `kohakuNpcMotion`. Hinata và Bartender quay đầu nhìn tâm bàn khoảng 3 s khi `shotResult` thành `bang`.

**Sản xuất file giọng:**
- Danh sách câu nằm trong một file JSON (`apps/web/game/systems/bluff-voice-lines.json`): id, nhóm tình huống, câu tiếng Nhật, nghĩa tiếng Việt (để đọc tham khảo), speaker. Câu cà khịa của phần A cũng nằm ở đây.
- Script `scripts/generate-bluff-voices.mjs` gọi VOICEVOX Engine qua HTTP (`/audio_query` → `/synthesis`) tại `127.0.0.1:50021`. Engine chạy bằng Docker image `voicevox/voicevox_engine` bản CPU, ghim phiên bản cụ thể. Script dùng ffmpeg chuyển WAV → MP3 mono và ghi vào `apps/web/public/assets/audio/kohaku-bluff/<id>.mp3`. Các file MP3 được commit; chơi game không cần VOICEVOX.
- Speaker: một giọng nữ điềm tĩnh cho Shinku, một giọng nữ tinh nghịch cho câu cà khịa của người chơi (dùng chung cho mọi nhân vật). Chỉ chọn speaker mà điều khoản cho phép dùng miễn phí khi ghi nguồn, và ghi rõ `VOICEVOX:<tên speaker>` cùng điều khoản vào `assets/source/audio/kohaku-bluff-voices/LICENSE.md`. Gợi ý ban đầu (người làm phải đọc điều khoản trước khi chốt): 冥鳴ひまり cho Shinku, 春日部つむぎ cho câu cà khịa.
- *(Quyết định của Claude)* Nếu điều khoản của speaker không cho phép nội dung (bạo lực, lời trêu chọc):
  1. Thử speaker VOICEVOX khác có điều khoản cho phép.
  2. Nếu vẫn không có speaker phù hợp, viết lại câu cho nhẹ đi, ví dụ đổi 「ざぁこ♡」 thành 「へたっぴ～」 và 「さようなら。」 thành 「…お気の毒に。」.
  3. Không bao giờ commit file có giấy phép chưa rõ ràng. Nếu nhóm câu nào vẫn bế tắc thì bỏ nhóm câu đó và báo người dùng; các phần còn lại vẫn làm tiếp.
- Tải trước: thêm các file giọng vào bước tải sẵn của `ClubAssetWarmup` (cùng chỗ tải MP3 club) và decode sang `AudioBuffer` một lần; cache giữ qua các lần đổi phòng.

## C. Dàn cảnh bóp cò

- **Đèn:** trong pha `shooting` và `result`, mọi đèn trong `KohakuScene` mờ xuống còn khoảng 25% trong 0.6 s, thêm một `spotLight` trắng ấm chiếu từ trần xuống ghế người cầm súng. Hết `result` thì sáng lại trong 0.6 s. Gom phần này vào một component/hook trong `systems/` hoặc `entities/` nhận `bluff`, không rải logic trong scene.
- **Tim đập:** tiếng tim đập "thịch-thịch" tổng hợp bằng WebAudio trong `bluffSfx`, lặp suốt pha `shooting`. BPM = 70 + 18 × `pulls` của người cầm súng trước lần bóp này (0 → 70, 5 → 160). Dừng ngay khi có `shotResult`.
- **Camera:** giữ `closeup` sẵn có, thêm hiệu ứng đẩy sát dần trong pha `shooting` (khoảng 15% khoảng cách trong `suspenseMs`). Áp cho mọi người đang ở zone Kohaku và đang thấy closeup, theo đúng điều kiện hiện tại.
- **Nhịp im lặng:** Shinku nói câu "vào bóp cò" ở đầu pha `shooting`, sau đó chỉ còn tiếng tim đập cho tới khi ra kết quả. Thời gian vẫn dùng `suspenseMs` của server, không đổi.

## Kiểm chứng

- game-protocol: test `normalizeBluffTaunt`.
- world-server `test/kohaku-bluff.spec.ts`: thêm ca cà khịa hợp lệ (gồm cả lúc đang tới lượt mình), sai pha, đang cầm súng, đích không hợp lệ/chính mình, cooldown; trạng thái ván không đổi sau khi cà khịa.
- web `test/kohaku-bluff.spec.ts`: `bluffVoiceFor` (seed, từng tình huống, không phản ứng trước reveal), BPM tim đập, điều kiện bật nút cà khịa/chọn đích mặc định.
- Chạy `pnpm typecheck`, `pnpm test`. Phần nhìn/nghe trong trình duyệt **chỉ kiểm khi người dùng cho phép**; nếu không, báo là "chưa kiểm bằng mắt".

## Để người làm tự quyết

- Góc xương và đường cong cụ thể của từng động tác; cách cong ngón tay.
- Phím tắt cho 4 động tác: phải không trùng phím di chuyển, F, N + số, và các phím HUD hiện có.
- Câu thoại cụ thể (giữ đúng giọng điệu và tình huống ở bảng), số câu mỗi nhóm (2–3), bitrate MP3.
- Âm lượng tương đối giữa giọng, SFX và nhạc nền.
- Cấu trúc file và tên hook, miễn là theo đúng tầng của repo.
