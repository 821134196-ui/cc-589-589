import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DECISION } from '../../domain';
import { PublishAnnouncementDto } from './dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  // 发布居民公告：
  // 1) 须有负责人"同意发布"决定；2) 决定须针对当前结果版本（更正后须重新批准）
  async publish(sampleId: string, userId: string, dto: PublishAnnouncementDto) {
    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({
        where: { id: sampleId },
        include: { results: { where: { isCurrent: true }, take: 1 } },
      });
      if (!sample) throw new NotFoundException('样品不存在');
      const current = sample.results[0];
      if (!current) throw new ConflictException('该样品尚无检测结果，不能发布公告');

      const approval = await tx.decision.findFirst({
        where: { sampleId, type: DECISION.PUBLISH },
        orderBy: { createdAt: 'desc' },
      });
      if (!approval) {
        throw new ConflictException('负责人尚未作出"同意发布"决定，公告不能发布');
      }
      if (approval.resultId && approval.resultId !== current.id) {
        throw new ConflictException(
          `检测结果已更正为 v${current.version}，此前的发布批准针对旧版本，须由负责人依据新结果重新决定后再发布（旧结果已保留）`,
        );
      }

      return tx.announcement.create({
        data: {
          sampleId,
          wellId: sample.wellId,
          title: dto.title,
          body: dto.body,
          publishedById: userId,
        },
      });
    });
  }

  // 居民端公告列表（公告中的结论可追溯到取样地点、时间、封签与交接）
  async list() {
    return this.prisma.announcement.findMany({
      where: { withdrawn: false },
      orderBy: { publishedAt: 'desc' },
      include: {
        well: { select: { code: true, name: true, address: true } },
        sample: {
          select: {
            id: true,
            containerCode: true,
            batchNo: true,
            sampledAt: true,
            sealCode: true,
            sealPhotoPath: true,
          },
        },
        publishedBy: { select: { id: true, name: true } },
      },
    });
  }

  async withdraw(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('公告不存在');
    return this.prisma.announcement.update({
      where: { id },
      data: { withdrawn: true, withdrawnAt: new Date() },
    });
  }
}
