import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { theme } from '../../lib/theme';
import i18n from '../../lib/i18n';

const API = Constants.expoConfig?.extra?.apiUrl as string;

export default function RulesScreen() {
  // i18n.t evaluated inside the component (not at module load) so translations are ready
  const GOALS = [
    { id: 'fill_quiet_hours' as const, label: i18n.t('merchant.goal_fill_quiet'), emoji: '☕' },
    { id: 'move_slow_stock' as const, label: i18n.t('merchant.goal_move_stock'), emoji: '📦' },
    { id: 'build_loyalty' as const, label: i18n.t('merchant.goal_loyalty'), emoji: '❤️' },
  ];

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [goal, setGoal] = useState<'fill_quiet_hours' | 'move_slow_stock' | 'build_loyalty'>('fill_quiet_hours');
  const [maxDiscount, setMaxDiscount] = useState(15);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('merchant_id');
      if (!id) { setLoaded(true); return; }
      setMerchantId(id);
      try {
        const res = await fetch(`${API}/api/merchant/${id}`);
        if (res.ok) {
          const m = await res.json();
          setGoal(m.goal ?? 'fill_quiet_hours');
          setMaxDiscount(m.max_discount_pct ?? 15);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const handleSave = async () => {
    if (!merchantId) {
      Alert.alert('Fehler', 'Kein Geschäft eingerichtet. Bitte erst „Demo-Café" erstellen oder Einrichtung abschließen.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/merchant/${merchantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, max_discount_pct: maxDiscount }),
      });
      if (res.ok) {
        Alert.alert('Gespeichert', 'Regeln aktualisiert.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.error ?? 'Konnte nicht gespeichert werden.');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Netzwerkfehler.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  if (!merchantId) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ fontSize: 56 }}>⚙️</Text>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
          Erst Geschäft einrichten
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
          Regeln können erst gespeichert werden, wenn ein Geschäft existiert.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(merchant)/setup')}
          style={{ backgroundColor: theme.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '800' }}>Zur Einrichtung</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>Schließen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22, gap: 22, paddingBottom: 40 }}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>← Zurück</Text>
      </TouchableOpacity>

      <View>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>EINSTELLUNGEN</Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>
          {i18n.t('merchant.rules_title')}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>ZIEL</Text>
        {GOALS.map(g => {
          const active = goal === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => setGoal(g.id)}
              style={{
                backgroundColor: active ? theme.primaryWash : theme.surface,
                borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
                borderWidth: 2, borderColor: active ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
              <Text style={{ color: active ? theme.primaryDark : theme.text, fontWeight: '800', fontSize: 15 }}>
                {g.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
          MAX. RABATT — <Text style={{ color: theme.primary }}>{maxDiscount} %</Text>
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[5, 10, 15, 20, 25, 30].map(v => {
            const active = maxDiscount === v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => setMaxDiscount(v)}
                style={{
                  flex: 1,
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderRadius: 11, paddingVertical: 11, alignItems: 'center',
                  borderWidth: 1, borderColor: active ? theme.primary : theme.border,
                }}
              >
                <Text style={{ color: active ? theme.textOnPrimary : theme.text, fontWeight: active ? '800' : '600', fontSize: 13 }}>
                  {v} %
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={{
          backgroundColor: saving ? theme.primaryWash : theme.primary,
          borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 8,
          shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Text style={{ color: theme.textOnPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>
          {saving ? 'Wird gespeichert…' : i18n.t('merchant.save_rules')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
