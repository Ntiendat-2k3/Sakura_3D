// Playwright MCP: thao tác bàn phím thật, hai browser contexts, animation và chuyển phòng hai chiều.
async (page) => {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  let context;
  const pose = p => p.evaluate(() => JSON.parse(document.querySelector('canvas').dataset.playerPose));
  const ready = async (p, zone) => {
    await p.waitForFunction(zone => document.querySelector('.world-root')?.dataset.zone === zone && document.querySelector('.world-root')?.dataset.switching === 'false' && document.querySelector('canvas')?.dataset.assetStatus === 'ready', zone, { timeout: 20000 });
    if (zone === 'club') await p.waitForFunction(() => document.querySelector('canvas')?.dataset.npcWINE === 'ready' && document.querySelector('canvas')?.dataset.npcPOP === 'ready', {}, { timeout: 30000 });
  };
  const walk = async (p, x, z) => {
    await p.bringToFront();
    const held = new Set();
    try {
      for (let i = 0; i < 70; i++) {
        const now = await pose(p);
        const dx = x - now.x, dz = z - now.z;
        const needed = new Set();
        if (Math.abs(dx) > .35) needed.add(dx > 0 ? 'd' : 'a');
        if (Math.abs(dz) > .35) needed.add(dz > 0 ? 's' : 'w');
        for (const key of held) if (!needed.has(key)) { await p.keyboard.up(key); held.delete(key); }
        if (!needed.size) return;
        for (const key of needed) if (!held.has(key)) { await p.keyboard.down(key); held.add(key); }
        await p.waitForTimeout(110);
      }
      throw new Error('Không đến được điểm kiểm tra bằng WASD');
    } finally { for (const key of held) await p.keyboard.up(key); }
  };
  try {
    await page.goto('http://localhost:3000'); await ready(page, 'street');
    await walk(page, 4.2, 1);
    await page.screenshot({ path: 'test-results/screenshots/club-door.png', scale: 'css' });
    await page.locator('.portal-action').click(); await ready(page, 'club');
    await walk(page, 0, -2);
    const first = await page.evaluate(() => ({ wine: JSON.parse(document.querySelector('canvas').dataset.danceWINE), pop: JSON.parse(document.querySelector('canvas').dataset.dancePOP) }));
    await page.screenshot({ path: 'test-results/screenshots/club-dance-a.png', scale: 'css' });
    await page.waitForTimeout(720);
    const second = await page.evaluate(() => ({ wine: JSON.parse(document.querySelector('canvas').dataset.danceWINE), pop: JSON.parse(document.querySelector('canvas').dataset.dancePOP) }));
    await page.screenshot({ path: 'test-results/screenshots/club-dance-b.png', scale: 'css' });
    const animationChanged = Math.abs(first.wine.hipsZ - second.wine.hipsZ) > .001 && Math.abs(first.pop.hipsZ - second.pop.hipsZ) > .001;
    const performanceSample = await page.evaluate(async () => {
      const samples = []; let last = performance.now(), id;
      await new Promise(resolve => {
        setTimeout(() => { cancelAnimationFrame(id); resolve(); }, 3000);
        function frame(time) { samples.push(time-last); last=time; id=requestAnimationFrame(frame); }
        id=requestAnimationFrame(frame);
      });
      const sorted=samples.slice(5).sort((a,b)=>a-b);
      return { fps: 1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length), p95:sorted[Math.floor(sorted.length*.95)], stats:JSON.parse(document.querySelector('canvas').dataset.renderStats), viewport:[innerWidth,innerHeight] };
    });
    context = await page.context().browser().newContext({ viewport: { width: 1280, height: 720 } });
    const b = await context.newPage(); b.on('pageerror', onError);
    await b.goto('http://localhost:3000'); await ready(b, 'street');
    await walk(b, 4.2, 1); await b.keyboard.press('e'); await ready(b, 'club');
    const roomA = await page.locator('.world-root').getAttribute('data-room-id');
    const roomB = await b.locator('.world-root').getAttribute('data-room-id');
    if (roomA !== roomB) throw new Error('Hai người không cùng room club');
    await b.locator('.pill').filter({ hasText: '2 người' }).waitFor();
    await b.locator('input').fill('club-browser-chat'); await b.locator('button[type=submit]').click();
    await page.getByText('club-browser-chat', { exact: false }).waitFor();
    await b.screenshot({ path:'test-results/screenshots/club-player-b.png', scale:'css' });
    await page.bringToFront();
    await page.screenshot({ path:'test-results/screenshots/club-two-players.png', scale:'css' });
    await context.close(); context=undefined;
    await page.locator('.pill').filter({ hasText:'1 người' }).waitFor();
    await walk(page, 0, 6.4); await page.keyboard.press('e'); await ready(page, 'street');
    await page.screenshot({ path:'test-results/screenshots/club-return-street.png', scale:'css' });
    await page.keyboard.press('e'); await ready(page,'club');
    await page.screenshot({ path:'test-results/screenshots/club-final.png', scale:'css' });
    const reentry = await page.evaluate(() => ({ npcWINE:document.querySelector('canvas').dataset.npcWINE,npcPOP:document.querySelector('canvas').dataset.npcPOP,contextLost:document.querySelector('canvas').getContext('webgl2').isContextLost(),stats:JSON.parse(document.querySelector('canvas').dataset.renderStats) }));
    return { pass:animationChanged && !reentry.contextLost && !errors.length, animationChanged, first, second, performanceSample, sameRoom:roomA===roomB, chat:true, disconnect:true, returnAndReentry:true,reentry,errors };
  } finally {
    if(context) await context.close();
    page.off('pageerror',onError);
  }
}
