// UI 端到端走查与截图：地图、编号冲突、封签/交接拦截、自放行 403、无权限公告、未批准发布 409、报告追溯。
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001/api';
const OUT = '/workspace/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const PNG = fs.readFileSync('/workspace/server/uploads/seal-w04.png');

async function users() {
  const list = await (await fetch(`${API}/users`)).json();
  return Object.fromEntries(list.map((u) => [u.login, u]));
}
async function wells() {
  return fetch(`${API}/wells/map`).then((r) => r.json());
}
async function asFetch(uid, path, opts = {}) {
  const isJson = typeof opts.body === 'string';
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'x-user-id': uid,
      ...(isJson ? { 'content-type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
}
async function createSample(uid, wellId, overrides = {}) {
  const fd = new FormData();
  const d = {
    wellId,
    containerCode: 'UI-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    sampledAt: new Date().toISOString(),
    sealCode: 'S-UI-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    weather: '晴',
    waterTempC: '18.0',
    chlorineSmell: 'false',
    visualNote: 'UI 走查样品',
    coldChainRequired: 'true',
    sealIntactAtCollect: 'true',
  };
  Object.assign(d, overrides);
  for (const [k, v] of Object.entries(d)) fd.set(k, v);
  fd.set('sealPhoto', new Blob([PNG], { type: 'image/png' }), 'seal.png');
  const res = await asFetch(uid, '/samples', { method: 'POST', body: fd });
  return res.json();
}

(async () => {
  const U = await users();
  const W = Object.fromEntries((await wells()).map((w) => [w.code, w]));
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (m) => m.type() === 'error' && console.log('PAGE-ERR:', m.text().slice(0, 200)));

  async function shot(name, full = true) {
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: full });
    console.log('saved', name);
  }
  async function switchUser(uid) {
    await page.selectOption('.user-switch select', uid);
    await page.waitForTimeout(400);
  }

  // ① 点位图仪表盘（未登录也可查看）
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot('01-map-dashboard.png');

  // ② 编号冲突：孙采样用已存在的 C-W04-1004 重复登记 → 409
  await switchUser(U.sun.id);
  await page.goto(BASE + '/collect', { waitUntil: 'networkidle' });
  await page.selectOption('form select', W['W-04'].id); // 井号
  await page.fill("input[placeholder='C-W01-1005']", 'C-W04-1004');
  await page.fill("input[placeholder='S-A008']", 'S-DUP-01');
  await page.setInputFiles('input[type=file]', {
    name: 'seal.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.click('button[type=submit]');
  await page.waitForSelector('.alert-error');
  await shot('02-container-conflict-409.png');

  // ③ 交接拦截：送检页取消封签勾选后启运 → 409 封签破损
  await page.goto(BASE + '/handovers', { waitUntil: 'networkidle' });
  const card = page.locator('[data-container="C-W04-1004"]');
  await card.locator('input[type=checkbox]').first().uncheck();
  await card.getByText('核对无误，启运送检').click();
  await card.locator('.alert-error').waitFor();
  await shot('03-handover-broken-seal-409.png');
  // 再演示冷藏不达标
  await card.locator('input[type=checkbox]').first().check();
  await card.locator('input[type=checkbox]').nth(1).uncheck();
  await card.getByText('核对无误，启运送检').click();
  await page.waitForTimeout(600);
  await shot('03b-handover-coldchain-409.png');

  // ④ 取样人签自己的放行 → 403：钱主任自建自走一条链
  const self = await createSample(U.qian.id, W['W-02'].id);
  await asFetch(U.qian.id, `/samples/${self.id}/handovers/send`, {
    method: 'POST',
    body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await asFetch(U.zhao.id, `/samples/${self.id}/handovers/receive`, {
    method: 'POST',
    body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await asFetch(U.zhao.id, `/samples/${self.id}/lab/simulate`, {
    method: 'POST',
    body: JSON.stringify({ outcome: 'qualified' }),
  });
  await switchUser(U.qian.id);
  await page.goto(BASE + '/review', { waitUntil: 'networkidle' });
  const selfCard = page.locator(`[data-container="${self.containerCode}"]`);
  await selfCard.getByText('核对封签与记录，放行').click();
  await selfCard.locator('.alert-error:has-text("不能签署自己")').waitFor();
  await shot('04-self-release-403.png');

  // ⑤ 无权限人员发布公告：周主任（OFFICIAL 无 ANNOUNCER）→ 提示无授权
  await switchUser(U.zhou.id);
  await page.goto(BASE + '/announcements', { waitUntil: 'networkidle' });
  await page.waitForSelector('.alert-warn');
  await shot('05-announce-forbidden.png');

  // ⑥ 授权人也不能跳过负责人批准：新合格批次只放行未决定"同意发布" → 409
  const s = await createSample(U.li.id, W['W-01'].id);
  await asFetch(U.li.id, `/samples/${s.id}/handovers/send`, {
    method: 'POST', body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await asFetch(U.zhao.id, `/samples/${s.id}/handovers/receive`, {
    method: 'POST', body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await asFetch(U.zhao.id, `/samples/${s.id}/lab/simulate`, {
    method: 'POST', body: JSON.stringify({ outcome: 'qualified' }),
  });
  await asFetch(U.zhou.id, `/samples/${s.id}/handovers/release`, {
    method: 'POST', body: JSON.stringify({ sealIntact: true }),
  });
  await switchUser(U.chen.id);
  await page.goto(BASE + '/announcements', { waitUntil: 'networkidle' });
  await page.selectOption('.card select', s.id);
  await page.fill('.card input', '测试公告标题');
  await page.fill('.card textarea', '测试正文');
  await page.getByText('发布公告').last().click();
  await page.waitForSelector('.alert-error:has-text("同意发布")');
  await shot('06-announce-without-approval-409.png');

  // ⑦ 报告详情：W-06 结果更正版本链 + 完整交接
  const list = await (await fetch(`${API}/samples`)).json();
  const w06 = list.find((x) => x.containerCode === 'C-W06-0929');
  await page.goto(`${BASE}/samples/${w06.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot('07-report-versions.png');

  // ⑧ 退样批次报告（W-05：封签破损退样，旧样品保留）
  const w05 = list.find((x) => x.containerCode === 'C-W05-0930');
  await page.goto(`${BASE}/samples/${w05.id}`, { waitUntil: 'networkidle' });
  await shot('08-report-rejected.png');

  await browser.close();
  console.log('ALL SCREENSHOTS DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
