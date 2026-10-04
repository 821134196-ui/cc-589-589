import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/auth.guard';
import { ROLE } from '../../domain';
import { LabService } from './lab.service';
import { CorrectResultDto, RecordResultDto, SimulateDto } from './dto';

@Controller('samples/:id/lab')
@UseGuards(RolesGuard)
export class LabController {
  constructor(private svc: LabService) {}

  // 本地模拟实验室接口：自动检测并回传结果
  @Post('simulate')
  @Roles(ROLE.LAB)
  simulate(@Param('id') id: string, @Req() req: Request, @Body() dto: SimulateDto) {
    return this.svc.simulate(id, (req as any).user.id, dto ?? {});
  }

  // 实验室手工回传结果（首版）
  @Post('results')
  @Roles(ROLE.LAB)
  record(@Param('id') id: string, @Req() req: Request, @Body() dto: RecordResultDto) {
    return this.svc.recordResult(id, (req as any).user.id, dto ?? {});
  }

  // 结果更正：旧版本保留，不覆盖
  @Post('correct')
  @Roles(ROLE.LAB)
  correct(@Param('id') id: string, @Req() req: Request, @Body() dto: CorrectResultDto) {
    return this.svc.correct(id, (req as any).user.id, dto);
  }
}
