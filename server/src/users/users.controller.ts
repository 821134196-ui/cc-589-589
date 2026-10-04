import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { publicUser } from '../common/serialize';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  /** 用户列表（前端身份切换器使用） */
  @Get()
  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { id: 'asc' } });
    return users.map(publicUser);
  }
}
