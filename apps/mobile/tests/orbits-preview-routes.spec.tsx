import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PlanScreen from '../app/(tabs)/plan';
import ProgressScreen from '../app/(tabs)/progress';
import { OrbitsThemeProvider } from '../theme/orbits';

const mockPush = jest.fn();
const mockRefetch = jest.fn();
let mockInboxState = {
  data: [] as Array<{ id: string; title: string }>,
  isLoading: false,
  isError: false,
};

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../lib/api/tasks', () => ({
  useInboxTasks: () => ({ ...mockInboxState, refetch: mockRefetch }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

function renderPlan() {
  return render(
    <OrbitsThemeProvider theme="warm">
      <PlanScreen />
    </OrbitsThemeProvider>,
  );
}

describe('Orbits Plan destination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInboxState = { data: [], isLoading: false, isError: false };
  });

  it('shows the real empty Thoughts source without fabricating entries', () => {
    renderPlan();

    expect(screen.getByTestId('plan-preview-screen')).toBeTruthy();
    expect(screen.getByText('План')).toBeTruthy();
    expect(screen.getByText('Пока нет мыслей')).toBeTruthy();
  });

  it('shows a truthful Thoughts count and opens the existing inbox', () => {
    mockInboxState.data = [
      { id: 'one', title: 'Первая' },
      { id: 'two', title: 'Вторая' },
    ];
    renderPlan();

    expect(screen.getByText('2 мысли')).toBeTruthy();
    fireEvent.press(screen.getByTestId('plan-thoughts-open'));
    expect(mockPush).toHaveBeenCalledWith('/inbox');
  });

  it('exposes loading without a fabricated count', () => {
    mockInboxState.isLoading = true;
    renderPlan();

    expect(screen.getByText('Загружаем мысли…')).toBeTruthy();
    expect(screen.getByLabelText('Загрузка мыслей')).toBeTruthy();
    expect(screen.queryByText(/\d+ мысл/)).toBeNull();
  });

  it('exposes an actionable error and retries the shared query', () => {
    mockInboxState.isError = true;
    renderPlan();

    expect(screen.getByText('Не удалось загрузить мысли')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Повторить загрузку мыслей'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('Orbits Success destination', () => {
  it('remains a truthful preview without fabricated data', () => {
    render(
      <OrbitsThemeProvider theme="warm">
        <ProgressScreen />
      </OrbitsThemeProvider>,
    );
    expect(screen.getByTestId('progress-preview-screen')).toBeTruthy();
    expect(screen.getByText('Успех')).toBeTruthy();
    expect(screen.getByText('Раздел уже на месте')).toBeTruthy();
    expect(screen.getByText(/честный preview без выдуманных данных/)).toBeTruthy();
  });
});
