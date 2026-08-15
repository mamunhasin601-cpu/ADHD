import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
const mockRequest = jest.fn();
const mockDefer = jest.fn();
let mockBusy = false;
jest.mock('../lib/notification-lifecycle', () => ({ useNotificationLifecycle: () => ({ busy: mockBusy, error: null, requestPermission: mockRequest, deferInvitation: mockDefer }) }));
import { NotificationInvitation } from './NotificationInvitation';

beforeEach(() => { jest.clearAllMocks(); mockBusy = false; });
it('uses the calm product copy and does nothing before an explicit action', () => {
  render(<NotificationInvitation />);
  expect(screen.getByText('Хотите получать напоминания?')).toBeTruthy();
  expect(screen.getByText(/Focus сможет напомнить/)).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});
it('offers explicit enable and distinct deferral actions', () => {
  render(<NotificationInvitation />);
  fireEvent.press(screen.getByText('Включить напоминания'));
  expect(mockRequest).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Не сейчас'));
  expect(mockDefer).toHaveBeenCalledTimes(1);
});
it('exposes disabled and busy accessibility state while pending', () => {
  mockBusy = true;
  render(<NotificationInvitation />);
  expect(screen.getByRole('button', { name: 'Включить напоминания' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
});
