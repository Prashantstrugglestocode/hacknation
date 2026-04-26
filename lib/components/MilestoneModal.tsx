import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

const MILESTONES: Record<number, { emoji: string; title: string; subtitle: string }> = {
  1: { emoji: '🎉', title: 'Erstes Angebot!', subtitle: 'Willkommen bei Stadtpuls.' },
  3: { emoji: '🔥', title: '3-Tage-Streak', subtitle: 'Du bist im Flow.' },
  10: { emoji: '⚡', title: '10 Angebote', subtitle: 'Stammkunde der Stadt.' },
  25: { emoji: '🏆', title: '25 Angebote', subtitle: 'Lokal-Held.' },
  50: { emoji: '💎', title: '50 Angebote', subtitle: 'Teil der Bewegung.' },
  100: { emoji: '👑', title: '100 Angebote', subtitle: 'Stadtpuls Legende.' },
};

export function isMilestone(count: number): boolean {
  return count in MILESTONES;
}

interface Props {
  visible: boolean;
  count: number;
  onClose: () => void;
}

export default function MilestoneModal({ visible, count, onClose }: Props) {
  const m = MILESTONES[count];

  useEffect(() => {
    if (visible && m) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [visible, m]);

  if (!m) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <MotiView
          from={{ scale: 0.7, opacity: 0, rotate: '-8deg' }}
          animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
          transition={{ type: 'spring', damping: 12, stiffness: 220 }}
          style={{ width: width * 0.85, borderRadius: 24, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[theme.primary, theme.primaryDark] as any}
            style={{ padding: 28, alignItems: 'center', gap: 16 }}
          >
            <MotiView
              from={{ scale: 0.5, rotate: '-20deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring', damping: 8, stiffness: 240, delay: 100 }}
            >
              <Text style={{ fontSize: 88 }}>{m.emoji}</Text>
            </MotiView>
            <Text style={{ color: '#FFFFFFCC', fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>
              MEILENSTEIN ERREICHT
            </Text>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' }}>
              {m.title}
            </Text>
            <Text style={{ color: '#FFFFFFDD', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              {m.subtitle}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
                marginTop: 8,
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 15 }}>Weiter</Text>
            </TouchableOpacity>
          </LinearGradient>
        </MotiView>
      </View>
    </Modal>
  );
}
