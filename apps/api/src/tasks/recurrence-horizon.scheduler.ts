import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from './tasks.service';

@Injectable()
export class RecurrenceHorizonScheduler {
  private readonly logger = new Logger(RecurrenceHorizonScheduler.name);
  constructor(private readonly tasks: TasksService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'recurrence-horizon-renewal', timeZone: 'UTC' })
  async renew(): Promise<void> {
    try {
      const count = await this.tasks.renewRecurrenceHorizons();
      this.logger.log(`Recurrence horizon renewal: created=${count}`);
    } catch (error) {
      this.logger.error('Recurrence horizon renewal failed', error);
    }
  }
}
