import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Глобальный валидатор — отклоняет запросы с невалидными данными
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // отрезает поля, которых нет в DTO
      forbidNonWhitelisted: true, // возвращает ошибку если есть лишние поля
      transform: true,           // автоматически преобразует типы (string → number)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS для веб-версии в dev-режиме
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: ['http://localhost:3001', 'http://localhost:19006'],
      credentials: true,
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 API запущен на http://localhost:${port}`);
}

bootstrap();
