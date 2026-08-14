import { validate } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';
import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common/interfaces';

async function durationErrors(durationMinutes?: number | null) {
  const dto = Object.assign(new CreateTaskDto(), {
    title: 'Task',
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
  });
  return validate(dto);
}

describe('CreateTaskDto durationMinutes', () => {
  it.each([undefined, null, 1, 30, 1440])('accepts %p', async (value) => {
    expect(await durationErrors(value)).toHaveLength(0);
  });

  it.each([0, -1, 1.5, 1441])('rejects invalid numeric value %p', async (value) => {
    expect(await durationErrors(value)).not.toHaveLength(0);
  });
});

describe('CreateTaskDto firstStep', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata: ArgumentMetadata = { type: 'body', metatype: CreateTaskDto, data: undefined };

  it.each([
    ['  Открыть документ  ', 'Открыть документ'],
    ['   ', null],
    [null, null],
    ['x'.repeat(240), 'x'.repeat(240)],
  ])('normalizes and accepts %p', async (firstStep, expected) => {
    await expect(pipe.transform({ title: 'Task', firstStep }, metadata))
      .resolves.toMatchObject({ firstStep: expected });
  });

  it.each([42, {}, 'x'.repeat(241)])('rejects invalid firstStep %p', async (firstStep) => {
    await expect(pipe.transform({ title: 'Task', firstStep }, metadata))
      .rejects.toMatchObject({ status: 400 });
  });
});
