import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';

interface Props {
  size: number;
  strokeWidth?: number;
  progress: number; // 0..1, 1 = full ring
  warn?: boolean;
}

export default function CountdownRing({ size, strokeWidth = 8, progress, warn = false }: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, progress)));
  const color = warn ? theme.danger : theme.primary;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={theme.bgMuted}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        fill="none"
      />
    </Svg>
  );
}
