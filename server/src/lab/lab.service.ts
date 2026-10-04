import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { STATUS_LABELS } from '../common/constants';
import { serializeResult } from '../common/serialize';
import { LabCorrectDto, LabRejectDto, LabResultDto } from './dto';

/** 实验室接口（本地模拟）：回传结果、退样、结果更正 */
@Injectable()
export class LabService {
  constructor(private prisma: PrismaService) {}

  private requireLab(actor: User) {
    if (actor.role !== 'LAB') {
      throw new ForbiddenException(`只有实验室可以执行该操作（当前身份：${actor.name}）`);
    }
  }

  /** 回传检测结果（样品须已被实验室接收） */
  async returnResult(actor: User, dto: LabResultDto) {
    this.requireLab(actor);
    const sample = await this.prisma.sample.findUnique({ where: { id: dto.sampleId } });
    if (!sample) throw new NotFoundException(`样品 #${dto.sampleId} 不存在`);
    if (sample.status !== 'LAB_RECEIVED') {
      throw new ConflictException(
        `样品当前状态为「${STATUS_LABELS[sample.status] ?? sample.status}」，实验室尚未接收，不能回传结果`,
      );
    }
    const count = await this.prisma.labResult.count({ where: { sampleId: dto.sampleId } });
    const [result] = await this.prisma.$transaction([
      this.prisma.labResult.create({
        data: {
          sampleId: dto.sampleId,
          version: count + 1,
          parameters: JSON.stringify(dto.parameters),
          conclusion: dto.conclusion,
          operator: dto.operator ?? actor.name,
        },
      }),
      this.prisma.sample.update({ where: { id: dto.sampleId }, data: { status: 'RESULT_RETURNED' } }),
    ]);
    return { result: serializeResult(result), sampleStatus: 'RESULT_RETURNED' };
  }

  /** 退样：样品保留（状态→退样），须重新采样，不允许覆盖 */
  async reject(actor: User, dto: LabRejectDto) {
    this.requireLab(actor);
    const sample = await this.prisma.sample.findUnique({ where: { id: dto.sampleId } });
    if (!sample) throw new NotFoundException(`样品 #${dto.sampleId} 不存在`);
    if (!['LAB_RECEIVED', 'DELIVERED'].includes(sample.status)) {
      throw new ConflictException(`当前状态「${STATUS_LABELS[sample.status] ?? sample.status}」不能退样`);
    }
    await this.prisma.sample.update({
      where: { id: dto.sampleId },
      data: { status: 'REJECTED', rejectReason: dto.reason },
    });
    return {
      sampleStatus: 'REJECTED',
      message: '已退样并保留记录：请使用新的容器编号重新采样送检，原样品记录不会被覆盖',
    };
  }

  /**
   * 结果更正：新增一个版本指向旧结果，旧结果与原公告全部保留；
   * 若已发布公告，旧公告标记为“已被更正”(SUPERSEDED)，样品回到待审核状态。
   */
  async correct(actor: User, resultId: number, dto: LabCorrectDto) {
    this.requireLab(actor);
    const old = await this.prisma.labResult.findUnique({
      where: { id: resultId },
      include: { sample: { include: { announcements: { where: { status: 'PUBLISHED' } } } } },
    });
    if (!old) throw new NotFoundException(`结果 #${resultId} 不存在`);
    const latest = await this.prisma.labResult.findFirst({
      where: { sampleId: old.sampleId },
      orderBy: { version: 'desc' },
    });
    if (latest?.id !== old.id) {
      throw new ConflictException(`结果 #${resultId} 已被 v${latest?.version} 更正，只能更正最新版本`);
    }

    const [result] = await this.prisma.$transaction([
      this.prisma.labResult.create({
        data: {
          sampleId: old.sampleId,
          version: old.version + 1,
          parameters: JSON.stringify(dto.parameters),
          conclusion: dto.conclusion,
          correctedFromId: old.id,
          correctionNote: dto.note,
          operator: actor.name,
        },
      }),
      // 已发布的公告标记为“已被更正”，保留供追溯
      ...old.sample.announcements.map((a) =>
        this.prisma.announcement.update({ where: { id: a.id }, data: { status: 'SUPERSEDED' } }),
      ),
      this.prisma.sample.update({ where: { id: old.sampleId }, data: { status: 'RESULT_RETURNED' } }),
    ]);
    return {
      result: serializeResult(result),
      message: old.sample.announcements.length
        ? '已生成更正版本，原结果保留；原公告已标记为“已被更正”，需负责人重新审核发布'
        : '已生成更正版本，原结果保留',
    };
  }
}
