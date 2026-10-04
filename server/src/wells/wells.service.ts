import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { serializeSampleBrief } from '../common/serialize';

@Injectable()
export class WellsService {
  constructor(private prisma: PrismaService) {}

  /** 每口井附带最近一次采样的状态（点位图用） */
  async listWithLatest() {
    const wells = await this.prisma.well.findMany({
      orderBy: { code: 'asc' },
      include: {
        samples: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { labResults: { orderBy: { version: 'desc' }, take: 1 } },
        },
      },
    });
    return wells.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      latitude: w.latitude,
      longitude: w.longitude,
      address: w.address,
      latestSample: w.samples[0]
        ? {
            id: w.samples[0].id,
            containerNo: w.samples[0].containerNo,
            status: w.samples[0].status,
            sampledAt: w.samples[0].sampledAt,
            latestConclusion: w.samples[0].labResults[0]?.conclusion ?? null,
          }
        : null,
    }));
  }

  async detail(id: number) {
    const well = await this.prisma.well.findUnique({
      where: { id },
      include: {
        samples: {
          orderBy: { createdAt: 'desc' },
          include: {
            sampler: true,
            labResults: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!well) throw new NotFoundException(`井位 #${id} 不存在`);
    return { ...well, samples: well.samples.map(serializeSampleBrief) };
  }
}
