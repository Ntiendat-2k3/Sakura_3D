# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Neon Sakura City: a local-only, anime-style multiplayer 3D social world. pnpm + Turbo monorepo on Windows. **`AGENTS.md` holds the binding project rules (architecture, safety, no Prisma/K8s/paid services, no Playwright/browser runs without explicit user permission) — read and follow it.** Docs and reports are mostly in Vietnamese.

## Commands

Run from the repo root (PowerShell). Outside VS Code, bare `pnpm` may hit a broken nvm shim: use `corepack.cmd pnpm ...` or prepend `scripts\bin` to PATH.

```powershell
npm run dev            # predev: starts Docker postgres (port 5435), builds @metaverse/database + game-protocol; then web:3000, api:4000, world-server:2567
pnpm build | pnpm typecheck | pnpm test     # turbo across all packages (test/typecheck depend on ^build)
pnpm db:migrate | db:undo | db:seed | db:status   # Umzug via packages/database
pnpm test:e2e          # API + 2-client Colyseus integration; requires `npm run dev` running in another terminal
```

First-time setup: `.\scripts\Init-Local.ps1` (creates `.env` with random secrets only if missing) → `pnpm install --frozen-lockfile` → `docker compose up -d postgres` → `pnpm db:migrate` → `pnpm db:seed`.

Tests use Node's built-in runner via `tsx --test`. **Each package's `test` script lists spec files explicitly** — a new spec file must be added to that list or it won't run. Single test file:

```powershell
corepack.cmd pnpm --filter @metaverse/web exec tsx --test test/dj-music.spec.ts
corepack.cmd pnpm --filter @metaverse/world-server exec tsx --test test/movement.spec.ts
```

Package names: `@metaverse/web`, `@metaverse/api`, `@metaverse/world-server`, `@metaverse/database`, `@metaverse/game-protocol`. If you see `Cannot find module @metaverse/database` (or game-protocol), build that package first — apps consume their `dist/`.

Asset pipeline: root `characters:*` scripts convert Mixamo FBX (`scripts/prepare-club-motion.mjs`) and bake into player GLBs (`apps/web/scripts/bake-player-flair.ts`); many `scripts/*.py` are Blender pipelines that build GLB scenes/characters.

## Architecture

```
Browser (Next.js 15 / R3F)  --REST-->  NestJS API (apps/api)  --> Sequelize --> PostgreSQL 17
                            --WS---->  Colyseus 0.16 (apps/world-server)  (in-memory room state)
Shared: packages/game-protocol (wire types, room names, movement/collision rules, layout/playlist JSON)
```

- **Auth (dev-only):** browser `POST /api/v1/auth/guest` → API signs 2h JWT (JOSE) → passed as Colyseus join token → `world-server/src/security/verify-demo-token.ts` verifies. API and world server must share `DEMO_JWT_SECRET` from the root `.env` (both load `../../.env`).
- **Rooms / zones:** one Colyseus room class per zone (`sakura`, `club`, `lounge`, `hotel`, `kohaku`) in `world-server/src/rooms`, registered in `main.ts` using names from game-protocol. Zone changes go through `useCityConnection.ts` `transferRef` → `joinOrCreate(roomName, { token, characterId, fromRoomId })`; the destination calls `verifyRoomTransfer`, which asks the source room via `matchMaker.remoteRoomCall(fromRoomId, 'canTransfer', ...)` — position/permission come from the server, never the client.
- **Movement:** client sends only input `{x,z}` in [-1,1] (~20 Hz). Server simulates at 20 Hz (`simulation/movement.ts`, using game-protocol walkability/colliders), patches at 10 Hz with `simulationTime`; web interpolates with a 200 ms buffer on simulation time. Positions are never written to Postgres.
- **API (Clean Architecture):** `apps/api/src/modules/<name>/{domain,application,infrastructure,presentation}`. Domain/application must not import Sequelize/NestJS/Colyseus; adapters implement ports and are wired in `<name>.module.ts`. Sequelize models and migrations live only in `packages/database/src/{models,migrations}`; never `sync()`.
- **Web:** `apps/web/components/World.tsx` composes the scene; game code lives in `apps/web/game/{scenes,entities,systems,networking,ui}`. New behavior goes in `systems/` (hooks/controllers), not in `World.tsx`. Data-driven layouts/choreography/NPC rosters are JSON next to their scenes/entities or in game-protocol. Club assets, characters and all MP3s are pre-warmed on World load (`ClubAssetWarmup`, `clubAudioBuffer`) and caches persist across room changes.
- Served assets live in `apps/web/public/assets/`; sources/licenses in `assets/source/`, intermediates in `assets/processed/`, manifests in `assets/manifests/`.

## Repo conventions

- New technical reports go in `docs/reports/` and must be linked from `docs/README.md`. Logs → `test-results/logs/`, screenshots → `test-results/screenshots/`, temp → `test-results/tmp/`.
- Never delete source models, textures, animations or license files just because they were exported.
- Project skills with domain guidance are in `skills/` (anime-r3f-world, blender-asset-pipeline, colyseus-multiplayer, game-economy-safety, game-qa-performance, sequelize-clean-architecture).
- If the 3D view shows `OFFLINE`, check the API/world-server processes before touching frontend code.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Sakura_3D** (6251 symbols, 8786 relationships, 147 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Sakura_3D/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Sakura_3D/clusters` | All functional areas |
| `gitnexus://repo/Sakura_3D/processes` | All execution flows |
| `gitnexus://repo/Sakura_3D/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
