import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { parseRoles } from '../../domain';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { login: 'asc' } });
    return users.map((u) => ({
      id: u.id,
      login: u.login,
      name: u.name,
      roles: parseRoles(u.roles),
    }));
  }
}
