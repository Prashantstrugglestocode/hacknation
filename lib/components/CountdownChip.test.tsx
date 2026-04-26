import React from 'react';
import { render, act } from '@testing-library/react-native';
import CountdownChip from './CountdownChip';

describe('CountdownChip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render correctly with initial time', () => {
    const generatedAt = Date.now();
    const { getByText } = render(<CountdownChip generatedAt={generatedAt} validityMinutes={15} />);
    
    expect(getByText('15 Min. übrig')).toBeTruthy();
  });

  it('should display 0 when expired', () => {
    const generatedAt = Date.now() - (20 * 60 * 1000); // 20 minutes ago
    const { getByText } = render(<CountdownChip generatedAt={generatedAt} validityMinutes={15} />);
    
    // Component uses setInterval which runs after 10s, advance timer
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    
    // The component uses Math.max(0, ...), so it should not be negative
    expect(getByText('0 Min. übrig')).toBeTruthy();
  });
});
