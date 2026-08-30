import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getOAuthProviderAvailability } from '../lib/api/auth';
import { useAuthStore } from '../stores/auth.store';
import AuthProviderSelectScreen from '../app/auth-provider-select';

jest.mock('../lib/api/auth', () => ({ getOAuthProviderAvailability: jest.fn() }));
jest.mock('../stores/auth.store', () => ({ useAuthStore: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-linking', () => ({ addEventListener: jest.fn(() => ({ remove: jest.fn() })) }));

const mockGetAvailability = getOAuthProviderAvailability as jest.MockedFunction<typeof getOAuthProviderAvailability>;
const mockOpenAuth = WebBrowser.openAuthSessionAsync as jest.MockedFunction<typeof WebBrowser.openAuthSessionAsync>;
const mockAuthenticate = jest.fn();

describe('AuthProviderSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => selector({ authenticate: mockAuthenticate }));
    mockOpenAuth.mockResolvedValue({ type: 'cancel' } as never);
  });

  it('keeps email/phone available while discovery is loading', () => {
    mockGetAvailability.mockReturnValue(new Promise(() => undefined));
    const screen = render(<AuthProviderSelectScreen />);
    expect(screen.getByTestId('oauth-discovery-loading')).toBeTruthy();
    expect(screen.getByTestId('email-phone-button')).toBeTruthy();
    expect(screen.queryByTestId('oauth-provider-yandex')).toBeNull();
  });

  it.each([
    [{ yandex: false, vk: false, mailru: false }, []],
    [{ yandex: true, vk: true, mailru: true }, ['yandex', 'vk', 'mailru']],
    [{ yandex: true, vk: false, mailru: false }, ['yandex']],
    [{ yandex: false, vk: true, mailru: true }, ['vk', 'mailru']],
  ])('renders only providers explicitly enabled by the API: %p', async (availability, enabled) => {
    mockGetAvailability.mockResolvedValue(availability);
    const screen = render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(screen.queryByTestId('oauth-discovery-loading')).toBeNull());
    for (const provider of ['yandex', 'vk', 'mailru']) {
      if (enabled.includes(provider)) {
        expect(screen.queryByTestId(`oauth-provider-${provider}`)).toBeTruthy();
      } else {
        expect(screen.queryByTestId(`oauth-provider-${provider}`)).toBeNull();
      }
    }
    expect(screen.getByTestId('email-phone-button')).toBeTruthy();
  });

  it('fails closed when discovery fails and does not log raw errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetAvailability.mockRejectedValue(new Error('network failure'));
    const screen = render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(screen.getByTestId('oauth-discovery-error')).toBeTruthy());
    expect(screen.queryByTestId('oauth-provider-yandex')).toBeNull();
    expect(screen.getByTestId('email-phone-button')).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('fails closed when the API parser rejects a malformed response', async () => {
    mockGetAvailability.mockRejectedValue(new Error('Invalid OAuth provider availability'));
    const screen = render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(screen.getByTestId('oauth-discovery-error')).toBeTruthy());
    expect(screen.queryByTestId('oauth-provider-yandex')).toBeNull();
    expect(screen.getByTestId('email-phone-button')).toBeTruthy();
  });

  it('does not invoke a disabled provider and prevents duplicate presses', async () => {
    let resolveAuth: (value: never) => void = () => undefined;
    mockGetAvailability.mockResolvedValue({ yandex: true, vk: false, mailru: false });
    mockOpenAuth.mockReturnValue(new Promise((resolve) => { resolveAuth = resolve; }));
    const screen = render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(screen.getByTestId('oauth-provider-yandex')).toBeTruthy());
    expect(screen.queryByTestId('oauth-provider-vk')).toBeNull();
    fireEvent.press(screen.getByTestId('oauth-provider-yandex'));
    fireEvent.press(screen.getByTestId('oauth-provider-yandex'));
    expect(mockOpenAuth).toHaveBeenCalledTimes(1);
    resolveAuth({ type: 'cancel' } as never);
  });

  it('opens an enabled provider through the shared API base URL', async () => {
    mockGetAvailability.mockResolvedValue({ yandex: false, vk: true, mailru: false });
    const screen = render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(screen.getByTestId('oauth-provider-vk')).toBeTruthy());
    fireEvent.press(screen.getByTestId('oauth-provider-vk'));
    await waitFor(() => expect(mockOpenAuth).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/auth/vk',
      'focus://auth/callback',
    ));
  });

  it('handles OAuth callback tokens through the auth store', async () => {
    const addEventListener = Linking.addEventListener as jest.Mock;
    let callback: ((event: { url: string }) => void) | undefined;
    addEventListener.mockImplementation((_: string, handler: (event: { url: string }) => void) => {
      callback = handler;
      return { remove: jest.fn() };
    });
    mockGetAvailability.mockResolvedValue({ yandex: false, vk: false, mailru: false });
    mockAuthenticate.mockResolvedValue(undefined);
    render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(mockGetAvailability).toHaveBeenCalled());
    callback?.({ url: 'focus://auth/callback?accessToken=access&refreshToken=refresh' });
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' }));
  });

  it('shows a calm cancellation message', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockGetAvailability.mockResolvedValue({ yandex: true, vk: false, mailru: false });
    const screen = render(<AuthProviderSelectScreen />);
    await waitFor(() => expect(screen.getByTestId('oauth-provider-yandex')).toBeTruthy());
    fireEvent.press(screen.getByTestId('oauth-provider-yandex'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Отменено', 'Вход через выбранный сервис был отменён'));
    alertSpy.mockRestore();
  });
});
