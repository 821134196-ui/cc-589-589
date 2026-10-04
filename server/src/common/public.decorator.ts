import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';
// 标注无需登录即可访问的接口（如登录用的人员列表、居民公告）
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
