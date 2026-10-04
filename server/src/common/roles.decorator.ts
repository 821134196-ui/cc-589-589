import { SetMetadata } from '@nestjs/common';

// 标注接口所需角色，如 @Roles(ROLE.SAMPLER)
export const ROLES_KEY = 'required_roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
