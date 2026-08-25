/**
 * Извлекает понятный текст ошибки из axios-исключения.
 *
 * Раньше в login.tsx/register.tsx была своя копия этой функции, которая при
 * ЛЮБОЙ ошибке без ответа сервера (сеть недоступна, таймаут, неверный адрес)
 * показывала одну и ту же общую фразу "Проверьте данные и попробуйте снова" —
 * это маскировало реальную причину и мешало диагностике.
 *
 * Теперь: если ответа от сервера вообще не было — показываем это явно
 * (с текстом низкоуровневой ошибки axios), а не generic-фразу.
 */
/**
 * Возвращает true если сервер ответил 403 FREE_TIER_LIMIT_REACHED
 * (пользователь Free превысил лимит активных задач).
 */
export function isFreeTierLimitError(err: unknown): boolean {
  const axiosErr = err as {
    response?: { status?: number; data?: { code?: string } };
  };
  return (
    axiosErr.response?.status === 403 &&
    axiosErr.response?.data?.code === 'FREE_TIER_LIMIT_REACHED'
  );
}

export function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    message?: string;
    code?: string;
    response?: { data?: { message?: string | string[] }; status?: number };
  };

  // Сервер ответил (400/401/409 и т.д.) — показываем именно его сообщение
  if (axiosErr.response) {
    const message = axiosErr.response.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return message;
    return `Сервер ответил с ошибкой (код ${axiosErr.response.status ?? '?'})`;
  }

  // Таймаут запроса
  if (axiosErr.code === 'ECONNABORTED') {
    return 'Сервер не ответил вовремя (таймаут). Проверьте, запущен ли backend.';
  }

  // Запрос вообще не дошёл до сервера — сеть/адрес/фаервол
  return `Не удалось подключиться к серверу: ${axiosErr.message ?? 'неизвестная сетевая ошибка'}. Проверьте адрес API (EXPO_PUBLIC_API_URL) и что телефон и компьютер в одной сети.`;
}

export function contactVerificationErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { code?: string } } };
  switch (axiosErr.response?.data?.code) {
    case 'CONTACT_VERIFICATION_INVALID_OR_EXPIRED':
      return 'Код неверный или истёк. Проверьте код или запросите новый.';
    case 'CONTACT_VERIFICATION_RATE_LIMITED':
      return 'Новый код пока нельзя отправить. Немного подождите и попробуйте снова.';
    case 'CONTACT_VERIFICATION_UNAVAILABLE':
      return 'Не удалось отправить или проверить код. Попробуйте позже.';
    default:
      return 'Не удалось отправить или проверить код. Попробуйте позже.';
  }
}

export function registrationErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { code?: string } } };
  if (
    axiosErr.response?.data?.code === 'CONTACT_VERIFICATION_INVALID_OR_EXPIRED' ||
    axiosErr.response?.data?.code === 'CONTACT_VERIFICATION_UNAVAILABLE'
  ) {
    return contactVerificationErrorMessage(err);
  }
  return 'Не удалось создать аккаунт. Проверьте данные и попробуйте позже.';
}

export function registrationNetworkMessage(): string {
  return 'Не удалось получить подтверждение от сервера. Аккаунт мог быть создан. Попробуйте войти с указанными данными.';
}

export function authenticationAfterRegistrationMessage(): string {
  return 'Аккаунт создан, но автоматически войти не удалось. Перейдите на экран входа и войдите с указанными данными.';
}
