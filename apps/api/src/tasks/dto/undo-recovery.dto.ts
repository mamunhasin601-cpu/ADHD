import { IsUUID } from 'class-validator';

export class UndoRecoveryDto {
  @IsUUID()
  undoId: string;
}

export class UndoRecoveryResponseDto {
  restoredCount: number;
  taskRestoreStatus: 'ok' | 'already-undone';
  reminderSyncStatus: 'ok' | 'partial';
  failedReminderSyncs?: string[];
  tasks: Array<{ id: string; startTime: Date | null }>;
}
