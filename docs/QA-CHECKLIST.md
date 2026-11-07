# Validation checklist

## Static checks and scripts

```powershell
pnpm --filter @metaverse/database build
pnpm --filter @metaverse/game-protocol build
pnpm test
pnpm typecheck
pnpm build
```

## API / DB integration (after Docker and `pnpm dev`)

```powershell
$env:PATH = "$env:APPDATA\npm;$env:PATH"
Invoke-RestMethod http://localhost:4000/api/v1/health
Invoke-RestMethod http://localhost:4000/api/v1/zones
Invoke-RestMethod -Method Post http://localhost:4000/api/v1/auth/guest
Test-NetConnection -ComputerName localhost -Port 2567
corepack.cmd pnpm test:e2e
```

The API health endpoint must return database connected. The auth endpoint returns a short-lived **demo token**. Do not post this token publicly.

## Multiplayer manual smoke

1. Open `http://localhost:3000` in two normal browser tabs.
2. Both show `ONLINE` and `2 người` (or more if other tabs connected).
3. Move character in Tab A; Tab B sees its position update.
4. Try diagonal movement and building walls; speed must not increase and player must not cross walls.
5. Write a message in Tab A; Tab B receives it.
6. Close A; B player count decreases.
7. Kill the world-server process; UI must display offline/error, not a false online state.
8. Inspect DevTools console for uncaught exceptions.

## Non-goals for this release

The e2e script does not assert WebGL pixels or frame rate. Browser screenshots from the local Playwright check are recorded in `docs/reports/DEV_SETUP_REPORT.md`.
