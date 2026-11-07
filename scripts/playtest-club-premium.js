// Playwright MCP: clip FBX, đèn thật, FPS và hai người trong cùng show.
async (page) => {
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

  let context;
  const errors = [], failed = [], sockets = [];
  const onError = e => errors.push(e.message);
  const onConsole = m => { if (m.type() === 'error') errors.push(m.text()); };
  const safeURL = value => value.split(/[?#]/)[0];
  const onFailed = r => { if (!r.failure()?.errorText?.includes('ERR_ABORTED')) failed.push({ url: safeURL(r.url()), error: r.failure() }); };
  const onSocket = s => { sockets.push(safeURL(s.url())); s.on('socketerror', e => errors.push(String(e))); };
  const instrument = p => { p.on('pageerror', onError); p.on('console', onConsole); p.on('requestfailed', onFailed); p.on('websocket', onSocket); };
  const data = p => p.locator('canvas').evaluate(c => ({...c.dataset}));
  const check = (p, text) => { if (!p) throw new Error(text); };
  const sampleFPS = p => p.evaluate(async () => {
    const times=[]; let id, previous=performance.now();
    await new Promise(resolve => {
      function frame(t){ times.push(t-previous); previous=t; id=requestAnimationFrame(frame); }
      id=requestAnimationFrame(frame);setTimeout(()=>{cancelAnimationFrame(id);resolve();},3000);
    });
    const samples=times.slice(5).sort((a,b)=>a-b);
    return { fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length), p95:samples[Math.floor(samples.length*.95)], render:JSON.parse(document.querySelector('canvas').dataset.renderStats), viewport:[innerWidth,innerHeight], dpr:devicePixelRatio };
  });
  instrument(page);
  try {
    await enter(page);
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.motionWINE==='rokoko-fbx'&&document.querySelector('canvas')?.dataset.motionPOP==='rokoko-fbx');
    const performance = {};
    await page.locator('.club-show-controls summary').click();
    for (const quality of ['low','medium','high']) {
      await page.getByLabel('Chất lượng club',{exact:true}).selectOption(quality);await page.waitForTimeout(1200);
      performance[quality] = await sampleFPS(page);
    }
    await page.getByLabel('Chất lượng club',{exact:true}).selectOption('medium');
    await page.getByLabel('BPM',{exact:true}).fill('180');
    await page.getByLabel('Cue',{exact:true}).selectOption('peak');
    await page.getByRole('button',{name:'Áp dụng / bắt đầu lại',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.clubShow).bpm===180);
    context=await page.context().browser().newContext({ viewport:{width:1280,height:720} });
    const b=await context.newPage();instrument(b);await enter(b);
    await b.waitForFunction(()=>document.querySelector('canvas')?.dataset.motionWINE==='rokoko-fbx'&&document.querySelector('canvas')?.dataset.motionPOP==='rokoko-fbx');
    const rooms=await Promise.all([page,b].map(p=>p.locator('.world-root').getAttribute('data-room-id')));
    check(rooms[0]===rooms[1],'Khác room club');
    await b.locator('.club-show-controls summary').click();
    check(await b.getByRole('button',{name:'Áp dụng / bắt đầu lại',exact:true}).isDisabled(),'Khách thứ hai không được điều khiển DJ');
    const freshSample = async p => {
      await p.bringToFront();
      await p.waitForFunction(() => {
        const show=JSON.parse(document.querySelector('canvas').dataset.clubShow);
        return Math.abs(show.beat-Math.max(0,((Date.now()-show.epoch)/1000-show.offset)*show.bpm/60))<.7;
      });
      return p.locator('canvas').evaluate(c=>({data:{...c.dataset},at:Date.now()}));
    };
    const aSample=await freshSample(page),bSample=await freshSample(b);
    const aData=aSample.data,bData=bSample.data;
    const aShow=JSON.parse(aData.clubShow),bShow=JSON.parse(bData.clubShow);
    check(aShow.epoch===bShow.epoch&&aShow.bpm===bShow.bpm&&aShow.cue===bShow.cue,'Lệch metadata show');
    const phaseError=Math.abs((bShow.beat-aShow.beat)-(bSample.at-aSample.at)*aShow.bpm/60000);
    check(phaseError<.8,'Lệch pha sau khi bù thời gian lấy mẫu hai browser');
    await b.getByLabel('Nhập nội dung chat',{exact:true}).fill('premium-show-sync');
    await b.getByRole('button',{name:'Gửi',exact:true}).click();await page.getByText('premium-show-sync',{exact:false}).waitFor();
    await page.locator('.club-show-controls summary').click();await walk(page,0,-2.6);
    const wine=new Set(),pop=new Set(),spectrum=new Set();let blended=false,maxRootY=-Infinity,minRootY=Infinity;
    const start=Date.now();
    while(Date.now()-start<44000){
      await page.bringToFront();const d=await data(page);
      spectrum.add(JSON.parse(d.movingHead4).spectrumIndex);
      for(const [name,set] of [['WINE',wine],['POP',pop]]){
        const motion=JSON.parse(d['dance'+name]);set.add(motion.clip);blended ||= motion.blend>0&&motion.blend<1;
        check(motion.style==='hip-sway-body-roll','Thiếu lớp nhấn hông/body roll');
        check(motion.clip!=='DoTheRobot','Không dùng lại điệu robot');
        check(Math.abs(motion.hipsX-motion.hipsBaseX)<=.056,'Lớp nhấn hông tích lũy gây trôi nhân vật');
        maxRootY=Math.max(maxRootY,motion.rootY);minRootY=Math.min(minRootY,motion.rootY);
        check(Number.isFinite(motion.rootY)&&Math.abs(motion.rootY)<1,'Root Y không hợp lệ');
      }
      await page.waitForTimeout(250);
    }
    check(wine.size===4&&pop.size===4,'Chưa thấy đủ bốn clip mỗi NPC');check(blended,'Chưa quan sát được blend');
    check(spectrum.size===7,'Chưa quan sát đủ chu kỳ bảy màu');
    const firstLights=await data(page),keyA=JSON.parse(firstLights.movingHead2);
    const lightA=JSON.parse(firstLights.movingHead4);await page.waitForTimeout(600);
    const secondLights=await data(page),keyB=JSON.parse(secondLights.movingHead2),lightB=JSON.parse(secondLights.movingHead4);
    check(lightA.active&&lightA.intensity>0&&Math.abs(lightA.pan-lightB.pan)>.001,'Đèn thật không hoạt động/pan');
    check(keyA.active&&keyA.mode==='steady-key'&&keyA.color==='ffe8dd'&&keyA.intensity===keyB.intensity,'Đèn sân khấu phải sáng ổn định');
    await page.locator('.club-show-controls summary').click();
    check(await page.getByLabel('Giảm nhấp nháy',{exact:true}).isChecked(),'Mặc định giảm nhấp nháy');
    await page.getByLabel('Chất lượng club',{exact:true}).selectOption('high');await page.getByLabel('Giảm nhấp nháy',{exact:true}).uncheck();
    await page.locator('.club-show-controls summary').click();await page.waitForTimeout(700);
    await page.screenshot({path:'test-results/screenshots/club-mood-verified.png',scale:'css'});
    await b.bringToFront();await b.screenshot({path:'test-results/screenshots/club-mood-player-b.png',scale:'css'});
    await context.close();context=null;await page.bringToFront();
    await page.waitForFunction(()=>document.querySelector('.pill')?.textContent.includes('1 người'));
    await page.locator('.club-show-controls summary').click();await page.getByLabel('Chất lượng club',{exact:true}).selectOption('low');await page.getByLabel('Giảm nhấp nháy',{exact:true}).check();
    await page.getByLabel('BPM',{exact:true}).fill('112');await page.getByLabel('Cue',{exact:true}).selectOption('groove');await page.getByRole('button',{name:'Áp dụng / bắt đầu lại',exact:true}).click();
    check(await page.locator('audio').evaluate(audio=>audio.paused),'Nhạc chung phải chờ người dùng cho phép phát');
    await page.getByRole('button',{name:'Đồng bộ theo bài nhạc',exact:true}).click();
    await page.locator('.club-show-controls summary').click();
    const result={pass:!errors.length&&!failed.length,performance,wine:[...wine],pop:[...pop],spectrum:[...spectrum],style:'hip-sway-body-roll',blended,minRootY,maxRootY,lightA,lightB,keyA,keyB,room:rooms[0],sync:{a:aShow,b:bShow,phaseError},chat:true,disconnect:true,noMusic:true,errors,failed,sockets};
    return result;
  } finally {
    if(context) await context.close();
    page.off('pageerror',onError);page.off('console',onConsole);page.off('requestfailed',onFailed);page.off('websocket',onSocket);
  }
}
