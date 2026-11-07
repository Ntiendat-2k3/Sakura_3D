// Chạy bằng Playwright MCP browser_run_code_unsafe(filename), kiểm tra game thật và lưu ảnh chứng cứ.
async (page) => {
  const errors = [];
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('pageerror', onError);
  page.on('console', onConsole);
  const pose = () => page.evaluate(() => JSON.parse(document.querySelector('canvas').dataset.playerPose));
  const ready = async () => {
    await page.locator('.pill.online').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.assetStatus === 'ready' && document.querySelector('canvas')?.dataset.playerPose, {}, { timeout: 20000 });
    await page.waitForTimeout(600);
  };
  try {
    await page.goto('http://localhost:3000');
    await page.bringToFront();
    await ready();
    const start = await pose();
    await page.keyboard.down('w');
    await page.waitForTimeout(800);
    await page.keyboard.up('w');
    await page.keyboard.down('d');
    const timing = await page.evaluate(async () => {
      const samples = [];
      let last = performance.now();
      let frameId;
      await new Promise(resolve => {
        setTimeout(() => { cancelAnimationFrame(frameId); resolve(); }, 3500);
        function frame(time) { samples.push(time - last); last = time; frameId = requestAnimationFrame(frame); }
        frameId = requestAnimationFrame(frame);
      });
      const sorted = samples.slice(5).sort((a, b) => a - b);
      return { frames: samples.length, fps: 1000 / (sorted.reduce((a, b) => a + b, 0) / sorted.length), frameTimeP95Ms: sorted[Math.floor(sorted.length * .95)] };
    });
    const wall = await pose();
    await page.waitForTimeout(650);
    await page.keyboard.up('d');
    const stopped = await pose();
    const cameraInside = [-8.8, 8.8].some(x => [-15, -7, 1, 9].some(z => stopped.camera[0] > x - 3.5 && stopped.camera[0] < x + 3.5 && stopped.camera[2] > z - 3.5 && stopped.camera[2] < z + 3.5));
    const collisionPassed = Math.abs(wall.x - stopped.x) < .05 && stopped.x < 5.3 && stopped.x > 4.8;
    await page.screenshot({ path: 'test-results/screenshots/asset-upgrade-collision.png', scale: 'css' });
    const rendering = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const assets = performance.getEntriesByType('resource').filter(r => r.name.includes('/assets/'));
      return {
        viewport: [innerWidth, innerHeight],
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
        contextLost: gl.isContextLost(),
        renderStats: JSON.parse(canvas.dataset.renderStats),
        bloom: document.querySelector('.graphics-toggle').getAttribute('aria-pressed'),
        assets: [...new Map(assets.map(r => [r.name, { url: r.name, status: r.responseStatus }])).values()],
      };
    });
    await page.goto('http://localhost:3000');
    await ready();
    await page.screenshot({ path: 'test-results/screenshots/asset-upgrade-after.png', scale: 'css' });
    await page.locator('.graphics-toggle').click();
    await page.waitForTimeout(1600);
    await page.screenshot({ path: 'test-results/screenshots/asset-upgrade-bloom.png', scale: 'css' });
    await page.locator('.graphics-toggle').click();
    return { pass: collisionPassed && !cameraInside && !rendering.contextLost && errors.length === 0, start, wall, stopped, collisionPassed, cameraInside, timing, rendering, errors };
  } finally {
    await page.keyboard.up('w');
    await page.keyboard.up('d');
    page.off('pageerror', onError);
    page.off('console', onConsole);
  }
}
