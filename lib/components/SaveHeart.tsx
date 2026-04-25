import React, { useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cw_saved_offers_v1';

interface Props {
  offerId: string;
  initiallySaved?: boolean;
  onChange?: (saved: boolean) => void;
}

export async function isSaved(offerId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  return list.includes(offerId);
}

async function toggleSavedStorage(offerId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  const idx = list.indexOf(offerId);
  if (idx >= 0) list.splice(idx, 1); else list.unshift(offerId);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  return idx < 0;
}

export default function SaveHeart({ offerId, initiallySaved = false, onChange }: Props) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pulse, setPulse] = useState(0);

  const onPress = async () => {
    const next = await toggleSavedStorage(offerId);
    setSaved(next);
    setPulse(p => p + 1);
    onChange?.(next);
    Haptics.impactAsync(next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <TouchableOpacity onPress={onPress} hitSlop={12} style={{
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: '#00000044', alignItems: 'center', justifyContent: 'center',
    }}>
      <MotiView
        key={pulse}
        from={{ scale: 1 }}
        animate={{ scale: [1.4, 1] }}
        transition={{ type: 'spring', damping: 10, stiffness: 200 }}
      >
        <Text style={{ fontSize: 20 }}>{saved ? '❤️' : '🤍'}</Text>
      </MotiView>
    </TouchableOpacity>
  );
}
