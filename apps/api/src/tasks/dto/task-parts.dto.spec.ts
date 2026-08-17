import { ValidationPipe } from '@nestjs/common';
import { CreateTaskDto, MAX_MANUAL_TASK_PARTS } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const metadata = (metatype: typeof CreateTaskDto | typeof UpdateTaskDto) => ({
  type: 'body' as const, metatype, data: '',
});

describe('manual task parts DTO boundary', () => {
  it('trims titles and accepts only id, title, and completed', async () => {
    await expect(pipe.transform({ title: 'Parent', subTasks: [{ title: '  Part  ', completed: true }] }, metadata(CreateTaskDto)))
      .resolves.toMatchObject({ subTasks: [{ title: 'Part', completed: true }] });
  });

  it.each(['userId', 'parentTaskId', 'startTime', 'durationMinutes', 'recurrenceRule', 'completedAt', 'subTasks', 'createdAt'])(
    'rejects client-controlled %s inside a part write',
    async (field) => {
      await expect(pipe.transform({ title: 'Parent', subTasks: [{ title: 'Part', [field]: field === 'subTasks' ? [] : 'x' }] }, metadata(CreateTaskDto)))
        .rejects.toMatchObject({ status: 400 });
    },
  );

  it('rejects blank titles and arrays over the documented bound', async () => {
    await expect(pipe.transform({ title: 'Parent', subTasks: [{ title: '   ' }] }, metadata(CreateTaskDto)))
      .rejects.toMatchObject({ status: 400 });
    await expect(pipe.transform({ title: 'Parent', subTasks: Array.from({ length: MAX_MANUAL_TASK_PARTS + 1 }, () => ({ title: 'Part' })) }, metadata(CreateTaskDto)))
      .rejects.toMatchObject({ status: 400 });
  });

  it('accepts an authoritative empty update draft', async () => {
    await expect(pipe.transform({ subTasks: [] }, metadata(UpdateTaskDto))).resolves.toMatchObject({ subTasks: [] });
  });

  it('accepts a UUID create identity and rejects it on update', async () => {
    const createRequestId = '00000000-0000-4000-8000-000000000025';
    await expect(pipe.transform({ title: 'Parent', createRequestId }, metadata(CreateTaskDto)))
      .resolves.toMatchObject({ createRequestId });
    await expect(pipe.transform({ title: 'Parent', createRequestId }, metadata(UpdateTaskDto)))
      .rejects.toMatchObject({ status: 400 });
  });
});
