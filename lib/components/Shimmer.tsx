import React from 'react';
import { View, ViewStyle, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

interface BlockProps {
  height: number;
  width?: number | string;
  style?: ViewStyle;
}

export function ShimmerBlock({ height, width: w = '100%', style }: BlockProps) {
  return (
    <View style={[{
      height, width: w as any,
      backgroundColor: theme.bgMuted,
      borderRadius: 8, overflow: 'hidden',
    }, style]}>
      <MotiView
        from={{ translateX: -width }}
        animate={{ translateX: width }}
        transition={{ type: 'timing', duration: 1400, loop: true }}
        style={{
          position: 'absolute', top: 0, bottom: 0, width: 140,
          backgroundColor: theme.surfaceAlt,
          opacity: 0.7,
        }}
      />
    </View>
  );
}

export default function ShimmerCard() {
  return (
    <View style={{
      flex: 1, minHeight: 400, borderRadius: 22, overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1, borderColor: theme.border,
    }}>
      <ShimmerBlock height={260} width="100%" style={{ borderRadius: 0 }} />
      <View style={{ padding: 22, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ShimmerBlock height={22} width={56} style={{ borderRadius: 11 }} />
          <ShimmerBlock height={22} width={72} style={{ borderRadius: 11 }} />
          <ShimmerBlock height={22} width={48} style={{ borderRadius: 11 }} />
        </View>
        <ShimmerBlock height={28} width="80%" />
        <ShimmerBlock height={16} width="95%" />
        <ShimmerBlock height={16} width="60%" />
        <View style={{ height: 12 }} />
        <ShimmerBlock height={54} width="100%" style={{ borderRadius: 16 }} />
      </View>
    </View>
  );
}
