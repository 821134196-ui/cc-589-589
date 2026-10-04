import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PerformHandoverDto } from './dto';
import {
  HANDOVER,
  HANDOVER_FLOW,
  SAMPLE_STATUS,
  STATUS_LABEL,
} from '../../domain';

@Injectable()
export class HandoversService {
  constructor(private prisma: PrismaService) {}

  // 办理一次交接。交接只能按实际顺序追加：
  // 启运送检 → 实验室签收 → （出结果）→ 负责人放行
  async perform(sampleId: string, type: string, actorId: string, dto: PerformHandoverDto) {
    const flow = HANDOVER_FLOW[type];
    if (!flow) throw new BadRequestException('未知交接类型');

    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({
        where: { id: sampleId },
        include: { collectedBy: true },
      });
      if (!sample) throw new NotFoundException('样品不存在');

      // —— 顺序校验：当前状态必须是该交接的前置状态 ——
      if (sample.status !== flow.require) {
        throw new ConflictException(
          `交接顺序错误：「${flow.label}」要求样品处于「${STATUS_LABEL[flow.require]}」，` +
            `当前为「${STATUS_LABEL[sample.status] ?? sample.status}」，请按实际顺序办理`,
        );
      }

      // —— 封签核对 ——
      if (type === HANDOVER.SEND_TO_LAB || type === HANDOVER.LAB_RECEIVE) {
        if (dto.sealIntact === false) {
          throw new ConflictException(
            '封签破损，禁止继续交接。该容器须按退样/作废处理并保留记录，不得用新样本覆盖',
          );
        }
        // —— 冷藏要求核对 ——
        if (sample.coldChainRequired && dto.coldChainOk === false) {
          throw new ConflictException('冷藏链温度不达标，禁止交接，请按退样处理');
        }
      }

      // —— 放行：取样人不能签自己的放行 ——
      let approverId: string | null = null;
      if (type === HANDOVER.RELEASE) {
        if (sample.collectedById === actorId) {
          throw new ForbiddenException(
            `取样人「${sample.collectedBy.name}」不能签署自己取样样品的放行，必须由其他负责人批准`,
          );
        }
        approverId = actorId;
      }

      // 序号严格递增（同一事务内取最大序号 +1）
      const last = await tx.handover.findFirst({
        where: { sampleId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });
      const seq = (last?.seq ?? 0) + 1;

      const handover = await tx.handover.create({
        data: {
          sampleId,
          seq,
          type,
          fromUserId: type === HANDOVER.RELEASE ? null : actorId,
          approverId,
          sealIntact: dto.sealIntact,
          coldChainOk: dto.coldChainOk ?? null,
          note: dto.note ?? '',
        },
      });

      if (flow.next) {
        await tx.sample.update({
          where: { id: sampleId },
          data: { status: flow.next },
        });
      }
      return handover;
    });
  }

  // 实验室退样：封签破损/温控不达标时登记，样品置 REJECTED 保留，不可被覆盖
  async reject(sampleId: string, actorId: string, dto: PerformHandoverDto) {
    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({ where: { id: sampleId } });
      if (!sample) throw new NotFoundException('样品不存在');
      const REJECTABLE: string[] = [SAMPLE_STATUS.IN_TRANSIT, SAMPLE_STATUS.RECEIVED];
      if (!REJECTABLE.includes(sample.status)) {
        throw new ConflictException(
          `交接顺序错误：仅在途或已签收的样品可以退样，当前为「${
            STATUS_LABEL[sample.status] ?? sample.status
          }」`,
        );
      }
      const last = await tx.handover.findFirst({
        where: { sampleId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });
      const handover = await tx.handover.create({
        data: {
          sampleId,
          seq: (last?.seq ?? 0) + 1,
          type: HANDOVER.LAB_REJECT,
          fromUserId: actorId,
          approverId: null,
          sealIntact: dto.sealIntact,
          coldChainOk: dto.coldChainOk ?? null,
          note: dto.note ?? '实验室退样',
        },
      });
      await tx.sample.update({
        where: { id: sampleId },
        data: { status: SAMPLE_STATUS.REJECTED },
      });
      return handover;
    });
  }
}
