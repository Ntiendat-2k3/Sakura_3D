---
name: game-economy-safety
description: Use for Neon Sakura City virtual wallet, cosmetic shop, demo coin purchases, VIP memberships, room moderation, age safeguards, privacy controls and audit trails with Sequelize/PostgreSQL.
---
# Demo economy and user safety

## Economy design
- Demo coins have no withdrawal, cash-out or conversion to legal currency in the initial project.
- Server calculates price, inventory eligibility and resulting balance; ignore all client-supplied balances.
- Store append-only wallet ledger entries and an indexed balance snapshot; reconcile under a database transaction.
- Use idempotency keys with unique constraints to avoid duplicate purchases and callback replays.
- Use integer quantities (BigInt when appropriate), check non-negative balance at database/application boundaries.
- Support transaction rollback on any partial failure and test races with simultaneous purchases.

## Social safety
- Adult-oriented styling requires age gating and a lawful content policy, plus region-specific compliance before launch.
- Add user block/mute/report, moderator dashboard, clear rules and appeal logs.
- For voice/video, default to off; grant permission per room and let the user leave or mute instantly.
- Enforce room membership and invitation checks on every protected resource.
- Protect private messages, minimize logs of sensitive content, apply retention rules and rate limits.
- Never design workflows to broker illegal sexual services or facilitate exploitation.

## Testing
Test insufficient funds, simultaneous purchases, negative prices, forged admin claims, duplicate requests, inaccessible private rooms, blocked user messaging and account bans.
