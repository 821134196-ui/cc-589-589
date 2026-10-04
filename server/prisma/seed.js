// 种子数据：用户、井位、各状态样品、交接链、结果与更正、公告
// 同时生成占位封签照片（SVG）到 server/uploads/
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const uploadsDir = path.join(__dirname, '..', 'uploads');

function sealPhoto(containerNo, intact = true) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const color = intact ? '#16a34a' : '#dc2626';
  const text = intact ? '封签完好' : '封签破损';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">
  <rect width="480" height="320" fill="#f1f5f9"/>
  <rect x="40" y="60" width="400" height="200" rx="12" fill="#fff" stroke="${color}" stroke-width="4"/>
  <circle cx="240" cy="130" r="34" fill="none" stroke="${color}" stroke-width="5"/>
  <text x="240" y="140" font-size="22" text-anchor="middle" fill="${color}" font-family="sans-serif">封</text>
  <text x="240" y="200" font-size="26" text-anchor="middle" fill="#0f172a" font-family="monospace">${containerNo}</text>
  <text x="240" y="236" font-size="18" text-anchor="middle" fill="${color}" font-family="sans-serif">${text}</text>
</svg>`;
  const file = `seed-${containerNo}.svg`;
  fs.writeFileSync(path.join(uploadsDir, file), svg);
  return `/uploads/${file}`;
}

const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000);

async function main() {
  // 清空（顺序：先子后父）
  await prisma.announcement.deleteMany();
  await prisma.labResult.deleteMany();
  await prisma.handover.deleteMany();
  await prisma.sample.deleteMany();
  await prisma.well.deleteMany();
  await prisma.user.deleteMany();
  // 重置自增序列，保证每次播种后 id 从 1 开始（演示脚本依赖确定性的初始数据）
  try {
    await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence');
  } catch { /* 表不存在时忽略 */ }

  // ---- 用户 ----
  const zhang = await prisma.user.create({ data: { username: 'zhanglan', name: '张岚', role: 'SAMPLER' } });
  const chen = await prisma.user.create({ data: { username: 'chenyuan', name: '陈远', role: 'COURIER' } });
  const wang = await prisma.user.create({ data: { username: 'wangjin', name: '王谨', role: 'SUPERVISOR', canPublish: true } });
  const lab = await prisma.user.create({ data: { username: 'lab01', name: '实验室接收员', role: 'LAB' } });

  // ---- 井位 ----
  const wells = await Promise.all([
    prisma.well.create({ data: { code: 'W-01', name: '东苑1号井', latitude: 31.2304, longitude: 121.4737, address: '东苑小区3栋旁' } }),
    prisma.well.create({ data: { code: 'W-02', name: '东苑2号井', latitude: 31.2312, longitude: 121.4755, address: '东苑小区7栋后' } }),
    prisma.well.create({ data: { code: 'W-03', name: '西苑井', latitude: 31.2289, longitude: 121.4701, address: '西苑健身角' } }),
    prisma.well.create({ data: { code: 'W-04', name: '南广场井', latitude: 31.2278, longitude: 121.474, address: '南广场东侧' } }),
    prisma.well.create({ data: { code: 'W-05', name: '北坡井', latitude: 31.233, longitude: 121.4722, address: '北坡步道口' } }),
    prisma.well.create({ data: { code: 'W-06', name: '中心花园井', latitude: 31.23, longitude: 121.4748, address: '中心花园凉亭旁' } }),
  ]);
  const [w1, w2, w3, w4, w5, w6] = wells;

  const mkSample = (data) => prisma.sample.create({ data });
  const mkHandover = (data) => prisma.handover.create({ data });

  // ---- s1：W-01 已完成全流程并公告（结果经一次更正，旧版本保留）----
  const s1 = await mkSample({
    containerNo: 'C-2026-0001', wellId: w1.id, samplerId: zhang.id,
    sampledAt: daysAgo(6), weather: '晴', waterTemp: 14.2, turbidity: 0.8,
    notes: '按计划月度采样', sealPhotoPath: sealPhoto('C-2026-0001'), status: 'PUBLISHED',
  });
  await mkHandover({ sampleId: s1.id, seq: 1, type: 'SAMPLER_TO_COURIER', fromUserId: zhang.id, toUserId: chen.id, sealIntact: true, createdAt: daysAgo(5, 22) });
  await mkHandover({ sampleId: s1.id, seq: 2, type: 'COURIER_TO_LAB', fromUserId: chen.id, toUserId: lab.id, sealIntact: true, coldChainOk: true, temperature: 4.5, createdAt: daysAgo(5, 20) });
  await mkHandover({ sampleId: s1.id, seq: 3, type: 'LAB_RECEIVE', fromUserId: lab.id, toUserId: lab.id, sealIntact: true, createdAt: daysAgo(5, 19) });
  const r1v1 = await prisma.labResult.create({
    data: {
      sampleId: s1.id, version: 1, conclusion: 'NORMAL', operator: '实验室接收员', returnedAt: daysAgo(4),
      parameters: JSON.stringify({ 'pH': '7.2', '浊度(NTU)': '1.2', '余氯(mg/L)': '0.30', '总大肠菌群': '未检出', '菌落总数(CFU/mL)': '12' }),
    },
  });
  const r1v2 = await prisma.labResult.create({
    data: {
      sampleId: s1.id, version: 2, conclusion: 'NORMAL', operator: '实验室接收员', returnedAt: daysAgo(3),
      correctedFromId: r1v1.id, correctionNote: '浊度复核修正：1.2 → 1.1',
      parameters: JSON.stringify({ 'pH': '7.2', '浊度(NTU)': '1.1', '余氯(mg/L)': '0.30', '总大肠菌群': '未检出', '菌落总数(CFU/mL)': '12' }),
    },
  });
  await prisma.announcement.create({
    data: {
      sampleId: s1.id, resultId: r1v2.id, publishedById: wang.id, publishedAt: daysAgo(3),
      title: '东苑1号井水质检测公告',
      content: '东苑1号井（东苑小区3栋旁）本次采样经实验室检测，所检项目符合《生活饮用水卫生标准》(GB 5749-2022)，可正常取用。取样时间、封签与交接记录可在公告详情中追溯。',
    },
  });

  // ---- s2：W-02 结果异常，等待负责人决定（演示：异常未复测不得归档）----
  const s2 = await mkSample({
    containerNo: 'C-2026-0002', wellId: w2.id, samplerId: zhang.id,
    sampledAt: daysAgo(2), weather: '阴', waterTemp: 15.1, turbidity: 2.3,
    sealPhotoPath: sealPhoto('C-2026-0002'), status: 'RESULT_RETURNED',
  });
  await mkHandover({ sampleId: s2.id, seq: 1, type: 'SAMPLER_TO_COURIER', fromUserId: zhang.id, toUserId: chen.id, sealIntact: true, createdAt: daysAgo(2, -2) });
  await mkHandover({ sampleId: s2.id, seq: 2, type: 'COURIER_TO_LAB', fromUserId: chen.id, toUserId: lab.id, sealIntact: true, coldChainOk: true, temperature: 5.2, createdAt: daysAgo(1, 20) });
  await mkHandover({ sampleId: s2.id, seq: 3, type: 'LAB_RECEIVE', fromUserId: lab.id, toUserId: lab.id, sealIntact: true, createdAt: daysAgo(1, 18) });
  await prisma.labResult.create({
    data: {
      sampleId: s2.id, version: 1, conclusion: 'ABNORMAL', operator: '实验室接收员', returnedAt: daysAgo(1),
      parameters: JSON.stringify({ 'pH': '7.0', '浊度(NTU)': '3.8', '余氯(mg/L)': '0.05', '总大肠菌群': '检出', '菌落总数(CFU/mL)': '320' }),
    },
  });

  // ---- s3：W-03 送检途中（已完成第1步交接）----
  const s3 = await mkSample({
    containerNo: 'C-2026-0003', wellId: w3.id, samplerId: zhang.id,
    sampledAt: daysAgo(1, 4), weather: '多云', waterTemp: 14.8, turbidity: 1.0,
    sealPhotoPath: sealPhoto('C-2026-0003'), status: 'PICKED_UP',
  });
  await mkHandover({ sampleId: s3.id, seq: 1, type: 'SAMPLER_TO_COURIER', fromUserId: zhang.id, toUserId: chen.id, sealIntact: true, createdAt: daysAgo(1, 2) });

  // ---- s4：W-04 刚登记（演示：交接顺序错误）----
  await mkSample({
    containerNo: 'C-2026-0004', wellId: w4.id, samplerId: zhang.id,
    sampledAt: daysAgo(0, 3), weather: '晴', waterTemp: 15.5, turbidity: 0.9,
    sealPhotoPath: sealPhoto('C-2026-0004'), status: 'REGISTERED',
  });

  // ---- s5：W-05 封签破损作废（保留记录）+ s6 替代样品 ----
  const s5 = await mkSample({
    containerNo: 'C-2026-0005', wellId: w5.id, samplerId: zhang.id,
    sampledAt: daysAgo(3), weather: '小雨', waterTemp: 13.9, turbidity: 1.4,
    sealPhotoPath: sealPhoto('C-2026-0005', false), status: 'INVALIDATED',
  });
  await mkHandover({ sampleId: s5.id, seq: 1, type: 'SAMPLER_TO_COURIER', fromUserId: zhang.id, toUserId: chen.id, sealIntact: false, notes: '交接时发现封签破损，样品作废', createdAt: daysAgo(3, -2) });
  await mkSample({
    containerNo: 'C-2026-0006', wellId: w5.id, samplerId: zhang.id,
    sampledAt: daysAgo(2, 5), weather: '阴', waterTemp: 14.0, turbidity: 1.1,
    notes: '替代作废样品 C-2026-0005 重新采样', sealPhotoPath: sealPhoto('C-2026-0006'),
    status: 'REGISTERED', replacesId: s5.id,
  });

  // ---- s7：W-06 实验室已接收，待回传结果 ----
  const s7 = await mkSample({
    containerNo: 'C-2026-0007', wellId: w6.id, samplerId: zhang.id,
    sampledAt: daysAgo(1, 6), weather: '晴', waterTemp: 14.6, turbidity: 0.7,
    sealPhotoPath: sealPhoto('C-2026-0007'), status: 'LAB_RECEIVED',
  });
  await mkHandover({ sampleId: s7.id, seq: 1, type: 'SAMPLER_TO_COURIER', fromUserId: zhang.id, toUserId: chen.id, sealIntact: true, createdAt: daysAgo(1, 4) });
  await mkHandover({ sampleId: s7.id, seq: 2, type: 'COURIER_TO_LAB', fromUserId: chen.id, toUserId: lab.id, sealIntact: true, coldChainOk: true, temperature: 3.8, createdAt: daysAgo(1, 2) });
  await mkHandover({ sampleId: s7.id, seq: 3, type: 'LAB_RECEIVE', fromUserId: lab.id, toUserId: lab.id, sealIntact: true, createdAt: daysAgo(0, 22) });

  console.log('✅ 种子数据完成：');
  console.log(`   用户: 张岚(采样#${zhang.id}) 陈远(送检#${chen.id}) 王谨(负责人#${wang.id}) 实验室(#${lab.id})`);
  console.log(`   井位: ${wells.length} 口；样品: 7 个（含作废+替代、异常待审、已公告等状态）`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
