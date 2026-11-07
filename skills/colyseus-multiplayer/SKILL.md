---
name: colyseus-multiplayer
description: Use when implementing or debugging Colyseus multiplayer rooms, player joins, movement, presence, matchmaking, interest management, server authority and WebSocket synchronization for an anime web game.
---
# Colyseus multiplayer

## Architecture
- Maintain a distinct `apps/world-server` process with Colyseus room classes; the NestJS API handles durable identities and data.
- Validate short-lived join tokens on the server. Derive user identity and permissions on the server; never accept arbitrary client user IDs.
- Instantiate rooms per zone/instance; cap players and support matchmaking with friend affinity where possible.
- Keep ephemeral movement and animation state inside the room. Do not persist transforms per frame.
- Treat client packets as input intentions, not trusted player transforms; validate rate, speed, collision and sequence order.

## Networking behavior
- Start with a measured 20 Hz simulation target and 10-15 Hz state snapshot target; benchmark, do not promise.
- Client-side interpolation for remote avatars, prediction/reconciliation for the local player if necessary.
- Define a versioned wire protocol in `packages/game-protocol` and validate payloads.
- Bound chat length and event rates, handle disconnect/reconnect and grace periods.
- Avoid exposing one client's private data in the shared room state.

## Testing
- At least two browser clients; test join, leave, reconnect, avatar spawn and scene transfer.
- Simulate 100-300 ms latency with browser/network tooling and verify smooth motion.
- Test room capacity, unauthorized joins, tampered movement, flood/rate-limit, disconnection cleanup.
- Profile network bytes/second and room CPU/memory while gradually increasing player count.
- Redis is optional for one server process; introduce compatible Colyseus Presence/Driver when scaling to multiple processes.

## Output
Provide protocol/events, room lifecycle design, relevant code, instrumentation, and reproduction steps. State any untested scalability assumptions.
