import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [NotificationsModule, PlanModule],
  controllers: [TasksController],
  providers: [TasksService, TaskRecoveryService],
  exports: [TasksService, TaskRecoveryService],
})
export class TasksModule {}
