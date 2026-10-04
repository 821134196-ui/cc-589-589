import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Request, Response } from 'express';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/auth.guard';
import { Public } from '../../common/public.decorator';
import { ROLE } from '../../domain';
import { SamplesService } from './samples.service';
import { CreateSampleDto } from './dto';

const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
mkdirSync(uploadDir, { recursive: true });

@Controller('samples')
@UseGuards(RolesGuard)
export class SamplesController {
  constructor(private svc: SamplesService) {}

  // 采样员登记：井号、容器编号、取样时间、现场条件 + 封签照片
  @Post()
  @Roles(ROLE.SAMPLER)
  @UseInterceptors(
    FileInterceptor('sealPhoto', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `seal-${ts}-${Math.round(Math.random() * 1e6)}${ext}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, /^image\/(jpeg|png|webp|jpg)$/.test(file.mimetype));
      },
    }),
  )
  async create(@Body() dto: CreateSampleDto, @Req() req: Request) {
    const file = (req as any).file as Express.Multer.File | undefined;
    const sealPhotoPath = file ? `/seal-photos/${file.filename}` : null;
    return this.svc.create(dto, (req as any).user.id, sealPhotoPath);
  }

  @Public()
  @Get()
  list(@Query('wellId') wellId?: string) {
    return this.svc.list(wellId);
  }

  // 报告详情：完整封签 + 各次交接 + 结果版本链
  @Public()
  @Get(':id/report')
  report(@Param('id') id: string) {
    return this.svc.report(id);
  }

  // 封签照片原始文件（本地存放）
  @Public()
  @Get(':id/seal-photo')
  async sealPhoto(@Param('id') id: string, @Res() res: Response) {
    const report = await this.svc.report(id);
    return res.redirect(report.sealPhotoPath);
  }
}
