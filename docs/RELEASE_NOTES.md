# Neon Sakura Architecture v2 — release notes

Date: 2026-11-04

## Fixed compared to previous starter

- Split monolithic World.tsx into Scene, Avatar, Input, Camera, Network and HUD modules.
- Implemented server-authoritative Colyseus room state with shared validated input types and basic collision.
- Implemented local guest onboarding with NestJS use case + repository port + Sequelize adapter and JWT issuer port.
- Implemented auth token verification before room join; room chat with throttling and no persistent storage.
- Aligned Docker credentials, DATABASE_URL and optional local Redis usage.
- Added unit tests, PowerShell .env generator, architecture docs, QA checklist, upgrade prompt.

## Verification evidence (artifact build environment)

- TypeScript source files parsed without syntax errors.
- Shared game-protocol compiled with global TypeScript 5.8.3; movement and collision assertions passed.
- JSON package manifests and ZIP archive were validated.
- **Not verified:** package installation, actual Next/NestJS/Colyseus builds, PostgreSQL migration, browser multiplayer, production load tests. Outbound npm registry access timed out and Docker is not installed in build environment.

## Support boundary

The deliverable is a refactored, functional-intent **development starter**, not a production-ready or fully implemented adult platform. Read README.md and docs/SECURITY-NOTES.md before any Internet deployment.
