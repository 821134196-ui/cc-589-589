import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser, requireUser } from '../common/current-user';
import { HandoversService } from './handovers.service';
import { CreateHandoverDto } from './dto';

@Controller('samples')
export class HandoversController {
  constructor(private handovers: HandoversService) {}

  /** 办理样品的下一环节交接 */
  @Post(':id/handovers')
  create(
    @CurrentUser() user: User | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateHandoverDto,
  ) {
    return this.handovers.create(requireUser(user), id, dto);
  }
}
