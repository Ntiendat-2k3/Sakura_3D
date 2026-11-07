// Playwright MCP: hai origin Windows local, API khởi động chậm và lỗi HTTP không bị lặp yêu cầu.
async (page) => {
  const browser = page.context().browser();
  const contexts = [];
  const check = (value, text) => { if (!value) throw new Error(text); };
  const open = async () => { const context = await browser.newContext(); contexts.push(context); return context.newPage(); };
  const results = { origins: [], cors: {}, networkRecovery: null, httpFailure: null };
  try {
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
      const p = await open();
      const guestResponse = p.waitForResponse(r => r.url().endsWith('/api/v1/auth/guest') && r.status() === 201);
      await p.goto(origin);
      await guestResponse;
      await p.waitForFunction(() => document.querySelector('.pill')?.textContent.includes('ONLINE'), {}, { timeout: 20000 });
      results.origins.push({ origin, online: true, guestStatus: 201 });
      const health = await p.request.get('http://localhost:4000/api/v1/health', { headers: { Origin: origin } });
      check(health.headers()['access-control-allow-origin'] === origin, 'Thiếu CORS cho ' + origin);
      results.cors[origin] = health.headers()['access-control-allow-origin'];
      await p.context().close();
    }
    const retry = await open(); let attempts = 0;
    await retry.route('**/api/v1/auth/guest', async route => {
      attempts++;
      if (attempts <= 2) await route.abort('connectionrefused'); else await route.continue();
    });
    await retry.goto('http://127.0.0.1:3000');
    await retry.waitForFunction(() => document.querySelector('.panel p')?.textContent.includes('Đang đợi API'), {}, { timeout: 10000 });
    await retry.waitForFunction(() => document.querySelector('.pill')?.textContent.includes('ONLINE'), {}, { timeout: 20000 });
    check(attempts >= 3, 'Không tự phục hồi sau lỗi mạng tạm thời');
    results.networkRecovery = { refusedRequests: 2, attempts, recovered: true };
    await retry.context().close();
    const rejected = await open(); let rejectedRequests = 0;
    await rejected.route('**/api/v1/auth/guest', async route => {
      rejectedRequests++;
      await route.fulfill({ status: 503, headers: { 'access-control-allow-origin': 'http://localhost:3000' }, contentType: 'application/json', body: '{"message":"Test service unavailable"}' });
    });
    await rejected.goto('http://localhost:3000');
    await rejected.waitForFunction(() => document.querySelector('.panel p')?.textContent.includes('Không tạo được phiên guest'), {}, { timeout: 10000 });
    // Next dev có thể reload document lần đầu; chỉ đo yêu cầu lặp sau khi mount đã ổn định.
    await rejected.waitForTimeout(2250); const settled = rejectedRequests;
    await rejected.waitForTimeout(1900);
    check(rejectedRequests === settled, 'Không được retry khi API đã trả lỗi HTTP');
    results.httpFailure = { status: 503, retried: false, requests: rejectedRequests };
    const untrusted = await rejected.request.get('http://localhost:4000/api/v1/health', { headers: { Origin: 'http://untrusted.example' } });
    check(!untrusted.headers()['access-control-allow-origin'], 'Không được mở wildcard CORS');
    results.cors.untrustedOriginAllowed = false;
    return { pass: true, ...results };
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
}
