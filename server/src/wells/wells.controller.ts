import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { WellsService } from './wells.service';

@Controller('wells')
export class WellsController {
  constructor(private wells: WellsService) {}

  /** 点位图：每口井 + 最近一次采样状态 */
  @Get()
  list() {
    return this.wells.listWithLatest();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.wells.detail(id);
  }
}
