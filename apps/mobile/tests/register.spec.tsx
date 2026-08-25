const mockStart = jest.fn();
const mockConfirm = jest.fn();
const mockRegister = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }));
jest.mock('../lib/api/auth', () => ({
  startContactVerification: (...args: unknown[]) => mockStart(...args),
  confirmContactVerification: (...args: unknown[]) => mockConfirm(...args),
  registerVerified: (...args: unknown[]) => mockRegister(...args),
}));
jest.mock('../stores/auth.store', () => ({ useAuthStore: (selector: any) => selector({ authenticate: mockAuthenticate }) }));
jest.mock('react-native-safe-area-context', () => { const { View } = require('react-native'); return { SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View> }; });

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RegisterScreen from '../app/register';

describe('RegisterScreen verified-contact flow', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  afterEach(() => jest.useRealTimers());
  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockReset(); mockConfirm.mockReset(); mockRegister.mockReset(); mockAuthenticate.mockReset();
    mockStart.mockResolvedValue({ challengeId: 'challenge-1', expiresInSeconds: 600, resendAfterSeconds: 60 });
    mockConfirm.mockResolvedValue({ verificationToken: 'ticket-email', expiresInSeconds: 900 });
    mockRegister.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    mockAuthenticate.mockResolvedValue(undefined);
  });

  function enterContact(contact = 'User@Example.RU') {
    fireEvent.changeText(screen.getByLabelText('Контакт для регистрации'), contact);
    fireEvent.changeText(screen.getByLabelText('Пароль'), 'password1');
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  it('starts EMAIL verification and does not register before accepted confirmation', async () => {
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код'));
    await screen.findByText(/Код отправлен на/);
    expect(mockStart).toHaveBeenCalledWith({ channel: 'EMAIL', destination: 'user@example.ru' });
    expect(mockRegister).not.toHaveBeenCalled(); expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(screen.getByText('Войти через соцсети')).toBeTruthy(); expect(screen.getByText('Уже есть аккаунт? Войти')).toBeTruthy();
  });

  it('enforces strict E.164 guidance and sends PHONE verification', async () => {
    render(<RegisterScreen />); fireEvent.press(screen.getByLabelText('Выбрать телефон')); enterContact('+7 999 123-45-67');
    expect(screen.getByText(/международный формат.*\+79991234567/)).toBeTruthy();
    expect(screen.getByLabelText('Получить код')).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Контакт для регистрации'), '+79991234567'); fireEvent.press(screen.getByLabelText('Получить код'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith({ channel: 'PHONE', destination: '+79991234567' }));
  });

  it('confirms six digits then registers with only the matching email ticket and authenticates', async () => {
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    const input = screen.getByLabelText('Код подтверждения'); fireEvent.changeText(input, '12a34567');
    expect(input.props.value).toBe('123456'); fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' }));
    expect(mockConfirm).toHaveBeenCalledWith({ challengeId: 'challenge-1', code: '123456' });
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ email: 'user@example.ru', emailVerificationToken: 'ticket-email' }));
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty('phoneVerificationToken');
  });

  it('never registers or authenticates when confirmation fails', async () => {
    mockConfirm.mockRejectedValue({ response: { data: { code: 'CONTACT_VERIFICATION_INVALID_OR_EXPIRED' } } });
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456'); fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled()); expect(mockRegister).not.toHaveBeenCalled(); expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('never authenticates when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('network detail'));
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456'); fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    await waitFor(() => expect(mockRegister).toHaveBeenCalled()); expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('clears the challenge and PIN when changing contact', async () => {
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456'); fireEvent.press(screen.getByLabelText('Изменить контакт'));
    expect(screen.getByLabelText('Контакт для регистрации')).toBeTruthy(); expect(screen.queryByDisplayValue('123456')).toBeNull();
  });

  it('uses fake timers for the server countdown, then resends with a new challenge and clears PIN', async () => {
    jest.useFakeTimers();
    mockStart
      .mockResolvedValueOnce({ challengeId: 'challenge-1', expiresInSeconds: 600, resendAfterSeconds: 3 })
      .mockResolvedValueOnce({ challengeId: 'challenge-2', expiresInSeconds: 600, resendAfterSeconds: 4 });
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код'));
    await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456');
    expect(screen.getByLabelText('Отправить код снова')).toBeDisabled();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByLabelText('Отправить код снова')).toBeDisabled();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByLabelText('Отправить код снова')).not.toBeDisabled();
    fireEvent.press(screen.getByLabelText('Отправить код снова'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Код подтверждения').props.value).toBe('');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '654321');
    fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith({ challengeId: 'challenge-2', code: '654321' }));
  });

  it('guards rapid duplicate resend and disables change-contact during the active request', async () => {
    mockStart.mockResolvedValueOnce({ challengeId: 'challenge-1', expiresInSeconds: 600, resendAfterSeconds: 0 });
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код'));
    await screen.findByLabelText('Код подтверждения');
    const resend = deferred<{ challengeId: string; expiresInSeconds: number; resendAfterSeconds: number }>();
    mockStart.mockReturnValueOnce(resend.promise);
    fireEvent.press(screen.getByLabelText('Отправить код снова'));
    fireEvent.press(screen.getByLabelText('Отправить код снова'));
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Изменить контакт')).toBeDisabled();
    fireEvent.press(screen.getByLabelText('Изменить контакт'));
    expect(screen.getByLabelText('Код подтверждения')).toBeTruthy();
    await act(async () => resend.resolve({ challengeId: 'challenge-2', expiresInSeconds: 600, resendAfterSeconds: 1 }));
  });

  it('allows only one confirm/register chain under rapid presses', async () => {
    const confirmation = deferred<{ verificationToken: string; expiresInSeconds: number }>();
    mockConfirm.mockReturnValue(confirmation.promise);
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456');
    fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    expect(mockConfirm).toHaveBeenCalledTimes(1); expect(mockRegister).not.toHaveBeenCalled();
    await act(async () => confirmation.resolve({ verificationToken: 'ticket', expiresInSeconds: 900 }));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('reports successful account creation separately when automatic sign-in fails', async () => {
    mockAuthenticate.mockRejectedValue(new Error('secret token detail'));
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456'); fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Аккаунт создан', 'Аккаунт создан, но автоматически войти не удалось. Перейдите на экран входа и войдите с указанными данными.'));
    expect(JSON.stringify(alert.mock.calls)).not.toContain('secret token detail');
  });

  it('reports an ambiguous registration network result without raw details', async () => {
    mockRegister.mockRejectedValue(new Error('socket secret'));
    render(<RegisterScreen />); enterContact(); fireEvent.press(screen.getByLabelText('Получить код')); await screen.findByLabelText('Код подтверждения');
    fireEvent.changeText(screen.getByLabelText('Код подтверждения'), '123456'); fireEvent.press(screen.getByLabelText('Подтвердить и создать аккаунт'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Не удалось подтвердить регистрацию', 'Не удалось получить подтверждение от сервера. Аккаунт мог быть создан. Попробуйте войти с указанными данными.'));
    expect(JSON.stringify(alert.mock.calls)).not.toContain('socket secret'); expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
