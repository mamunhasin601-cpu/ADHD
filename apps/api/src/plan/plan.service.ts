import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FREE_TIER_LIMITS } from '@focus/shared-types';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Проверяет, является ли пользователь Pro (с учётом срока действия).
   */
  async isProUser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, proExpiresAt: true },
    });

    if (!user || user.plan !== 'PRO') return false;
    if (user.proExpiresAt && user.proExpiresAt < new Date()) return false;
    return true;
  }

  /**
   * Проверяет, не превышен ли лимит задач для Free пользователя.
   * Бросает ForbiddenException если лимит превышен.
   */
  async enforceTaskLimit(userId: string): Promise<void> {
    const isPro = await this.isProUser(userId);
    if (isPro) return; // Pro пользователи безограничений

    const activeTaskCount = await this.prisma.task.count({
      where: {
        userId,
        completedAt: null,
        parentTaskId: null, // считаем только верхнеуровневые задачи
      },
    });

    if (activeTaskCount >= FREE_TIER_LIMITS.maxActiveTasks) {
      throw new ForbiddenException({
        message: `Достигнут лимит бесплатного плана: ${FREE_TIER_LIMITS.maxActiveTasks} активных задач`,
        code: 'FREE_TIER_LIMIT_REACHED',
        limit: FREE_TIER_LIMITS.maxActiveTasks,
current: activeTaskCount,
      });
    }
  }

  /**
   * Получает информацию о плане и использовании лимитов.
   */
  async getPlanInfo(userId: string): Promise<{
    plan: 'FREE' | 'PRO';
    isPro: boolean;
    proExpiresAt: Date | null;
    usage: {
      activeTasks: number;
      limit: number | null;
    };
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, proExpiresAt: true },
    });

    const isPro = await this.isProUser(userId);

    const activeTasks = await this.prisma.task.count({
      where: {
        userId,
        completedAt: null,
        parentTaskId: null,
      },
    });

    return {
      plan: user?.plan ?? 'FREE',
      isPro,
      proExpiresAt: user?.proExpiresAt ?? null,
      usage: {
        activeTasks,
        limit: isPro ? null : FREE_TIER_LIMITS.maxActiveTasks,
      },
    };
  }

  /**
   * Обновляет план пользователя (вызывается после успешной оплаты).
   */
  async upgradeToPro(userId: string, expiresAt?: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'PRO',
        proExpiresAt: expiresAt ?? null, // null = бессрочно
      },
    });
  }

  /**
   * Даунгрейд до Free (например, истёк срок подписки).
   */
  async downgradeToFree(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'FREE',
        proExpiresAt: null,
      },
    });
  }
}
