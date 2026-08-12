import { validate } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

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
