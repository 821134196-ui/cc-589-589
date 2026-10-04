import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DECISION, SAMPLE_STATUS } from '../../domain';
import { DecisionDto } from './dto';

@Injectable()
export class DecisionsService {
  constructor(private prisma: PrismaService) {}

  // 负责人依据当前结果做出决定。必须在"已放行"之后。
  async decide(sampleId: string, officialId: string, dto: DecisionDto) {
    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({
        where: { id: sampleId },
        include: {
          results: { where: { isCurrent: true }, take: 1 },
          retest: { include: { results: { where: { isCurrent: true }, take: 1 } } },
        },
      });
      if (!sample) throw new NotFoundException('样品不存在');
      if (sample.status !== SAMPLE_STATUS.RELEASED && dto.type !== DECISION.RETEST) {
        throw new ConflictException(
          `顺序错误：结果须经负责人放行后才能做出该决定，当前为「${sample.status}」`,
        );
      }
      const current = sample.results[0];
      if (!current) throw new ConflictException('该样品尚无检测结果，无法做出决定');

      if (dto.type === DECISION.ARCHIVE) {
        // 异常结果未复测前不得直接归档
        if (!current.qualified) {
          const retestOk =
            sample.retest && sample.retest.results.some((r) => r.qualified);
          if (!retestOk) {
            throw new ConflictException(
              '检测结果异常且尚未复测合格，禁止直接归档；请先决定"复测"并完成复测',
            );
          }
        }
        await tx.sample.update({
          where: { id: sampleId },
          data: { status: SAMPLE_STATUS.ARCHIVED },
        });
      }

      if (dto.type === DECISION.RETEST) {
        await tx.sample.update({
          where: { id: sampleId },
          data: { status: SAMPLE_STATUS.RETESTING },
        });
      }

      // PUBLISH：样品保持 RELEASED，等待获授权人员发布公告
      return tx.decision.create({
        data: {
          sampleId,
          resultId: current.id,
          type: dto.type,
          reason: dto.reason ?? '',
          officialId,
        },
      });
    });
  }

  // 该样品是否已有"同意发布"决定（供公告模块校验）
  async hasPublishApproval(sampleId: string) {
    const d = await this.prisma.decision.findFirst({
      where: { sampleId, type: DECISION.PUBLISH },
      orderBy: { createdAt: 'desc' },
    });
    return !!d;
  }
}
