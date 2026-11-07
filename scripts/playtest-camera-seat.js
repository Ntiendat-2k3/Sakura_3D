// Playwright MCP: đo bám camera theo frame, orbit/zoom thật, ghế và đồng bộ hai người.
async (page) => {
  let context;
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pose = p => p.evaluate(() => JSON.parse(document.querySelector('canvas').dataset.playerPose));
  const view = p => p.locator('canvas').evaluate(c => ({ ...c.neonView }));
  const ready = async (p, zone) => {
    await p.waitForFunction(zone => document.querySelector('.world-root')?.dataset.zone === zone && document.querySelector('.world-root')?.dataset.switching === 'false' && document.querySelector('canvas')?.dataset.assetStatus === 'ready' && document.querySelector('canvas')?.neonView, zone, { timeout: 20000 });
    if (zone === 'club') await p.waitForFunction(() => document.querySelector('canvas')?.dataset.npcWINE === 'ready' && document.querySelector('canvas')?.dataset.npcPOP === 'ready', {}, { timeout: 30000 });
    await p.waitForTimeout(300);
  };
  const walk = async (p, x, z) => {
    await p.bringToFront(); await p.locator('canvas').focus();
    try {
      for (let i = 0; i < 90; i++) {
        const state = await view(p), angle = state.yaw;
        const dx = x - state.rawX, dz = z - state.rawZ;
        if (Math.hypot(dx, dz) < .4) return;
        const sideways = dx * Math.cos(angle) - dz * Math.sin(angle);
        const forward = -dx * Math.sin(angle) - dz * Math.cos(angle);
        const horizontal = Math.abs(sideways) > Math.abs(forward);
        const remaining = horizontal ? sideways : forward;
        const key = horizontal ? (remaining > 0 ? 'd' : 'a') : (remaining > 0 ? 'w' : 's');
        await p.keyboard.down(key);
        await p.waitForTimeout(Math.max(45, Math.min(180, Math.abs(remaining) / 4.8 * 750)));
        await p.keyboard.up(key);
        await p.waitForTimeout(210);
      }
      throw new Error(`Không đến được điểm kiểm tra ${x},${z}`);
    } finally { for (const key of ['w','a','s','d']) await p.keyboard.up(key); }
  };
  const enter = async p => {
    await p.goto('http://localhost:3000'); await ready(p,'street');
    await walk(p,4.2,1); await p.locator('.portal-action').click(); await ready(p,'club');
  };
  try {
    await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
    await page.goto('http://localhost:3000'); await page.bringToFront(); await ready(page,'street');
    await page.locator('canvas').focus(); await page.waitForTimeout(900); await page.keyboard.down('w');
    const movement = await page.evaluate(async () => {
      const frames=[];let id;
      await new Promise(resolve => {
        setTimeout(() => {cancelAnimationFrame(id);resolve();},1800);
        function sample(t){frames.push({t,...document.querySelector('canvas').neonView});id=requestAnimationFrame(sample);}
        id=requestAnimationFrame(sample);
      });
      const steps=frames.slice(1).map((p,i)=>({visual:Math.hypot(p.x-frames[i].x,p.z-frames[i].z),raw:Math.hypot(p.rawX-frames[i].rawX,p.rawZ-frames[i].rawZ),dt:p.t-frames[i].t})).slice(10);
      const times=steps.map(s=>s.dt).sort((a,b)=>a-b);
      return {fps:1000/(times.reduce((a,b)=>a+b,0)/times.length),p95:times[Math.floor(times.length*.95)],maxVisualStep:Math.max(...steps.map(s=>s.visual)),maxRawStep:Math.max(...steps.map(s=>s.raw)),anchorError:Math.max(...frames.map(p=>Math.hypot(p.screenX,p.screenY)))};
    });
    await page.keyboard.up('w'); await page.waitForTimeout(250);
    check(movement.anchorError < 1e-5,'Camera không bám cùng avatar');
    const original=await view(page);
    await page.mouse.move(850,280);await page.mouse.down({button:'right'});await page.mouse.move(536,280,{steps:30});await page.mouse.up({button:'right'});await page.waitForTimeout(450);
    const rotated=await view(page);check(Math.abs(rotated.yaw-original.yaw)>1.4,'Không xoay được chuột phải');
    await page.screenshot({path:'test-results/screenshots/camera-quarter-turn.png',scale:'css'});
    const before=await pose(page);await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.waitForTimeout(250);const after=await pose(page);
    check(after.x<before.x-.6 && Math.abs(after.z-before.z)<.5,'WASD không theo hướng camera');
    await page.mouse.move(180,280);await page.mouse.down();await page.mouse.move(1437,280,{steps:65});await page.mouse.up();await page.waitForTimeout(450);
    const full=await view(page);check(Math.abs(full.yaw-rotated.yaw)>6.1,'Không xoay đủ 360 độ');
    await page.mouse.wheel(0,-450);await page.waitForTimeout(500);const zoom=await view(page);check(zoom.radius<full.radius-.2,'Không zoom được');
    await enter(page);await walk(page,5.7,0);
    await page.keyboard.press('Enter');await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.playerPose).seatId==='sofa-2');
    const sitting=await pose(page);await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');const frozen=await pose(page);
    check(Math.hypot(sitting.x-frozen.x,sitting.z-frozen.z)<.01,'Ngồi vẫn di chuyển được');
    await page.mouse.move(450,280);await page.mouse.down({button:'right'});await page.mouse.move(764,280,{steps:30});await page.mouse.up({button:'right'});await page.waitForTimeout(450);
    await page.screenshot({path:'test-results/screenshots/club-seated-camera.png',scale:'css'});
    await page.locator('input').fill('seat chat');await page.keyboard.press('Enter');check((await pose(page)).seatId==='sofa-2','Enter chat làm đứng dậy');
    context=await page.context().browser().newContext({viewport:{width:1280,height:720}});
    const b=await context.newPage();b.on('pageerror',onError);await enter(b);await walk(b,5.7,0);
    await b.locator('.seat-action').filter({hasText:'Ghế đang có người'}).waitFor();
    await b.screenshot({path:'test-results/screenshots/remote-seated-avatar.png',scale:'css'});
    await page.bringToFront();await page.locator('canvas').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!JSON.parse(document.querySelector('canvas').dataset.playerPose).seatId);
    await b.locator('.seat-action').filter({hasText:'Ngồi xuống'}).waitFor();await b.locator('.seat-action').click();
    await b.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.playerPose).seatId==='sofa-2');
    await context.close();context=undefined;
    await page.bringToFront();await page.locator('.seat-action').filter({hasText:'Ngồi xuống'}).waitFor();
    await page.locator('canvas').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.playerPose).seatId==='sofa-2');
    await page.screenshot({path:'test-results/screenshots/club-seat-final.png',scale:'css'});
    check(!errors.length,'Lỗi JavaScript trong browser');
    return {pass:true,movement,rotation:{quarter:rotated.yaw-original.yaw,fullTurn:full.yaw-rotated.yaw},zoom:{before:full.radius,after:zoom.radius},cameraRelativeMovement:{before,after},seated:sitting,blockedMovement:true,chatEnterSafe:true,remoteSeatVisible:true,seatFreedOnDisconnect:true,errors};
  } finally {
    await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
    for(const key of ['w','a','s','d']) await page.keyboard.up(key);
    if(context) await context.close();page.off('pageerror',onError);
  }
}
