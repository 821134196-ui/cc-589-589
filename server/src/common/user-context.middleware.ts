import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma.service';

/**
 * 简化身份机制：请求头 x-user-id 标识当前操作人（演示系统，无口令）。
 * 前端右上角切换用户即切换该请求头。
 */
@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request & { user?: any }, _res: Response, next: NextFunction) {
    const header = req.headers['x-user-id'];
    if (header) {
      const id = Number(header);
      const user = Number.isInteger(id)
        ? await this.prisma.user.findUnique({ where: { id } })
        : null;
      if (!user) {
        throw new UnauthorizedException(`身份无效：不存在 id=${header} 的用户`);
      }
      req.user = user;
    }
    next();
  }
}
