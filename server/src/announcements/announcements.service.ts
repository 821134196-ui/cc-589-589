import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { STATUS_LABELS } from '../common/constants';
import { serializeAnnouncement } from '../common/serialize';
import { CreateAnnouncementDto } from './dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  /** 发布公告：仅获授权人员（canPublish）可发布 */
  async publish(actor: User, dto: CreateAnnouncementDto) {
    // 规则：公告只允许获授权人员发布（先查权限，再查业务状态）
    if (!actor.canPublish) {
      throw new ForbiddenException(
        `无权限发布公告：「${actor.name}」未获公告发布授权，只有获授权的负责人可以发布`,
      );
    }
    const sample = await this.prisma.sample.findUnique({
      where: { id: dto.sampleId },
      include: {
        well: true,
        labResults: { orderBy: { version: 'desc' }, take: 1 },
        announcements: { where: { status: 'PUBLISHED' } },
      },
    });
    if (!sample) throw new NotFoundException(`样品 #${dto.sampleId} 不存在`);
    if (sample.announcements.length > 0) {
      throw new ConflictException(`样品 #${dto.sampleId} 已发布过公告（#${sample.announcements[0].id}）`);
    }
    if (sample.status !== 'RESULT_RETURNED') {
      throw new ConflictException(
        `当前状态「${STATUS_LABELS[sample.status] ?? sample.status}」不能发布公告（需结果已回传且经负责人审核）`,
      );
    }
    const latest = sample.labResults[0];
    if (!latest) throw new ConflictException('该样品尚无检测结果，不能发布公告');

    const conclusionText =
      latest.conclusion === 'NORMAL'
        ? '所检项目符合《生活饮用水卫生标准》(GB 5749-2022)，可正常取用。'
        : '部分项目不符合《生活饮用水卫生标准》(GB 5749-2022)，请居民暂停取用，等待复测结果。';
    const title = dto.title || `${sample.well.name}水质检测公告`;
    const content =
      dto.content ||
      `${sample.well.name}（${sample.well.address ?? '社区'}）本次采样（容器编号 ${sample.containerNo}，` +
        `取样时间 ${sample.sampledAt.toLocaleString('zh-CN')}）经实验室检测：${conclusionText}` +
        `取样地点、时间及完整封签交接记录可在本公告详情中追溯。`;

    const [announcement] = await this.prisma.$transaction([
      this.prisma.announcement.create({
        data: {
          sampleId: sample.id,
          resultId: latest.id,
          title,
          content,
          publishedById: actor.id,
        },
        include: { publishedBy: true },
      }),
      this.prisma.sample.update({ where: { id: sample.id }, data: { status: 'PUBLISHED' } }),
    ]);
    return serializeAnnouncement(announcement);
  }

  /** 居民公告列表（公开） */
  async list() {
    const list = await this.prisma.announcement.findMany({
      orderBy: { publishedAt: 'desc' },
      include: {
        publishedBy: true,
        sample: {
          include: {
            well: true,
            sampler: true,
            handovers: { orderBy: { seq: 'asc' }, include: { fromUser: true, toUser: true } },
            labResults: { orderBy: { version: 'asc' } },
            announcements: { include: { publishedBy: true } },
            replacedBy: true,
          },
        },
      },
    });
    return list.map(serializeAnnouncement);
  }

  /** 公告详情：含完整追溯链（取样地点/时间、封签记录、各次交接、结果版本） */
  async detail(id: number) {
    const a = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        publishedBy: true,
        sample: {
          include: {
            well: true,
            sampler: true,
            handovers: { orderBy: { seq: 'asc' }, include: { fromUser: true, toUser: true } },
            labResults: { orderBy: { version: 'asc' } },
            announcements: { include: { publishedBy: true } },
            replacedBy: true,
          },
        },
      },
    });
    if (!a) throw new NotFoundException(`公告 #${id} 不存在`);
    return serializeAnnouncement(a);
  }
}
