---
name: game-qa-performance
description: Use to smoke-test and profile a browser-based 3D game, capture visual regressions with Playwright MCP, check WebGL/Canvas behavior and report reproducible bugs after frontend or networking changes.
---
# Browser game QA and performance

## Browser acceptance checklist
1. Start game locally using documented commands. Check HTTP and WebSocket endpoints independently.
2. Use Playwright MCP to capture initial login and world spawn screenshots. WebGL requires screenshots; DOM-only testing is not sufficient.
3. Exercise controls: walk, rotate camera, interact, open chat, close menus, change window size.
4. Check console errors, failed asset requests and rejected network requests.
5. Verify room join/leave with two independent browser contexts where supported.
6. Measure FPS and relevant performance telemetry in the app; avoid claiming values without measurement.
7. Report findings by severity with exact repro, expected vs actual, logs and screenshot references.

## Do not
- Do not report a green build simply because `/` returns HTTP 200.
- Do not treat screenshot similarity as sufficient for physics, collision or authorization.
- Do not overwrite production user data with test scripts.
- Do not use live payments or third-party personal accounts in automated tests.

## Useful game fixtures
- Local deterministic test account without personal information.
- Fixed spawn location, sample avatar, sample zone, two seeded demo rooms.
- Feature toggles to disable motion-heavy visual effects during baseline captures.
