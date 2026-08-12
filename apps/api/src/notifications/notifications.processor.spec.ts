/**
 * NotificationsProcessor unit tests (0011B: per-device retry/dedup).
 *
 * Key behavioral changes from 0011A:
 * - No task-global wasRecentlyDelivered precheck (removed in 0011B).
 * - sendPushNotification now takes (userId, taskId).
 * - Per-device outcomes logged individually; 'already-delivered' not re-logged.
 * - Retry thrown only when at least one device has a retryable 'error' outcome.
 */
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import type { PushSendResult } from './notifications.service';
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
        // taskTitle is intentionally absent from the payload (ADR-009 privacy contract)
        taskId: 'task-1',
        userId: 'user-1',
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

  it('ignores jobs with a different name', async () => {
    await processor.process(makeJob({ name: 'other-job' }));
    expect(notifications.sendPushNotification).not.toHaveBeenCalled();
  });

  it('passes taskId to sendPushNotification (per-device dedup, no task-global precheck)', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'sent',
      devices: [{ tokenId: 'tok-1', outcome: 'sent' }],
    } satisfies PushSendResult);

    await processor.process(makeJob());

    // No task-global wasRecentlyDelivered call (0011B)
    expect(notifications.wasRecentlyDelivered).not.toHaveBeenCalled();
    // taskId forwarded so service can do per-device dedup
    expect(notifications.sendPushNotification).toHaveBeenCalledWith('user-1', 'task-1');
  });

  it('logs delivered=true per device on success', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'sent',
      devices: [{ tokenId: 'tok-1', outcome: 'sent' }],
    } satisfies PushSendResult);

    await processor.process(makeJob());

    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', true, 'tok-1');
  });

  it('logs delivered=false for error outcome', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'all-failed',
      devices: [{ tokenId: 'tok-err', outcome: 'error', errorMessage: 'timeout' }],
    } satisfies PushSendResult);

    await expect(processor.process(makeJob())).rejects.toThrow('Some device tokens failed delivery');
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false, 'tok-err');
  });

  it('logs delivered=false for device-not-registered outcome', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'all-failed',
      devices: [{ tokenId: 'tok-dead', outcome: 'device-not-registered' }],
    } satisfies PushSendResult);

    // device-not-registered only — no retryable error, does NOT throw
    await expect(processor.process(makeJob())).resolves.not.toThrow();
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false, 'tok-dead');
  });

  it('does NOT re-log already-delivered devices (per-device dedup, 0011B)', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'sent',
      devices: [
        { tokenId: 'tok-new', outcome: 'sent' },
        { tokenId: 'tok-prev', outcome: 'already-delivered' },
      ],
    } satisfies PushSendResult);

    await processor.process(makeJob());

    // Only the newly sent device is logged; already-delivered has a prior log entry.
    expect(notifications.logNotification).toHaveBeenCalledTimes(1);
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', true, 'tok-new');
    expect(notifications.logNotification).not.toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), 'tok-prev',
    );
  });

  it('multi-device: logs each device outcome separately', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'sent',
      devices: [
        { tokenId: 'dev-1', outcome: 'sent' },
        { tokenId: 'dev-2', outcome: 'error', errorMessage: 'network' },
      ],
    } satisfies PushSendResult);

    // Has retryable error on dev-2, but dev-1 succeeded → still throws for retry
    await expect(processor.process(makeJob())).rejects.toThrow();

    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', true, 'dev-1');
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false, 'dev-2');
  });

  it('no-tokens: logs delivered=false and does not throw', async () => {
    notifications.sendPushNotification.mockResolvedValue({ status: 'no-tokens' } satisfies PushSendResult);

    await expect(processor.process(makeJob())).resolves.not.toThrow();
    expect(notifications.logNotification).toHaveBeenCalledWith('user-1', 'task-1', false, null);
  });

  it('all-failed with only already-delivered: does NOT throw (all deduped)', async () => {
    notifications.sendPushNotification.mockResolvedValue({
      status: 'all-failed',
      devices: [{ tokenId: 'tok-1', outcome: 'already-delivered' }],
    } satisfies PushSendResult);

    await expect(processor.process(makeJob())).resolves.not.toThrow();
    expect(notifications.logNotification).not.toHaveBeenCalled();
  });

  it('job payload не содержит taskTitle (конфиденциальность, ADR-009)', () => {
    const job = makeJob();
    expect((job.data as any).taskTitle).toBeUndefined();
    expect(job.data.taskId).toBeDefined();
    expect(job.data.userId).toBeDefined();
  });
});
