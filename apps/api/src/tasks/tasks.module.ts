import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanModule } from '../plan/plan.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecurrenceHorizonScheduler } from './recurrence-horizon.scheduler';

@Module({
  imports: [NotificationsModule, PlanModule, ScheduleModule.forRoot()],
  controllers: [TasksController],
  providers: [TasksService, TaskRecoveryService, RecurrenceHorizonScheduler],
  exports: [TasksService, TaskRecoveryService],
})
export class TasksModule {}
