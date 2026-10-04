import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { makeSealPng } from './photo';

const prisma = new PrismaClient();

const uploadDir = join(process.cwd(), 'uploads');
mkdirSync(uploadDir, { recursive: true });

function photo(name: string, seed: number): string {
  writeFileSync(join(uploadDir, name), makeSealPng(seed));
  return `/seal-photos/${name}`;
}

async function main() {
  // ---------- 人员 ----------
  const li = await prisma.user.create({
    data: { login: 'li', name: '李采样', roles: JSON.stringify(['SAMPLER']) },
  });
  const sun = await prisma.user.create({
    data: { login: 'sun', name: '孙采样', roles: JSON.stringify(['SAMPLER']) },
  });
  const wang = await prisma.user.create({
    data: { login: 'wang', name: '王送检', roles: JSON.stringify(['COURIER']) },
  });
  const zhao = await prisma.user.create({
    data: { login: 'zhao', name: '赵实验', roles: JSON.stringify(['LAB']) },
  });
  const zhou = await prisma.user.create({
    data: { login: 'zhou', name: '周主任', roles: JSON.stringify(['OFFICIAL']) },
  });
  // 钱主任兼具采样员身份（用于演示：取样人不能签自己的放行）
  const qian = await prisma.user.create({
    data: { login: 'qian', name: '钱主任', roles: JSON.stringify(['OFFICIAL', 'SAMPLER']) },
  });
  const chen = await prisma.user.create({
    data: { login: 'chen', name: '陈发布', roles: JSON.stringify(['ANNOUNCER']) },
  });

  // ---------- 井位（坐标为 SVG 0-100 相对坐标，模拟社区点位分布） ----------
  const wellsData = [
    ['W-01', '东街井', '东街 12 号院', 18, 26],
    ['W-02', '大槐树下井', '槐荫巷 3 号', 42, 18],
    ['W-03', '菜市场井', '利民菜市场北门', 68, 36],
    ['W-04', '新村井', '幸福新村 5 栋旁', 82, 14],
    ['W-05', '老戏台井', '文化广场南侧', 28, 48],
    ['W-06', '西河沿井', '河沿步道 200 米', 58, 54],
  ] as const;

  const wells: Record<string, { id: string; code: string; name: string }> = {};
  for (const [code, name, address, x, y] of wellsData) {
    wells[code] = await prisma.well.create({
      data: { code, name, address, posX: x, posY: y },
    });
  }

  const ind = {
    qualified: { ph: 7.2, turbidityNTU: 1.1, coliformMPN: 0, residualCl: 0.15 },
    abnormal: { ph: 6.8, turbidityNTU: 6.4, coliformMPN: 920, residualCl: 0.02 },
  };

  // ---------- W-01：完整合格链，已公告并归档 ----------
  const s1 = await prisma.sample.create({
    data: {
      wellId: wells['W-01'].id,
      containerCode: 'C-W01-0928',
      batchNo: 'B-W01-0928-001',
      sampledAt: new Date('2026-09-28T08:30:00'),
      collectedById: li.id,
      weather: '晴，22℃',
      waterTempC: 17.5,
      chlorineSmell: false,
      visualNote: '清澈无异味',
      sealCode: 'S-A001',
      sealPhotoPath: photo('seal-w01.png', 1),
      coldChainRequired: true,
      status: 'ARCHIVED',
    },
  });
  await chain(s1.id, li.id, wang.id, zhou.id, new Date('2026-09-28T08:30:00'));
  const r1 = await result(s1.id, 1, ind.qualified, true, null, zhao.id,
    new Date('2026-09-28T14:00:00'), null);
  await prisma.decision.create({
    data: { sampleId: s1.id, resultId: r1.id, type: 'PUBLISH', reason: '指标全部合格', officialId: zhou.id,
      createdAt: new Date('2026-09-28T15:00:00') },
  });
  await prisma.decision.create({
    data: { sampleId: s1.id, resultId: r1.id, type: 'ARCHIVE', reason: '合格，公告后归档', officialId: zhou.id,
      createdAt: new Date('2026-09-28T16:00:00') },
  });
  await prisma.announcement.create({
    data: {
      sampleId: s1.id, wellId: wells['W-01'].id,
      title: '东街井 9 月 28 日水质检测公告：合格',
      body: '东街井（东街12号院）本批次水质检测全部指标合格，可正常饮用。采样时间 2026-09-28 08:30，批次 B-W01-0928-001，封签 S-A001 全程完好。',
      publishedById: chen.id, publishedAt: new Date('2026-09-28T16:30:00'),
    },
  });

  // ---------- W-02：异常结果，已出结果待负责人审核 ----------
  const s2 = await prisma.sample.create({
    data: {
      wellId: wells['W-02'].id,
      containerCode: 'C-W02-1002',
      batchNo: 'B-W02-1002-001',
      sampledAt: new Date('2026-10-02T09:10:00'),
      collectedById: sun.id,
      weather: '多云，24℃',
      waterTempC: 19.0,
      chlorineSmell: true,
      visualNote: '轻微浑浊，有异味',
      sealCode: 'S-A002',
      sealPhotoPath: photo('seal-w02.png', 2),
      coldChainRequired: true,
      status: 'TESTED',
    },
  });
  await handover(s2.id, 1, 'SEND_TO_LAB', li.id, null, true, true, '', new Date('2026-10-02T09:30:00'));
  await handover(s2.id, 2, 'LAB_RECEIVE', wang.id, null, true, true, '', new Date('2026-10-02T11:00:00'));
  await result(s2.id, 1, ind.abnormal, false, '总大肠菌群超标（920 MPN/100mL，限值不得检出）',
    zhao.id, new Date('2026-10-02T15:30:00'), null);

  // ---------- W-03：异常→负责人要求复测；复测样品（新容器）在途 ----------
  const s3 = await prisma.sample.create({
    data: {
      wellId: wells['W-03'].id,
      containerCode: 'C-W03-1001',
      batchNo: 'B-W03-1001-001',
      sampledAt: new Date('2026-10-01T07:50:00'),
      collectedById: li.id,
      weather: '阴，20℃',
      waterTempC: 18.2,
      chlorineSmell: false,
      visualNote: '正常',
      sealCode: 'S-A003',
      sealPhotoPath: photo('seal-w03.png', 3),
      coldChainRequired: true,
      status: 'RETESTING',
    },
  });
  await handover(s3.id, 1, 'SEND_TO_LAB', li.id, null, true, true, '', new Date('2026-10-01T08:10:00'));
  await handover(s3.id, 2, 'LAB_RECEIVE', wang.id, null, true, true, '', new Date('2026-10-01T09:40:00'));
  const r3 = await result(s3.id, 1, ind.abnormal, false, '浑浊度与总大肠菌群超标',
    zhao.id, new Date('2026-10-01T14:00:00'), null);
  await handover(s3.id, 3, 'RELEASE', null, zhou.id, true, null, '异常，须复测', new Date('2026-10-01T16:00:00'));
  await prisma.decision.create({
    data: { sampleId: s3.id, resultId: r3.id, type: 'RETEST', reason: '异常，安排重新采样复测', officialId: zhou.id,
      createdAt: new Date('2026-10-01T16:10:00') },
  });
  // 复测使用新容器，原样品保留不覆盖
  const s3r = await prisma.sample.create({
    data: {
      wellId: wells['W-03'].id,
      containerCode: 'C-W03-1003',
      batchNo: 'B-W03-1003-002',
      sampledAt: new Date('2026-10-03T08:00:00'),
      collectedById: sun.id,
      weather: '晴，19℃',
      waterTempC: 17.8,
      chlorineSmell: false,
      visualNote: '清澈',
      sealCode: 'S-A006',
      sealPhotoPath: photo('seal-w03r.png', 6),
      coldChainRequired: true,
      retestOfId: s3.id,
      status: 'IN_TRANSIT',
    },
  });
  await handover(s3r.id, 1, 'SEND_TO_LAB', sun.id, null, true, true, '复测批次', new Date('2026-10-03T08:30:00'));

  // ---------- W-04：刚采样，待送检 ----------
  await prisma.sample.create({
    data: {
      wellId: wells['W-04'].id,
      containerCode: 'C-W04-1004',
      batchNo: 'B-W04-1004-001',
      sampledAt: new Date('2026-10-04T08:00:00'),
      collectedById: sun.id,
      weather: '晴，18℃',
      waterTempC: 17.0,
      chlorineSmell: false,
      visualNote: '清澈',
      sealCode: 'S-A004',
      sealPhotoPath: photo('seal-w04.png', 4),
      coldChainRequired: true,
      status: 'COLLECTED',
    },
  });

  // ---------- W-05：封签破损，实验室退样，旧样品保留 ----------
  const s5 = await prisma.sample.create({
    data: {
      wellId: wells['W-05'].id,
      containerCode: 'C-W05-0930',
      batchNo: 'B-W05-0930-001',
      sampledAt: new Date('2026-09-30T09:00:00'),
      collectedById: li.id,
      weather: '小雨，21℃',
      waterTempC: 18.5,
      chlorineSmell: false,
      visualNote: '正常',
      sealCode: 'S-A005',
      sealPhotoPath: photo('seal-w05.png', 5),
      coldChainRequired: true,
      status: 'REJECTED',
    },
  });
  await handover(s5.id, 1, 'SEND_TO_LAB', li.id, null, true, true, '', new Date('2026-09-30T09:20:00'));
  await handover(s5.id, 2, 'LAB_REJECT', zhao.id, null, false, true,
    '签收时发现封签断裂，照片留档，退样处理', new Date('2026-09-30T11:30:00'));

  // ---------- W-06：结果更正链 v1(异常)→v2(合格)，旧结果保留，已放行待发布 ----------
  const s6 = await prisma.sample.create({
    data: {
      wellId: wells['W-06'].id,
      containerCode: 'C-W06-0929',
      batchNo: 'B-W06-0929-001',
      sampledAt: new Date('2026-09-29T08:20:00'),
      collectedById: li.id,
      weather: '晴，23℃',
      waterTempC: 19.6,
      chlorineSmell: false,
      visualNote: '清澈',
      sealCode: 'S-A007',
      sealPhotoPath: photo('seal-w06.png', 7),
      coldChainRequired: true,
      status: 'RELEASED',
    },
  });
  await handover(s6.id, 1, 'SEND_TO_LAB', li.id, null, true, true, '', new Date('2026-09-29T08:40:00'));
  await handover(s6.id, 2, 'LAB_RECEIVE', wang.id, null, true, true, '', new Date('2026-09-29T10:10:00'));
  await result(s6.id, 1, ind.abnormal, false, '初检总大肠菌群判读异常',
    zhao.id, new Date('2026-09-29T15:00:00'), '该版本已被 v2 更正，原结果保留备查');
  await prisma.labResult.updateMany({ where: { sampleId: s6.id, version: 1 }, data: { isCurrent: false } });
  const r6v2 = await result(s6.id, 2, ind.qualified, true, null, zhao.id,
    new Date('2026-09-30T09:30:00'), '复核为平行样污染导致误判，更正为合格');
  await handover(s6.id, 3, 'RELEASE', null, zhou.id, true, null,
    '依据更正后的 v2 合格结果放行', new Date('2026-09-30T10:30:00'));
  await prisma.decision.create({
    data: { sampleId: s6.id, resultId: r6v2.id, type: 'PUBLISH',
      reason: 'v2 更正结果合格，同意发布并说明更正情况', officialId: zhou.id,
      createdAt: new Date('2026-09-30T11:00:00') },
  });

  console.log('种子数据完成：7 名人员、6 口井、7 个样品批次');
}

// —— 辅助函数 ——

async function chain(sampleId: string, samplerId: string, courierId: string,
  officialId: string, base: Date) {
  await handover(sampleId, 1, 'SEND_TO_LAB', samplerId, null, true, true, '', addH(base, 1));
  await handover(sampleId, 2, 'LAB_RECEIVE', courierId, null, true, true, '', addH(base, 3));
  await handover(sampleId, 3, 'RELEASE', null, officialId, true, null, '合格，放行', addH(base, 8));
}

async function handover(
  sampleId: string, seq: number, type: string,
  fromUserId: string | null, approverId: string | null,
  sealIntact: boolean, coldChainOk: boolean | null, note: string, at: Date,
) {
  return prisma.handover.create({
    data: { sampleId, seq, type, fromUserId, approverId, sealIntact, coldChainOk, note, occurredAt: at },
  });
}

async function result(
  sampleId: string, version: number, indicators: any, qualified: boolean,
  abnormalItem: string | null, recordedById: string, testedAt: Date,
  correctionNote: string | null,
) {
  return prisma.labResult.create({
    data: {
      sampleId, version, isCurrent: true,
      indicators: JSON.stringify(indicators),
      conclusion: qualified ? 'QUALIFIED' : 'ABNORMAL',
      qualified, abnormalItem, testedAt, recordedById, correctionNote,
    },
  });
}

function addH(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600 * 1000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
