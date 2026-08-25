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
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../app/register';

describe('RegisterScreen verified-contact flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStart.mockResolvedValue({ challengeId: 'challenge-1', expiresInSeconds: 600, resendAfterSeconds: 60 });
    mockConfirm.mockResolvedValue({ verificationToken: 'ticket-email', expiresInSeconds: 900 });
    mockRegister.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    mockAuthenticate.mockResolvedValue(undefined);
  });

  function enterContact(contact = 'User@Example.RU') {
    fireEvent.changeText(screen.getByLabelText('Контакт для регистрации'), contact);
    fireEvent.changeText(screen.getByLabelText('Пароль'), 'password1');
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
});
