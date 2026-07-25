import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { JOBS } from './notifications.constants';
import type { Job } from 'bullmq';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let notifications: jest.Mocked<
    Pick<NotificationsService, 'wasRecentlyDelivered' | 'sendPushNotification' | 'logNotification'>
  >;

  const makeJob = (overrides: Partial<Job> = {}): Job =>
    ({
      name: JOBS.TASK_REMINDER,
      data: {
        taskId: 'task-1',
        userId: 'user-1',
        taskTitle: 'Тестовая задача',
        scheduledFor: new Date().toISOString(),
      },
      ...overrides,
    }) as Job;

  beforeEach(() => {
    notifications = {
      wasRecentlyDelivered: jest.fn().mockResolvedValue(false),
      sendPushNotification: jest.fn(),
      logNotification: jest.fn().mockResolvedValue(undefined),
    } as any;
    processor = new NotificationsProcessor(notifications as unknown as NotificationsService);
  });

  it('игнорирует джобы с другим именем', async () => {
    await processor.process(makeJob({ name: 'other-job' }));
    expect(notifications.sendPushNotification).not.toHaveBeenCalled();
  });

  it('пропускает отправку, если недавно уже была доставка (идемпотентность)', async () => {
    notifications.wasRecentlyDelivered.mockResolvedValue(true);
    await processor.process(makeJob());
    expect(notifications.sendPushNotification).not.toHaveBeenCalled();
  });

  it('логирует delivered=true и не бросает ошибку при успешной отправке', async () => {
    notifications.sendPushNotification.mockResolvedValue({ status: 'sent' });
    await processor.process(makeJob());
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', true);
  });

  it('логирует delivered=false и НЕ бросает ошибку при no-token (ретрай бессмысленен)', async () => {
    notifications.sendPushNotification.mockResolvedValue({ status: 'no-token' });
    await expect(processor.process(makeJob())).resolves.not.toThrow();
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false);
  });

  it('логирует delivered=false и НЕ бросает ошибку при device-not-registered', async () => {
    notifications.sendPushNotification.mockResolvedValue({ status: 'device-not-registered' });
    await expect(processor.process(makeJob())).resolves.not.toThrow();
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false);
  });

  it('логирует delivered=false и БРОСАЕТ ошибку при error (чтобы BullMQ сделал retry)', async () => {
    notifications.sendPushNotification.mockResolvedValue({ status: 'error', message: 'boom' });
    await expect(processor.process(makeJob())).rejects.toThrow('boom');
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false);
  });
});
