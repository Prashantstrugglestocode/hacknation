import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

export default function CountdownChip({ generatedAt, validityMinutes }: { generatedAt: number, validityMinutes: number }) {
  const [remainingMinutes, setRemainingMinutes] = useState(validityMinutes);

  useEffect(() => {
    let lastHapticMinute = -1;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - generatedAt;
      const ttlMs = validityMinutes * 60 * 1000;
      const remainingMs = ttlMs - elapsedMs;
      
      const mins = Math.max(0, Math.ceil(remainingMs / 60000));
      setRemainingMinutes(mins);

      // Haptic feedback at 5-min and 1-min milestones
      if (mins === 5 && lastHapticMinute !== 5) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        lastHapticMinute = 5;
      } else if (mins === 1 && lastHapticMinute !== 1) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        lastHapticMinute = 1;
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [generatedAt, validityMinutes]);

  let color = theme.textMuted;
  let bgColor = theme.bgMuted;
  
  if (remainingMinutes <= 2) {
    color = theme.danger;
    bgColor = theme.danger + '22';
  } else if (remainingMinutes <= 5) {
    color = '#F59E0B'; // Amber
    bgColor = '#F59E0B22';
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: bgColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    }}>
      <Text style={{ fontSize: 12 }}>⏱</Text>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>
        {remainingMinutes} Min. übrig
      </Text>
    </View>
  );
}
