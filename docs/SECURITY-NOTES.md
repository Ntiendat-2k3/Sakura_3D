# Security notes for a dev-only demo

## Strong warnings

- This example does NOT validate real users' age, identity or consent. Never expose an adult-content or adult-service app based on this scaffold.
- The guest endpoint writes rows to PostgreSQL; it is intentionally disabled under `NODE_ENV=production` and lacks rate limits appropriate for the public Internet.
- Colyseus JWT is short-lived but not revocable yet; production must add revocation, bans and proper account lifecycle.
- Room chat is ephemeral and only throttled; no moderation, profanity filtering, reporting, retained evidence or safety operations are implemented.
- All media, events, shop, VIP and coin features require additional security design before exposing them to users.

## Local development

- Generate `.env` with `scripts/Init-Local.ps1`, which uses CSPRNG; never commit it.
- Never pass `DEMO_JWT_SECRET` to the frontend or add `NEXT_PUBLIC_` to that variable.
- `docker compose` binds Postgres and optional Redis to 127.0.0.1, not all network interfaces.
- The API has CORS restricted to localhost:3000 by default.
- The sample includes no public registration, payment, administrator credentials or real-person content.
