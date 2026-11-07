# Architecture Decision Record: v2 (2026-11)

## Context

Browser multiplayer world for one hobby developer; free local dev, future scale without premature distributed complexity.

## Decision

**Modular Monolith NestJS API + separate stateful Colyseus server + Next.js 3D web + PostgreSQL**.
The API owns durable identity, profiles, economy, and audit records.
Colyseus owns short-lived room state (position, activity, chat) and validates client inputs.

```text
                         Browser (Next.js, R3F)
                          | REST     | WS
                          v          v
                  NestJS API     Colyseus Game Server
                  | Clean Ports  | rooms / state / input
                  | adapters     | bounded movement
                  v              v
                 Sequelize      in-memory Room state
                  |
             PostgreSQL 17

             Shared: @metaverse/game-protocol
```

### Server boundaries

- `packages/game-protocol`: zero ORM, zero network, zero UI dependencies. Shared message names, wire types and pure movement constraints.
- `apps/api/src/modules/*/domain`: domain entities and repository interfaces.
- `.../application`: use cases depend only on domain and ports.
- `.../infrastructure`: Sequelize adapters and token signing.
- `.../presentation`: HTTP controllers; never place domain logic here.
- `apps/world-server`: room lifecycle, auth verification, state, simulation and message handlers.
- `apps/web/game`: renderer, input, camera, network adapter, HUD. **Never trust the client as authoritative**.

### Persistence

- Sequelize v6 + sequelize-typescript are stable and maintained. Umzug SQL migrations; no schema sync at app boot.
- Connection pooling is configured conservatively for local dev (pool max 5).
- Migrate, seed and server run from the root `.env` but never commit that file.
- No user position written to PostgreSQL every tick.

### Auth flow (DEV ONLY)

1. Browser POSTs `/api/v1/auth/guest`; API creates a guest user via repository.
2. API signs a 2-hour JWT with `issuer`, `audience` and `sub`.
3. Browser sends JWT as Colyseus auth token.
4. Server checks signature, issuer, audience, expiration and claim shapes; joins room.
5. Guest is recreated on refresh; there is no refresh token, CAPTCHA, age verification or ban system yet.

**Must replace guest auth before public deployment.** Private adult areas must be access-controlled and verified for age/consent as appropriate.

### Movement

- Input từ browser: `{x:-1..1,z:-1..1}` khoảng 20 Hz khi có frame; keyup gửi dừng ngay ở frame kế tiếp.
- World validates finite values, caps diagonals, simulates at 20 ticks per second.
- Movement clipped by map boundaries and basic collider rectangles; stale inputs stop automatically.
- Colyseus gửi patch 10 Hz, gồm `simulationTime` tăng theo tick kể cả khi mọi người đứng yên. Adapter gắn mốc này vào `PositionSnapshot.sampleTime`; browser nội suy trên thời gian mô phỏng với đệm 200 ms, hiệu chỉnh lệch đồng hồ từ từ và không ngoại suy ra ngoài tọa độ đã nhận.
- Physics collisions are simplified to rectangles. A production scene needs actual collider data derived from approved level geometry.

### Scaling path

1. **Local:** one API + one Colyseus process + Postgres, no Redis (demo).
2. **Small online test:** add authoritative login, distributed rate limit, tests, private access, TLS, metrics, chat moderation and incident response.
3. **More simultaneous players:** partition into multiple Colyseus room instances, tune player counts to benchmark. Add RedisPresence + RedisDriver and appropriate routing, plus PostgreSQL pooling only when using multiple processes.
4. **Higher concurrency:** shared asset CDN, server allocation by zone, interest management, monitoring, load testing; consider separate services only when clear bottlenecks exist.

### Known limitations

- Chat is ephemeral in-memory and lightly throttled. No profanity/content filter, report history, or moderation log.
- No transaction ledger yet. Never implement coins by trusting values from browser.
- No age assurance or payment stack. Keep this environment private to local development.
- Static building colliders are demonstration geometry only.
- No WebRTC/LiveKit integration yet. Must implement consent and moderation before voice.
- Dependency versions are compatible targets, but installation/build should be verified on your Windows machine.
