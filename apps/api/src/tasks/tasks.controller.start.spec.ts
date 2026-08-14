import { ConflictException, HttpStatus, ParseUUIDPipe, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { TasksController } from './tasks.controller';

describe('TasksController start command', () => {
  it('declares PATCH :id/start, status 200, UUID validation and exact delegation', async () => {
    const returned = { id: 'task', startedAt: new Date() };
    const tasks = { start: jest.fn().mockResolvedValue(returned) } as any;
    const controller = new TasksController(tasks, {} as any);
    await expect(controller.start({ id: 'owner' } as any, 'task')).resolves.toBe(returned);
    expect(tasks.start).toHaveBeenCalledWith('owner', 'task');
    expect(Reflect.getMetadata(PATH_METADATA, controller.start)).toBe(':id/start');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.start)).toBe(RequestMethod.PATCH);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.start)).toBe(HttpStatus.OK);
    const pipes = Reflect.getMetadata('__routeArguments__', TasksController, 'start');
    const idArgument = Object.values(pipes).find((argument: any) => argument.data === 'id') as any;
    expect(idArgument.pipes[0]).toBe(ParseUUIDPipe);
  });

  it('propagates the service conflict as HTTP 409', async () => {
    const tasks = { start: jest.fn().mockRejectedValue(new ConflictException('Завершённую задачу нельзя начать')) } as any;
    const controller = new TasksController(tasks, {} as any);
    await expect(controller.start({ id: 'owner' } as any, 'task')).rejects.toMatchObject({ status: 409 });
  });
});
