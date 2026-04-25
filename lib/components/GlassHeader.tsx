import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { SavingsStats } from '../savings';
import { theme } from '../theme';

interface Props {
  stats: SavingsStats;
}

function formatEur(eur: number): string {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export default function GlassHeader({ stats }: Props) {
  const showStreak = stats.count_this_week > 0;
  return (
    <View style={{
      borderRadius: 18, overflow: 'hidden', marginBottom: 14,
      borderWidth: 1, borderColor: theme.border,
      backgroundColor: theme.surface,
    }}>
      <BlurView intensity={30} tint="light" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>
              CITY WALLET
            </Text>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 }}>
              {formatEur(stats.total_eur)}{' '}
              <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600' }}>gespart</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {showStreak && (
              <MotiView
                from={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14 }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: theme.primary, borderRadius: 999,
                  paddingHorizontal: 11, paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 13 }}>🔥</Text>
                <Text style={{ color: theme.textOnPrimary, fontSize: 13, fontWeight: '800' }}>
                  {stats.count_this_week}
                </Text>
              </MotiView>
            )}
            <TouchableOpacity
              onPress={() => router.push('/(customer)/saved')}
              hitSlop={10}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.primaryWash,
                borderWidth: 1, borderColor: theme.primary + '44',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16 }}>❤️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace('/role')}
              hitSlop={10}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14 }}>↺</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </View>
  );
}
