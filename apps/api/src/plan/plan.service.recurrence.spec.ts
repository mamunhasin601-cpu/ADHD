import { PlanService } from './plan.service';

describe('PlanService recurrence counting', () => {
  it('counts a series once and excludes its generated occurrence rows', async () => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ plan: 'FREE', proExpiresAt: null }) },
      task: { count: jest.fn().mockResolvedValue(1) },
    };
    const result = await new PlanService(prisma).getPlanInfo('owner');
    expect(prisma.task.count).toHaveBeenCalledWith({ where: {
      userId: 'owner', completedAt: null, parentTaskId: null, seriesId: null, recurrenceEndedAt: null,
    }});
    expect(result.usage.activeTasks).toBe(1);
  });
});
