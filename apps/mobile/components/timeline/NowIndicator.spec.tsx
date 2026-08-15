import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NowIndicator } from './NowIndicator';
import { TIMELINE_CONFIG } from '../../lib/timeline-config';

describe('NowIndicator profile-local geometry', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-13T11:30:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('positions now at Moscow 14:30', () => {
    render(<NowIndicator profileTimezone="Europe/Moscow" />);
    const line = screen.UNSAFE_getAllByType(require('react-native').View)[0];
    expect(line.props.style[1].top).toBe((14.5 - TIMELINE_CONFIG.dayStartHour) * TIMELINE_CONFIG.hourHeight);
  });

  it('renders nothing when profile-local now is outside the visible range', () => {
    jest.setSystemTime(new Date('2026-08-13T09:30:00.000Z'));
    const { toJSON } = render(<NowIndicator profileTimezone="America/New_York" />);
    expect(toJSON()).toBeNull();
  });
});
