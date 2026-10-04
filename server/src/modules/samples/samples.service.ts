import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { CreateSampleDto } from './dto';
import { SAMPLE_STATUS } from '../../domain';

@Injectable()
export class SamplesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSampleDto, collectorId: string, sealPhotoPath: string | null) {
    const well = await this.prisma.well.findUnique({ where: { id: dto.wellId } });
    if (!well) throw new NotFoundException('井号不存在');

    if (!sealPhotoPath) {
      throw new ConflictException('必须上传封签照片，样品才能登记');
    }

    const batchNo = this.makeBatchNo(well.code, dto.sampledAt);

    // 容器编号全局唯一；复测也必须使用新容器，不能覆盖旧样品
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const sample = await tx.sample.create({
          data: {
            wellId: dto.wellId,
            containerCode: dto.containerCode.trim(),
            batchNo,
            sampledAt: new Date(dto.sampledAt),
            collectedById: collectorId,
            weather: dto.weather,
            waterTempC: dto.waterTempC,
            chlorineSmell: dto.chlorineSmell,
            visualNote: dto.visualNote ?? '',
            sealCode: dto.sealCode.trim(),
            sealPhotoPath,
            sealIntactAtCollect: dto.sealIntactAtCollect,
            coldChainRequired: dto.coldChainRequired,
            retestOfId: dto.retestOfId ?? null,
            status: SAMPLE_STATUS.COLLECTED,
          },
        });

        if (dto.retestOfId) {
          const origin = await tx.sample.findUnique({ where: { id: dto.retestOfId } });
          if (!origin) throw new NotFoundException('被复测的原样品不存在');
          await tx.sample.update({
            where: { id: origin.id },
            data: { status: SAMPLE_STATUS.RETESTING },
          });
        }
        return sample;
      });
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined)?.join(',');
        if (target?.includes('containerCode')) {
          throw new ConflictException(
            `容器编号冲突：「${dto.containerCode}」已被使用。容器编号必须全局唯一，禁止重复登记或覆盖旧样品`,
          );
        }
        throw new ConflictException('编号冲突：批次号或容器编号已存在');
      }
      throw e;
    }
  }

  async list(wellId?: string) {
    return this.prisma.sample.findMany({
      where: wellId ? { wellId } : undefined,
      orderBy: [{ sampledAt: 'desc' }],
      include: {
        well: true,
        collectedBy: { select: { id: true, name: true } },
        results: { where: { isCurrent: true }, take: 1 },
      },
    });
  }

  // 报告详情：完整封签记录 + 各次交接 + 结果全部版本 + 决定 + 公告（可追溯）
  async report(id: string) {
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      include: {
        well: true,
        collectedBy: { select: { id: true, login: true, name: true } },
        retestOf: {
          select: { id: true, containerCode: true, batchNo: true, status: true },
        },
        retest: {
          select: { id: true, containerCode: true, batchNo: true, status: true },
        },
        handovers: {
          orderBy: { seq: 'asc' },
          include: {
            fromUser: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
          },
        },
        results: {
          orderBy: { version: 'desc' },
          include: { recordedBy: { select: { id: true, name: true } } },
        },
        announcements: {
          orderBy: { publishedAt: 'desc' },
          include: { publishedBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!sample) throw new NotFoundException('样品不存在');

    const decisions = await this.prisma.decision.findMany({
      where: { sampleId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        official: { select: { id: true, name: true } },
        result: { select: { id: true, version: true, conclusion: true } },
      },
    });

    return {
      ...sample,
      decisions,
      // 指标 JSON 反序列化
      results: sample.results.map((r) => ({ ...r, indicators: JSON.parse(r.indicators) })),
    };
  }

  private makeBatchNo(wellCode: string, sampledAt: string) {
    const d = new Date(sampledAt);
    const p = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(
      d.getMinutes(),
    )}`;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${wellCode}-${stamp}-${rand}`;
  }
}
