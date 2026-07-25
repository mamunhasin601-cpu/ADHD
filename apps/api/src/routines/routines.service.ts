import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';
import type { Routine } from '@prisma/client';

@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoutineDto): Promise<Routine> {
    return this.prisma.routine.create({
      data: {
        userId,
        name: dto.name,
        daysOfWeek: dto.daysOfWeek,
      },
    });
  }

  async findAll(userId: string): Promise<Routine[]> {
    return this.prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, routineId: string): Promise<Routine> {
    const routine = await this.prisma.routine.findUnique({
      where: { id: routineId },
    });

    if (!routine) throw new NotFoundException('Рутина не найдена');
    if (routine.userId !== userId) throw new ForbiddenException('Нет доступа к этой рутине');

    return routine;
  }

  async update(userId: string, routineId: string, dto: UpdateRoutineDto): Promise<Routine> {
    await this.findOne(userId, routineId); // проверка принадлежности

    return this.prisma.routine.update({
      where: { id: routineId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.daysOfWeek !== undefined && { daysOfWeek: dto.daysOfWeek }),
      },
    });
  }

  async remove(userId: string, routineId: string): Promise<void> {
    await this.findOne(userId, routineId);
    await this.prisma.routine.delete({ where: { id: routineId } });
  }
}
