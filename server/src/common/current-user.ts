import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';

/** 取当前登录用户（可能为 undefined，匿名访问如居民公告列表） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

/** 必须登录，否则 401 */
export function requireUser(user?: User): User {
  if (!user) {
    throw new UnauthorizedException('请先选择操作人身份（请求头 x-user-id）');
  }
  return user;
}
