import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CONCLUSION, SAMPLE_STATUS } from '../../domain';
import { CorrectResultDto, RecordResultDto, SimulateDto } from './dto';

@Injectable()
export class LabService {
  constructor(private prisma: PrismaService) {}

  // 本地模拟实验室接口：对已签收样品自动"检测"并回传结果
  async simulate(sampleId: string, operatorId: string, dto: SimulateDto) {
    const sample = await this.prisma.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new NotFoundException('样品不存在');
    if (sample.status !== SAMPLE_STATUS.RECEIVED) {
      throw new ConflictException(
        `只有实验室已签收的样品可以送检出结果，当前为「${sample.status}」`,
      );
    }

    // 伪随机但可复现（seed 或容器编号决定），便于演示
    const seedVal = dto.seed ?? this.hashCode(sample.containerCode);
    const abnormal =
      dto.outcome === 'abnormal'
        ? true
        : dto.outcome === 'qualified'
          ? false
          : seedVal % 2 === 0;

    const indicators = abnormal
      ? { ph: 6.8, turbidityNTU: 6.4, coliformMPN: 920, residualCl: 0.02 }
      : { ph: 7.2, turbidityNTU: 1.1, coliformMPN: 0, residualCl: 0.15 };

    return this.recordResult(sampleId, operatorId, {
      indicators,
      abnormalItem: abnormal ? '总大肠菌群超标（920 MPN/100mL，限值不得检出）' : undefined,
      note: '本地模拟实验室自动检测回传',
    });
  }

  // 回传检测结果（首版）
  async recordResult(sampleId: string, operatorId: string, dto: RecordResultDto) {
    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({ where: { id: sampleId } });
      if (!sample) throw new NotFoundException('样品不存在');
      const existed = await tx.labResult.findFirst({
        where: { sampleId, isCurrent: true },
      });
      if (existed) {
        throw new ConflictException(
          '该样品已有当前结果；结果需要变更时必须走"结果更正"，原结果将保留不可覆盖',
        );
      }
      if (sample.status !== SAMPLE_STATUS.RECEIVED) {
        throw new ConflictException(
          `交接顺序错误：样品须为「实验室已签收」才能录入结果，当前为「${sample.status}」`,
        );
      }

      const indicators =
        dto.indicators ?? { ph: 7.1, turbidityNTU: 1.2, coliformMPN: 0, residualCl: 0.12 };
      const qualified = dto.abnormalItem == null;
      const result = await tx.labResult.create({
        data: {
          sampleId,
          version: 1,
          isCurrent: true,
          indicators: JSON.stringify(indicators),
          conclusion: qualified ? CONCLUSION.QUALIFIED : CONCLUSION.ABNORMAL,
          qualified,
          abnormalItem: dto.abnormalItem ?? null,
          testedAt: new Date(),
          recordedById: operatorId,
          correctionNote: null,
        },
      });
      await tx.sample.update({
        where: { id: sampleId },
        data: { status: SAMPLE_STATUS.TESTED },
      });
      return result;
    });
  }

  // 结果更正：旧版本保留（isCurrent=false），新版本 isCurrent=true，绝不覆盖
  async correct(sampleId: string, operatorId: string, dto: CorrectResultDto) {
    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({ where: { id: sampleId } });
      if (!sample) throw new NotFoundException('样品不存在');

      const current = await tx.labResult.findFirst({
        where: { sampleId, isCurrent: true },
        orderBy: { version: 'desc' },
      });
      if (!current) throw new ConflictException('该样品尚无结果，无法更正，请先回传结果');

      await tx.labResult.update({
        where: { id: current.id },
        // 旧结果原样保留，仅把"当前版本"标记摘掉
        data: {
          isCurrent: false,
          correctionNote: `该版本已被 v${current.version + 1} 更正，原结果保留备查`,
        },
      });

      const next = await tx.labResult.create({
        data: {
          sampleId,
          version: current.version + 1,
          isCurrent: true,
          indicators: JSON.stringify(dto.indicators),
          conclusion: dto.qualified ? CONCLUSION.QUALIFIED : CONCLUSION.ABNORMAL,
          qualified: dto.qualified,
          abnormalItem: dto.abnormalItem ?? null,
          testedAt: new Date(),
          recordedById: operatorId,
          correctionNote: dto.correctionNote,
        },
      });

      // 更正后样品回到"待审核"，由负责人依据新版本重新决定
      const TERMINAL: string[] = [SAMPLE_STATUS.ARCHIVED, SAMPLE_STATUS.VOID];
      if (!TERMINAL.includes(sample.status)) {
        await tx.sample.update({
          where: { id: sampleId },
          data: { status: SAMPLE_STATUS.TESTED },
        });
      }
      return next;
    });
  }

  private hashCode(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 1000;
  }
}
