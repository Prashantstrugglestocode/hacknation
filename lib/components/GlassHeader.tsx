import React from 'react';
import { View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { SavingsStats } from '../savings';

interface Props {
  stats: SavingsStats;
}

function formatEur(eur: number): string {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export default function GlassHeader({ stats }: Props) {
  const showStreak = stats.count_this_week > 0;
  return (
    <View style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 14 }}>
      <BlurView intensity={40} tint="dark" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#ffffff66', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>
              CITY WALLET
            </Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 }}>
              {formatEur(stats.total_eur)} <Text style={{ color: '#ffffff44', fontSize: 13, fontWeight: '600' }}>gespart</Text>
            </Text>
          </View>
          {showStreak && (
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#FF7A45', borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 13 }}>🔥</Text>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                {stats.count_this_week}
              </Text>
            </MotiView>
          )}
        </View>
      </BlurView>
    </View>
  );
}
