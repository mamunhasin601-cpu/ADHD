import { ValidationPipe } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common/interfaces';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

describe('Task startedAt DTO boundary', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype, data: undefined });

  it.each([
    ['create', CreateTaskDto, { title: 'Task', startedAt: '2026-08-14T10:00:00Z' }],
    ['update', UpdateTaskDto, { title: 'Task', startedAt: '2026-08-14T10:00:00Z' }],
  ])('rejects arbitrary startedAt on %s under the production ValidationPipe', async (_name, dto, payload) => {
    await expect(pipe.transform(payload, metadata(dto))).rejects.toMatchObject({ status: 400 });
  });
});
