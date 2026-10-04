import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser, requireUser } from '../common/current-user';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  /** 发布公告（仅获授权人员） */
  @Post()
  publish(@CurrentUser() user: User | undefined, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.publish(requireUser(user), dto);
  }

  /** 居民公告列表（公开，无需身份） */
  @Get()
  list() {
    return this.announcements.list();
  }

  /** 公告详情 + 完整追溯链 */
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.announcements.detail(id);
  }
}
