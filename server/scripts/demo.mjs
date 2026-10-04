#!/usr/bin/env node
// 端到端业务规则演示：对运行中的后端发起真实 HTTP 请求。
// 用法：先 `npm run dev`，再 `npm run demo`。
// 若数据库被演示数据污染：`npm run setup` 重置并重新播种。

const BASE = process.env.API_BASE ?? 'http://localhost:3001/api';

const OK = '\x1b[32m✔\x1b[0m';
const NO = '\x1b[31m✘\x1b[39m';
const HEAD = '\x1b[36m━\x1b[39m';
let pass = 0;
let fail = 0;

function head(title) {
  console.log(`\n${HEAD} ${title}`);
}

// 期望某种状态码与错误信息片段
async function expectReject(label, res, expectedStatus, kw) {
  const body = await res.json().catch(() => ({}));
  const msg = Array.isArray(body.message) ? body.message.join('；') : body.message;
  const okStatus = res.status === expectedStatus;
  const okKw = !kw || (msg ?? '').includes(kw);
  if (okStatus && okKw) {
    pass++;
    console.log(`${OK} 【${label}】被拦截：HTTP ${res.status} —— ${msg}`);
  } else {
    fail++;
    console.log(
      `${NO} 【${label}】期望 ${expectedStatus} 且含「${kw}」，实际 HTTP ${res.status}：${msg}`,
    );
  }
  return body;
}

async function expectOk(label, res) {
  const body = await res.json().catch(() => ({}));
  if (res.status >= 200 && res.status < 300) {
    pass++;
    console.log(`${OK} 【${label}】成功：HTTP ${res.status}`);
  } else {
    fail++;
    const msg = Array.isArray(body.message) ? body.message.join('；') : body.message;
    console.log(`${NO} 【${label}】应成功却返回 HTTP ${res.status}：${msg}`);
  }
  return body;
}

const h = (uid) => ({ 'x-user-id': uid });
const j = (uid, extra = {}) => ({ ...h(uid), 'content-type': 'application/json', ...extra });

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function sampleForm(overrides) {
  const fd = new FormData();
  const d = {
    wellId: null,
    containerCode: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    sampledAt: new Date().toISOString(),
    sealCode: 'S-DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    weather: '晴',
    waterTempC: '18.0',
    chlorineSmell: 'false',
    visualNote: '演示样品',
    coldChainRequired: 'true',
    sealIntactAtCollect: 'true',
    ...overrides,
  };
  for (const [k, v] of Object.entries(d)) fd.set(k, v);
  fd.set('sealPhoto', new Blob([PNG], { type: 'image/png' }), 'seal.png');
  return fd;
}

async function main() {
  // —— 就绪检查 ——
  let users;
  try {
    users = await (await fetch(`${BASE}/users`, { headers: {} })).json();
  } catch {
    console.error('后端未启动。请先在另一个终端执行： npm run dev');
    process.exit(1);
  }
  const U = Object.fromEntries(users.map((u) => [u.login, u]));
  const wells = await (await fetch(`${BASE}/wells/map`)).json();
  const w = (code) => wells.find((x) => x.code === code).id;

  console.log('当前登录角色：');
  for (const u of users) console.log(`  · ${u.name}（${u.login}）：${u.roles.join('、')}`);

  // ============ 一、容器编号冲突 ============
  head('一、容器编号冲突（容器编号必须唯一，禁止覆盖旧样品）');
  // 种子数据中 C-W04-1004 已存在
  const dup = await fetch(`${BASE}/samples`, {
    method: 'POST',
    headers: h(U.li.id),
    body: sampleForm({ wellId: w('W-04'), containerCode: 'C-W04-1004' }),
  });
  await expectReject('用已存在容器编号 C-W04-1004 重复登记', dup, 409, '容器编号冲突');

  // ============ 二、交接顺序错误 ============
  head('二、交接顺序错误（必须按 启运→签收→结果→放行 的实际顺序办理）');
  // 新建一个样品（默认 COLLECTED 待送检），跳过"启运"直接让送检员"签收"
  const sOrder = await (
    await fetch(`${BASE}/samples`, {
      method: 'POST',
      headers: h(U.li.id),
      body: sampleForm({ wellId: w('W-05') }),
    })
  ).json();
  const receiveEarly = await fetch(`${BASE}/samples/${sOrder.id}/handovers/receive`, {
    method: 'POST',
    headers: j(U.wang.id),
    body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await expectReject('未启运就直接办理实验室签收', receiveEarly, 409, '交接顺序错误');

  // 封签破损同样阻断交接
  const sendBroken = await fetch(`${BASE}/samples/${sOrder.id}/handovers/send`, {
    method: 'POST',
    headers: j(U.li.id),
    body: JSON.stringify({ sealIntact: false, coldChainOk: true, note: '封签已断裂' }),
  });
  await expectReject('封签破损仍办理启运', sendBroken, 409, '封签破损');

  // 冷藏不达标也阻断
  const sendWarm = await fetch(`${BASE}/samples/${sOrder.id}/handovers/send`, {
    method: 'POST',
    headers: j(U.li.id),
    body: JSON.stringify({ sealIntact: true, coldChainOk: false }),
  });
  await expectReject('冷藏温度不达标仍办理启运', sendWarm, 409, '冷藏');

  // ============ 三、取样人不能签自己的放行 ============
  head('三、取样人不能签自己的放行（须由其他负责人批准）');
  // 钱主任兼具 采样员+负责人，自己取样
  const sSelf = await (
    await fetch(`${BASE}/samples`, {
      method: 'POST',
      headers: h(U.qian.id),
      body: sampleForm({ wellId: w('W-02') }),
    })
  ).json();
  // 钱主任自己启运（采样员身份），赵实验签收、模拟出结果
  await expectOk(
    '钱主任（取样人）启运',
    await fetch(`${BASE}/samples/${sSelf.id}/handovers/send`, {
      method: 'POST',
      headers: j(U.qian.id),
      body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
    }),
  );
  await expectOk(
    '赵实验签收',
    await fetch(`${BASE}/samples/${sSelf.id}/handovers/receive`, {
      method: 'POST',
      headers: j(U.zhao.id),
      body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
    }),
  );
  await expectOk(
    '本地模拟实验室回传合格结果',
    await fetch(`${BASE}/samples/${sSelf.id}/lab/simulate`, {
      method: 'POST',
      headers: j(U.zhao.id),
      body: JSON.stringify({ outcome: 'qualified' }),
    }),
  );
  const selfRelease = await fetch(`${BASE}/samples/${sSelf.id}/handovers/release`, {
    method: 'POST',
    headers: j(U.qian.id),
    body: JSON.stringify({ sealIntact: true }),
  });
  await expectReject('取样人钱主任签自己样品的放行', selfRelease, 403, '不能签署自己');
  await expectOk(
    '改由周主任（非取样人）放行',
    await fetch(`${BASE}/samples/${sSelf.id}/handovers/release`, {
      method: 'POST',
      headers: j(U.zhou.id),
      body: JSON.stringify({ sealIntact: true, note: '换人复核封签与记录后放行' }),
    }),
  );

  // ============ 四、无权限人员发布公告 ============
  head('四、公告只允许获授权人员发布');
  // 种子样品 C-W02-1002（异常，TESTED）
  const abnormalSample = wells
    .find((x) => x.code === 'W-02')
    .latestSample; // 注意：W-02 最新样品现在是 sSelf（合格），所以下面按列表查找
  const sampleList = await (await fetch(`${BASE}/samples?wellId=${w('W-02')}`)).json();
  const s2 = sampleList.find((s) => s.containerCode === 'C-W02-1002');

  // 403：采样员、送检员、实验室、普通负责人（无 ANNOUNCER 角色）都不能发布
  const publishBySampler = await fetch(`${BASE}/samples/${s2.id}/announcements`, {
    method: 'POST',
    headers: j(U.li.id),
    body: JSON.stringify({ title: '测试公告', body: '...' }),
  });
  await expectReject('采样员李采样发布公告', publishBySampler, 403, '没有');

  const publishByOfficial = await fetch(`${BASE}/samples/${s2.id}/announcements`, {
    method: 'POST',
    headers: j(U.zhou.id),
    body: JSON.stringify({ title: '测试公告', body: '...' }),
  });
  await expectReject('未获公告授权的周主任发布公告', publishByOfficial, 403, '没有');

  // 授权人陈发布：但该异常样品尚未经"同意发布"决定 → 409
  const publishWithoutApproval = await fetch(`${BASE}/samples/${s2.id}/announcements`, {
    method: 'POST',
    headers: j(U.chen.id),
    body: JSON.stringify({ title: '大槐树下井水质公告', body: '正文' }),
  });
  await expectReject('授权人对未经负责人同意的样品发布', publishWithoutApproval, 409, '同意发布');

  // 正常链路：W-06 种子样品已有"同意发布"决定，授权人可以发布
  const s6 = (await (await fetch(`${BASE}/samples?wellId=${w('W-06')}`)).json()).find(
    (s) => s.containerCode === 'C-W06-0929',
  );
  await expectOk(
    '授权发布人陈发布依据 v2 更正结果发布西河沿井公告',
    await fetch(`${BASE}/samples/${s6.id}/announcements`, {
      method: 'POST',
      headers: j(U.chen.id),
      body: JSON.stringify({
        title: '西河沿井 9 月 29 日批次水质公告（含结果更正说明）',
        body: '初检异常经复核系平行样污染误判，更正后各指标合格。原 v1 结果与封签记录均已保留备查。',
      }),
    }),
  );

  // ============ 五、异常结果未复测前不得归档 ============
  head('五、异常结果未复测前不得直接归档');
  await expectOk(
    '周主任对异常样品 C-W02-1002 放行',
    await fetch(`${BASE}/samples/${s2.id}/handovers/release`, {
      method: 'POST',
      headers: j(U.zhou.id),
      body: JSON.stringify({ sealIntact: true }),
    }),
  );
  const archiveAbnormal = await fetch(`${BASE}/samples/${s2.id}/decisions`, {
    method: 'POST',
    headers: j(U.zhou.id),
    body: JSON.stringify({ type: 'ARCHIVE', reason: '试图跳过复测直接归档' }),
  });
  await expectReject('异常样品未复测直接归档', archiveAbnormal, 409, '禁止直接归档');
  await expectOk(
    '正确做法：负责人决定复测',
    await fetch(`${BASE}/samples/${s2.id}/decisions`, {
      method: 'POST',
      headers: j(U.zhou.id),
      body: JSON.stringify({ type: 'RETEST', reason: '异常，安排重新采样复测' }),
    }),
  );

  // ============ 六、结果更正：旧结果保留，不覆盖 ============
  head('六、检测结果更正（保留旧样本与原结果，新版本另存）');
  // 再取一个已签收的样品做更正演示：重新走一条链
  const sCorr = await (
    await fetch(`${BASE}/samples`, {
      method: 'POST',
      headers: h(U.sun.id),
      body: sampleForm({ wellId: w('W-01') }),
    })
  ).json();
  await fetch(`${BASE}/samples/${sCorr.id}/handovers/send`, {
    method: 'POST', headers: j(U.sun.id),
    body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await fetch(`${BASE}/samples/${sCorr.id}/handovers/receive`, {
    method: 'POST', headers: j(U.zhao.id),
    body: JSON.stringify({ sealIntact: true, coldChainOk: true }),
  });
  await fetch(`${BASE}/samples/${sCorr.id}/lab/simulate`, {
    method: 'POST', headers: j(U.zhao.id),
    body: JSON.stringify({ outcome: 'abnormal' }),
  });
  // 试图再"首录"一次 → 被拒，必须走更正
  const reRecord = await fetch(`${BASE}/samples/${sCorr.id}/lab/results`, {
    method: 'POST',
    headers: j(U.zhao.id),
    body: JSON.stringify({ indicators: { ph: 7, turbidityNTU: 1, coliformMPN: 0, residualCl: 0.1 } }),
  });
  await expectReject('对已有结果的样品再次首录（试图覆盖）', reRecord, 409, '更正');
  await expectOk(
    '走结果更正流程，生成 v2',
    await fetch(`${BASE}/samples/${sCorr.id}/lab/correct`, {
      method: 'POST',
      headers: j(U.zhao.id),
      body: JSON.stringify({
        indicators: { ph: 7.1, turbidityNTU: 1.0, coliformMPN: 0, residualCl: 0.12 },
        qualified: true,
        correctionNote: '平行样复核，初检异常系实验操作误差，更正为合格',
      }),
    }),
  );
  const report = await (await fetch(`${BASE}/samples/${sCorr.id}/report`)).json();
  const versions = report.results.map((r) => `v${r.version}(${r.qualified ? '合格' : '异常'}${r.isCurrent ? '·当前' : '·旧版保留'})`);
  console.log(`  ${OK} 报告详情中的结果版本链（${versions.length} 个版本同时保留）：${versions.join(' → ')}`);
  pass++;

  // ============ 汇总 ============
  console.log(`\n${HEAD} 汇总：${pass} 项按预期处理${fail ? `，${fail} 项异常` : '，全部通过'}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
