import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/auth.guard';
import { HANDOVER, ROLE } from '../../domain';
import { HandoversService } from './handovers.service';
import { PerformHandoverDto } from './dto';

@Controller('samples/:id/handovers')
@UseGuards(RolesGuard)
export class HandoversController {
  constructor(private svc: HandoversService) {}

  // 采样员 → 送检员：核对封签及冷藏要求后启运
  @Post('send')
  @Roles(ROLE.SAMPLER, ROLE.COURIER)
  send(@Param('id') id: string, @Req() req: Request, @Body() dto: PerformHandoverDto) {
    return this.svc.perform(id, HANDOVER.SEND_TO_LAB, (req as any).user.id, dto);
  }

  // 送检人员 → 实验室：签收（再次核对封签/冷藏）
  @Post('receive')
  @Roles(ROLE.COURIER, ROLE.LAB)
  receive(@Param('id') id: string, @Req() req: Request, @Body() dto: PerformHandoverDto) {
    return this.svc.perform(id, HANDOVER.LAB_RECEIVE, (req as any).user.id, dto);
  }

  // 实验室退样（封签破损/温控不达标），样品保留为 REJECTED
  @Post('reject')
  @Roles(ROLE.LAB)
  reject(@Param('id') id: string, @Req() req: Request, @Body() dto: PerformHandoverDto) {
    return this.svc.reject(id, (req as any).user.id, dto);
  }

  // 负责人放行（取样人不能签自己的放行，在 service 校验）
  @Post('release')
  @Roles(ROLE.OFFICIAL)
  release(@Param('id') id: string, @Req() req: Request, @Body() dto: PerformHandoverDto) {
    return this.svc.perform(id, HANDOVER.RELEASE, (req as any).user.id, dto);
  }
}
