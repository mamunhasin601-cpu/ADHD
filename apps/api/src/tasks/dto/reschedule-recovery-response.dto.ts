/**
 * Response для POST /tasks/recovery/reschedule
 * Различает успешный task update и частичный reminder sync
 */
export class RescheduleRecoveryResponseDto {
  /** Owner-scoped, one-time server identity. No previous values are exposed. */
  undoId?: string;
  undoExpiresAt?: string;
  /**
   * Количество задач, успешно обновлённых в БД
   */
  updatedCount: number;

  /**
   * Статус обновления задач в транзакции
   */
  taskUpdateStatus: 'ok';

  /**
   * Статус синхронизации reminder после commit
   * 'ok' — все reminders синхронизированы
   * 'partial' — некоторые reminders не смогли синхронизироваться (Redis/queue failure)
   */
  reminderSyncStatus: 'ok' | 'partial';

  /**
   * Массив taskId, для которых reminder sync failed (если partial)
   */
  failedReminderSyncs?: string[];
}
