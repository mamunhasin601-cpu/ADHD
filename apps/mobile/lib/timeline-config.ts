/**
 * Конфигурация вертикального таймлайна дня.
 *
 * ДОПУЩЕНИЕ: в модели User пока нет полей "время подъёма/отбоя", поэтому диапазон
 * зашит константой. Когда такое поле появится в профиле — заменить dayStartHour/
 * dayEndHour на значения из useAuthStore().user, сам компонент Timeline менять не придётся.
 */
export const TIMELINE_CONFIG = {
  dayStartHour: 6,
  dayEndHour: 24,
  hourHeight: 56, // compact proportional scale; exact time stays on each card
  minBlockHeight: 32, // минимальная высота блока задачи — чтобы короткие задачи оставались читаемыми
};
