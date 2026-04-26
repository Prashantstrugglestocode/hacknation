import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { theme } from '../theme';

export default function FreshnessChip({ generatedAt }: { generatedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sec = Math.max(0, Math.floor((now - generatedAt) / 1000));
  const label =
    sec < 5 ? 'gerade jetzt' :
    sec < 60 ? `vor ${sec} Sek.` :
    sec < 3600 ? `vor ${Math.floor(sec / 60)} Min.` :
    `vor ${Math.floor(sec / 3600)} Std.`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5 }}>
      <MotiView
        from={{ scale: 0.9, opacity: 0.4 }}
        animate={{ scale: 1.5, opacity: 1 }}
        transition={{ type: 'timing', duration: 1100, loop: true }}
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary }}
      />
      <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
        aktualisiert {label}
      </Text>
    </View>
  );
}
