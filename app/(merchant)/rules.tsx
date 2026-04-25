import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;

const GOALS = [
  { id: 'fill_quiet_hours', label: i18n.t('merchant.goal_fill_quiet'), emoji: '☕' },
  { id: 'move_slow_stock', label: i18n.t('merchant.goal_move_stock'), emoji: '📦' },
  { id: 'build_loyalty', label: i18n.t('merchant.goal_loyalty'), emoji: '❤️' },
] as const;

export default function RulesScreen() {
  const [goal, setGoal] = useState<'fill_quiet_hours' | 'move_slow_stock' | 'build_loyalty'>('fill_quiet_hours');
  const [maxDiscount, setMaxDiscount] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('merchant_id');
      if (!id) return;
      const res = await fetch(`${API}/api/merchant/${id}`);
      if (res.ok) {
        const m = await res.json();
        setGoal(m.goal ?? 'fill_quiet_hours');
        setMaxDiscount(m.max_discount_pct ?? 15);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = await AsyncStorage.getItem('merchant_id');
      if (!id) return;
      const res = await fetch(`${API}/api/merchant/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, max_discount_pct: maxDiscount }),
      });
      if (res.ok) router.back();
      else Alert.alert('Fehler', 'Konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0A0A0F' }} contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 40 }}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: '#6C63FF', fontSize: 15, marginBottom: 8 }}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>
        {i18n.t('merchant.rules_title')}
      </Text>

      {/* Goal */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          ZIEL
        </Text>
        {GOALS.map(g => (
          <TouchableOpacity
            key={g.id}
            onPress={() => setGoal(g.id)}
            style={{
              backgroundColor: goal === g.id ? '#6C63FF22' : '#1A1A2E',
              borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
              borderWidth: 2, borderColor: goal === g.id ? '#6C63FF' : 'transparent'
            }}
          >
            <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Max discount */}
      <View style={{ gap: 10 }}>
        <Text style={{ color: '#ffffff99', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          MAX. RABATT — {maxDiscount} %
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[5, 10, 15, 20, 25, 30].map(v => (
            <TouchableOpacity
              key={v}
              onPress={() => setMaxDiscount(v)}
              style={{
                flex: 1,
                backgroundColor: maxDiscount === v ? '#6C63FF' : '#1A1A2E',
                borderRadius: 10, paddingVertical: 10, alignItems: 'center'
              }}
            >
              <Text style={{ color: '#fff', fontWeight: maxDiscount === v ? '700' : '400', fontSize: 13 }}>
                {v} %
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={{
          backgroundColor: saving ? '#6C63FF88' : '#6C63FF',
          borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 12
        }}
      >
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
          {saving ? 'Wird gespeichert…' : i18n.t('merchant.save_rules')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
