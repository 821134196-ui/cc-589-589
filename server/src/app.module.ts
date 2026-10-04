import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma.module';
import { RolesGuard } from './common/auth.guard';
import { UsersModule } from './modules/users/users.module';
import { WellsModule } from './modules/wells/wells.module';
import { SamplesModule } from './modules/samples/samples.module';
import { HandoversModule } from './modules/handovers/handovers.module';
import { LabModule } from './modules/lab/lab.module';
import { DecisionsModule } from './modules/decisions/decisions.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    WellsModule,
    SamplesModule,
    HandoversModule,
    LabModule,
    DecisionsModule,
    AnnouncementsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
