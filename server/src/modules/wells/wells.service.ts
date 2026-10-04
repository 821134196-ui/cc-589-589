import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class WellsService {
  constructor(private prisma: PrismaService) {}

  // 点位图：每口井 + 最近一次采样状态（SQLite 取每井最新一条）
  async mapOverview() {
    const wells = await this.prisma.well.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      include: {
        samples: {
          orderBy: { sampledAt: 'desc' },
          take: 1,
          include: {
            results: { where: { isCurrent: true }, take: 1 },
            announcements: { where: { withdrawn: false }, take: 1 },
          },
        },
      },
    });

    return wells.map((w) => {
      const latest = w.samples[0] ?? null;
      return {
        id: w.id,
        code: w.code,
        name: w.name,
        address: w.address,
        posX: w.posX,
        posY: w.posY,
        latestSample: latest
          ? {
              id: latest.id,
              containerCode: latest.containerCode,
              batchNo: latest.batchNo,
              status: latest.status,
              sampledAt: latest.sampledAt,
              sealCode: latest.sealCode,
              qualified: latest.results[0]?.qualified ?? null,
              announced: latest.announcements.length > 0,
            }
          : null,
      };
    });
  }
}
