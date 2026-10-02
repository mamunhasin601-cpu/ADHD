import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { StartTaskDto } from './start-task.dto';

describe('StartTaskDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata = { type: 'body' as const, metatype: StartTaskDto, data: '' };

  it.each([
    {},
    { confirmSwitch: false },
    { confirmSwitch: true },
    { confirmEarlyStart: false },
    { confirmEarlyStart: true },
    { confirmSwitch: true, confirmEarlyStart: true },
  ])('accepts %j', async (value) => {
    await expect(pipe.transform(value, metadata)).resolves.toMatchObject(value);
  });

  it.each([
    { confirmSwitch: 'true' },
    { confirmSwitch: 1 },
    { confirmEarlyStart: 'true' },
    { confirmEarlyStart: 1 },
    { switch: true },
  ])('rejects %j', async (value) => {
    await expect(pipe.transform(value, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});
