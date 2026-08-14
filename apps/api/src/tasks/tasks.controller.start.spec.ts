import { ParseUUIDPipe } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { TasksController } from './tasks.controller';

describe('TasksController start command', () => {
  it('delegates PATCH :id/start with the authenticated owner', async () => {
    const tasks = { start: jest.fn().mockResolvedValue({ id: 'task' }) } as any;
    const controller = new TasksController(tasks, {} as any);
    await expect(controller.start({ id: 'owner' } as any, 'task')).resolves.toEqual({ id: 'task' });
    expect(tasks.start).toHaveBeenCalledWith('owner', 'task');
    expect(Reflect.getMetadata(PATH_METADATA, controller.start)).toBe(':id/start');
    const pipes = Reflect.getMetadata('__routeArguments__', TasksController, 'start');
    const idArgument = Object.values(pipes).find((argument: any) => argument.data === 'id') as any;
    expect(idArgument.pipes[0]).toBe(ParseUUIDPipe);
  });
});
