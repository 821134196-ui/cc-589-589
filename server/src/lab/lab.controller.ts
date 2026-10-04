import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser, requireUser } from '../common/current-user';
import { LabService } from './lab.service';
import { LabCorrectDto, LabRejectDto, LabResultDto } from './dto';

@Controller('lab')
export class LabController {
  constructor(private lab: LabService) {}

  /** 实验室回传检测结果 */
  @Post('results')
  returnResult(@CurrentUser() user: User | undefined, @Body() dto: LabResultDto) {
    return this.lab.returnResult(requireUser(user), dto);
  }

  /** 实验室退样 */
  @Post('reject')
  reject(@CurrentUser() user: User | undefined, @Body() dto: LabRejectDto) {
    return this.lab.reject(requireUser(user), dto);
  }

  /** 更正已回传的结果（旧版本保留） */
  @Post('results/:id/correct')
  correct(
    @CurrentUser() user: User | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LabCorrectDto,
  ) {
    return this.lab.correct(requireUser(user), id, dto);
  }
}
