---
name: anime-r3f-world
description: Use for a stylized anime neon city built with Next.js, Three.js, React Three Fiber, Drei, GLB avatars, Rapier collisions, scene streaming, camera movement and character animations.
---
# Anime React Three Fiber World

## Core conventions
- Keep browser-only WebGL components behind Next.js client boundaries; avoid SSR for Canvas/WebGL contexts.
- Compose a small scene graph: `WorldCanvas`, `WorldEnvironment`, `AvatarController`, `CameraRig`, `InteractionSystem`, `WorldHUD`.
- Keep gameplay simulation, network state and React render state separate; avoid per-frame React state updates.
- Start with procedural prototype geometry, then replace art with optimized licensed `.glb` assets.
- Use a consistent world scale, coordinate system and asset naming convention.

## Rendering and interaction
- Anime style: restrained toon-like materials, warm neon signs, cool ambient fill, fog, silhouettes and clear navigation routes.
- Support WASD and arrow keys, camera orbit, sprint and interact key `E`; do not trap keyboard input in chat forms.
- Validate collisions and navigability, not just visual appearance.
- Implement loading, offline/no-WebGL and WebGL context loss fallbacks.
- Keep post-processing optional and measure its cost.

## Performance
- Prefer compressed textures (KTX2 where toolchain supports), Draco/Meshopt GLB compression where useful.
- Instanced repeated props, bound shadow casters/lights, frustum culling and appropriate LOD.
- Dispose geometries/materials/textures and remove listeners on scene transitions.
- Track draw calls, triangles, GPU time (where available), FPS, bytes downloaded and initial interaction latency.
- Check both desktop and a lower-power browser profile.

## Quality checks
Build/typecheck + Playwright screenshots at spawn, after movement, inside a room, HUD with chat open and resize. Confirm avatar animation does not conflict with physics/network updates.
