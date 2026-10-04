import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/auth.guard';
import { Public } from '../../common/public.decorator';
import { ROLE } from '../../domain';
import { AnnouncementsService } from './announcements.service';
import { PublishAnnouncementDto } from './dto';

@Controller()
@UseGuards(RolesGuard)
export class AnnouncementsController {
  constructor(private svc: AnnouncementsService) {}

  // 居民公告列表（无需登录即可查看）
  @Public()
  @Get('announcements')
  list() {
    return this.svc.list();
  }

  // 发布公告：仅 ANNOUNCER 授权人员
  @Post('samples/:id/announcements')
  @Roles(ROLE.ANNOUNCER)
  publish(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: PublishAnnouncementDto,
  ) {
    return this.svc.publish(id, (req as any).user.id, dto);
  }

  // 撤回公告：仅 ANNOUNCER 授权人员（记录保留）
  @Delete('announcements/:id')
  @Roles(ROLE.ANNOUNCER)
  withdraw(@Param('id') id: string) {
    return this.svc.withdraw(id);
  }
}
