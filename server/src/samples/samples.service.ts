import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { serializeSampleBrief, serializeSampleDetail } from '../common/serialize';
import { STATUS_LABELS } from '../common/constants';

@Injectable()
export class SamplesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 采样登记。容器编号必须唯一；封签破损/退样/复测重新采样时通过 replacesId 关联旧样品，
   * 旧样品与原结果全部保留，绝不覆盖。
   */
  async create(actor: User, body: any, sealPhoto?: Express.Multer.File) {
    if (actor.role !== 'SAMPLER') {
      throw new ForbiddenException(`只有采样员可以登记样品（当前身份：${actor.name}）`);
    }
    const wellId = Number(body.wellId);
    const containerNo = String(body.containerNo ?? '').trim();
    const sampledAt = body.sampledAt ? new Date(body.sampledAt) : null;
    if (!Number.isInteger(wellId)) throw new BadRequestException('缺少有效的井位 wellId');
    if (!containerNo) throw new BadRequestException('容器编号不能为空');
    if (!sampledAt || isNaN(sampledAt.getTime())) throw new BadRequestException('取样时间无效');

    const well = await this.prisma.well.findUnique({ where: { id: wellId } });
    if (!well) throw new BadRequestException(`井位 #${wellId} 不存在`);

    // 规则：容器编号必须唯一
    const dup = await this.prisma.sample.findUnique({ where: { containerNo } });
    if (dup) {
      throw new ConflictException(
        `容器编号「${containerNo}」已存在（样品 #${dup.id}，状态：${STATUS_LABELS[dup.status] ?? dup.status}），容器编号必须唯一`,
      );
    }

    // 重新采样：旧样品必须处于作废/退样/待复测，关联但不覆盖
    let replacesId: number | undefined;
    if (body.replacesId) {
      const old = await this.prisma.sample.findUnique({ where: { id: Number(body.replacesId) } });
      if (!old) throw new BadRequestException('被替代的旧样品不存在');
      if (!['INVALIDATED', 'REJECTED', 'RETEST_REQUESTED'].includes(old.status)) {
        throw new BadRequestException(
          `旧样品 #${old.id} 状态为「${STATUS_LABELS[old.status]}」，只有作废/退样/待复测的样品才能被重新采样替代`,
        );
      }
      replacesId = old.id;
    }

    try {
      const sample = await this.prisma.sample.create({
        data: {
          containerNo,
          wellId,
          samplerId: actor.id,
          sampledAt,
          weather: body.weather || null,
          waterTemp: body.waterTemp !== undefined && body.waterTemp !== '' ? Number(body.waterTemp) : null,
          turbidity: body.turbidity !== undefined && body.turbidity !== '' ? Number(body.turbidity) : null,
          notes: body.notes || null,
          sealPhotoPath: sealPhoto ? `/uploads/${sealPhoto.filename}` : null,
          replacesId,
        },
        include: { well: true, sampler: true },
      });
      return serializeSampleBrief(sample);
    } catch (e: any) {
      // 数据库唯一约束兜底（并发场景）
      if (e?.code === 'P2002') {
        throw new ConflictException(`容器编号「${containerNo}」已存在，容器编号必须唯一`);
      }
      throw e;
    }
  }

  async list(query: { status?: string; wellId?: number }) {
    const samples = await this.prisma.sample.findMany({
      where: {
        status: query.status || undefined,
        wellId: query.wellId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        well: true,
        sampler: true,
        labResults: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    return samples.map(serializeSampleBrief);
  }

  async detail(id: number) {
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      include: {
        well: true,
        sampler: true,
        handovers: { orderBy: { seq: 'asc' }, include: { fromUser: true, toUser: true } },
        labResults: { orderBy: { version: 'asc' } },
        announcements: { orderBy: { publishedAt: 'desc' }, include: { publishedBy: true } },
        replacedBy: true,
      },
    });
    if (!sample) throw new NotFoundException(`样品 #${id} 不存在`);
    return serializeSampleDetail(sample);
  }

  /**
   * 负责人审核决定：
   * - RETEST 要求复测（状态 → 待复测，之后重新采样替代，旧样品保留）
   * - ARCHIVE 归档；规则：异常结果未复测前不得直接归档
   */
  async decide(actor: User, sampleId: number, action: 'RETEST' | 'ARCHIVE', note?: string) {
    if (actor.role !== 'SUPERVISOR') {
      throw new ForbiddenException(`只有负责人可以做出审核决定（当前身份：${actor.name}）`);
    }
    const sample = await this.prisma.sample.findUnique({
      where: { id: sampleId },
      include: { labResults: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!sample) throw new NotFoundException(`样品 #${sampleId} 不存在`);

    if (action === 'RETEST') {
      if (sample.status !== 'RESULT_RETURNED') {
        throw new ConflictException(`当前状态「${STATUS_LABELS[sample.status]}」不能要求复测（需结果已回传）`);
      }
      await this.prisma.sample.update({
        where: { id: sampleId },
        data: { status: 'RETEST_REQUESTED', reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note ?? null },
      });
      return { message: '已要求复测：请用新的容器编号重新采样送检，原样品与检测结果将完整保留', status: 'RETEST_REQUESTED' };
    }

    // ARCHIVE
    if (sample.status === 'ARCHIVED') {
      throw new ConflictException('该样品已归档');
    }
    if (sample.status === 'RESULT_RETURNED') {
      const latest = sample.labResults[0];
      if (latest?.conclusion === 'ABNORMAL') {
        // 规则：异常结果未复测前不得直接归档
        throw new BadRequestException('检测结果异常，未复测前不得直接归档。请先要求复测并重新采样。');
      }
    } else if (!['PUBLISHED', 'INVALIDATED', 'REJECTED'].includes(sample.status)) {
      throw new ConflictException(`当前状态「${STATUS_LABELS[sample.status]}」不能归档`);
    }
    await this.prisma.sample.update({
      where: { id: sampleId },
      data: { status: 'ARCHIVED', reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note ?? null },
    });
    return { message: '已归档', status: 'ARCHIVED' };
  }
}
