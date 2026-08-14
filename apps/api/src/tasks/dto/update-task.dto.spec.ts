import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common/interfaces';
import { UpdateTaskDto } from './update-task.dto';

describe('UpdateTaskDto firstStep production boundary', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata: ArgumentMetadata = { type: 'body', metatype: UpdateTaskDto, data: undefined };

  it.each([
    ['  Открыть документ  ', 'Открыть документ'],
    ['   ', null],
    [null, null],
    ['x'.repeat(240), 'x'.repeat(240)],
  ])('normalizes and accepts %p', async (firstStep, expected) => {
    await expect(pipe.transform({ firstStep }, metadata)).resolves.toMatchObject({ firstStep: expected });
  });

  it.each([42, {}, 'x'.repeat(241)])('rejects invalid firstStep %p', async (firstStep) => {
    await expect(pipe.transform({ firstStep }, metadata)).rejects.toMatchObject({ status: 400 });
  });

  it('still rejects startedAt', async () => {
    await expect(pipe.transform({ startedAt: '2026-08-14T10:00:00Z' }, metadata))
      .rejects.toMatchObject({ status: 400 });
  });
});
