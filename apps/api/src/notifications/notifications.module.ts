import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsController } from './notifications.controller';
import { TASK_REMINDERS_QUEUE } from './notifications.constants';

@Module({
  imports: [BullModule.registerQueue({ name: TASK_REMINDERS_QUEUE }), PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
