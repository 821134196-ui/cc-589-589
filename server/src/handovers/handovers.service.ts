import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  COLD_CHAIN_MAX,
  COLD_CHAIN_MIN,
  HANDOVER_LABELS,
  HANDOVER_NEXT_STATUS,
  NEXT_HANDOVER,
  STATUS_LABELS,
} from '../common/constants';
import { serializeHandover } from '../common/serialize';
import { CreateHandoverDto } from './dto';

@Injectable()
export class HandoversService {
  constructor(private prisma: PrismaService) {}

  /**
   * 办理交接。监管链规则：
   * 1. 交接必须按 采样→送检→实验室 的实际顺序办理，不可跳步；
   * 2. 每个环节只能由对应角色办理（采样员发起、送检员送达、实验室接收）；
   * 3. 取样人不能签自己的放行（第一环节接收人不能是采样者本人）；
   * 4. 送达实验室时必须核对冷藏要求（0~8℃）；
   * 5. 封签破损 → 记录交接事实并将样品作废保留，须用新容器编号重新采样。
   */
  async create(actor: User, sampleId: number, dto: CreateHandoverDto) {
    const sample = await this.prisma.sample.findUnique({
      where: { id: sampleId },
      include: { handovers: { orderBy: { seq: 'asc' } } },
    });
    if (!sample) throw new NotFoundException(`样品 #${sampleId} 不存在`);

    // 规则1：当前状态决定应办理的环节，顺序错误直接拒绝
    const expected = NEXT_HANDOVER[sample.status];
    if (!expected) {
      throw new ConflictException(
        `样品当前状态为「${STATUS_LABELS[sample.status] ?? sample.status}」，没有可办理的交接环节`,
      );
    }
    if (dto.type && dto.type !== expected.type) {
      throw new ConflictException(
        `交接顺序错误：当前应办理「${HANDOVER_LABELS[expected.type]}」（第 ${expected.seq} 步），` +
          `不能办理「${HANDOVER_LABELS[dto.type]}」。交接须按实际顺序进行。`,
      );
    }

    const toUser = await this.prisma.user.findUnique({ where: { id: dto.toUserId } });
    if (!toUser) throw new BadRequestException(`接收人 #${dto.toUserId} 不存在`);

    // 规则2/3：各环节的操作人与接收人校验
    if (expected.type === 'SAMPLER_TO_COURIER') {
      if (actor.id !== sample.samplerId) {
        throw new ForbiddenException('只能由登记该样品的采样员本人发起交接');
      }
      if (dto.toUserId === sample.samplerId) {
        // 规则3：取样人不能签自己的放行
        throw new BadRequestException('取样人不能签自己的放行：第一环节接收人必须是送检人员，不能是采样者本人');
      }
      if (toUser.role !== 'COURIER') {
        throw new BadRequestException(`第一环节接收人必须是送检人员（${toUser.name} 的角色不是送检员）`);
      }
    }

    if (expected.type === 'COURIER_TO_LAB') {
      const last = sample.handovers[sample.handovers.length - 1];
      if (actor.id !== last?.toUserId) {
        throw new ForbiddenException('只能由上一环节接收样品的送检员办理送达');
      }
      if (toUser.role !== 'LAB') {
        throw new BadRequestException('第二环节接收人必须是实验室接收员');
      }
      // 规则4：送检时核对冷藏要求
      if (dto.coldChainOk !== true) {
        throw new BadRequestException('冷藏要求核对未通过（coldChainOk 必须为 true），不能办理送达交接');
      }
      if (
        dto.temperature === undefined ||
        dto.temperature < COLD_CHAIN_MIN ||
        dto.temperature > COLD_CHAIN_MAX
      ) {
        throw new BadRequestException(
          `冷藏温度需在 ${COLD_CHAIN_MIN}~${COLD_CHAIN_MAX}℃ 之间（当前：${dto.temperature ?? '未填写'}）`,
        );
      }
    }

    if (expected.type === 'LAB_RECEIVE') {
      const last = sample.handovers[sample.handovers.length - 1];
      if (actor.role !== 'LAB' || actor.id !== last?.toUserId) {
        throw new ForbiddenException('只能由接收该样品的实验室人员确认接收');
      }
    }

    // 规则5：封签破损 → 记录事实 + 样品作废（保留全部记录，需重新采样）
    if (dto.sealIntact === false) {
      const [handover] = await this.prisma.$transaction([
        this.prisma.handover.create({
          data: {
            sampleId,
            seq: expected.seq,
            type: expected.type,
            fromUserId: actor.id,
            toUserId: dto.toUserId,
            sealIntact: false,
            coldChainOk: dto.coldChainOk ?? null,
            temperature: dto.temperature ?? null,
            notes: dto.notes ?? null,
          },
          include: { fromUser: true, toUser: true },
        }),
        this.prisma.sample.update({ where: { id: sampleId }, data: { status: 'INVALIDATED' } }),
      ]);
      return {
        handover: serializeHandover(handover),
        sampleStatus: 'INVALIDATED',
        warning: '封签破损：样品已作废并保留全部记录，请使用新的容器编号重新采样（旧样品不会被覆盖）',
      };
    }

    const [handover] = await this.prisma.$transaction([
      this.prisma.handover.create({
        data: {
          sampleId,
          seq: expected.seq,
          type: expected.type,
          fromUserId: actor.id,
          toUserId: dto.toUserId,
          sealIntact: true,
          coldChainOk: dto.coldChainOk ?? null,
          temperature: dto.temperature ?? null,
          notes: dto.notes ?? null,
        },
        include: { fromUser: true, toUser: true },
      }),
      this.prisma.sample.update({
        where: { id: sampleId },
        data: { status: HANDOVER_NEXT_STATUS[expected.type] },
      }),
    ]);
    return {
      handover: serializeHandover(handover),
      sampleStatus: HANDOVER_NEXT_STATUS[expected.type],
    };
  }
}
