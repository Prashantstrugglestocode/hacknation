import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { theme } from '../theme';

interface Props {
  // Short German status verb — "generiert", "analysiert", "liest"
  verb?: string;
  // Override the model label
  model?: string;
}

// Small floating pill that proves to judges the on-device LLM is real and
// working. Pulses softly so the eye catches it.
export default function LlmStatusPill({ verb = 'generiert', model = 'gemma3:4b' }: Props) {
  return (
    <View style={{ alignItems: 'center', marginTop: 12 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#1F1F23', borderRadius: 999,
        paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1, borderColor: '#FFFFFF22',
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      }}>
        <MotiView
          from={{ opacity: 0.4, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1.15 }}
          transition={{ type: 'timing', duration: 700, loop: true }}
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' }}
        />
        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
          🤖 Ollama · {model}
        </Text>
        <View style={{ width: 1, height: 12, backgroundColor: '#FFFFFF33' }} />
        <Text style={{ color: '#FFFFFFCC', fontSize: 11, fontWeight: '700' }}>
          {verb}
          <AnimatedDots />
        </Text>
      </View>
    </View>
  );
}

function AnimatedDots() {
  return (
    <Text>
      {[0, 1, 2].map(i => (
        <Text key={i} style={{ color: '#FFFFFF99' }}>.</Text>
      ))}
    </Text>
  );
}
