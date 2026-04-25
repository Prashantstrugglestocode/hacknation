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

// Hero-shaped skeleton — matches the layout shape so judges feel the card forming
export default function ShimmerCard() {
  return (
    <View style={{
      flex: 1, minHeight: 480, borderRadius: 22, overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1, borderColor: theme.border,
    }}>
      {/* Gradient hero zone (60%) — chip row + big headline */}
      <View style={{ height: '60%', padding: 22, justifyContent: 'flex-end', backgroundColor: theme.primaryWash }}>
        {/* Heart top-right */}
        <View style={{ position: 'absolute', top: 14, right: 14 }}>
          <ShimmerBlock height={36} width={36} style={{ borderRadius: 18 }} />
        </View>

        {/* Signal chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <ShimmerBlock height={22} width={64} style={{ borderRadius: 11 }} />
          <ShimmerBlock height={22} width={56} style={{ borderRadius: 11 }} />
          <ShimmerBlock height={22} width={84} style={{ borderRadius: 11 }} />
        </View>
        {/* Headline two lines */}
        <ShimmerBlock height={28} width="80%" style={{ marginBottom: 6 }} />
        <ShimmerBlock height={28} width="60%" />
      </View>

      {/* Bottom zone (40%) — subline, discount, distance, CTA */}
      <View style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
        <View style={{ gap: 8 }}>
          <ShimmerBlock height={15} width="95%" />
          <ShimmerBlock height={15} width="78%" />
          <View style={{ height: 4 }} />
          <ShimmerBlock height={20} width="55%" />
          <ShimmerBlock height={13} width="40%" />
        </View>
        <View style={{ gap: 10 }}>
          <ShimmerBlock height={54} width="100%" style={{ borderRadius: 16 }} />
          <View style={{ alignSelf: 'center' }}>
            <ShimmerBlock height={13} width={88} style={{ borderRadius: 6 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
