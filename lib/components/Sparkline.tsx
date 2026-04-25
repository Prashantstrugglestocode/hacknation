import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { theme } from '../theme';

interface Props {
  values: number[];
  width?: number;
  height?: number;
}

// Simple SVG sparkline. Values can be any range; auto-normalized.
export default function Sparkline({ values, width = 220, height = 50 }: Props) {
  if (!values.length) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const stepX = width / (values.length - 1 || 1);

  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * (height - 8) - 4,
  }));

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const lastIdx = points.length - 1;

  return (
    <Svg width={width} height={height}>
      {/* Baseline */}
      <Line x1={0} y1={height - 4} x2={width} y2={height - 4} stroke={theme.border} strokeWidth={1} strokeDasharray="2,3" />
      <Path d={path} stroke={theme.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={points[lastIdx].x} cy={points[lastIdx].y} r={4} fill={theme.primary} />
      <Circle cx={points[lastIdx].x} cy={points[lastIdx].y} r={2} fill="#FFFFFF" />
    </Svg>
  );
}
