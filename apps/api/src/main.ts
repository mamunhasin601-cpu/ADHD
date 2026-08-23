import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  // Глобальный валидатор — отклоняет запросы с невалидными данными
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // отрезает поля, которых нет в DTO
      forbidNonWhitelisted: true, // возвращает ошибку если есть лишние поля
      transform: true,           // автоматически преобразует типы (string → number)
      // enableImplicitConversion убран: он применяет Boolean("false") === true до @Transform.
      // Явные @Transform на boolean-полях DTO обеспечивают корректную конверсию.
    }),
  );

  // CORS для веб-версии в dev-режиме
  if (config.getOrThrow('NODE_ENV') !== 'production') {
    app.enableCors({
      origin: ['http://localhost:3001', 'http://localhost:19006'],
      credentials: true,
    });

    const httpLogger = new Logger('HTTP');
    app.use((request: Request, response: Response, next: NextFunction) => {
      response.on('finish', () => {
        httpLogger.log(`${request.method} ${request.originalUrl} ${response.statusCode}`);
      });
      next();
    });
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  logger.log(`🚀 API запущен на http://localhost:${port}`);
}

bootstrap();
