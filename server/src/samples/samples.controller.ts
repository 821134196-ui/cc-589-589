import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { CurrentUser, requireUser } from '../common/current-user';
import { SamplesService } from './samples.service';
import { DecisionDto, SampleQueryDto } from './dto';

const photoStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    cb(null, `seal-${Date.now()}-${randomUUID().slice(0, 8)}${extname(file.originalname)}`);
  },
});

@Controller('samples')
export class SamplesController {
  constructor(private samples: SamplesService) {}

  /** 采样登记（multipart：字段 + 封签照片 sealPhoto） */
  @Post()
  @UseInterceptors(FileInterceptor('sealPhoto', { storage: photoStorage }))
  create(
    @CurrentUser() user: User | undefined,
    @Body() body: any,
    @UploadedFile() sealPhoto?: Express.Multer.File,
  ) {
    return this.samples.create(requireUser(user), body, sealPhoto);
  }

  @Get()
  list(@Query() query: SampleQueryDto) {
    return this.samples.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.samples.detail(id);
  }

  /** 负责人审核决定：RETEST 要求复测 / ARCHIVE 归档 */
  @Post(':id/decision')
  decide(
    @CurrentUser() user: User | undefined,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.samples.decide(requireUser(user), id, dto.action, dto.note);
  }
}
