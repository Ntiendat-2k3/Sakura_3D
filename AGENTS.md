# Neon Sakura City — Codex Project Instructions

## Tech stack and costs
- Windows-friendly local development, no paid service required.
- pnpm workspaces + Turbo; Next.js 15/React 19/R3F, NestJS 10, Sequelize v6/PostgreSQL 17, Colyseus 0.16.
- DO NOT introduce Prisma, Kubernetes, hosted paid services or extra microservices without explicit approval.
- Read README.md, docs/ARCHITECTURE.md and docs/ROADMAP.md before altering core architecture.

## Architecture rules
- Domain and Application layers do not import Sequelize, NestJS or Colyseus.
- Use port interfaces and infrastructure adapters; NestJS wiring belongs to module providers.
- Database models/migrations only under packages/database. All DB structural changes through Umzug migrations, never auto-sync.
- Client sends player INPUT; game server owns authoritative position and validates every message.
- Wire protocol types and pure collision helpers live in packages/game-protocol; no ORM dependencies there.
- New game behavior belongs in systems/, not a giant World.tsx.
- Redis is optional until multi-process scaling becomes necessary.

## Required safety and quality
- Demo auth endpoint is local-only; do not deploy publicly or treat it as age verification.
- No real-money purchases, adult service marketplace or unverified age-gated content flows in this starter.
- Chat/voice requires user controls, consent, report/mute/ban and abuse management before release.
- Never print secrets, commit .env or expose DEMO_JWT_SECRET with NEXT_PUBLIC_.
- Test ports/migrations/auth/room sync, and honestly describe unverified tests.
- Không chạy Playwright hoặc tự mở trình duyệt kiểm thử khi chưa được người dùng cho phép rõ ràng; dùng terminal/static/unit checks trong thời gian chờ.
- Check official docs for exact versions before making large dependency upgrades.

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
