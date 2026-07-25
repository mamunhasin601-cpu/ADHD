import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Делаем глобальным — не нужно импортировать в каждом модуле
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
