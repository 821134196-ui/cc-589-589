// 命令行规则演示：编号冲突 / 交接顺序错误 / 无权限公告（+两个附加规则）
// 用法：先启动后端（npm start），再执行 npm run demo
const BASE = process.env.API_BASE || 'http://localhost:3000/api';

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function call(method, path, { userId, body } = {}) {
  const headers = {};
  if (userId) headers['x-user-id'] = String(userId);
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let pass = 0;
let fail = 0;
/** 校验拦截：状态码与错误消息关键词都要匹配，避免“误报通过” */
function check(got, wantStatus, wantMsg) {
  const msg = Array.isArray(got.data.message) ? got.data.message.join('；') : got.data.message ?? '';
  if (got.status === wantStatus && msg.includes(wantMsg)) {
    pass++;
    console.log(`  ${C.green('✔ 已拦截')} HTTP ${got.status} → ${msg}`);
  } else {
    fail++;
    console.log(`  ${C.red('✘ 不符合预期！')} 期望 HTTP ${wantStatus} 且含「${wantMsg}」，实际 ${got.status} → ${msg}`);
  }
}

async function mustCreate(body, userId) {
  const r = await call('POST', '/samples', { userId, body });
  if (r.status !== 201 && r.status !== 200) {
    console.error(C.red(`准备样品失败：HTTP ${r.status} ${JSON.stringify(r.data)}`));
    process.exit(1);
  }
  return r.data;
}

const users = await call('GET', '/users');
if (users.status !== 200) {
  console.error(C.red(`无法连接后端 ${BASE}，请先运行 npm start`));
  process.exit(1);
}
const wells = (await call('GET', '/wells')).data;
const byRole = (r) => users.data.find((u) => u.role === r);
const [sampler, courier, supervisor, lab] = ['SAMPLER', 'COURIER', 'SUPERVISOR', 'LAB'].map(byRole);
console.log(C.bold(`\n社区水井水质采样送检系统 —— 业务规则演示`));
console.log(`身份：采样员=${sampler.name} 送检员=${courier.name} 负责人=${supervisor.name} 实验室=${lab.name}\n`);

let seq = 1;
const freshContainer = () => `C-DEMO-${Date.now()}-${seq++}`;
const wellId = (i) => wells[i % wells.length].id;

// ---------- 演示1：容器编号冲突 ----------
console.log(C.cyan('演示1：容器编号冲突（容器编号必须唯一）'));
{
  const no = freshContainer();
  const body = { wellId: wellId(0), containerNo: no, sampledAt: new Date().toISOString(), weather: '晴' };
  const first = await mustCreate(body, sampler.id);
  console.log(`  第一次登记 ${no} → 成功（样品 #${first.id}）`);
  console.log(`  用同一编号再次登记：`);
  const dup = await call('POST', '/samples', { userId: sampler.id, body });
  check(dup, 409, '容器编号');
}

// ---------- 演示2：交接顺序错误 ----------
console.log(C.cyan('\n演示2：交接顺序错误（交接须按实际顺序办理）'));
{
  const s = await mustCreate(
    { wellId: wellId(1), containerNo: freshContainer(), sampledAt: new Date().toISOString() },
    sampler.id,
  );
  console.log(`  新样品 #${s.id} 状态=已登记（应先办第1步 采样→送检）`);
  console.log(`  送检员试图直接办理第2步「送检员→实验室」：`);
  const bad = await call('POST', `/samples/${s.id}/handovers`, {
    userId: courier.id,
    body: { type: 'COURIER_TO_LAB', toUserId: lab.id, sealIntact: true, coldChainOk: true, temperature: 4 },
  });
  check(bad, 409, '交接顺序错误');
}

// ---------- 演示3：无权限人员发布公告 ----------
console.log(C.cyan('\n演示3：无权限人员发布公告（公告只允许获授权人员发布）'));
{
  console.log(`  采样员「${sampler.name}」试图发布公告：`);
  const denied = await call('POST', '/announcements', {
    userId: sampler.id,
    body: { sampleId: 1, title: '擅自发布的公告' },
  });
  check(denied, 403, '无权限发布公告');
  console.log(`  送检员「${courier.name}」试图发布公告：`);
  const denied2 = await call('POST', '/announcements', {
    userId: courier.id,
    body: { sampleId: 1, title: '擅自发布的公告' },
  });
  check(denied2, 403, '无权限发布公告');
}

// ---------- 附加演示4：取样人不能签自己的放行 ----------
console.log(C.cyan('\n附加演示4：取样人签自己的放行'));
{
  const s = await mustCreate(
    { wellId: wellId(2), containerNo: freshContainer(), sampledAt: new Date().toISOString() },
    sampler.id,
  );
  const self = await call('POST', `/samples/${s.id}/handovers`, {
    userId: sampler.id,
    body: { toUserId: sampler.id, sealIntact: true },
  });
  check(self, 400, '取样人不能签自己的放行');
}

// ---------- 附加演示5：异常结果未复测不得归档 ----------
console.log(C.cyan('\n附加演示5：异常结果未复测直接归档'));
{
  const s = await mustCreate(
    { wellId: wellId(3), containerNo: freshContainer(), sampledAt: new Date().toISOString() },
    sampler.id,
  );
  const id = s.id;
  await call('POST', `/samples/${id}/handovers`, { userId: sampler.id, body: { toUserId: courier.id, sealIntact: true } });
  await call('POST', `/samples/${id}/handovers`, { userId: courier.id, body: { toUserId: lab.id, sealIntact: true, coldChainOk: true, temperature: 4 } });
  await call('POST', `/samples/${id}/handovers`, { userId: lab.id, body: { toUserId: lab.id, sealIntact: true } });
  await call('POST', '/lab/results', {
    userId: lab.id,
    body: { sampleId: id, parameters: { 总大肠菌群: '检出' }, conclusion: 'ABNORMAL' },
  });
  console.log(`  样品 #${id} 已完成送检并回传【异常】结果，负责人直接归档：`);
  const arch = await call('POST', `/samples/${id}/decision`, { userId: supervisor.id, body: { action: 'ARCHIVE' } });
  check(arch, 400, '未复测前不得直接归档');
}

console.log(C.bold(`\n结果：${pass} 项规则全部生效，${fail} 项不符合预期`));
process.exit(fail ? 1 : 0);
