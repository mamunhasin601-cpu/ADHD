import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { RoutinesModule } from './routines/routines.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlanModule } from './plan/plan.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),

    // Redis-соединение для BullMQ (единственный @forRoot на весь AppModule)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),

        PrismaModule,
    AuthModule,
    UsersModule,
    TasksModule,
    RoutinesModule,
    NotificationsModule,
    PlanModule,
  ],
})
export class AppModule {}
