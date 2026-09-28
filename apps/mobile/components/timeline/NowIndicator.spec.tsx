import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NowIndicator } from './NowIndicator';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';

describe('NowIndicator profile-local geometry', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-13T11:30:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('positions now at Moscow 14:30', () => {
    render(<NowIndicator profileTimezone="Europe/Moscow" timeFormat="H24" />);
    const beacon = screen.getByTestId('timeline-now-indicator');
    const style = require('react-native').StyleSheet.flatten(beacon.props.style);
    expect(style.top).toBe((14.5 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight);
    expect(beacon.props.accessibilityLabel).toBe('Сейчас 14:30');
    expect(screen.getByText('14:30')).toBeTruthy();
  });

  it('renders nothing when profile-local now is outside the visible range', () => {
    jest.setSystemTime(new Date('2026-08-13T09:30:00.000Z'));
    const { toJSON } = render(<NowIndicator profileTimezone="America/New_York" />);
    expect(toJSON()).toBeNull();
  });

  it('keeps the marker circle completely inside the gutter and never draws a card-crossing line', () => {
    render(<NowIndicator profileTimezone="Europe/Moscow" timeFormat="H12" gutterWidth={82} />);
    const orbit = require('react-native').StyleSheet.flatten(screen.getByTestId('timeline-now-orbit').props.style);
    expect(orbit.left + orbit.width).toBeLessThanOrEqual(82);
    expect(screen.getByTestId('timeline-now-indicator').props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#EF4444' })]),
    );
  });
});
