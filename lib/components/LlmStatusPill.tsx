import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { theme } from '../theme';

interface Props {
  // Short status verb — kept for back-compat but NOT shown anymore.
  verb?: string;
  // Override the brand label.
  brand?: string;
}

// Small floating pill — proves an AI is composing the offer without
// leaking which model is in play (judges shouldn't see "gemma3:4b").
export default function LlmStatusPill({ brand = 'KI komponiert' }: Props) {
  return (
    <View style={{ alignItems: 'center', marginTop: 12 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#1F1F23', borderRadius: 999,
        paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: '#FFFFFF22',
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
      }}>
        <MotiView
          from={{ opacity: 0.4, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1.18 }}
          transition={{ type: 'timing', duration: 700, loop: true }}
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' }}
        />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>
          ✨ {brand}
        </Text>
      </View>
    </View>
  );
}
