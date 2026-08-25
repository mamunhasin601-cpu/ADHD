import { authenticationAfterRegistrationMessage, contactVerificationErrorMessage, registrationErrorMessage, registrationNetworkMessage } from '../lib/api-error';

describe('verified registration error mapping', () => {
  it.each([
    ['CONTACT_VERIFICATION_INVALID_OR_EXPIRED', 'Код неверный или истёк. Проверьте код или запросите новый.'],
    ['CONTACT_VERIFICATION_RATE_LIMITED', 'Новый код пока нельзя отправить. Немного подождите и попробуйте снова.'],
    ['CONTACT_VERIFICATION_UNAVAILABLE', 'Не удалось отправить или проверить код. Попробуйте позже.'],
  ])('maps %s without reflecting provider or database details', (code, expected) => {
    expect(contactVerificationErrorMessage({ response: { data: { code, message: 'secret provider payload' } } })).toBe(expected);
  });

  it('uses a safe fallback for network and unknown registration failures', () => {
    expect(contactVerificationErrorMessage(new Error('socket secret'))).not.toContain('socket');
    expect(registrationErrorMessage({ response: { data: { message: 'P2002 email' } } })).toBe('Не удалось создать аккаунт. Проверьте данные и попробуйте позже.');
  });

  it('keeps ambiguous registration and post-registration authentication outcomes honest', () => {
    expect(registrationNetworkMessage()).toContain('Аккаунт мог быть создан');
    expect(authenticationAfterRegistrationMessage()).toContain('Аккаунт создан');
    expect(registrationNetworkMessage()).not.toMatch(/socket|token|password|Prisma/i);
  });
});
