import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/public.decorator';
import { WellsService } from './wells.service';

@Controller('wells')
export class WellsController {
  constructor(private svc: WellsService) {}

  // 点位图数据（居民也可查看）
  @Public()
  @Get('map')
  map() {
    return this.svc.mapOverview();
  }
}
