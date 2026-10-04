import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/auth.guard';
import { ROLE } from '../../domain';
import { DecisionsService } from './decisions.service';
import { DecisionDto } from './dto';

@Controller('samples/:id/decisions')
@UseGuards(RolesGuard)
export class DecisionsController {
  constructor(private svc: DecisionsService) {}

  // 负责人决定：公告 / 复测 / 归档
  @Post()
  @Roles(ROLE.OFFICIAL)
  decide(@Param('id') id: string, @Req() req: Request, @Body() dto: DecisionDto) {
    return this.svc.decide(id, (req as any).user.id, dto);
  }
}
