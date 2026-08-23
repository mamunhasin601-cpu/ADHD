import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskRecoveryService } from './task-recovery.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import { GetRecoveryQueryDto } from './dto/get-recovery-query.dto';
import { RescheduleRecoveryDto } from './dto/reschedule-recovery.dto';
import { ExtendRecurrenceDto } from './dto/extend-recurrence.dto';
import { UndoRecoveryDto } from './dto/undo-recovery.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskRecoveryService: TaskRecoveryService,
  ) {}

  /** POST /tasks */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.id, dto);
  }

  /** GET /tasks?date=2026-07-23&includeSubTasks=true */
  @Get()
  findAll(@CurrentUser() user: User, @Query() query: GetTasksQueryDto) {
    return this.tasksService.findAll(user.id, query);
  }

    /**
   * GET /tasks/recovery?date=YYYY-MM-DD
   * Возвращает просроченные задачи пользователя для recovery flow.
   * Зарегистрирован ПЕРЕД GET /tasks/:id чтобы избежать конфликта маршрутов (ADR-008 D-9).
   */
  @Get('recovery')
  getOverdueTasks(
    @CurrentUser() user: User,
    @Query() query: GetRecoveryQueryDto,
  ) {
    return this.taskRecoveryService.getOverdueTasks(user.id);
  }

  /**
   * POST /tasks/recovery/reschedule
   * Подтверждает перенос выбранных просроченных задач.
   * Зарегистрирован ПЕРЕД GET /tasks/:id (ADR-008 D-9).
   */
  @Post('recovery/reschedule')
  @HttpCode(HttpStatus.OK)
  rescheduleOverdueTasks(
    @CurrentUser() user: User,
    @Body() dto: RescheduleRecoveryDto,
  ) {
    return this.taskRecoveryService.rescheduleOverdueTasks(user.id, dto.items);
  }

  @Post('recovery/undo')
  @HttpCode(HttpStatus.OK)
  undoRecovery(@CurrentUser() user: User, @Body() dto: UndoRecoveryDto) {
    return this.taskRecoveryService.undoRecovery(user.id, dto.undoId);
  }

  /** Explicit lifecycle write; GET remains read-only. Includes migrated series. */
  @Post('recurrence/extend')
  @HttpCode(HttpStatus.OK)
  extendAllRecurrences(@CurrentUser() user: User, @Body() dto: ExtendRecurrenceDto) {
    return this.tasksService.extendAllSeries(user.id, dto.deviceTimezone);
  }

  /** POST is deliberate: extension materializes a bounded, idempotent horizon. */
  @Post(':id/recurrence/extend')
  @HttpCode(HttpStatus.OK)
  extendRecurrence(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.extendSeries(user.id, id);
  }

  /** GET /tasks/:id */
  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.findOne(user.id, id);
  }

  /** PATCH /tasks/:id */
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.id, id, dto);
  }

  /** PATCH /tasks/:id/start */
  @Patch(':id/start')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.start(user.id, id);
  }

  /** PATCH /tasks/:id/toggle — быстрое переключение completed */
  @Patch(':id/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.toggleComplete(user.id, id);
  }

  /** DELETE /tasks/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.remove(user.id, id);
  }
}
