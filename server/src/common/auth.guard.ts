import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PrismaService } from '../prisma.service';
import { parseRoles } from '../domain';

// 演示系统：前端通过 x-user-id 请求头指定当前登录人（等价于登录态）。
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const userId = req.header('x-user-id');
    if (!userId) {
      throw new UnauthorizedException('缺少登录信息（请求头 x-user-id）');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('登录人不存在');
    req.user = user;

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const roles = parseRoles(user.roles);
    if (!required.some((r) => roles.includes(r))) {
      throw new ForbiddenException(
        `人员「${user.name}」没有 ${required.join('/')} 权限，禁止办理该操作`,
      );
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
