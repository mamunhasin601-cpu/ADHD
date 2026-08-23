import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { RoutinesModule } from './routines/routines.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlanModule } from './plan/plan.module';
import { validateCoreEnvironment } from './config/core-environment';
import { redisConnectionFromUrl } from './config/redis-connection';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateCoreEnvironment,
    }),

    // Redis-соединение для BullMQ (единственный @forRoot на весь AppModule)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromUrl(config.getOrThrow<string>('REDIS_URL')),
      }),
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
