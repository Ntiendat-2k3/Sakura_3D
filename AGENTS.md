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
