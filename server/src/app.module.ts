import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserContextMiddleware } from './common/user-context.middleware';
import { UsersController } from './users/users.controller';
import { WellsController } from './wells/wells.controller';
import { WellsService } from './wells/wells.service';
import { SamplesController } from './samples/samples.controller';
import { SamplesService } from './samples/samples.service';
import { HandoversController } from './handovers/handovers.controller';
import { HandoversService } from './handovers/handovers.service';
import { LabController } from './lab/lab.controller';
import { LabService } from './lab/lab.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AnnouncementsService } from './announcements/announcements.service';

@Module({
  controllers: [
    UsersController,
    WellsController,
    SamplesController,
    HandoversController,
    LabController,
    AnnouncementsController,
  ],
  providers: [
    PrismaService,
    UserContextMiddleware,
    WellsService,
    SamplesService,
    HandoversService,
    LabService,
    AnnouncementsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserContextMiddleware).forRoutes('*');
  }
}
