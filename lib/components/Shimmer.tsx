import React from 'react';
import { View, ViewStyle, Dimensions } from 'react-native';
import { MotiView } from 'moti';

const { width } = Dimensions.get('window');

interface BlockProps {
  height: number;
  width?: number | string;
  style?: ViewStyle;
}

export function ShimmerBlock({ height, width: w = '100%', style }: BlockProps) {
  return (
    <View style={[{ height, width: w as any, backgroundColor: '#1A1A2E', borderRadius: 8, overflow: 'hidden' }, style]}>
      <MotiView
        from={{ translateX: -width }}
        animate={{ translateX: width }}
        transition={{ type: 'timing', duration: 1400, loop: true }}
        style={{
          position: 'absolute', top: 0, bottom: 0, width: 140,
          backgroundColor: '#2A2A3E',
          opacity: 0.6,
        }}
      />
    </View>
  );
}

export default function ShimmerCard() {
  return (
    <View style={{ flex: 1, minHeight: 400, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0F0F1A' }}>
      <ShimmerBlock height={260} width="100%" style={{ borderRadius: 0 }} />
      <View style={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ShimmerBlock height={20} width={56} style={{ borderRadius: 10 }} />
          <ShimmerBlock height={20} width={72} style={{ borderRadius: 10 }} />
          <ShimmerBlock height={20} width={48} style={{ borderRadius: 10 }} />
        </View>
        <ShimmerBlock height={26} width="80%" />
        <ShimmerBlock height={16} width="95%" />
        <ShimmerBlock height={16} width="60%" />
        <View style={{ height: 12 }} />
        <ShimmerBlock height={52} width="100%" style={{ borderRadius: 14 }} />
      </View>
    </View>
  );
}
